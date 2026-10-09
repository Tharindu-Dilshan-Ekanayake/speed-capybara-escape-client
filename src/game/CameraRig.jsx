import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { runtime } from '../state/store'
import { cameraClip } from './physics'

const LOOK_H = 1.7
const MIN_D = 4
const MAX_D = 34
const MIN_PITCH = -0.2
const MAX_PITCH = 1.35

const _target = new Vector3()
const _desired = new Vector3()

/**
 * Third-person orbit camera (Roblox style): drag to orbit, wheel / pinch to zoom.
 * Publishes its yaw to runtime.cameraYaw so movement is camera-relative.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const orbit = useRef({ yaw: 0, pitch: 0.34, dist: 11 })
  const look = useRef(new Vector3())
  const init = useRef(false)

  useEffect(() => {
    const el = gl.domElement
    const pointers = new Map()
    let pinch = 0
    const down = (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture?.(e.pointerId)
    }
    const move = (e) => {
      const p = pointers.get(e.pointerId)
      if (!p) return
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d0 = Math.hypot(a.x - b.x, a.y - b.y)
        p.x = e.clientX
        p.y = e.clientY
        const [c, d] = [...pointers.values()]
        const d1 = Math.hypot(c.x - d.x, c.y - d.y)
        if (pinch) orbit.current.dist = clamp(orbit.current.dist - (d1 - d0) * 0.05, MIN_D, MAX_D)
        pinch = 1
        return
      }
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      const s = e.pointerType === 'touch' ? 0.007 : 0.005
      orbit.current.yaw -= dx * s
      orbit.current.pitch = clamp(orbit.current.pitch + dy * s, MIN_PITCH, MAX_PITCH)
    }
    const up = (e) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = 0
    }
    const wheel = (e) => {
      e.preventDefault()
      orbit.current.dist = clamp(orbit.current.dist + e.deltaY * 0.012, MIN_D, MAX_D)
    }
    const ctx = (e) => e.preventDefault()
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('contextmenu', ctx)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
      el.removeEventListener('contextmenu', ctx)
    }
  }, [gl])

  useFrame((state, dtRaw) => {
    const me = runtime.me
    if (!me) return
    const dt = Math.min(dtRaw, 0.05)
    if (runtime.turn) orbit.current.yaw -= runtime.turn * dt
    const { yaw, pitch, dist } = orbit.current
    // Follow the smoothly drawn position (between physics steps), not the raw one.
    const v = runtime.view || me
    _target.set(v.x, v.y + LOOK_H, v.z)
    // Pull the camera in front of any wall between it and the duck.
    const dx = Math.sin(yaw) * Math.cos(pitch)
    const dy = Math.sin(pitch)
    const dz = Math.cos(yaw) * Math.cos(pitch)
    const d = Math.max(1.5, Math.min(dist, cameraClip(_target.x, _target.y, _target.z, dx, dy, dz, dist) - 0.4))
    _desired.set(_target.x + dx * d, _target.y + dy * d, _target.z + dz * d)
    const jump = !init.current || camera.position.distanceTo(_desired) > 60
    if (jump) {
      camera.position.copy(_desired)
      look.current.copy(_target)
      init.current = true
    } else {
      camera.position.lerp(_desired, 1 - Math.pow(0.00001, dt))
      look.current.lerp(_target, 1 - Math.pow(0.000001, dt))
    }
    // Shake on knock-backs.
    const shake = runtime.shake || 0
    if (shake > 0) {
      runtime.shake = Math.max(0, shake - dt)
      camera.position.x += (Math.random() - 0.5) * shake * 0.6
      camera.position.y += (Math.random() - 0.5) * shake * 0.6
    }
    camera.lookAt(look.current)
    // Wider field of view the faster you go.
    const fov = 68 + Math.min(16, (runtime.speedNow || 0) * 0.55)
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * (1 - Math.pow(0.02, dt))
      camera.updateProjectionMatrix()
    }
    runtime.cameraYaw = yaw
    state.invalidate?.()
  })

  return null
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export default CameraRig
