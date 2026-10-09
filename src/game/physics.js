import { LOBBIES, STAGES } from '../shared/course'
import { boulderState, dynBox, floodState, METEOR_HIT, meteorPhase, moverOffset, pendAngle, pendHead, sweepAngle, windActive } from './dynamics'

/**
 * Kinematic character controller against axis-aligned boxes and vertical cylinders.
 *
 * Why not a physics engine: every surface in the game is an AABB or a cylinder, and the
 * gameplay needs exact, predictable behaviour (Roblox-style step-up, coyote time,
 * riding moving platforms, sinking stones, knock-backs). A small custom solver does all
 * of that deterministically and costs almost nothing per frame.
 */

export const PLAYER_R = 0.42
export const PLAYER_H = 2.3
export const GRAVITY = 42
export const JUMP_V = 13
const STEP_UP = 0.56
const CELL = 8
const EPS = 1e-4
const R = PLAYER_R
const H = PLAYER_H

/* ------------------------------------------------------------------ */
/* Static collision world (built once)                                  */
/* ------------------------------------------------------------------ */

const grid = new Map()
let built = false
let stamp = 1
/** stage number -> its dynamic objects */
export const stageDyn = new Map()

const key = (ix, iz) => ix * 100003 + iz

function addItem(it) {
  const x0 = Math.floor(it.minX / CELL)
  const x1 = Math.floor(it.maxX / CELL)
  const z0 = Math.floor(it.minZ / CELL)
  const z1 = Math.floor(it.maxZ / CELL)
  it.stamp = 0
  for (let ix = x0; ix <= x1; ix += 1) {
    for (let iz = z0; iz <= z1; iz += 1) {
      const k = key(ix, iz)
      let cell = grid.get(k)
      if (!cell) grid.set(k, (cell = []))
      cell.push(it)
    }
  }
}

function boxItem(b) {
  return {
    type: 'box',
    minX: b.x - b.w / 2,
    maxX: b.x + b.w / 2,
    minY: b.y - b.h / 2,
    maxY: b.y + b.h / 2,
    minZ: b.z - b.d / 2,
    maxZ: b.z + b.d / 2,
    k: b.k,
    cv: b.cv || null,
    power: b.power || 0,
    req: b.req || 0,
    // Visible, sizeable walls block the camera (not invisible bounds or thin decor).
    cam: b.m !== 'invisible' && b.k !== 'gate' && b.h > 3,
  }
}

function cylItem(c) {
  return {
    type: 'cyl',
    cx: c.x,
    cz: c.z,
    r: c.r,
    top: c.top,
    bottom: c.top - c.h,
    minX: c.x - c.r,
    maxX: c.x + c.r,
    minZ: c.z - c.r,
    maxZ: c.z + c.r,
    k: c.k,
    power: c.power || 0,
  }
}

export function buildCollision() {
  if (built) return
  built = true
  for (const L of [LOBBIES[1], LOBBIES[2]]) {
    for (const b of L.boxes) if (b.k !== 'deco') addItem(boxItem(b))
    for (const t of L.trees) {
      if (t.solid) addItem(cylItem({ x: t.x, z: t.z, r: 0.55 * t.s, top: t.y + 3.4 * t.s, h: 3.4 * t.s, k: 'solid' }))
    }
  }
  for (let n = 1; n < STAGES.length; n += 1) {
    const S = STAGES[n]
    for (const b of S.boxes) if (b.k !== 'deco') addItem(boxItem(b))
    for (const c of S.cyls) if (c.k !== 'deco') addItem(cylItem(c))
    stageDyn.set(n, S.dyn)
  }
}

/**
 * Camera collision: how far (0..maxDist) a ray from (ox,oy,oz) along unit (dx,dy,dz) gets
 * before it hits a tall static wall. Keeps the camera from ending up behind a stage wall.
 */
