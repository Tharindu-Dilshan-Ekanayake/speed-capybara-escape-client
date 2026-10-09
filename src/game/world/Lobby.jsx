import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
  SRGBColorSpace,
} from 'three'

import { LOBBY } from '../../shared/course'
import { CAPYS, TREADMILLS, WHEEL, formatNum } from '../../shared/gameData'
import { useGame } from '../../state/store'
import Capybara from '../Capybara'
import { additiveMaterial, surfaceMaterial } from '../materials'
import { FONT_TITLE, FONT_UI } from '../textures'
import { Label } from './Signs'

const BOX = new BoxGeometry(1, 1, 1)
const CYL = new CylinderGeometry(1, 1, 1, 24)
const SPHERE = new SphereGeometry(1, 24, 16)
const CONE = new ConeGeometry(1, 1, 12)
const GEM = new OctahedronGeometry(1, 0)
const WHEEL_DISC = new CircleGeometry(4.2, 64)
const frame = new MeshStandardMaterial({ color: '#2a2e3d', roughness: 0.5, metalness: 0.3 })
const chrome = new MeshStandardMaterial({ color: '#c9d2e3', roughness: 0.25, metalness: 0.8 })

/* ---- Capybara pads: red = for sale, green = owned, yellow = riding ---------- */

const PAD_COLORS = { sale: '#ff2a3a', owned: '#2fe05a', riding: '#ffd21a' }
const Pedestal = memo(function Pedestal({ ped, owned, equipped, affordable, rebirthsOk }) {
  const d = CAPYS.find((x) => x.id === ped.id)
  const spin = useRef()
  useFrame(({ clock }) => {
    if (spin.current) spin.current.rotation.y = (ped.ry || 0) + Math.sin(clock.elapsedTime * 0.5 + ped.x) * 0.5
  })
  let top
  let style
  if (equipped) [top, style] = ['Riding!', 'gold']
  else if (owned) [top, style] = ['Owned', 'green']
  else if (d.wheel) [top, style] = ['Lucky Wheel Only!', 'gold']
  else if (!rebirthsOk) [top, style] = [`Needs ${d.reb} Rebirth${d.reb === 1 ? '' : 's'}`, 'red']
  else [top, style] = [`${formatNum(d.cost)} Wins`, affordable ? 'gold' : 'red']
  const pad = equipped ? PAD_COLORS.riding : owned ? PAD_COLORS.owned : PAD_COLORS.sale
  return (
    <group position={[ped.x, ped.y, ped.z]}>
      <mesh geometry={BOX} material={surfaceMaterial('#3a3d5c', 'smooth')} position={[0, 0.06, 0]} scale={[3.3, 0.12, 3.3]} receiveShadow />
      <mesh geometry={BOX} material={surfaceMaterial(pad, 'neon')} position={[0, 0.14, 0]} scale={[2.9, 0.06, 2.9]} />
      <group ref={spin} position={[0, 0.17, 0]} scale={1.2}>
        <Capybara id={d.id} />
      </group>
      <Label text={`+${formatNum(d.perStep)}/Step`} style="green" height={0.55} position={[0, 3.25, 0]} billboard />
      <Label text={top} style={style} height={0.5} position={[0, 2.65, 0]} billboard />
    </group>
  )
})

/* ---- Treadmills ------------------------------------------------------------ */

