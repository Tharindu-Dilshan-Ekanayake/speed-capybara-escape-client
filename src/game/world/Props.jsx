import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  ShaderMaterial,
  SphereGeometry,
} from 'three'

import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { useGame } from '../../state/store'
import Capybara from '../Capybara'
import { additiveMaterial, liquidMaterial, surfaceMaterial } from '../materials'
import { Label } from './Signs'

const BOX = new BoxGeometry(1, 1, 1)
const CYL = new CylinderGeometry(1, 1, 1, 24)
const HEX = new CylinderGeometry(1, 1, 1, 6)
const CONE = new ConeGeometry(1, 1, 16)
const SPHERE = new SphereGeometry(1, 28, 20)
const SPHERE_LO = new SphereGeometry(1, 14, 10)
const PRISM = new CylinderGeometry(1, 1, 1, 3)
const HALF_CYL = new CylinderGeometry(1, 1, 1, 20, 1, false, 0, Math.PI)

const std = (color, extra = {}) => new MeshStandardMaterial({ color: new Color(color), roughness: 0.6, ...extra })
const stoneMat = std('#6b6f86', { roughness: 0.9 })
const goldMat = std('#ffcc1a', { metalness: 0.8, roughness: 0.25, emissive: '#ff9a00', emissiveIntensity: 0.25 })
const whiteMat = std('#ffffff', { roughness: 0.9, flatShading: true })
const woodMat = std('#8a5a33', { roughness: 0.85 })
const woodLightMat = std('#b07a46', { roughness: 0.85 })
const vcMat = std('#ffffff', { flatShading: true, roughness: 0.85, vertexColors: true })

/** Bakes transformed copies of geometries (optionally vertex-coloured) into one mesh. */
function bakeParts(list) {
  const geos = list.map(([geo, pos, scale, color, rotY = 0]) => {
    const src = geo.index ? geo.toNonIndexed() : geo.clone()
    const g = new BufferGeometry()
    for (const k of ['position', 'normal']) g.setAttribute(k, src.attributes[k])
    g.scale(...(Array.isArray(scale) ? scale : [scale, scale, scale]))
    if (rotY) g.rotateY(rotY)
    g.translate(...pos)
    if (color) {
      const c = new Color(color)
      const n = g.attributes.position.count
      const arr = new Float32Array(n * 3)
      for (let k = 0; k < n; k += 1) arr.set([c.r, c.g, c.b], k * 3)
      g.setAttribute('color', new BufferAttribute(arr, 3))
    }
    return g
  })
  const out = mergeGeometries(geos, false)
  out.computeBoundingSphere()
  return out
}

function Spin({ speed = 1, axis = 'y', children, ...props }) {
  const ref = useRef()
  useFrame((_s, dt) => {
    if (ref.current) ref.current.rotation[axis] += dt * speed
  })
  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  )
}

/** Gentle bobbing on water (or breathing on land). */
function Bob({ children, amp = 0.08, speed = 1.4, phase = 0, roll = 0.04, ...props }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime * speed + phase
    ref.current.position.y = Math.sin(t) * amp
    ref.current.rotation.z = Math.sin(t * 0.7) * roll
  })
  return (
    <group {...props}>
      <group ref={ref}>{children}</group>
    </group>
  )
}

/* ---- Capybara NPCs ---------------------------------------------------------- */

function Zzz() {
  const ref = useRef()
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    g.children.forEach((c, i) => {
      const k = (clock.elapsedTime * 0.4 + i / 3) % 1
      c.position.set(0.3 + k * 0.5, 1.9 + k * 1.2, 0.8)
      c.scale.setScalar(0.3 + k * 0.5)
    })
  })
  return (
    <group ref={ref}>
      {[0, 1, 2].map((i) => (
        <Label key={i} text="z" style="label" height={0.5} position={[0, 2, 0]} billboard />
      ))}
    </group>
  )
}

function CapyNpc({ p }) {
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, p.ry || 0, 0]} scale={p.s || 1.25}>
      <Bob amp={0.02} speed={1.1} phase={p.x} roll={0.01}>
        <Capybara id={p.id || 'classic'} look={p.look} particles={false} />
      </Bob>
      {p.look === 'sleepy' && <Zzz />}
    </group>
  )
}

