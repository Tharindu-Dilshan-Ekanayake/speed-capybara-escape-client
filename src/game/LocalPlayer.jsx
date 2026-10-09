import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { play } from '../audio/sfx'
import { useBloxityStore } from '../bloxity/store'
import { send } from '../net/net'
import { lobbySpawn, regionAt, STAGES, treadAt } from '../shared/course'
import { STEP_DISTANCE, TREADMILL_STEPS, speedStat, stageLevel, treadById, velocityFor } from '../shared/gameData'
import { xpPerStep } from '../shared/rules'
import { runtime, serverNow, useGame, worldTime } from '../state/store'
import { dynBox, sinkExpired } from './dynamics'
import { footprintPool, FootprintTrail } from './footprints'
import { readInput, installKeyboard } from './input'
import { findPrompt } from './interactions'
import { buildCollision, createPlayer, placePlayer, stageDyn, stepPlayer } from './physics'
import Rider, { newMotion } from './Rider'

/** Position updates per second sent to the server (others see you through these). */
const SEND_EVERY = 1 / 15
/**
 * Physics runs in fixed 120 Hz steps and the capybara is drawn between the last two steps.
 * Frame times always wobble a little; this keeps the motion perfectly even anyway.
 */
const FIXED = 1 / 120
const round2 = (v) => Math.round(v * 100) / 100

const dynById = new Map()
for (let n = 1; n < STAGES.length; n += 1) for (const d of STAGES[n].dyn) dynById.set(d.id, d)

/** Dynamics near a stage (its own + neighbours, so boundaries behave). */
const dynCache = new Map()
function dynNear(stage) {
  if (!dynCache.has(stage)) {
    const list = stage ? [...(stageDyn.get(stage - 1) || []), ...(stageDyn.get(stage) || []), ...(stageDyn.get(stage + 1) || [])] : []
    dynCache.set(stage, list)
  }
  return dynCache.get(stage)
}

const WET = new Set(['water', 'swamp', 'spring'])
function killCauseFor(S) {
  const kind = S?.planes?.find((p) => WET.has(p.kind) || p.kind === 'lava' || p.kind === 'toxic')?.kind
  return WET.has(kind) ? 'splash' : kind ? 'burn' : 'fall'
}

const DEATH_SFX = { splash: 'splash', wave: 'splash', zap: 'zap', burn: 'burn', fall: 'fall', bonk: 'bonk' }
const DEATH_COLOR = { splash: '#7ff0ff', wave: '#7ff0ff', zap: '#ff3a4a', burn: '#ff8a1a', fall: '#ffffff', bonk: '#8a5a33' }

function resetHazards() {
  runtime.hazards.sinks.clear()
  runtime.hazards.wave = null
  runtime.hazards.rise = null
}

