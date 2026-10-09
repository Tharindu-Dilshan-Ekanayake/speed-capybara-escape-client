import { runtime } from '../state/store'

/**
 * Movement input from the keyboard and the on-screen joystick, merged.
 * `runtime.input.touchX/touchY` is written by the TouchControls joystick.
 */

const keys = { f: false, b: false, l: false, r: false, jump: false }
const MAP = {
  KeyW: 'f',
  ArrowUp: 'f',
  KeyS: 'b',
  ArrowDown: 'b',
  KeyA: 'l',
  ArrowLeft: 'l',
  KeyD: 'r',
  ArrowRight: 'r',
  Space: 'jump',
}

let installed = false
export function installKeyboard() {
  if (installed) return
  installed = true
  const typing = (e) => /INPUT|TEXTAREA/.test(e.target?.tagName || '')
  window.addEventListener('keydown', (e) => {
    if (typing(e)) return
    const k = MAP[e.code]
    if (!k) return
    e.preventDefault()
    keys[k] = true
  })
  window.addEventListener('keyup', (e) => {
    const k = MAP[e.code]
    if (k) keys[k] = false
  })
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false
  })
}

/**
 * @param {boolean} turnKeys when true, A / D (and the arrow keys) turn the camera instead of
 *   strafing; the joystick still strafes.
 * @returns {{ fwd: number, right: number, turn: number, jump: boolean }}
 */
export function readInput(turnKeys = false) {
  const t = runtime.input
  const sideKeys = (keys.r ? 1 : 0) - (keys.l ? 1 : 0)
  let fwd = (keys.f ? 1 : 0) - (keys.b ? 1 : 0) + (t.touchY || 0)
  let right = (turnKeys ? 0 : sideKeys) + (t.touchX || 0)
  const len = Math.hypot(fwd, right)
  if (len > 1) {
    fwd /= len
    right /= len
  }
  return { fwd, right, turn: turnKeys ? sideKeys : 0, jump: keys.jump || !!t.touchJump }
}