/* ---- Lobby: welcome gate, signboards, hint arrow, treasure chest -------------- */

function Welcome({ p }) {
  return (
    <group position={[p.x, p.y, p.z]}>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 5.8, 0, 0]}>
          <mesh geometry={BOX} material={woodMat} position={[0, 4.6, 0]} scale={[1.3, 9.2, 1.3]} castShadow />
          <mesh geometry={BOX} material={surfaceMaterial('#2fbf5a', 'stud')} position={[0, 9.4, 0]} scale={[1.8, 0.6, 1.8]} />
          <mesh geometry={BOX} material={goldMat} position={[0, 0.3, 0]} scale={[1.8, 0.6, 1.8]} />
        </group>
      ))}
      <mesh geometry={BOX} material={woodLightMat} position={[0, 8.6, 0]} scale={[14.6, 2.6, 0.5]} castShadow />
      <mesh geometry={BOX} material={woodMat} position={[0, 10.05, 0]} scale={[15.4, 0.45, 0.9]} />
      <mesh geometry={BOX} material={woodMat} position={[0, 7.15, 0]} scale={[15.4, 0.35, 0.8]} />
      <Label text="+1 Speed Capybara Escape" style="stage" height={1.1} position={[0, 8.75, 0.3]} px={140} />
      <Label text="Trot faster. Win bigger. Stay chill." style="gold" height={0.5} position={[0, 7.75, 0.3]} />
      <group position={[0, 10.3, 0]} scale={1.1}>
        <Capybara id="golden" particles={false} />
      </group>
    </group>
  )
}

function Board({ p }) {
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh geometry={BOX} material={woodLightMat} scale={[p.w, p.h, 0.4]} castShadow />
      <mesh geometry={BOX} material={woodMat} position={[0, p.h / 2, 0]} scale={[p.w + 0.6, 0.4, 0.7]} />
      <mesh geometry={BOX} material={woodMat} position={[0, -p.h / 2, 0]} scale={[p.w + 0.6, 0.4, 0.7]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} material={woodMat} position={[s * (p.w / 2 - 1.5), -p.y / 2 - p.h / 4, -0.1]} scale={[0.6, p.y - p.h / 2, 0.6]} />
      ))}
    </group>
  )
}

function HintArrow({ p }) {
  const ref = useRef()
  const show = useGame((s) => !!s.profile && (s.profile.totalWins || 0) < 3 && s.profile.level < 8)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.y = p.y + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.8
    ref.current.rotation.y = clock.elapsedTime * 1.5
  })
  if (!show) return null
  return (
    <group ref={ref} position={[p.x, p.y, p.z]}>
      <mesh geometry={CONE} material={surfaceMaterial('#7fe8ff', 'neon')} rotation={[Math.PI, 0, 0]} scale={[0.9, 1.2, 0.9]} />
      <mesh geometry={BOX} material={surfaceMaterial('#ffffff', 'neon')} position={[0, 1.1, 0]} scale={[0.6, 1.2, 0.6]} />
    </group>
  )
}

function Chest({ p }) {
  const lid = useRef()
  useFrame(({ clock }) => {
    if (lid.current) lid.current.rotation.x = -0.25 - Math.max(0, Math.sin(clock.elapsedTime * 0.8)) * 0.35
  })
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, p.ry || 0, 0]} scale={1.3}>
      <mesh geometry={BOX} material={std('#c0392b')} position={[0, 0.9, 0]} scale={[3.2, 1.8, 2]} castShadow />
      {[-1.2, 0, 1.2].map((x) => (
        <mesh key={x} geometry={BOX} material={goldMat} position={[x, 0.9, 0]} scale={[0.3, 1.86, 2.06]} />
      ))}
      <group ref={lid} position={[0, 1.8, -1]}>
        <mesh geometry={HALF_CYL} material={std('#c0392b')} position={[0, 0, 1]} rotation={[0, 0, Math.PI / 2]} scale={[1, 3.2, 1]} />
      </group>
      <mesh geometry={SPHERE} material={additiveMaterial('#ffd84a', 0.45)} position={[0, 1.9, 0]} scale={[1.3, 0.4, 0.8]} />
      {[[-0.6, 0.3], [0.3, -0.2], [0.8, 0.4], [-0.1, 0.1]].map(([x, z], i) => (
        <mesh key={i} geometry={CYL} material={goldMat} position={[x, 1.85 + i * 0.05, z]} scale={[0.28, 0.06, 0.28]} />
      ))}
      <Label text="Treasure!" style="gold" height={0.6} position={[0, 3.4, 0]} billboard />
    </group>
  )
}

