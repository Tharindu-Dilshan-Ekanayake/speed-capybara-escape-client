import { useFrame } from '@react-three/fiber'
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
  SphereGeometry,
} from 'three'

import { STAGES } from '../../shared/course'
import { runtime, worldTime } from '../../state/store'
import {
  blinkActive,
  blinkWarn,
  boulderState,
  diskAngle,
  dynBox,
  floodState,
  METEOR_HIT,
  meteorPhase,
  pendAngle,
  sweepAngle,
  windActive,
} from '../dynamics'
import { additiveMaterial, liquidMaterial, surfaceMaterial } from '../materials'
import { boulderGeometry } from './geometry'
import { Label } from './Signs'

const BOX = new BoxGeometry(1, 1, 1)
const CYL = new CylinderGeometry(1, 1, 1, 20)
const SPHERE = new SphereGeometry(1, 24, 16)
const RING = new RingGeometry(0.86, 1, 40)
const SPIKE = new ConeGeometry(0.22, 0.6, 8)
const BOULDER = boulderGeometry()
const dummy = new Object3D()
const metal = new MeshStandardMaterial({ color: '#8a93a8', metalness: 0.7, roughness: 0.3 })
const dark = new MeshStandardMaterial({ color: '#2a2e3d', roughness: 0.6 })
const rope = new MeshStandardMaterial({ color: '#c9a46a', roughness: 0.9 })
const rock = new MeshStandardMaterial({ color: '#8d8478', roughness: 0.95, flatShading: true })
const ghostMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, depthWrite: false })
const meteorMat = new MeshStandardMaterial({ color: '#5a2a1a', emissive: '#ff5a00', emissiveIntensity: 1.2, flatShading: true })
const warnMat = new MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false })
const bridgeTimber = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.86 })

const localNow = () => performance.now() / 1000

/* ---- Instanced moving / blinking / sinking blocks ----------------------- */

function DynBoxes({ items, c, m, ghost }) {
  const ref = useRef()
  const ghostRef = useRef()
  const material = surfaceMaterial(c, m)
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const T = worldTime()
    const now = localNow()
    const flick = Math.floor(now * 12) % 2 === 0
    items.forEach((d, i) => {
      let b = dynBox(d, T, runtime.hazards.sinks, now)
      if (b && d.t === 'blink' && blinkWarn(d, T) > 0 && !flick) b = null
      if (!b) {
        dummy.scale.setScalar(0)
      } else {
        // Sinking stones tremble before they drop.
        const st = d.t === 'sink' ? runtime.hazards.sinks.get(d.id) : null
        const shake = st && now - st.t0 < d.delay ? (Math.random() - 0.5) * 0.12 : 0
        dummy.position.set((b.minX + b.maxX) / 2 + shake, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2)
        dummy.scale.set(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      if (ghostRef.current) {
        const show = d.t === 'blink' && !blinkActive(d, T)
        dummy.position.set(d.x, d.y, d.z)
        dummy.scale.set(show ? d.w : 0, show ? d.h : 0, show ? d.d : 0)
        dummy.updateMatrix()
        ghostRef.current.setMatrixAt(i, dummy.matrix)
      }
    })
    mesh.instanceMatrix.needsUpdate = true
    if (ghostRef.current) ghostRef.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={ref} args={[BOX, material, items.length]} castShadow={m !== 'laser'} receiveShadow frustumCulled={false} />
      {ghost && <instancedMesh ref={ghostRef} args={[BOX, ghostMat, items.length]} frustumCulled={false} />}
    </>
  )
}

/** Planks, timber beams and rope rails all follow the same moving collision deck. */
function BridgeDecks({ items }) {
  const ref = useRef()
  const poses = useMemo(() => new Map(items.map((d) => [d.id, { x: d.x, y: d.y, z: d.z }])), [items])
  const parts = useMemo(() => items.flatMap((d) => {
    const out = []
    const add = (x, y, z, w, h, len, color) => out.push({ id: d.id, x, y, z, w, h, len, color: new Color(color) })
    const count = Math.ceil(d.d / 0.65)
    const pitch = d.d / count
    for (let i = 0; i < count; i += 1) {
      const color = new Color(d.c).multiplyScalar(i % 3 === 0 ? 0.82 : 1)
      add(0, 0, -d.d / 2 + (i + 0.5) * pitch, d.w, d.h, pitch - 0.045, color)
    }
    for (const side of [-1, 1]) {
      add(side * d.w * 0.33, -d.h / 2 - 0.06, 0, 0.2, 0.16, d.d, '#593d2b')
      for (const end of [-1, 1]) add(side * (d.w / 2 - 0.12), d.h / 2 + 0.5, end * (d.d / 2 - 0.16), 0.14, 1, 0.14, '#705038')
      add(side * (d.w / 2 - 0.12), d.h / 2 + 0.92, 0, 0.065, 0.065, d.d, '#c3b08a')
    }
    return out
  }), [items])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    parts.forEach((part, i) => mesh.setColorAt(i, part.color))
    mesh.instanceColor.needsUpdate = true
  }, [parts])

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const T = worldTime()
    const now = localNow()
    dummy.rotation.set(0, 0, 0)
    for (const d of items) {
      const b = dynBox(d, T, runtime.hazards.sinks, now)
      const pose = poses.get(d.id)
      const st = d.t === 'sink' ? runtime.hazards.sinks.get(d.id) : null
      const shake = st && now - st.t0 < d.delay ? Math.sin(now * 55) * 0.055 : 0
      pose.x = (b.minX + b.maxX) / 2 + shake
      pose.y = (b.minY + b.maxY) / 2
      pose.z = (b.minZ + b.maxZ) / 2
    }
    parts.forEach((part, i) => {
      const pose = poses.get(part.id)
      dummy.position.set(pose.x + part.x, pose.y + part.y, pose.z + part.z)
      dummy.scale.set(part.w, part.h, part.len)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[BOX, bridgeTimber, parts.length]} castShadow receiveShadow frustumCulled={false} />
}

