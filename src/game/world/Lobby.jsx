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
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from 'three'

import { LOBBIES } from '../../shared/course'
import { DUCKS, TREADMILLS, WHEEL, WORLD2_REBIRTHS, formatNum } from '../../shared/gameData'
import { useGame } from '../../state/store'
import Duck from '../Duck'
import { additiveMaterial, surfaceMaterial } from '../materials'
import { FONT_TITLE, FONT_UI } from '../textures'
import { Portal } from './Props'
import { Label } from './Signs'

const BOX = new BoxGeometry(1, 1, 1)
const CYL = new CylinderGeometry(1, 1, 1, 24)
const SPHERE = new SphereGeometry(1, 24, 16)
const TORUS = new TorusGeometry(1, 0.05, 8, 40)
const CONE = new ConeGeometry(1, 1, 12)
const WHEEL_DISC = new CircleGeometry(4.2, 64)
const frame = new MeshStandardMaterial({ color: '#2a2e3d', roughness: 0.5, metalness: 0.3 })
const chrome = new MeshStandardMaterial({ color: '#c9d2e3', roughness: 0.25, metalness: 0.8 })
const blackHole = new MeshStandardMaterial({ color: '#05030a', roughness: 0.2 })

/* ---- Duck pedestals ------------------------------------------------------ */

const BEAM = new CylinderGeometry(1.1, 1.5, 6, 20, 1, true)
const Pedestal = memo(function Pedestal({ ped, owned, equipped, affordable, rebirthsOk }) {
  const d = DUCKS.find((x) => x.id === ped.id)
  const spin = useRef()
  useFrame(({ clock }) => {
    if (spin.current) spin.current.rotation.y = (ped.ry || 0) + Math.sin(clock.elapsedTime * 0.6 + ped.x) * 0.6
  })
  let top
  let style
  if (equipped) [top, style] = ['Equipped!', 'green']
  else if (owned) [top, style] = ['Owned', 'green']
  else if (d.wheel) [top, style] = ['Lucky Wheel Only!', 'gold']
  else if (!rebirthsOk) [top, style] = [`Needs ${d.reb} Rebirths`, 'red']
  else [top, style] = [`${formatNum(d.cost)} Wins`, affordable ? 'gold' : 'red']
  return (
    <group position={[ped.x, ped.y, ped.z]}>
      <mesh geometry={CYL} material={surfaceMaterial('#ffcc1a', 'gold')} position={[0, 0.02, 0]} scale={[1.9, 0.12, 1.9]} />
      <mesh geometry={BEAM} material={additiveMaterial(d.fx?.glow || d.body, 0.08)} position={[0, 3, 0]} />
      <group ref={spin} scale={1.45}>
        <Duck id={d.id} />
      </group>
      <Label text={top} style={style} height={0.6} position={[0, 4.45, 0]} billboard />
      <Label text={`+${formatNum(d.perStep)} / Step`} style="label" height={0.58} position={[0, 3.6, 0]} billboard />
    </group>
  )
})

/* ---- Treadmills --------------------------------------------------------- */

function TreadFx({ def }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime
    g.children.forEach((c, i) => {
      if (def.mult === 2) c.scale.y = 1.2 + Math.sin(t * 6 + i) * 0.4
      else if (def.mult === 4) c.rotation.z = t * (i % 2 ? 2 : -3)
      else c.rotation.y = t * (1.5 + i * 0.4)
    })
  })
  if (def.mult === 1) return null
  if (def.mult === 2) {
    return (
      <group ref={ref}>
        {[-1.9, 1.9].flatMap((x) => [-2.5, 0, 2.5].map((z) => [x, z])).map(([x, z], i) => (
          <mesh key={i} geometry={CONE} material={additiveMaterial(i % 2 ? '#ffb000' : '#ff4a00', 0.75)} position={[x, 1.2, z]} scale={[0.35, 1.2, 0.35]} />
        ))}
      </group>
    )
  }
  if (def.mult === 4) {
    return (
      <group ref={ref}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={TORUS} material={additiveMaterial(def.glow, 0.85)} position={[0, 1.4, -1.5 + i * 1.5]} scale={[1.9, 1.9, 2]} />
        ))}
      </group>
    )
  }
  return (
    <group ref={ref}>
      {[-1.8, 1.8].map((x) => (
        <group key={x} position={[x, 4.2, -3.6]}>
          <mesh geometry={SPHERE} material={blackHole} scale={0.75} />
          <mesh geometry={TORUS} material={additiveMaterial(def.glow, 0.9)} rotation={[Math.PI / 2.4, 0, 0]} scale={[1.3, 1.3, 3]} />
        </group>
      ))}
    </group>
  )
}

