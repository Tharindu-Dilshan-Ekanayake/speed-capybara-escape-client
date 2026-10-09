import { useFrame } from '@react-three/fiber'
import { memo, useMemo, useRef } from 'react'
import { AdditiveBlending, BoxGeometry, CylinderGeometry, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, TorusGeometry, Vector3 } from 'three'

import { textTexture } from '../textures'

const PLANE = new PlaneGeometry(1, 1)
const _p = new Vector3()
const matCache = new Map()
function textMaterial(text, style, px) {
  const k = `${style}|${px}|${text}`
  if (!matCache.has(k)) {
    const { texture, aspect } = textTexture(text, style, px)
    const m = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false })
    m.userData.aspect = aspect
    matCache.set(k, m)
  }
  return matCache.get(k)
}

/** A flat text label. `height` is the world height of one text line. */
export const Label = memo(function Label({ text, style = 'label', height = 1, position, rotation = [0, 0, 0], px = 96, billboard = false }) {
  const mat = textMaterial(text, style, px)
  const ref = useRef()
  const h = height * 1.5
  const aspect = mat.userData.aspect
  useFrame(({ camera }) => {
    const m = ref.current
    if (!billboard || !m) return
    m.quaternion.copy(camera.quaternion)
    // Shrink when the camera is close so labels never swamp the screen.
    m.getWorldPosition(_p)
    const k = Math.min(1, Math.max(0.4, camera.position.distanceTo(_p) / 16))
    m.scale.set(h * aspect * k, h * k, 1)
  })
  return <mesh ref={ref} geometry={PLANE} material={mat} position={position} rotation={rotation} scale={[h * aspect, h, 1]} renderOrder={5} />
})

const SIGN_STYLES = new Set(['stage', 'stageSub', 'warn', 'red', 'green', 'gold', 'label'])

export const Signs = memo(function Signs({ signs }) {
  return signs.map((s, i) => (
    <Label key={i} text={s.text} style={SIGN_STYLES.has(s.kind) ? s.kind : 'label'} height={s.size} position={[s.x, s.y, s.z]} rotation={[0, s.ry || 0, 0]} px={s.kind === 'stage' ? 160 : 110} />
  ))
})

/* ---- Trophy (wins pads) ---- */
const gold = new MeshStandardMaterial({ color: '#ffcc1a', metalness: 0.7, roughness: 0.25, emissive: '#ff9a00', emissiveIntensity: 0.35 })
const CUP = new CylinderGeometry(0.42, 0.18, 0.55, 20)
const STEM = new CylinderGeometry(0.07, 0.07, 0.3, 10)
const BASE = new CylinderGeometry(0.28, 0.32, 0.12, 20)
const HANDLE = new TorusGeometry(0.17, 0.045, 8, 20)

export function Trophy({ position, scale = 1 }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = clock.elapsedTime * 1.4
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 2) * 0.15
  })
  return (
    <group ref={ref} position={position} scale={scale}>
      <mesh geometry={CUP} material={gold} position={[0, 0.62, 0]} />
      <mesh geometry={STEM} material={gold} position={[0, 0.2, 0]} />
      <mesh geometry={BASE} material={gold} position={[0, 0.03, 0]} />
      <mesh geometry={HANDLE} material={gold} position={[0.44, 0.66, 0]} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={HANDLE} material={gold} position={[-0.44, 0.66, 0]} rotation={[0, 0, Math.PI / 2]} />
    </group>
  )
}

/** The end-of-stage wins pad: a glowing gold plate, a light beam, a trophy and "Press E". */
const GLOW_PLATE = new BoxGeometry(1, 1, 1)
const BEAM = new CylinderGeometry(2.1, 2.5, 12, 24, 1, true)
const glowMat = new MeshBasicMaterial({ color: '#ffd21a', transparent: true, opacity: 0.6, blending: AdditiveBlending, depthWrite: false, toneMapped: false })
const beamMat = new MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.2, blending: AdditiveBlending, depthWrite: false, toneMapped: false, side: DoubleSide })
export const PadMarker = memo(function PadMarker({ pad, wins }) {
  const text = useMemo(() => `+${wins}`, [wins])
  useFrame(({ clock }) => {
    const k = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3)
    glowMat.opacity = 0.35 + k * 0.5
    beamMat.opacity = 0.1 + k * 0.14
  })
  return (
    <group>
      <mesh geometry={GLOW_PLATE} material={glowMat} position={[pad.x, pad.y + 0.2, pad.z]} scale={[pad.w, 0.04, pad.d]} renderOrder={3} />
      <mesh geometry={GLOW_PLATE} material={glowMat} position={[pad.x, pad.y + 0.22, pad.z]} scale={[pad.w * 0.6, 0.04, pad.d * 0.6]} renderOrder={3} />
      <mesh geometry={BEAM} material={beamMat} position={[pad.x, pad.y + 6, pad.z]} renderOrder={3} />
      <Trophy position={[pad.x - 0.9, pad.y + 1.6, pad.z]} scale={1.3} />
      <Label text={text} style="gold" height={1.1} position={[pad.x + 0.9, pad.y + 2.6, pad.z]} billboard />
      <Label text="Press E to claim!" style="warn" height={0.6} position={[pad.x, pad.y + 4, pad.z]} billboard />
    </group>
  )
})

export default Signs