/* ---- Sweepers, pendulums, disks, boulders, meteors, wind ---------------- */

function Sweeper({ d }) {
  const ref = useRef()
  useFrame(() => {
    if (ref.current) ref.current.rotation.y = -sweepAngle(d, worldTime())
  })
  const laser = d.kill
  const mat = laser ? surfaceMaterial(d.c, 'laser') : surfaceMaterial(d.c, d.c === '#8a5a33' ? 'stud' : 'smooth')
  return (
    <group position={[d.x, d.y, d.z]}>
      <group ref={ref}>
        <mesh geometry={CYL} material={mat} rotation={[0, 0, Math.PI / 2]} scale={[laser ? d.r : 0.45, d.len * 2, laser ? d.r : 0.45]} castShadow={!laser} />
        {laser && <mesh geometry={CYL} material={additiveMaterial(d.c, 0.35)} rotation={[0, 0, Math.PI / 2]} scale={[d.r * 2.6, d.len * 2, d.r * 2.6]} />}
      </group>
      {!laser && <mesh geometry={CYL} material={dark} position={[0, 0.3, 0]} scale={[0.6, 1.2, 0.6]} />}
    </group>
  )
}

function Pendulum({ d }) {
  const ref = useRef()
  useFrame(() => {
    if (ref.current) ref.current.rotation.z = pendAngle(d, worldTime())
  })
  return (
    <group position={[d.x, d.y, d.z]}>
      <mesh geometry={BOX} material={dark} scale={[14, 0.6, 0.8]} />
      <group ref={ref}>
        <mesh geometry={CYL} material={rope} position={[0, -d.len / 2, 0]} scale={[0.08, d.len, 0.08]} />
        <mesh geometry={SPHERE} material={metal} position={[0, -d.len, 0]} scale={d.r} castShadow />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2
          return <mesh key={i} geometry={SPIKE} material={metal} position={[Math.cos(a) * d.r, -d.len, Math.sin(a) * d.r]} rotation={[Math.sin(a) * 1.57, 0, -Math.cos(a) * 1.57]} />
        })}
      </group>
    </group>
  )
}

function Disk({ d }) {
  const ref = useRef()
  useFrame(() => {
    if (ref.current) ref.current.rotation.y = -diskAngle(d, worldTime())
  })
  const top = surfaceMaterial(d.c, 'stud')
  const edge = surfaceMaterial('#ffffff', 'neon')
  return (
    <group ref={ref} position={[d.x, d.top - d.h / 2, d.z]}>
      <mesh geometry={CYL} material={top} scale={[d.r, d.h, d.r]} castShadow receiveShadow />
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={BOX} material={edge} position={[0, d.h / 2 + 0.01, 0]} rotation={[0, (i / 3) * Math.PI, 0]} scale={[d.r * 2 - 0.3, 0.02, 0.18]} />
      ))}
    </group>
  )
}