const Treadmill = memo(function Treadmill({ t, owned, rebirthsOk, affordable }) {
  const def = TREADMILLS.find((x) => x.id === t.id)
  const belt = useMemo(() => surfaceMaterial('#2b2f3a', 'belt', { cv: [0, 4 + Math.log2(def.mult) * 2] }), [def.mult])
  const glow = def.glow ? surfaceMaterial(def.glow, 'neon') : surfaceMaterial('#8a93a8', 'neon')
  let sub = null
  if (!owned) sub = !rebirthsOk ? [`Needs ${def.reb} Rebirths`, 'red'] : [`${formatNum(def.cost)} Wins`, affordable ? 'gold' : 'red']
  return (
    <group position={[t.x, 0, t.z]}>
      <mesh geometry={BOX} material={belt} position={[0, t.top - 0.06, 0]} scale={[t.w, 0.12, t.l]} receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={glow} position={[s * (t.w / 2 + 0.15), t.top + 0.05, 0]} scale={[0.22, 0.22, t.l]} />
      ))}
      {/* Console + handlebars at the front (-z). */}
      <mesh geometry={BOX} material={frame} position={[0, 1.6, -t.l / 2 - 0.2]} scale={[t.w + 0.4, 2.4, 0.5]} castShadow />
      <mesh geometry={BOX} material={glow} position={[0, 2.4, -t.l / 2 + 0.06]} scale={[t.w - 0.6, 0.7, 0.04]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={CYL} material={chrome} position={[s * (t.w / 2 + 0.1), 1.5, -t.l / 2 + 0.6]} rotation={[0.5, 0, 0]} scale={[0.07, 2.2, 0.07]} />
      ))}
      <TreadFx def={def} />
      <Label text={`${def.mult}X SPEED`} style="stageSub" height={1.25} position={[0, 4.6, -t.l / 2 - 0.2]} px={120} billboard />
      {sub && <Label text={sub[0]} style={sub[1]} height={0.65} position={[0, 3.5, -t.l / 2 - 0.2]} billboard />}
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
  grd.addColorStop(0, '#2a2f6a')
  grd.addColorStop(1, '#151838')
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
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'
    g.fillRect(24, y, 592, 58)
    const r = rows[i]
    g.textAlign = 'left'
    g.font = `700 34px ${FONT_UI}`
    g.fillStyle = medal[i] || '#aab0d0'
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
      <mesh geometry={BOX} material={frame} position={[0, 5.4, -0.25]} scale={[7.4, 9.4, 0.4]} castShadow />
      <mesh material={mat} position={[0, 5.4, 0]}>
        <planeGeometry args={[7, 9]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={frame} position={[s * 3.2, 0.5, -0.25]} scale={[0.5, 1, 0.5]} />
      ))}
    </group>
  )
}

/* ---- Lobby composition -------------------------------------------------- */

export const LobbyFeatures = memo(function LobbyFeatures({ world }) {
  const L = LOBBIES[world]
  const ducks = useGame((s) => s.profile?.ducks)
  const duck = useGame((s) => s.profile?.duck)
  const treads = useGame((s) => s.profile?.treads)
  const rebirths = useGame((s) => s.profile?.rebirths || 0)
  const wins = useGame((s) => s.profile?.wins || 0)
  return (
    <>
      {L.pedestals.map((p) => {
        const d = DUCKS.find((x) => x.id === p.id)
        return <Pedestal key={p.id} ped={p} owned={!!ducks?.includes(p.id)} equipped={duck === p.id} affordable={wins >= d.cost} rebirthsOk={rebirths >= d.reb} />
      })}
      {L.treads.map((t) => {
        const def = TREADMILLS.find((x) => x.id === t.id)
        return <Treadmill key={t.id} t={t} owned={!!treads?.includes(t.id)} rebirthsOk={rebirths >= def.reb} affordable={wins >= def.cost} />
      })}
      <LuckyWheel w={L.wheel} />
      {L.boards.map((b) => (
        <Board key={b.kind} b={b} />
      ))}
      <Portal
        x={L.portal.x}
        y={L.portal.y}
        z={L.portal.z}
        ry={L.portal.ry}
        title={world === 1 ? 'World 2' : 'World 1'}
        sub={world === 1 ? (rebirths >= WORLD2_REBIRTHS ? 'Walk in & press E!' : `Needs ${WORLD2_REBIRTHS} Rebirths`) : 'Back to World 1'}
        colors={world === 1 ? ['#29c8ff', '#7a3dff'] : ['#7dff8a', '#29c8ff']}
      />
    </>
  )
})

export default LobbyFeatures