/* ---- Stage props --------------------------------------------------------------- */

function Arch({ p }) {
  const w = p.w || 20
  return (
    <group position={[p.x, p.y, p.z]}>
      {[1, -1].map((s) => (
        <mesh key={s} geometry={BOX} material={stoneMat} position={[s * (w / 2 + 1), 5, 0]} scale={[2, 10, 3]} castShadow />
      ))}
      <mesh geometry={BOX} material={stoneMat} position={[0, 10.5, 0]} scale={[w + 4, 3, 3]} castShadow />
      <mesh geometry={BOX} material={surfaceMaterial('#2fbf5a', 'stud')} position={[0, 12.2, 0]} scale={[w + 4.4, 0.5, 3.4]} />
      <Label text={p.label || 'BOULDERS!'} style="warn" height={1.4} position={[0, 10.5, 1.55]} />
    </group>
  )
}

const bowlingMat = std('#3f7bff', { roughness: 0.15, metalness: 0.2 })
function BigBall({ p }) {
  const mat = useMemo(() => std(p.c || '#3f7bff', { roughness: 0.15, metalness: 0.2 }), [p.c])
  return (
    <Spin speed={0.4} axis="x" position={[p.x, p.y, p.z]}>
      <mesh geometry={SPHERE} material={p.c ? mat : bowlingMat} scale={p.r || 4} castShadow />
      {[[-0.35, 0.82], [0.35, 0.82], [0, 0.6]].map(([x, y], i) => (
        <mesh key={i} geometry={SPHERE_LO} material={std('#0d1030')} position={[x * (p.r || 4), y * (p.r || 4), 0.42 * (p.r || 4)]} scale={(p.r || 4) * 0.12} />
      ))}
    </Spin>
  )
}

const crocMat = std('#3f8a3a', { roughness: 0.7, flatShading: true })
const crocBelly = std('#9fd06a', { roughness: 0.7 })
function Croc({ p }) {
  return (
    <Bob amp={0.06} speed={0.9} phase={p.x} roll={0.02} position={[p.x, p.y, p.z]} rotation={[0, p.ry || 0, 0]}>
      <mesh geometry={BOX} material={crocMat} position={[0, 0.15, 0]} scale={[1.2, 0.6, 3.6]} />
      <mesh geometry={BOX} material={crocMat} position={[0, 0.1, 2.3]} scale={[0.9, 0.42, 1.4]} />
      <mesh geometry={BOX} material={crocBelly} position={[0, -0.02, 2.3]} scale={[0.85, 0.12, 1.36]} />
      <mesh geometry={BOX} material={crocMat} position={[0, 0.05, -2.4]} scale={[0.6, 0.35, 1.6]} />
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh geometry={SPHERE_LO} material={whiteMat} position={[s * 0.3, 0.5, 1.75]} scale={0.18} />
          <mesh geometry={SPHERE_LO} material={std('#111')} position={[s * 0.3, 0.52, 1.88]} scale={0.08} />
        </group>
      ))}
      {[-1, 0, 1].map((z) => (
        <mesh key={z} geometry={BOX} material={crocMat} position={[0, 0.5, z * 0.9]} scale={[0.3, 0.2, 0.4]} />
      ))}
    </Bob>
  )
}