function Boulders({ items }) {
  const ref = useRef()
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const T = worldTime()
    items.forEach((d, i) => {
      const b = boulderState(d, T)
      dummy.position.set(b.x, b.y, b.z)
      dummy.rotation.set(b.roll, 0, 0)
      dummy.scale.setScalar(d.r * Math.max(0.001, b.scale))
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    dummy.rotation.set(0, 0, 0)
  })
  return <instancedMesh ref={ref} args={[BOULDER, rock, items.length]} castShadow frustumCulled={false} />
}

function Meteors({ items }) {
  const rings = useRef()
  const rocks = useRef()
  const blasts = useRef()
  useFrame(() => {
    const T = worldTime()
    items.forEach((d, i) => {
      const f = meteorPhase(d, T)
      // Warning circle grows until impact.
      const warn = f < METEOR_HIT[0]
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.position.set(d.x, d.floor + 0.06, d.z)
      dummy.scale.setScalar(warn ? d.r * (0.3 + 0.7 * (f / METEOR_HIT[0])) : 0)
      dummy.updateMatrix()
      rings.current.setMatrixAt(i, dummy.matrix)
      // Falling rock during the last part of the warning.
      dummy.rotation.set(f * 9, f * 7, 0)
      const fall = (f - 0.55) / (METEOR_HIT[0] - 0.55)
      if (fall > 0 && fall < 1) {
        dummy.position.set(d.x + (1 - fall) * 8, d.floor + 1 + (1 - fall) * 45, d.z)
        dummy.scale.setScalar(1.3)
      } else dummy.scale.setScalar(0)
      dummy.updateMatrix()
      rocks.current.setMatrixAt(i, dummy.matrix)
      // Blast.
      const bl = (f - METEOR_HIT[0]) / 0.14
      dummy.rotation.set(0, 0, 0)
      dummy.position.set(d.x, d.floor, d.z)
      dummy.scale.setScalar(bl > 0 && bl < 1 ? d.r * (0.5 + bl) : 0)
      dummy.updateMatrix()
      blasts.current.setMatrixAt(i, dummy.matrix)
    })
    for (const r of [rings, rocks, blasts]) r.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={rings} args={[RING, warnMat, items.length]} frustumCulled={false} />
      <instancedMesh ref={rocks} args={[BOULDER, meteorMat, items.length]} frustumCulled={false} />
      <instancedMesh ref={blasts} args={[SPHERE, additiveMaterial('#ff7a1a', 0.55), items.length]} frustumCulled={false} />
    </>
  )
}

const STREAKS = 26
function Wind({ d }) {
  const ref = useRef()
  const seeds = useMemo(() => Array.from({ length: STREAKS }, () => [Math.random(), Math.random(), Math.random()]), [])
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const T = worldTime()
    const on = windActive(d, T)
    const dir = Math.sign(d.vx) || 1
    seeds.forEach(([a, b, c], i) => {
      const p = (a + T * 0.9) % 1
      dummy.position.set(d.x + (p - 0.5) * d.w * dir, 0.4 + c * 3.5, d.z + (b - 0.5) * d.d)
      dummy.scale.set(on ? 2.4 : 0, 0.05, 0.05)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[BOX, additiveMaterial('#ffffff', 0.5), STREAKS]} frustumCulled={false} />
}

/* ---- Tsunami + rising lava (per player, from runtime.hazards) ------------ */

const foam = new MeshStandardMaterial({ color: '#ffffff', emissive: '#bff8ff', emissiveIntensity: 0.6, roughness: 0.4 })
function Wave({ S }) {
  const ref = useRef()
  const born = useRef(0)
  const width = S.half * 2 + 70
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const w = runtime.hazards.wave
    const on = w && w.stage === S.n && w.t0 !== null
    g.visible = !!on
    if (!on) {
      born.current = 0
      return
    }
    if (!born.current) born.current = clock.elapsedTime
    const rise = Math.min(1, (clock.elapsedTime - born.current) / 0.8)
    const z = S.z0 - w.front
    g.position.set(S.cx, -2.5, z + 5)
    g.scale.set(1, rise, 1)
    g.children[1].position.y = S.wave.height + Math.sin(clock.elapsedTime * 4) * 0.4
  })
  const water = useMemo(() => liquidMaterial('water'), [])
  return (
    <group ref={ref} visible={false}>
      <mesh geometry={BOX} material={water} position={[0, S.wave.height / 2, 0]} scale={[width, S.wave.height, 10]} />
      <group>
        <mesh geometry={CYL} material={foam} position={[0, 0, -4.2]} rotation={[0, 0, Math.PI / 2]} scale={[2.2, width, 2.2]} />
        <mesh geometry={CYL} material={foam} position={[0, 1.2, -2.4]} rotation={[0, 0, Math.PI / 2]} scale={[1.4, width, 1.4]} />
      </group>
    </group>
  )
}