const _cam = []
export function cameraClip(ox, oy, oz, dx, dy, dz, maxDist) {
  _cam.length = 0
  const ex = ox + dx * maxDist
  const ez = oz + dz * maxDist
  query(Math.min(ox, ex), Math.max(ox, ex), Math.min(oz, ez), Math.max(oz, ez), _cam, _cam)
  let best = maxDist
  for (const b of _cam) {
    if (b.type !== 'box' || !b.cam) continue
    // Slab test.
    let t0 = 0
    let t1 = best
    let hit = true
    for (const [o, d, lo, hi] of [[ox, dx, b.minX, b.maxX], [oy, dy, b.minY, b.maxY], [oz, dz, b.minZ, b.maxZ]]) {
      if (Math.abs(d) < 1e-6) {
        if (o < lo || o > hi) hit = false
        continue
      }
      let a = (lo - o) / d
      let c = (hi - o) / d
      if (a > c) [a, c] = [c, a]
      t0 = Math.max(t0, a)
      t1 = Math.min(t1, c)
      if (t0 > t1) hit = false
    }
    // Ignore boxes the ray starts inside (e.g. standing in a doorway).
    if (hit && t0 > 0.05) best = Math.min(best, t0)
  }
  return best
}

function query(minX, maxX, minZ, maxZ, solids, kills, level = 1) {
  stamp += 1
  const x0 = Math.floor(minX / CELL)
  const x1 = Math.floor(maxX / CELL)
  const z0 = Math.floor(minZ / CELL)
  const z1 = Math.floor(maxZ / CELL)
  for (let ix = x0; ix <= x1; ix += 1) {
    for (let iz = z0; iz <= z1; iz += 1) {
      const cell = grid.get(key(ix, iz))
      if (!cell) continue
      for (const it of cell) {
        if (it.stamp === stamp) continue
        it.stamp = stamp
        if (it.maxX < minX || it.minX > maxX || it.maxZ < minZ || it.minZ > maxZ) continue
        if (it.k === 'kill') kills.push(it)
        // Stage-gate force fields only stop players below the required level.
        else if (it.k === 'gate' && level >= it.req) continue
        else solids.push(it)
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    yaw: spawn.yaw ?? Math.PI,
    vx: 0,
    vy: 0,
    vz: 0,
    kx: 0,
    kz: 0,
    ex: 0,
    ez: 0,
    grounded: false,
    ground: null,
    coyote: 0,
    jumpBuf: 0,
    stun: 0,
    knockCd: 0,
    airTime: 0,
  }
}

export function placePlayer(pl, pos) {
  pl.x = pos.x
  pl.y = pos.y
  pl.z = pos.z
  if (pos.yaw !== undefined) pl.yaw = pos.yaw
  pl.vx = pl.vy = pl.vz = pl.kx = pl.kz = 0
  pl.ground = null
  pl.grounded = false
  pl.stun = 0
}

const overlapBox = (pl, b, shrink = 0) =>
  b.minX < pl.x + R - shrink && b.maxX > pl.x - R + shrink && b.minZ < pl.z + R - shrink && b.maxZ > pl.z - R + shrink && b.minY < pl.y + H && b.maxY > pl.y + 0.002

const horizOverlap = (pl, b) => b.minX < pl.x + R && b.maxX > pl.x - R && b.minZ < pl.z + R && b.maxZ > pl.z - R

function headClear(pl, y, solids, self) {
  for (const s of solids) {
    if (s === self || s.type !== 'box') continue
    if (s.minX < pl.x + R && s.maxX > pl.x - R && s.minZ < pl.z + R && s.maxZ > pl.z - R && s.minY < y + H && s.maxY > y + 0.002) return false
  }
  return true
}

function resolveAxis(pl, solids, axis, delta) {
  for (const s of solids) {
    if (s.type !== 'box' || !overlapBox(pl, s)) continue
    const rise = s.maxY - pl.y
    if (rise > 0 && rise <= STEP_UP && (pl.grounded || pl.coyote > 0) && pl.vy <= 0.5 && headClear(pl, s.maxY, solids, s)) {
      pl.y = s.maxY
      continue
    }
    if (axis === 0) {
      const pushLeft = pl.x + R - s.minX
      const pushRight = s.maxX - (pl.x - R)
      const left = delta > 0 && pushLeft <= delta + 0.05 ? true : delta < 0 && pushRight <= -delta + 0.05 ? false : pushLeft < pushRight
      pl.x = left ? s.minX - R - EPS : s.maxX + R + EPS
      if ((left && pl.vx > 0) || (!left && pl.vx < 0)) pl.vx = 0
      if ((left && pl.kx > 0) || (!left && pl.kx < 0)) pl.kx = 0
    } else {
      const pushBack = pl.z + R - s.minZ
      const pushFwd = s.maxZ - (pl.z - R)
      const back = delta > 0 && pushBack <= delta + 0.05 ? true : delta < 0 && pushFwd <= -delta + 0.05 ? false : pushBack < pushFwd
      pl.z = back ? s.minZ - R - EPS : s.maxZ + R + EPS
      if ((back && pl.vz > 0) || (!back && pl.vz < 0)) pl.vz = 0
      if ((back && pl.kz > 0) || (!back && pl.kz < 0)) pl.kz = 0
    }
  }
}

function resolveCylinders(pl, solids) {
  const rr = R * 0.85
  for (const c of solids) {
    if (c.type !== 'cyl') continue
    if (!(c.bottom < pl.y + H && c.top > pl.y + 0.002)) continue
    const dx = pl.x - c.cx
    const dz = pl.z - c.cz
    const dist = Math.hypot(dx, dz)
    if (dist >= c.r + rr) continue
    const rise = c.top - pl.y
    if (rise > 0 && rise <= STEP_UP && (pl.grounded || pl.coyote > 0) && pl.vy <= 0.5) {
      pl.y = c.top
      continue
    }
    const nx = dist > 1e-4 ? dx / dist : 1
    const nz = dist > 1e-4 ? dz / dist : 0
    pl.x = c.cx + nx * (c.r + rr + EPS)
    pl.z = c.cz + nz * (c.r + rr + EPS)
  }
}

function resolveVertical(pl, solids, yPrev) {
  if (pl.vy <= 0) {
    let best = null
    let bestY = -Infinity
    for (const s of solids) {
      let top
      if (s.type === 'box') {
        if (!horizOverlap(pl, s)) continue
        top = s.maxY
      } else {
        if (Math.hypot(pl.x - s.cx, pl.z - s.cz) > s.r + R * 0.35) continue
        top = s.top
      }
      if (top <= yPrev + 0.03 && top >= pl.y - 0.001 && top > bestY) {
        bestY = top
        best = s
      }
    }
    if (best) {
      pl.y = bestY
      pl.vy = 0
      return best
    }
    return null
  }
  for (const s of solids) {
    if (s.type !== 'box' || !horizOverlap(pl, s)) continue
    if (s.minY >= yPrev + H - 0.03 && s.minY <= pl.y + H) {
      pl.y = s.minY - H
      pl.vy = 0
    }
  }
  return null
}

const approach = (v, target, max) => (v < target ? Math.min(target, v + max) : Math.max(target, v - max))

function knock(pl, dx, dz, strength, up, events) {
  if (pl.knockCd > 0) return
  const len = Math.hypot(dx, dz) || 1
  pl.kx = (dx / len) * strength
  pl.kz = (dz / len) * strength
  pl.vy = Math.max(pl.vy, up)
  pl.vx *= 0.2
  pl.vz *= 0.2
  pl.stun = 0.4
  pl.knockCd = 0.7
  pl.grounded = false
  pl.ground = null
  events.push({ type: 'bonk' })
}

const _solids = []
const _kills = []

/**
 * Advances the player by `dt`.
 * @param ctl { dirX, dirZ, speed, jump (held) }
 * @param env { T, Tprev, now, sinks: Map, dyn: object[], killY }
 * @returns events: { type: 'jump'|'land'|'bounce'|'bonk'|'kill'|'sink', ... }[]
 */
export function stepPlayer(pl, ctl, dt, env) {
  const events = []
  dt = Math.min(dt, 0.05)

  // Ride whatever we're standing on (movers translate, disks rotate).
  const g = pl.ground
  if (g?.dyn) {
    const d = g.dyn
    if (d.t === 'move') {
      const a = moverOffset(d, env.Tprev)
      const b = moverOffset(d, env.T)
      pl.x += b[0] - a[0]
      pl.y += b[1] - a[1]
      pl.z += b[2] - a[2]
    } else if (d.t === 'disk') {
      const ang = d.spd * (env.T - env.Tprev)
      const dx = pl.x - d.x
      const dz = pl.z - d.z
      const c = Math.cos(ang)
      const s = Math.sin(ang)
      pl.x = d.x + dx * c - dz * s
      pl.z = d.z + dx * s + dz * c
      pl.yaw -= ang
    }
  }

  // External pushes: conveyors underfoot, wind gusts, knock-back.
  pl.ex = g?.cv ? g.cv[0] : 0
  pl.ez = g?.cv ? g.cv[1] : 0
  for (const d of env.dyn) {
    if (d.t !== 'wind' || !windActive(d, env.T)) continue
    if (Math.abs(pl.x - d.x) < d.w / 2 && Math.abs(pl.z - d.z) < d.d / 2 && pl.y > d.y0 && pl.y < d.y1) {
      pl.ex += d.vx
      pl.ez += d.vz
    }
  }
  const kDecay = Math.exp(-2.6 * dt)
  pl.kx *= kDecay
  pl.kz *= kDecay
  if (Math.abs(pl.kx) + Math.abs(pl.kz) < 0.3) pl.kx = pl.kz = 0
  pl.stun = Math.max(0, pl.stun - dt)
  pl.knockCd = Math.max(0, pl.knockCd - dt)

  // Steering.
  const accel = pl.grounded ? 130 : 75
  const tx = pl.stun > 0 ? 0 : ctl.dirX * ctl.speed
  const tz = pl.stun > 0 ? 0 : ctl.dirZ * ctl.speed
  pl.vx = approach(pl.vx, tx, accel * dt)
  pl.vz = approach(pl.vz, tz, accel * dt)

  // Jump (buffered; holding Space keeps hopping like Roblox).
  if (ctl.jump) pl.jumpBuf = 0.12
  else pl.jumpBuf = Math.max(0, pl.jumpBuf - dt)
  if (pl.jumpBuf > 0 && (pl.grounded || pl.coyote > 0) && pl.stun <= 0) {
    pl.vy = JUMP_V
    pl.grounded = false
    pl.ground = null
    pl.coyote = 0
    pl.jumpBuf = 0
    events.push({ type: 'jump' })
  }

  const hx = pl.vx + pl.kx + pl.ex
  const hz = pl.vz + pl.kz + pl.ez
  const travel = Math.max(Math.abs(hx), Math.abs(hz), Math.abs(pl.vy)) * dt
  const sub = Math.min(10, Math.max(1, Math.ceil(travel / 0.25)))
  const h = dt / sub
  const wasGrounded = pl.grounded
  const impact = pl.vy

  _solids.length = 0
  _kills.length = 0
  const pad = travel + 2
  query(pl.x - R - pad, pl.x + R + pad, pl.z - R - pad, pl.z + R + pad, _solids, _kills, env.level || 1)
  const now = env.now
  for (const d of env.dyn) {
    if (d.t === 'move' || d.t === 'blink' || d.t === 'sink') {
      const b = dynBox(d, env.T, env.sinks, now)
      if (!b) continue
      if (b.maxX < pl.x - R - pad || b.minX > pl.x + R + pad || b.maxZ < pl.z - R - pad || b.minZ > pl.z + R + pad) continue
      b.type = 'box'
      b.dyn = d
      if (d.k === 'kill') {
        b.k = 'kill'
        b.floor = !!d.floorLaser
        _kills.push(b)
      } else {
        b.k = 'solid'
        _solids.push(b)
      }
    } else if (d.t === 'disk') {
      if (Math.abs(pl.x - d.x) > d.r + pad || Math.abs(pl.z - d.z) > d.r + pad) continue
      _solids.push({ type: 'cyl', cx: d.x, cz: d.z, r: d.r, top: d.top, bottom: d.top - d.h, k: 'solid', dyn: d })
    }
  }

  let landedOn = null
  for (let i = 0; i < sub; i += 1) {
    pl.vy = Math.max(-60, pl.vy - GRAVITY * h)
    const dx = hx * h
    pl.x += dx
    resolveAxis(pl, _solids, 0, dx)
    const dz = hz * h
    pl.z += dz
    resolveAxis(pl, _solids, 2, dz)
    resolveCylinders(pl, _solids)
    const yPrev = pl.y
    pl.y += pl.vy * h
    landedOn = resolveVertical(pl, _solids, yPrev)
    pl.grounded = !!landedOn
    if (landedOn) pl.coyote = 0.13
  }
  if (!pl.grounded) pl.coyote = Math.max(0, pl.coyote - dt)
  pl.ground = landedOn
  pl.airTime = pl.grounded ? 0 : pl.airTime + dt

  if (landedOn) {
    if (landedOn.k === 'bounce') {
      pl.vy = landedOn.power || 20
      pl.grounded = false
      pl.ground = null
      events.push({ type: 'bounce' })
    } else if (!wasGrounded) {
      events.push({ type: 'land', speed: -impact })
    }
    const d = landedOn.dyn
    if (d?.t === 'sink' && !env.sinks.has(d.id)) {
      env.sinks.set(d.id, { t0: now })
      events.push({ type: 'sink' })
    }
  }

  // ---- Hazards ------------------------------------------------------
  for (const k of _kills) {
    if (overlapBox(pl, k, k.floor ? 0.12 : 0.05)) {
      events.push({ type: 'kill', cause: 'zap' })
      return events
    }
  }
  const midY = pl.y + H / 2
  for (const d of env.dyn) {
    if (d.t === 'flood') {
      if (Math.abs(pl.x - d.x) <= d.w / 2 + R && Math.abs(pl.z - d.z) <= d.d / 2 + R && pl.y < floodState(d, env.T).y - 0.025) {
        events.push({ type: 'kill', cause: 'burn' })
        return events
      }
    } else if (d.t === 'sweep') {
      if (pl.y > d.y + d.r || pl.y + H < d.y - d.r) continue
      const a = sweepAngle(d, env.T)
      const ux = Math.cos(a)
      const uz = Math.sin(a)
      const px = pl.x - d.x
      const pz = pl.z - d.z
      const t = Math.max(-d.len, Math.min(d.len, px * ux + pz * uz))
      const cx = px - ux * t
      const cz = pz - uz * t
      if (Math.hypot(cx, cz) > d.r + R) continue
      if (d.kill) {
        events.push({ type: 'kill', cause: d.fire ? 'burn' : 'zap' })
        return events
      }
      // Knock along the bar's direction of travel, plus outward.
      const sgn = Math.sign(d.spd) || 1
      const tanX = -uz * sgn * Math.sign(t || 1)
      const tanZ = ux * sgn * Math.sign(t || 1)
      knock(pl, tanX + cx * 0.6, tanZ + cz * 0.6, 15, 7.5, events)
    } else if (d.t === 'pend') {
      const [x, y, z] = pendHead(d, env.T)
      const nx = Math.max(pl.x - R, Math.min(x, pl.x + R))
      const ny = Math.max(pl.y, Math.min(y, pl.y + H))
      const nz = Math.max(pl.z - R, Math.min(z, pl.z + R))
      if (Math.hypot(nx - x, ny - y, nz - z) > d.r) continue
      const vel = Math.cos((2 * Math.PI * env.T) / d.per + 2 * Math.PI * d.ph)
      const dir = Math.sign(vel * Math.cos(pendAngle(d, env.T))) || Math.sign(pl.x - x) || 1
      knock(pl, dir, 0, 17, 8, events)
    } else if (d.t === 'boulder') {
      const b = boulderState(d, env.T)
      if (b.scale < 0.3) continue
      const rr = d.r * b.scale
      const nx = Math.max(pl.x - R, Math.min(b.x, pl.x + R))
      const ny = Math.max(pl.y, Math.min(b.y, pl.y + H))
      const nz = Math.max(pl.z - R, Math.min(b.z, pl.z + R))
      if (Math.hypot(nx - b.x, ny - b.y, nz - b.z) > rr) continue
      knock(pl, (pl.x - b.x) * 0.3, Math.sign(b.speed) || 1, 19, 9, events)
    } else if (d.t === 'meteor') {
      const f = meteorPhase(d, env.T)
      if (f < METEOR_HIT[0] || f > METEOR_HIT[1]) continue
      if (Math.hypot(pl.x - d.x, pl.z - d.z) < d.r && pl.y < d.floor + 3) {
        events.push({ type: 'kill', cause: 'burn' })
        return events
      }
    }
  }
  if (pl.y < env.killY || midY < env.killY - 1) events.push({ type: 'kill', cause: env.killCause || 'fall' })
  return events
}