let REEDS = null
const reedsGeo = () =>
  (REEDS ||= bakeParts(
    [[0, 0], [0.4, 0.2], [-0.35, 0.3], [0.2, -0.4], [-0.2, -0.25], [0.5, -0.1]].flatMap(([x, z], i) => {
      const h = 2 + (i % 3) * 0.5
      return [
        [CYL, [x, h / 2, z], [0.04, h, 0.04], '#3f9a2a'],
        [CYL, [x, h + 0.15, z], [0.09, 0.45, 0.09], '#7a4a22'],
      ]
    }),
  ))
function Reeds({ p }) {
  return <mesh geometry={reedsGeo()} material={vcMat} position={[p.x, p.y, p.z]} />
}

function Raft({ p }) {
  return (
    <Bob amp={0.12} speed={1.2} phase={p.z} roll={0.05} position={[p.x, p.y, p.z]} rotation={[0, p.ry || 0, 0]}>
      {[-0.8, 0, 0.8].map((x) => (
        <mesh key={x} geometry={CYL} material={woodMat} position={[x, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.38, 3.6, 0.38]} />
      ))}
      <group position={[0, 0.5, 0]} scale={1.1}>
        <Capybara id="classic" look="shades" particles={false} />
      </group>
    </Bob>
  )
}

const steamMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false })
function Steam({ r }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    g.children.forEach((c, i) => {
      const k = (clock.elapsedTime * 0.25 + i / g.children.length) % 1
      const a = i * 2.4
      c.position.set(Math.cos(a) * r * 0.5, 0.3 + k * 4, Math.sin(a) * r * 0.5)
      c.scale.setScalar(0.4 + k * 1.4)
    })
  })
  return (
    <group ref={ref}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} geometry={SPHERE_LO} material={steamMat} />
      ))}
    </group>
  )
}

const spaStonesCache = new Map()
function Spa({ p }) {
  const r = p.r || 4
  const stones = useMemo(() => {
    if (!spaStonesCache.has(r)) {
      const list = Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2
        const s = 0.7 + ((i * 37) % 10) / 22
        return [SPHERE_LO, [Math.cos(a) * (r + 0.2), 0.15, Math.sin(a) * (r + 0.2)], [s, s * 0.55, s], i % 2 ? '#8a8fa8' : '#a4aabd']
      })
      spaStonesCache.set(r, bakeParts(list))
    }
    return spaStonesCache.get(r)
  }, [r])
  const water = useMemo(() => liquidMaterial('spring'), [])
  const two = r >= 4.4
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh geometry={CYL} material={water} position={[0, 0.25, 0]} scale={[r, 0.1, r]} />
      <mesh geometry={stones} material={vcMat} />
      <group position={[two ? -1.1 : 0, -0.3, 0]} rotation={[0, 0.6, 0]}>
        <Capybara id="classic" look="spa" particles={false} />
      </group>
      {two && (
        <group position={[1.3, -0.3, 0.4]} rotation={[0, -0.9, 0]}>
          <Capybara id="choco" look="yuzu" particles={false} />
        </group>
      )}
      {[0, 1, 2].map((i) => (
        <Bob key={i} amp={0.05} speed={1.6} phase={i * 2} position={[Math.cos(i * 2.2) * r * 0.6, 0.35, Math.sin(i * 2.2) * r * 0.6]}>
          <mesh geometry={SPHERE_LO} material={std('#ffb21a', { emissive: '#ff8a00', emissiveIntensity: 0.15 })} scale={0.28} />
        </Bob>
      ))}
      <Steam r={r} />
      <Label text="Capy Spa" style="gold" height={0.7} position={[0, 3.2, 0]} billboard />
    </group>
  )
}

const lanternGlow = new MeshBasicMaterial({ color: '#ff6a4a', toneMapped: false })
function Lantern({ p }) {
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh geometry={BOX} material={woodMat} position={[0, 1.6, 0]} scale={[0.22, 3.2, 0.22]} castShadow />
      <mesh geometry={BOX} material={woodMat} position={[0.4, 3.15, 0]} scale={[0.9, 0.14, 0.14]} />
      <mesh geometry={SPHERE_LO} material={lanternGlow} position={[0.75, 2.55, 0]} scale={[0.32, 0.42, 0.32]} />
      <mesh geometry={SPHERE_LO} material={additiveMaterial('#ffb070', 0.18)} position={[0.75, 2.55, 0]} scale={0.8} />
    </group>
  )
}

