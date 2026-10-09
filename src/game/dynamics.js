/**
 * Pure time functions for every moving thing on the course. Physics and rendering
 * both call these with the same synced clock `T` (seconds), so what you see is what
 * you collide with - and every player in the lobby sees the same phase.
 */

const TAU = Math.PI * 2
export const frac = (v) => v - Math.floor(v)

/** Synced repeating lava tide. Renderer and collision read exactly the same height. */
export function floodState(d, T) {
  const t = frac(T / d.per + (d.ph || 0)) * d.per
  const ease = (v) => v * v * (3 - 2 * v)
  let phase
  let amount
  let end
  if (t < d.riseStart) {
    phase = 'clear'; amount = 0; end = d.riseStart
  } else if (t < d.riseEnd) {
    phase = 'rising'; amount = ease((t - d.riseStart) / (d.riseEnd - d.riseStart)); end = d.riseEnd
  } else if (t < d.drainStart) {
    phase = 'flooded'; amount = 1; end = d.drainStart
  } else {
    phase = 'draining'; amount = 1 - ease((t - d.drainStart) / (d.per - d.drainStart)); end = d.per
  }
  return { y: d.lowY + (d.highY - d.lowY) * amount, phase, seconds: Math.ceil(end - t) }
}

export function moverOffset(d, T) {
  const s = Math.sin(TAU * (T / d.per + d.ph)) * d.amp
  return d.ax === 0 ? [s, 0, 0] : d.ax === 1 ? [0, s, 0] : [0, 0, s]
}

export const blinkPhase = (d, T) => frac(T / d.per + d.ph)
export function blinkActive(d, T) {
  const f = blinkPhase(d, T)
  return f >= d.on0 && f < d.on1
}
/** 0..1 how close an active blink object is to switching off (for warning flashes). */
export function blinkWarn(d, T) {
  const f = blinkPhase(d, T)
  if (f < d.on0 || f >= d.on1) return 0
  const left = (d.on1 - f) * d.per
  return left < 0.7 ? 1 - left / 0.7 : 0
}

export const sweepAngle = (d, T) => d.ph + d.spd * T
export const pendAngle = (d, T) => d.amp * Math.sin(TAU * (T / d.per + d.ph))
export function pendHead(d, T) {
  const a = pendAngle(d, T)
  return [d.x + Math.sin(a) * d.len, d.y - Math.cos(a) * d.len, d.z]
}

export function boulderState(d, T) {
  const f = frac(T / d.per + d.ph)
  const z = d.zA + (d.zB - d.zA) * f
  // Grow in at the cave mouth, shrink out at the far end.
  const scale = Math.min(1, f / 0.04, (1 - f) / 0.04)
  const speed = (d.zB - d.zA) / d.per
  // Balls rolling down a ramp follow a sloped floor (floor -> floorB).
  const floor = d.floorB === undefined ? d.floor : d.floor + (d.floorB - d.floor) * f
  return { x: d.x, y: floor + d.r, z, scale, roll: (z / d.r) % TAU, speed }
}

/** Meteor cycle: 0..0.78 warning circle grows, 0.78..0.86 impact, then embers. */
export const METEOR_HIT = [0.78, 0.86]
export const meteorPhase = (d, T) => frac(T / d.per + d.ph)

export const windActive = (d, T) => {
  const f = frac(T / d.per + d.ph)
  return f >= d.on0 && f < d.on1
}

export const diskAngle = (d, T) => d.spd * T

/* ---- Sinking stones (per-player, local state) ---- */

const SINK_ACCEL = 7

/** @param {{ t0: number }|undefined} st  @param now seconds (local clock) */
export function sinkOffset(d, st, now) {
  if (!st) return 0
  const t = now - st.t0 - d.delay
  if (t <= 0) return 0
  return -Math.min(d.depth, 0.5 * SINK_ACCEL * t * t)
}

/** True once a sunk stone should pop back up. */
export function sinkExpired(d, st, now) {
  if (!st) return false
  const fallTime = Math.sqrt((2 * d.depth) / SINK_ACCEL)
  return now - st.t0 > d.delay + fallTime + d.back
}

/** Current AABB of a box-shaped dynamic, or null when it is not solid right now. */
export function dynBox(d, T, sinks, now) {
  let ox = 0
  let oy = 0
  let oz = 0
  if (d.t === 'move') {
    ;[ox, oy, oz] = moverOffset(d, T)
  } else if (d.t === 'blink') {
    if (!blinkActive(d, T)) return null
  } else if (d.t === 'sink') {
    oy = sinkOffset(d, sinks.get(d.id), now)
  } else {
    return null
  }
  const x = d.x + ox
  const y = d.y + oy
  const z = d.z + oz
  return { minX: x - d.w / 2, maxX: x + d.w / 2, minY: y - d.h / 2, maxY: y + d.h / 2, minZ: z - d.d / 2, maxZ: z + d.d / 2 }
}
