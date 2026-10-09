import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CanvasTexture, LinearFilter, SpriteMaterial, SRGBColorSpace } from 'three'

import { formatNum } from '../../shared/gameData'
import { runtime, useGame } from '../../state/store'
import { FONT_TITLE, shapeTexture } from '../textures'

/** "+N" with a little red sneaker, like the original's step popups. */
const texCache = new Map()
function popupTexture(text) {
  if (texCache.has(text)) return texCache.get(text)
  const c = document.createElement('canvas')
  c.width = 440
  c.height = 160
  const g = c.getContext('2d')
  g.font = `400 96px ${FONT_TITLE}`
  g.textAlign = 'right'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.lineWidth = 12
  g.strokeStyle = '#3a2400'
  g.strokeText(text, 258, 82)
  const grd = g.createLinearGradient(0, 36, 0, 120)
  grd.addColorStop(0, '#fff6b0')
  grd.addColorStop(0.55, '#ffd23a')
  grd.addColorStop(1, '#ff9a1a')
  g.fillStyle = grd
  g.fillText(text, 258, 82)
  const shoe = shapeTexture('sneaker').image
  g.save()
  g.translate(350, 78)
  g.rotate(-0.3)
  g.drawImage(shoe, -76, -76, 152, 152)
  g.restore()
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.minFilter = LinearFilter
  if (texCache.size > 200) texCache.clear()
  texCache.set(text, t)
  return t
}

const POOL = 28
const LIFE = 1.1

export function Popups() {
  const refs = useRef([])
  const slots = useMemo(
    () => Array.from({ length: POOL }, () => ({ alive: false, t: 0, x: 0, y: 0, z: 0, vx: 0, vz: 0, mat: new SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }) })),
    [],
  )
  const next = useRef(0)

  useFrame(({ camera }, dt) => {
    const show = useGame.getState().settings.popups
    let budget = 3
    while (runtime.popups.length && budget > 0) {
      const p = runtime.popups.shift()
      budget -= 1
      if (!show) continue
      const s = slots[next.current]
      next.current = (next.current + 1) % POOL
      s.alive = true
      s.t = 0
      s.x = p.x + (Math.random() - 0.5) * 1.6
      s.y = p.y + Math.random() * 0.4
      s.z = p.z + (Math.random() - 0.5) * 1.6
      s.vx = (Math.random() - 0.5) * 0.8
      s.vz = (Math.random() - 0.5) * 0.8
      const hadMap = !!s.mat.map
      s.mat.map = popupTexture(`+${formatNum(p.amount)}`)
      // Only the first map assignment changes the shader; later swaps are just a uniform.
      if (!hadMap) s.mat.needsUpdate = true
    }
    if (runtime.popups.length > 30) runtime.popups.length = 0
    slots.forEach((s, i) => {
      const sp = refs.current[i]
      if (!sp) return
      if (!s.alive) {
        sp.visible = false
        return
      }
      s.t += dt
      if (s.t > LIFE) {
        s.alive = false
        sp.visible = false
        return
      }
      const k = s.t / LIFE
      sp.visible = true
      sp.position.set(s.x + s.vx * s.t, s.y + k * 1.8, s.z + s.vz * s.t)
      const pop = Math.min(1, s.t / 0.12)
      // Scale with camera distance so the popup stays a small, constant size on screen.
      const dist = camera.position.distanceTo(sp.position)
      const sc = 0.06 * dist * (0.6 + 0.4 * pop)
      sp.scale.set(sc * 2.75, sc, 1)
      s.mat.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
    })
  })

  return slots.map((s, i) => <sprite key={i} ref={(el) => (refs.current[i] = el)} material={s.mat} visible={false} renderOrder={20} />)
}

export default Popups