/** Show-off effects per treadmill tier (see TREADMILLS[].fx). */
function TreadFx({ def, t }) {
  const ref = useRef()
  const glow = def.glow
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const tt = clock.elapsedTime
    switch (def.fx) {
      case 'leaf':
        g.children.forEach((c, i) => {
          const k = (tt * 0.35 + i / g.children.length) % 1
          c.position.set(Math.cos(i * 2.4 + tt) * 2.3, 0.6 + k * 3.2, Math.sin(i * 2.4) * 3)
          c.rotation.set(tt * 2 + i, tt + i, 0)
          c.scale.setScalar(0.14 * Math.sin(k * Math.PI))
        })
        break
      case 'gold':
        g.rotation.y = tt * 0.8
        g.children.forEach((c, i) => {
          c.scale.y = 1.2 + Math.sin(tt * 6 + i) * 0.5
        })
        break
      case 'ice':
        g.children.forEach((c, i) => {
          c.position.y = 1.4 + Math.sin(tt * 1.6 + i) * 0.35
          c.rotation.y = tt * (1 + i * 0.2)
        })
        break
      case 'fire':
        g.children.forEach((c, i) => {
          c.scale.y = 1.3 + Math.sin(tt * 7 + i * 1.7) * 0.45
        })
        break
      case 'bolt': {
        // Jagged bolts that re-shape and flicker several times a second.
        const k = Math.floor(tt * 11)
        g.children.forEach((c, i) => {
          const on = ((k + i * 3) * 7) % 5 < 3
          c.visible = on
          c.rotation.z = (((k * 13 + i * 29) % 17) / 17 - 0.5) * 1.1
          c.rotation.y = i * 1.3 + k * 0.7
        })
        break
      }
      default:
    }
  })
  switch (def.fx) {
    case 'leaf':
      return (
        <group ref={ref}>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} geometry={GEM} material={additiveMaterial(glow, 0.85)} />
          ))}
          <mesh geometry={BOX} material={additiveMaterial(glow, 0.12)} position={[0, 1.6, 0]} scale={[t.w + 0.6, 3.2, t.l + 0.4]} />
        </group>
      )
    case 'gold':
      return (
        <group position={[0, 2.6, 0]}>
          <group ref={ref}>
            {Array.from({ length: 10 }, (_, i) => {
              const a = (i / 10) * Math.PI * 2
              return <mesh key={i} geometry={CONE} material={additiveMaterial(i % 2 ? '#fff06a' : '#ffb000', 0.6)} position={[Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4]} rotation={[0, -a, Math.PI / 2]} scale={[0.12, 1.4, 0.12]} />
            })}
          </group>
          <mesh geometry={SPHERE} material={additiveMaterial('#fff6b0', 0.5)} scale={0.45} />
        </group>
      )
    case 'ice':
      return (
        <group ref={ref}>
          {[[-2.3, -2.4], [2.3, -1], [-2.3, 1.5], [2.3, 2.6]].map(([x, z], i) => (
            <mesh key={i} geometry={GEM} material={surfaceMaterial('#bff4ff', 'crystal')} position={[x, 1.4, z]} scale={[0.35, 0.7, 0.35]} />
          ))}
        </group>
      )
    case 'fire':
      return (
        <group ref={ref}>
          {[-2.2, 2.2].flatMap((x) => [-2.8, -0.9, 0.9, 2.8].map((z) => [x, z])).map(([x, z], i) => (
            <mesh key={i} geometry={CONE} material={additiveMaterial(i % 2 ? '#ffb000' : '#ff3a00', 0.75)} position={[x, 1.1, z]} scale={[0.36, 1.3, 0.36]} />
          ))}
        </group>
      )
    case 'bolt':
      return (
        <group>
          <group ref={ref}>
            {[-2.3, 2.3, -2.3, 2.3].map((x, i) => (
              <group key={i} position={[x, 2.4, i < 2 ? -1.6 : 1.6]}>
                <mesh geometry={BOX} material={additiveMaterial('#bff6ff', 0.95)} position={[0, 0.6, 0]} rotation={[0, 0, 0.5]} scale={[0.09, 1.4, 0.09]} />
                <mesh geometry={BOX} material={additiveMaterial('#5ef0ff', 0.95)} position={[0.2, -0.45, 0]} rotation={[0, 0, -0.4]} scale={[0.09, 1.3, 0.09]} />
              </group>
            ))}
          </group>
          <mesh geometry={BOX} material={additiveMaterial(glow, 0.14)} position={[0, 1.8, 0]} scale={[t.w + 1, 3.6, t.l + 0.6]} />
        </group>
      )
    default:
      return null
  }
}

const Treadmill = memo(function Treadmill({ t, i, owned, rebirthsOk, affordable }) {
  const def = TREADMILLS.find((x) => x.id === t.id)
  const belt = useMemo(() => surfaceMaterial('#24262f', 'belt', { cv: [0, 4 + Math.log2(def.mult) * 2] }), [def.mult])
  const body = surfaceMaterial(def.color, 'smooth')
  const glow = surfaceMaterial(def.glow, 'neon')
  let sub = ['Owned!', 'green']
  if (!owned) sub = !rebirthsOk ? [`Needs ${def.reb} Rebirth${def.reb === 1 ? '' : 's'}`, 'red'] : def.cost ? [`${formatNum(def.cost)} Wins`, affordable ? 'gold' : 'red'] : ['FREE!', 'green']
  return (
    <group position={[t.x, 0, t.z]}>
      <mesh geometry={BOX} material={belt} position={[0, t.top - 0.06, 0]} scale={[t.w, 0.12, t.l]} receiveShadow />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={BOX} material={body} position={[s * (t.w / 2 + 0.25), t.top + 0.08, 0]} scale={[0.5, 0.36, t.l + 0.4]} castShadow />
          <mesh geometry={BOX} material={glow} position={[s * (t.w / 2 + 0.25), t.top + 0.27, 0]} scale={[0.3, 0.04, t.l + 0.2]} />
        </group>
      ))}
      {/* Console + handlebars at the front (-z). */}
      <mesh geometry={BOX} material={body} position={[0, 1.7, -t.l / 2 - 0.25]} scale={[t.w + 0.9, 2.6, 0.5]} castShadow />
      <mesh geometry={BOX} material={frame} position={[0, 2.4, -t.l / 2 + 0.02]} scale={[t.w - 0.4, 0.9, 0.04]} />
      <mesh geometry={BOX} material={glow} position={[0, 2.4, -t.l / 2 + 0.05]} scale={[t.w - 0.8, 0.5, 0.02]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={CYL} material={chrome} position={[s * (t.w / 2 + 0.15), 1.5, -t.l / 2 + 0.6]} rotation={[0.5, 0, 0]} scale={[0.07, 2.2, 0.07]} />
      ))}
      <TreadFx def={def} t={t} />
      {/* Neighbouring labels are staggered in height so they never overlap. */}
      <Label text={`${def.mult}x Speed`} style="stageSub" height={0.72} position={[0, 4.3 + (i % 2) * 1.5, -t.l / 2 - 0.2]} px={120} billboard />
      <Label text={sub[0]} style={sub[1]} height={0.45} position={[0, 3.55 + (i % 2) * 1.5, -t.l / 2 - 0.2]} billboard />
    </group>
  )
})