function RisingLava({ S }) {
  const ref = useRef()
  const len = S.rise.stopU + 2
  useFrame(() => {
    if (!ref.current) return
    const r = runtime.hazards.rise
    const y = r && r.stage === S.n ? r.y : S.rise.y0
    ref.current.position.y = y - 15
  })
  const mat = useMemo(() => liquidMaterial('lava'), [])
  return <mesh ref={ref} geometry={BOX} material={mat} position={[S.cx, S.rise.y0 - 15, S.z0 - len / 2]} scale={[S.half * 2 + 1, 30, len]} />
}

function LavaFlood({ d }) {
  const ref = useRef()
  const [status, setStatus] = useState(() => floodState(d, worldTime()))
  const shown = useRef(`${status.phase}:${status.seconds}`)
  useFrame(() => {
    const next = floodState(d, worldTime())
    if (ref.current) ref.current.position.y = next.y - 6
    const key = `${next.phase}:${next.seconds}`
    if (shown.current !== key) {
      shown.current = key
      setStatus(next)
    }
  })
  const text = {
    clear: `PATH CLEAR - ${status.seconds}s`,
    rising: `LAVA RISING - ${status.seconds}s`,
    flooded: `LAVA HIGH - WAIT ${status.seconds}s`,
    draining: `LAVA DRAINING - ${status.seconds}s`,
  }[status.phase]
  return (
    <>
      <mesh ref={ref} geometry={BOX} material={liquidMaterial('lava')} position={[d.x, status.y - 6, d.z]} scale={[d.w, 12, d.d]} />
      <Label text={text} style={status.phase === 'clear' ? 'green' : 'warn'} height={0.9} position={[d.x, 5.3, d.z + d.d / 2 - 1]} billboard />
    </>
  )
}

/* ---- Per-stage composition --------------------------------------------- */

export const StageDynamics = memo(function StageDynamics({ stage }) {
  const S = STAGES[stage]
  const boxGroups = useMemo(() => {
    const groups = new Map()
    for (const d of S.dyn) {
      if (d.bridgeDeck) continue
      if (d.t !== 'move' && d.t !== 'blink' && d.t !== 'sink') continue
      const m = d.m === 'laser' ? 'laser' : d.c === '#ffffff' && d.cloudTile ? 'smooth' : 'stud'
      const key = `${d.c}|${m}`
      if (!groups.has(key)) groups.set(key, { key, c: d.c, m, items: [], ghost: false })
      const g = groups.get(key)
      g.items.push(d)
      if (d.t === 'blink' && d.k !== 'kill') g.ghost = true
    }
    return [...groups.values()]
  }, [S])
  const boulders = useMemo(() => S.dyn.filter((d) => d.t === 'boulder'), [S])
  const meteors = useMemo(() => S.dyn.filter((d) => d.t === 'meteor'), [S])
  const bridges = useMemo(() => S.dyn.filter((d) => d.bridgeDeck), [S])
  return (
    <>
      {boxGroups.map((g) => (
        <DynBoxes key={g.key} items={g.items} c={g.c} m={g.m} ghost={g.ghost} />
      ))}
      {bridges.length > 0 && <BridgeDecks items={bridges} />}
      {S.dyn.map((d) => {
        if (d.t === 'flood') return <LavaFlood key={d.id} d={d} />
        if (d.t === 'sweep') return <Sweeper key={d.id} d={d} />
        if (d.t === 'pend') return <Pendulum key={d.id} d={d} />
        if (d.t === 'disk') return <Disk key={d.id} d={d} />
        if (d.t === 'wind') return <Wind key={d.id} d={d} />
        return null
      })}
      {boulders.length > 0 && <Boulders items={boulders} />}
      {meteors.length > 0 && <Meteors items={meteors} />}
      {S.wave && <Wave S={S} />}
      {S.rise && <RisingLava S={S} />}
    </>
  )
})

export default StageDynamics