let CRATE = null
const crateGeo = () =>
  (CRATE ||= bakeParts([
    [BOX, [0, 0.6, 0], [1.6, 1.2, 1.6], '#b07a46'],
    [BOX, [0, 0.6, 0.81], [1.62, 0.18, 0.04], '#7a4a22'],
    [BOX, [0, 0.6, -0.81], [1.62, 0.18, 0.04], '#7a4a22'],
    ...[[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4], [0, 0]].map(([x, z], i) => [SPHERE_LO, [x, 1.38 + (i === 4 ? 0.3 : 0), z], 0.36, i % 2 ? '#ff9a1a' : '#ffb21a']),
  ]))
function Crate({ p }) {
  return <mesh geometry={crateGeo()} material={vcMat} position={[p.x, p.y, p.z]} castShadow />
}

function Temple({ p }) {
  return (
    <group position={[p.x, p.y, p.z]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={BOX} material={goldMat} position={[0, 0.2 + i * 0.4, -4 - i * 1.2]} scale={[22 - i * 2, 0.4, 6]} receiveShadow />
      ))}
      {[-8, -4, 4, 8].map((x) => (
        <mesh key={x} geometry={CYL} material={goldMat} position={[x, 7, -6]} scale={[0.8, 12, 0.8]} castShadow />
      ))}
      <mesh geometry={BOX} material={goldMat} position={[0, 13.5, -6]} scale={[20, 1.2, 4]} castShadow />
      <mesh geometry={PRISM} material={goldMat} position={[0, 16, -6]} rotation={[Math.PI / 2, 0, Math.PI / 2]} scale={[3, 4, 10]} />
      <Label text="GOLDEN TEMPLE" style="gold" height={1.5} position={[0, 13.5, -3.95]} />
    </group>
  )
}

function GoldenCapy({ p }) {
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh geometry={CYL} material={goldMat} position={[0, 0.6, 0]} scale={[2.6, 1.2, 2.6]} castShadow />
      <Spin speed={0.4} position={[0, 1.2, 0]} scale={p.s || 3}>
        <Capybara id="golden" />
      </Spin>
    </group>
  )
}

function FirePillar({ p }) {
  const flames = useRef()
  useFrame(({ clock }) => {
    if (!flames.current) return
    flames.current.children.forEach((f, i) => {
      const t = clock.elapsedTime * 3 + i
      f.scale.y = 2.5 + Math.sin(t) * 0.8
      f.position.y = 6 + Math.sin(t * 1.3) * 0.2
    })
  })
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh geometry={HEX} material={std('#3a2622', { flatShading: true })} position={[0, 2.5, 0]} scale={[1.4, 5, 1.4]} castShadow />
      <group ref={flames}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={CONE} material={additiveMaterial(i ? '#ffb000' : '#ff4a00', 0.7)} position={[(i - 1) * 0.4, 6, 0]} scale={[0.9 - i * 0.15, 2.5, 0.9 - i * 0.15]} />
        ))}
      </group>
    </group>
  )
}

function Cloud({ p }) {
  const s = p.s || 4
  return (
    <group position={[p.x, p.y, p.z]} scale={s}>
      {[
        [0, 0, 0, 1],
        [0.9, -0.15, 0.1, 0.75],
        [-0.95, -0.1, -0.1, 0.8],
        [0.3, 0.45, 0, 0.7],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} geometry={SPHERE} material={whiteMat} position={[x, y, z]} scale={[r, r * 0.8, r]} />
      ))}
    </group>
  )
}

function Teleporter({ p }) {
  const beam = useRef()
  useFrame(({ clock }) => {
    if (beam.current) beam.current.material.opacity = 0.25 + Math.sin(clock.elapsedTime * 3) * 0.1
  })
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh geometry={CYL} material={surfaceMaterial('#29c8ff', 'neon')} position={[0, 0.06, 0]} scale={[1.6, 0.12, 1.6]} />
      <mesh ref={beam} geometry={CYL} position={[0, 3, 0]} scale={[1.5, 6, 1.5]}>
        <meshBasicMaterial color="#7fe8ff" transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
      </mesh>
      <Label text="Back to Lobby" style="label" height={0.7} position={[0, 3.2, 0]} billboard />
    </group>
  )
}