export function LocalPlayer() {
  const group = useRef()
  const motion = useRef(newMotion())
  const footTrail = useMemo(() => new FootprintTrail('me'), [])
  const equipped = useBloxityStore((s) => s.equipped)
  const proportions = useBloxityStore((s) => s.proportions)
  const capy = useGame((s) => s.profile?.capy || 'classic')

  const pl = useMemo(() => {
    buildCollision()
    // Reuse the existing body if the canvas remounts (e.g. a graphics-quality change).
    const p = runtime.me || createPlayer(lobbySpawn())
    runtime.me = p
    return p
  }, [])

  const st = useRef({
    sendT: 0,
    stepAcc: 0,
    treadAcc: 0,
    treadPop: 0,
    stepSfx: 0,
    promptT: 0,
    prevStage: 0,
    region: { world: 1, stage: 0 },
    run: null,
    Tprev: worldTime(),
    facing: Math.PI,
    lastX: pl.x,
    lastZ: pl.z,
  })

  useEffect(() => installKeyboard(), [])
  useEffect(() => () => footprintPool.clearActor('me'), [])
  useEffect(() => {
    runtime.interact = () => {
      const pr = useGame.getState().prompt
      if (!pr || pr.done) return
      if (pr.locked) {
        play('error')
        useGame.getState().toast(pr.cost ? 'Not enough Wins!' : pr.sub, 'error')
        return
      }
      play('click')
      pr.action?.()
    }
    return () => {
      runtime.interact = null
    }
  }, [])

  const onReady = useCallback(() => useGame.setState({ avatarReady: true }), [])

  useFrame((_state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const s = st.current
    const g = useGame.getState()
    const prof = g.profile
    const mo = motion.current
    let teleported = false
    // Snap the drawn position to the physics one (after a teleport / respawn).
    const snapView = () => {
      s.px = pl.x
      s.py = pl.y
      s.pz = pl.z
      s.acc = 0
    }
    if (s.px === undefined) snapView()

    if (runtime.pendingTeleport) {
      const t = runtime.pendingTeleport
      teleported = true
      runtime.pendingTeleport = null
      placePlayer(pl, t)
      snapView()
      resetHazards()
      s.facing = t.yaw ?? Math.PI
      s.prevStage = -1
      s.lastX = pl.x
      s.lastZ = pl.z
      s.sendT = SEND_EVERY
      play('spawn')
    }

    const T = worldTime()
    const now = performance.now() / 1000
    const reg = regionAt(pl.x, pl.z)
    const S = reg.stage ? STAGES[reg.stage] : null

    // ---- Steering, relative to the camera ----
    const inp = readInput(g.settings.turnKeys)
    runtime.turn = inp.turn * 2.6 // rad/s the camera swings while A / D is held
    const yaw = runtime.cameraYaw
    const fx = -Math.sin(yaw)
    const fz = -Math.cos(yaw)
    const rx = Math.cos(yaw)
    const rz = -Math.sin(yaw)
    const speed = velocityFor(speedStat(prof?.level || 1)) * (g.speedPct / 100)

    const kill = (cause) => {
      teleported = true
      play(DEATH_SFX[cause] || 'fall')
      runtime.bursts.push({ kind: 'poof', x: pl.x, y: pl.y + 1, z: pl.z, at: performance.now(), color: DEATH_COLOR[cause] })
      // Falling / getting caught in a stage sends you back to the lobby.
      const spawn = lobbySpawn()
      placePlayer(pl, spawn)
      snapView()
      resetHazards()
      s.facing = spawn.yaw
      s.lastX = pl.x
      s.lastZ = pl.z
      s.run = null
      s.prevStage = -1
      send('respawn', { stage: 0 })
      if (cause === 'wave') g.toast('The tsunami got you! Run faster - level up for more Speed.', 'warn')

    }

    const ctl = { dirX: fx * inp.fwd + rx * inp.right, dirZ: fz * inp.fwd + rz * inp.right, speed, jump: inp.jump }
    const env = { T, Tprev: s.Tprev, now, sinks: runtime.hazards.sinks, dyn: dynNear(reg.stage), killY: S ? S.killY : -25, killCause: killCauseFor(S), level: prof?.level || 1 }
    const events = []
    s.acc = Math.min((s.acc || 0) + dt, 0.1)
    while (s.acc >= FIXED) {
      s.acc -= FIXED
      s.px = pl.x
      s.py = pl.y
      s.pz = pl.z
      env.T = T - s.acc
      env.Tprev = s.Tprev ?? env.T - FIXED
      for (const e of stepPlayer(pl, ctl, FIXED, env)) events.push(e)
      s.Tprev = env.T
      if (events.some((e) => e.type === 'kill')) break
    }

    let died = false
    for (const e of events) {
      if (e.type === 'jump') {
        play('jump')
        mo.jumpT = 0
        runtime.bursts.push({ kind: 'dust', x: pl.x, y: pl.y, z: pl.z, at: performance.now() })
      } else if (e.type === 'bounce') {
        play('bounce')
        mo.jumpT = 0
      } else if (e.type === 'land') {
        if (e.speed > 9) {
          play('land')
          mo.landT = 0
          runtime.bursts.push({ kind: 'dust', x: pl.x, y: pl.y, z: pl.z, at: performance.now() })
        }
      } else if (e.type === 'bonk') {
        play('bonk')
        runtime.shake = 0.45
      } else if (e.type === 'sink') {
        play('sink')
      } else if (e.type === 'kill' && !died) {
        died = true
        kill(e.cause)
      }
    }

    // Sunk stones pop back up after a while.
    for (const [id, stt] of runtime.hazards.sinks) {
      const d = dynById.get(id)
      if (!d || sinkExpired(d, stt, now)) runtime.hazards.sinks.delete(id)
    }

    // ---- Chasing tsunami / rising lava (per player) ----
    const hz = runtime.hazards
    if (!died && S?.wave) {
      const u = S.z0 - pl.z
      if (!hz.wave || hz.wave.stage !== S.n) hz.wave = { stage: S.n, t0: null, front: S.wave.startU }
      if (hz.wave.t0 === null && u >= S.wave.triggerU && u < S.wave.stopU) {
        hz.wave.t0 = now
        play('wave')
        g.showBig({ kind: 'warn', text: 'TSUNAMI!', sub: 'RUN!!!', ms: 1400 })
      }
      if (hz.wave.t0 !== null) {
        hz.wave.front = Math.min(S.wave.stopU, S.wave.startU + S.wave.speed * Math.max(0, now - hz.wave.t0 - S.wave.delay))
        if (u < hz.wave.front - 0.4 && u < S.wave.stopU - 0.5) {
          died = true
          kill('wave')
        }
      }
    } else if (hz.wave && (!S || hz.wave.stage !== S.n)) hz.wave = null
    if (!died && S?.rise) {
      const u = S.z0 - pl.z
      if (!hz.rise || hz.rise.stage !== S.n) hz.rise = { stage: S.n, t0: null, y: S.rise.y0, done: false }
      if (u >= S.rise.stopU) hz.rise.done = true
      if (hz.rise.t0 === null && u >= S.rise.triggerU && !hz.rise.done) {
        hz.rise.t0 = now
        g.showBig({ kind: 'warn', text: 'THE LAVA IS RISING!', sub: 'Climb!!', ms: 1500 })
        play('burn')
      }
      if (hz.rise.t0 !== null && !hz.rise.done) hz.rise.y = Math.min(S.rise.maxY, S.rise.y0 + S.rise.speed * Math.max(0, now - hz.rise.t0 - S.rise.delay))
      if (!hz.rise.done && pl.y < hz.rise.y - 0.2) kill('burn')
    } else if (hz.rise && (!S || hz.rise.stage !== S.n)) hz.rise = null

    // ---- Region / stage runs (mirrors the server so pads are claimed once) ----
    const reg2 = regionAt(pl.x, pl.z)
    if (reg2.stage !== s.region.stage || reg2.world !== s.region.world) {
      const prev = s.prevStage
      if (reg2.stage > 0) {
        const forward = prev === -1 || prev === reg2.stage - 1
        s.run = { stage: reg2.stage, sent: !forward }
      } else s.run = null
      s.region = reg2
      s.prevStage = reg2.stage
      useGame.setState({ region: reg2 })
    }

    // ---- Locked gate ahead? Tell the player what they need. ----
    const nextN = reg2.stage + 1
    const G = STAGES[nextN]?.gate || null
    if (G && prof && prof.level < G.req && Math.abs(pl.x - G.x) < G.w / 2 + 1 && pl.z - G.z < 3.5 && pl.z - G.z > -1.6 && now - (s.gateHint || 0) > 4) {
      s.gateHint = now
      g.showBig({ kind: 'warn', text: `LEVEL ${stageLevel(nextN)} NEEDED`, sub: 'Train on the treadmills to level up!', ms: 1800 })
      play('error')
    }

    // ---- Steps: walking and treadmills both count ----
    let onTread = null
    if (reg2.stage === 0 && pl.grounded && prof) {
      const t = treadAt(pl.x, pl.z)
      if (t && prof.treads.includes(t.id)) onTread = t
    }
    const per = prof ? xpPerStep(prof, Math.max(0, g.friends - 1)) : 1
    const moved = Math.hypot(pl.x - s.lastX, pl.z - s.lastZ)
    s.lastX = pl.x
    s.lastZ = pl.z
    if (onTread) {
      s.treadAcc += TREADMILL_STEPS * treadById(onTread.id).mult * dt
      s.treadPop += dt
      if (s.treadPop > 0.12 && s.treadAcc >= 1) {
        const n = Math.floor(s.treadAcc)
        s.treadAcc -= n
        s.treadPop = 0
        runtime.popups.push({ amount: n * per, x: pl.x, y: pl.y + 2.4, z: pl.z, at: performance.now() })
        play('step')
      }
    } else if (pl.grounded && moved > 0.001 && moved < 3) {
      s.stepAcc += moved
      if (s.stepAcc >= STEP_DISTANCE) {
        const n = Math.floor(s.stepAcc / STEP_DISTANCE)
        s.stepAcc -= n * STEP_DISTANCE
        runtime.popups.push({ amount: n * per, x: pl.x, y: pl.y + 2.4, z: pl.z, at: performance.now() })
        if (now - s.stepSfx > 0.09) {
          s.stepSfx = now
          play('step')
        }
      }
    }

    // ---- Facing + animation ----
    const hs = Math.hypot(pl.vx, pl.vz)
    if (onTread) s.facing = lerpAngle(s.facing, Math.PI, 1 - Math.pow(0.0001, dt))
    else if (hs > 0.5) s.facing = lerpAngle(s.facing, Math.atan2(pl.vx, pl.vz), 1 - Math.pow(0.00002, dt))
    pl.yaw = s.facing
    const support = pl.ground?.dyn
    const supportBox = support ? dynBox(support, T, runtime.hazards.sinks, now) : null
    footTrail.step({
      x: pl.x, y: pl.y, z: pl.z, yaw: s.facing, now,
      grounded: pl.grounded && hs > 0.15 && !onTread && !died && !!prof, teleported,
      capy, level: prof?.level || 1, support,
      supportPose: supportBox ? { x: (supportBox.minX + supportBox.maxX) / 2, y: (supportBox.minY + supportBox.maxY) / 2, z: (supportBox.minZ + supportBox.maxZ) / 2 } : null,
    })
    mo.time += dt
    // Ease the trot amount and advance the stride phase smoothly.
    const ratioTarget = onTread ? 1 : Math.min(1, hs / Math.max(4, speed * 0.85))
    mo.ratio += (ratioTarget - mo.ratio) * (1 - Math.exp(-dt * 12))
    mo.phase += dt * (7 + mo.ratio * 7)
    mo.grounded = pl.grounded || pl.coyote > 0.08
    mo.vy = pl.vy
    mo.jumpT += dt
    mo.landT += dt
    runtime.speedNow = hs
    runtime.onTread = onTread
    // Draw between the last two physics steps.
    const alpha = Math.min(1, (s.acc || 0) / FIXED)
    const view = runtime.view || (runtime.view = { x: 0, y: 0, z: 0 })
    view.x = s.px + (pl.x - s.px) * alpha
    view.y = s.py + (pl.y - s.py) * alpha
    view.z = s.pz + (pl.z - s.pz) * alpha
    if (group.current) {
      group.current.position.set(view.x, view.y, view.z)
      group.current.rotation.y = s.facing
    }

    // ---- Prompt (E) ----
    s.promptT += dt
    if (s.promptT > 0.12) {
      s.promptT = 0
      const pr = findPrompt(pl.x, pl.z, prof)
      if ((pr?.key || null) !== (g.prompt?.key || null)) useGame.setState({ prompt: pr })
    }

    // ---- Network ----
    s.sendT += dt
    if (s.sendT >= SEND_EVERY) {
      s.sendT = 0
      const flags = (hs > 0.3 ? 1 : 0) | (pl.grounded ? 2 : 0) | (pl.vy > 0.5 ? 4 : 0) | (onTread ? 8 : 0) | (pl.stun > 0 ? 16 : 0)
      // Stamped with the shared server clock so others can replay it with even timing.
      send('pos', [round2(pl.x), round2(pl.y), round2(pl.z), round2(s.facing), flags, Math.round(serverNow())])
    }
  })

  return (
    <group ref={group}>
      <Rider capy={capy} equipped={equipped} proportions={proportions} motionRef={motion} onReady={onReady} />
    </group>
  )
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

export default LocalPlayer