/* ---- Lucky wheel ---------------------------------------------------------- */

function wheelTexture() {
  const s = 1024
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  const n = WHEEL.length
  const seg = (Math.PI * 2) / n
  g.translate(s / 2, s / 2)
  for (let i = 0; i < n; i += 1) {
    const a0 = -Math.PI / 2 + i * seg
    g.beginPath()
    g.moveTo(0, 0)
    g.arc(0, 0, s / 2 - 10, a0, a0 + seg)
    g.closePath()
    g.fillStyle = WHEEL[i].color
    g.fill()
    g.lineWidth = 8
    g.strokeStyle = '#ffffff'
    g.stroke()
    g.save()
    g.rotate(a0 + seg / 2)
    g.textAlign = 'right'
    g.textBaseline = 'middle'
    g.font = `400 58px ${FONT_TITLE}`
    g.lineWidth = 10
    g.strokeStyle = '#1a1030'
    g.strokeText(WHEEL[i].label, s / 2 - 50, 0)
    g.fillStyle = '#ffffff'
    g.fillText(WHEEL[i].label, s / 2 - 50, 0)
    g.restore()
  }
  g.beginPath()
  g.arc(0, 0, 70, 0, Math.PI * 2)
  g.fillStyle = '#ffffff'
  g.fill()
  g.font = `400 70px ${FONT_TITLE}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = '#ff3a6a'
  g.fillText('★', 0, 4)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

export const wheelRotationFor = (idx) => (idx + 0.5) * ((Math.PI * 2) / WHEEL.length)

function LuckyWheel({ w }) {
  const disc = useRef()
  const spin = useRef({ from: 0, to: 0, start: 0, dur: 0 })
  const tex = useMemo(() => new MeshBasicMaterial({ map: wheelTexture(), toneMapped: false }), [])
  const wheel = useGame((s) => s.wheel)
  useEffect(() => {
    if (!wheel || !disc.current) return
    const cur = disc.current.rotation.z
    const base = cur - (cur % (Math.PI * 2))
    spin.current = { from: cur, to: base + Math.PI * 2 * 6 + wheelRotationFor(wheel.idx), start: performance.now(), dur: 4000 }
  }, [wheel])
  useFrame((_s, dt) => {
    if (!disc.current) return
    const sp = spin.current
    const k = sp.dur ? Math.min(1, (performance.now() - sp.start) / sp.dur) : 1
    if (sp.dur && k < 1) {
      const e = 1 - Math.pow(1 - k, 4)
      disc.current.rotation.z = sp.from + (sp.to - sp.from) * e
    } else if (sp.dur) {
      disc.current.rotation.z = sp.to
    } else disc.current.rotation.z += dt * 0.15
  })
  const bulbs = useMemo(() => Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2), [])
  return (
    <group position={[w.x, w.y, w.z]} rotation={[0, w.ry, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={frame} position={[s * 2.2, 2.6, -0.4]} rotation={[0, 0, s * 0.25]} scale={[0.4, 5.4, 0.4]} castShadow />
      ))}
      <group position={[0, 5.4, 0]}>
        <mesh geometry={CYL} material={surfaceMaterial('#ffffff', 'smooth')} rotation={[Math.PI / 2, 0, 0]} scale={[4.35, 0.3, 4.35]} position={[0, 0, -0.18]} />
        <mesh ref={disc} geometry={WHEEL_DISC} material={tex} />
        {bulbs.map((a, i) => (
          <mesh key={i} geometry={SPHERE} material={surfaceMaterial(i % 2 ? '#fff06a' : '#ff5ad8', 'neon')} position={[Math.cos(a) * 4.45, Math.sin(a) * 4.45, 0.05]} scale={0.14} />
        ))}
        <mesh geometry={CONE} material={surfaceMaterial('#ff2a2a', 'smooth')} position={[0, 4.6, 0.2]} rotation={[Math.PI, 0, 0]} scale={[0.45, 0.8, 0.2]} />
      </group>
      <Label text="Lucky Wheel" style="red" height={1.1} position={[0, 11.2, 0]} />
      <Label text="Gain A Spin Every 10 Minutes!" style="label" height={0.55} position={[0, 10.2, 0]} />
    </group>
  )
}

/* ---- Leaderboards ------------------------------------------------------- */

const TITLES = { wins: 'Top Wins', level: 'Top Level', rebirths: 'Top Rebirths' }
function boardTexture(kind, rows) {
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 820
  const g = c.getContext('2d')
  const grd = g.createLinearGradient(0, 0, 0, 820)
  grd.addColorStop(0, '#3a5bdc')
  grd.addColorStop(1, '#1d2a7a')
  g.fillStyle = grd
  g.fillRect(0, 0, 640, 820)
  g.strokeStyle = '#ffd84a'
  g.lineWidth = 12
  g.strokeRect(6, 6, 628, 808)
  g.textAlign = 'center'
  g.font = `400 72px ${FONT_TITLE}`
  g.lineWidth = 10
  g.strokeStyle = '#1a1030'
  g.strokeText(TITLES[kind], 320, 82)
  const tg = g.createLinearGradient(0, 40, 0, 110)
  tg.addColorStop(0, '#fff6b0')
  tg.addColorStop(1, '#ffae1a')
  g.fillStyle = tg
  g.fillText(TITLES[kind], 320, 82)
  const medal = ['#ffd84a', '#d8e0ee', '#e0965a']
  for (let i = 0; i < 10; i += 1) {
    const y = 140 + i * 66
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)'
    g.fillRect(24, y, 592, 58)
    const r = rows[i]
    g.textAlign = 'left'
    g.font = `700 34px ${FONT_UI}`
    g.fillStyle = medal[i] || '#c8d0f0'
    g.fillText(`#${i + 1}`, 40, y + 41)
    if (!r) continue
    g.fillStyle = '#ffffff'
    g.fillText(r.name.slice(0, 16), 120, y + 41)
    g.textAlign = 'right'
    g.fillStyle = '#7dff8a'
    const v = kind === 'level' ? `${r.r ? `R${r.r} ` : ''}Lv ${formatNum(r.v)}` : formatNum(r.v)
    g.fillText(v, 600, y + 41)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

function Board({ b }) {
  const rows = useGame((s) => s.lb[b.kind])
  const mat = useMemo(() => new MeshBasicMaterial({ map: boardTexture(b.kind, rows || []), toneMapped: false }), [b.kind, rows])
  useEffect(() => () => mat.map?.dispose(), [mat])
  return (
    <group position={[b.x, b.y, b.z]} rotation={[0, b.ry, 0]}>
      <mesh geometry={BOX} material={surfaceMaterial('#5c57c4', 'brick')} position={[0, 5.4, -0.3]} scale={[7.8, 9.8, 0.5]} castShadow />
      <mesh geometry={BOX} material={surfaceMaterial('#2fbf5a', 'stud')} position={[0, 10.45, -0.3]} scale={[8.2, 0.5, 0.8]} />
      <mesh material={mat} position={[0, 5.4, 0]}>
        <planeGeometry args={[7, 9]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={frame} position={[s * 3.2, 0.25, -0.3]} scale={[0.6, 0.5, 0.6]} />
      ))}
    </group>
  )
}

/* ---- Lobby composition -------------------------------------------------- */

export const LobbyFeatures = memo(function LobbyFeatures() {
  const L = LOBBY
  const capys = useGame((s) => s.profile?.capys)
  const capy = useGame((s) => s.profile?.capy)
  const treads = useGame((s) => s.profile?.treads)
  const rebirths = useGame((s) => s.profile?.rebirths || 0)
  const wins = useGame((s) => s.profile?.wins || 0)
  return (
    <>
      {L.pedestals.map((p) => {
        const d = CAPYS.find((x) => x.id === p.id)
        return <Pedestal key={p.id} ped={p} owned={!!capys?.includes(p.id)} equipped={capy === p.id} affordable={wins >= d.cost} rebirthsOk={rebirths >= d.reb} />
      })}
      {L.treads.map((t, i) => {
        const def = TREADMILLS.find((x) => x.id === t.id)
        return <Treadmill key={t.id} t={t} i={i} owned={!!treads?.includes(t.id)} rebirthsOk={rebirths >= def.reb} affordable={wins >= def.cost} />
      })}
      <LuckyWheel w={L.wheel} />
      {L.boards.map((b) => (
        <Board key={b.kind} b={b} />
      ))}
    </>
  )
})

export default LobbyFeatures