/* ---- Lobby decorations ---------------------------------------------------- */

const LAMP_GLOW = new MeshBasicMaterial({ color: '#fff3b0', toneMapped: false })
const LAMP_POST = std('#3a3f58', { roughness: 0.5, metalness: 0.4 })
const GREENS = ['#2fae3a', '#46d14f', '#1f9a4a']

let LAMP_POST_GEO = null
const lampPost = () =>
  (LAMP_POST_GEO ||= bakeParts([
    [CYL, [0, 0.25, 0], [0.55, 0.5, 0.55]],
    [CYL, [0, 2.2, 0], [0.14, 4, 0.14]],
    [CONE, [0, 4.95, 0], [0.5, 0.35, 0.5]],
  ]))

function Lamp({ p }) {
  const halo = useRef()
  useFrame(({ clock }) => {
    if (halo.current) halo.current.scale.setScalar(0.95 + Math.sin(clock.elapsedTime * 2 + p.x) * 0.08)
  })
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh geometry={lampPost()} material={LAMP_POST} castShadow />
      <mesh geometry={SPHERE_LO} material={LAMP_GLOW} position={[0, 4.5, 0]} scale={0.38} />
      <mesh ref={halo} geometry={SPHERE_LO} material={additiveMaterial('#ffd86a', 0.14)} position={[0, 4.5, 0]} scale={0.95} />
    </group>
  )
}

const bushMat = std('#ffffff', { flatShading: true, roughness: 0.85, vertexColors: true })
const FLOWERS = ['#ff5ad8', '#ffe14a', '#ffffff']
const bushGeos = [0, 1, 2].map((c) =>
  bakeParts([
    [SPHERE_LO, [0, 0.5, 0], [0.9, 0.62, 0.85], GREENS[c % 3]],
    [SPHERE_LO, [0.6, 0.38, 0.2], [0.55, 0.45, 0.5], GREENS[(c + 1) % 3]],
    [SPHERE_LO, [-0.55, 0.36, -0.1], [0.5, 0.42, 0.5], GREENS[(c + 2) % 3]],
    ...[
      [0.2, 1.0, 0.45],
      [-0.4, 0.85, 0.5],
      [0.7, 0.75, 0.35],
      [-0.1, 1.05, -0.3],
    ].map((pos, i) => [SPHERE_LO, pos, 0.1, FLOWERS[(i + c) % 3]]),
  ]),
)

function Bush({ p }) {
  return <mesh geometry={bushGeos[p.c % 3]} material={bushMat} position={[p.x, p.y, p.z]} scale={p.s || 1} castShadow />
}

/* ---- Stage-gate force field (shown only while you are below its level) ------- */

