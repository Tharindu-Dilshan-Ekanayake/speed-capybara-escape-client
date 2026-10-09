import { useEffect, useRef, useState } from 'react'

import { unlockAudio } from '../audio/sfx'
import { runtime, useGame } from '../state/store'

const isTouch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window)

const PAD = 10
const GAP = 8

const overlaps = (a, b) => !!b && a.x < b.right + GAP && a.x + a.s > b.left - GAP && a.y < b.bottom + GAP && a.y + a.s > b.top - GAP
const rectOf = (sel) => {
  const el = document.querySelector(sel)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width && r.height ? r : null
}

/**
 * Places the joystick and JUMP / E buttons in whatever space the HUD leaves free on this
 * screen, measured live: phones, tablets and the Bloxity app frame all have different
 * shapes, so fixed CSS positions always end up covering a button somewhere.
 */
function computeLayout() {
  const W = window.innerWidth
  const H = window.innerHeight
  const tl = rectOf('.hud .corner.tl')
  const tr = rectOf('.hud .corner.tr')
  const bc = rectOf('.hud .corner.bc')
  const blockers = [tl, tr, bc]
  const free = (c) => c.x >= 0 && c.y >= 0 && c.x + c.s <= W && c.y + c.s <= H && !blockers.some((b) => overlaps(c, b))

  // JUMP: bottom-right corner if clear, else tucked left of the right-hand column,
  // shrinking until it fits.
  let jump = null
  for (let s = Math.round(Math.min(96, Math.max(56, H * 0.22))); s >= 44 && !jump; s -= 6) {
    const y = H - PAD - s
    const spots = [{ x: W - PAD - s, y, s }]
    if (tr) spots.push({ x: tr.left - GAP - s, y, s })
    jump = spots.find(free) || null
  }
  jump ||= { x: W - PAD - 44, y: H - PAD - 44, s: 44 }

  // E: left of JUMP, or above it.
  let e = null
  for (let s = Math.round(jump.s * 0.75); s >= 40 && !e; s -= 6) {
    e = [{ x: jump.x - GAP - s, y: H - PAD - s - 6, s }, { x: jump.x + (jump.s - s) / 2, y: jump.y - GAP - s, s }].find(free) || null
  }
  e ||= { x: jump.x - GAP - 40, y: H - PAD - 46, s: 40 }

  // Joystick: bottom-left, just right of the left column, as big as the gap allows.
  let joy = null
  for (let s = Math.round(Math.min(150, Math.max(84, H * 0.3))); s >= 64 && !joy; s -= 8) {
    const y = H - PAD - s
    const spots = [{ x: PAD, y, s }]
    if (tl) spots.push({ x: tl.right + GAP, y, s })
    joy = spots.find(free) || null
  }
  joy ||= { x: tl ? tl.right + GAP : PAD, y: H - PAD - 64, s: 64 }
  return { jump, e, joy }
}

const place = (c) => ({ left: c.x, top: c.y, width: c.s, height: c.s, right: 'auto', bottom: 'auto' })

/** On-screen joystick + jump / interact buttons for phones and tablets. */
export function TouchControls() {
  const prompt = useGame((s) => s.prompt)
  const knob = useRef()
  const origin = useRef(null)
  const [layout, setLayout] = useState(null)

  useEffect(() => {
    if (!isTouch) return undefined
    let last = ''
    const update = () => {
      const next = computeLayout()
      const key = JSON.stringify(next)
      if (key !== last) {
        last = key
        setLayout(next)
      }
    }
    update()
    // The HUD can change size (new boosts, prompts), so keep re-checking now and then.
    const id = setInterval(update, 800)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      clearInterval(id)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  if (!isTouch) return null

  const move = (e) => {
    if (!origin.current) return
    const dx = e.clientX - origin.current.x
    const dy = e.clientY - origin.current.y
    const len = Math.hypot(dx, dy)
    // Knob travel scales with the joystick size.
    const max = origin.current.max
    const k = len > max ? max / len : 1
    if (knob.current) knob.current.style.transform = `translate(${dx * k}px, ${dy * k}px)`
    runtime.input.touchX = (dx * k) / max
    runtime.input.touchY = -(dy * k) / max
  }
  const end = () => {
    origin.current = null
    runtime.input.touchX = 0
    runtime.input.touchY = 0
    if (knob.current) knob.current.style.transform = ''
  }

  return (
    <div className="touch">
      <div
        className="joy"
        style={layout ? place(layout.joy) : undefined}
        onPointerDown={(e) => {
          unlockAudio()
          const r = e.currentTarget.getBoundingClientRect()
          origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, max: r.width * 0.38 }
          e.currentTarget.setPointerCapture(e.pointerId)
          move(e)
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div ref={knob} className="knob" />
      </div>
      <button
        className="tbtn"
        style={layout ? { ...place(layout.jump), fontSize: Math.max(12, Math.round(layout.jump.s * 0.21)) } : undefined}
        onPointerDown={(e) => {
          unlockAudio()
          e.currentTarget.setPointerCapture(e.pointerId)
          runtime.input.touchJump = true
        }}
        onPointerUp={() => (runtime.input.touchJump = false)}
        onPointerCancel={() => (runtime.input.touchJump = false)}
      >
        JUMP
      </button>
      {prompt && !prompt.done && (
        <button className="tbtn e" style={layout ? { ...place(layout.e), fontSize: Math.round(layout.e.s * 0.38) } : undefined} onPointerDown={() => runtime.interact?.()}>
          E
        </button>
      )}
    </div>
  )
}

export default TouchControls