const fieldMat = new ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform float uTime; varying vec2 vUv;
    void main() {
      float hex = abs(sin(vUv.x * 60.0 + sin(vUv.y * 40.0) * 0.6)) * abs(sin(vUv.y * 34.0 - uTime * 1.5));
      float edge = smoothstep(0.08, 0.0, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
      float scan = smoothstep(0.96, 1.0, fract(vUv.y * 3.0 - uTime * 0.6));
      float a = 0.16 + hex * 0.12 + edge * 0.6 + scan * 0.25;
      gl_FragColor = vec4(mix(vec3(0.35, 0.85, 1.0), vec3(1.0, 0.45, 0.85), vUv.y * 0.6), a);
    }`,
  transparent: true,
  depthWrite: false,
  side: DoubleSide,
  blending: AdditiveBlending,
  toneMapped: false,
})
const FIELD = new BoxGeometry(1, 1, 0.05)

function ForceField({ p }) {
  const locked = useGame((s) => (s.profile?.level || 1) < p.req)
  useFrame(({ clock }) => {
    fieldMat.uniforms.uTime.value = clock.elapsedTime
  })
  if (!locked) return null
  return <mesh geometry={FIELD} material={fieldMat} position={[p.x, p.y + p.h / 2, p.z]} scale={[p.w, p.h, 1]} renderOrder={4} />
}

/* ---- Floor arrows: chevrons that pulse in the direction to go ---------------- */

const CHEVRON = (() => {
  const s = new Shape()
  s.moveTo(0, 0.42)
  s.lineTo(0.5, -0.08)
  s.lineTo(0.5, -0.42)
  s.lineTo(0, 0.08)
  s.lineTo(-0.5, -0.42)
  s.lineTo(-0.5, -0.08)
  s.closePath()
  const g = new ShapeGeometry(s)
  g.rotateX(-Math.PI / 2) // shape +y -> world -z
  return g
})()

function arrowMaterial(color) {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new Color(color) } },
    vertexShader: `
      attribute float aIdx; varying float vIdx;
      void main() { vIdx = aIdx; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; varying float vIdx;
      void main() {
        float wave = fract(uTime * 0.7 - vIdx * 0.11);
        float k = 0.35 + 0.65 * pow(1.0 - wave, 3.0);
        gl_FragColor = vec4(uColor * (0.55 + k * 0.9), 0.45 + k * 0.5);
      }`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    toneMapped: false,
  })
}

const _m = new Matrix4()
const _r = new Matrix4()
function FloorArrows({ p }) {
  const { geo, mat, mats } = useMemo(() => {
    const [x0, z0] = p.from
    const [x1, z1] = p.to
    const n = Math.max(1, Math.floor(Math.hypot(x1 - x0, z1 - z0) / p.gap))
    const ang = Math.atan2(-(x1 - x0), -(z1 - z0))
    const g = CHEVRON.clone()
    g.setAttribute('aIdx', new InstancedBufferAttribute(Float32Array.from({ length: n }, (_, i) => i), 1))
    const list = Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n
      return _m.makeScale(p.w, 1, p.w * 0.8).premultiply(_r.makeRotationY(ang)).setPosition(x0 + (x1 - x0) * t, p.y, z0 + (z1 - z0) * t).clone()
    })
    return { geo: g, mat: arrowMaterial(p.color), mats: list }
  }, [p])
  const ref = useRef()
  useLayoutEffect(() => {
    mats.forEach((m, i) => ref.current.setMatrixAt(i, m))
    ref.current.instanceMatrix.needsUpdate = true
  }, [mats])
  useEffect(() => () => geo.dispose(), [geo])
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
  })
  return <instancedMesh ref={ref} args={[geo, mat, mats.length]} frustumCulled={false} renderOrder={3} />
}

export const Props = memo(function Props({ props }) {
  return props.map((p, i) => {
    switch (p.type) {
      case 'capy':
        return <CapyNpc key={i} p={p} />
      case 'welcome':
        return <Welcome key={i} p={p} />
      case 'board':
        return <Board key={i} p={p} />
      case 'hintArrow':
        return <HintArrow key={i} p={p} />
      case 'chest':
        return <Chest key={i} p={p} />
      case 'arch':
        return <Arch key={i} p={p} />
      case 'bigBall':
        return <BigBall key={i} p={p} />
      case 'croc':
        return <Croc key={i} p={p} />
      case 'reeds':
        return <Reeds key={i} p={p} />
      case 'raft':
        return <Raft key={i} p={p} />
      case 'spa':
        return <Spa key={i} p={p} />
      case 'lantern':
        return <Lantern key={i} p={p} />
      case 'crate':
        return <Crate key={i} p={p} />
      case 'lamp':
        return <Lamp key={i} p={p} />
      case 'bush':
        return <Bush key={i} p={p} />
      case 'temple':
        return <Temple key={i} p={p} />
      case 'goldenCapy':
        return <GoldenCapy key={i} p={p} />
      case 'firePillar':
        return <FirePillar key={i} p={p} />
      case 'cloud':
        return <Cloud key={i} p={p} />
      case 'teleporter':
        return <Teleporter key={i} p={p} />
      case 'arrows':
        return <FloorArrows key={i} p={p} />
      case 'forcefield':
        return <ForceField key={i} p={p} />
      default:
        return null
    }
  })
})

export default Props
