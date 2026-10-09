import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  MeshBasicMaterial,
  CylinderGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  Matrix4,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three'

import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { useGame } from '../../state/store'
import Duck from '../Duck'
import { additiveMaterial, liquidMaterial, surfaceMaterial } from '../materials'
import { Label } from './Signs'

const BOX = new BoxGeometry(1, 1, 1)
const CYL = new CylinderGeometry(1, 1, 1, 24)
const HEX = new CylinderGeometry(1, 1, 1, 6)
const CONE = new ConeGeometry(1, 1, 16)
const SPHERE = new SphereGeometry(1, 28, 20)
const SPHERE_LO = new SphereGeometry(1, 14, 10)
const TORUS = new TorusGeometry(1, 0.12, 16, 64)
const DISC = new CylinderGeometry(1, 1, 0.05, 48)
const PRISM = new CylinderGeometry(1, 1, 1, 3)

const std = (color, extra = {}) => new MeshStandardMaterial({ color: new Color(color), roughness: 0.6, ...extra })
const demonSkin = std('#a3101c', { emissive: '#4a0008', emissiveIntensity: 0.5, roughness: 0.5 })
const demonDark = std('#3a0508', { roughness: 0.7 })
const eyeGlow = std('#ffe14a', { emissive: '#ffcc00', emissiveIntensity: 3 })
const stoneMat = std('#6b6f86', { roughness: 0.9 })
const goldMat = std('#ffcc1a', { metalness: 0.8, roughness: 0.25, emissive: '#ff9a00', emissiveIntensity: 0.25 })
const whiteMat = std('#ffffff', { roughness: 0.9, flatShading: true })
const fanMat = std('#cfd8e6', { metalness: 0.5, roughness: 0.35 })
const fanDark = std('#3a4152', { metalness: 0.4, roughness: 0.5 })

/** Animated swirl used for portals. */
export function swirlMaterial(a, b) {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: new Color(a) }, uB: { value: new Color(b) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
      void main(){
        vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
        float s = sin(a * 4.0 + r * 10.0 - uTime * 4.0) * 0.5 + 0.5;
        vec3 col = mix(uA, uB, s) + vec3(1.0) * pow(1.0 - r, 3.0) * 0.8;
        float alpha = smoothstep(1.0, 0.85, r);
        gl_FragColor = vec4(col, alpha * 0.92);
      }`,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  })
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

function Demon({ p }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.y = p.s * (1 + Math.sin(clock.elapsedTime * 1.5) * 0.02)
  })
  return (
    <group ref={ref} position={[p.x, p.y, p.z]} scale={p.s}>
      <mesh geometry={SPHERE} material={demonSkin} position={[0, 2.6, 0]} scale={[1.6, 2.2, 1.2]} castShadow />
      <mesh geometry={SPHERE} material={demonSkin} position={[0, 5.2, 0.2]} scale={[1.05, 1.0, 1.0]} castShadow />
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh geometry={CONE} material={demonDark} position={[s * 0.75, 6.2, 0.1]} rotation={[0, 0, -s * 0.5]} scale={[0.28, 1.2, 0.28]} />
          <mesh geometry={SPHERE} material={eyeGlow} position={[s * 0.38, 5.35, 1.0]} scale={0.16} />
          <mesh geometry={SPHERE} material={demonSkin} position={[s * 1.9, 2.8, 0.3]} rotation={[0, 0, s * 0.5]} scale={[0.45, 1.6, 0.45]} castShadow />
          <mesh geometry={BOX} material={demonDark} position={[s * 2.6, 4.2, -0.9]} rotation={[0.2, s * 0.5, s * 0.6]} scale={[2.8, 2.2, 0.12]} />
          <mesh geometry={SPHERE} material={demonDark} position={[s * 0.7, 0.4, 0]} scale={[0.5, 0.8, 0.6]} />
        </group>
      ))}
      <pointLight color="#ff2020" intensity={30} distance={18} position={[0, 4, 3]} />
    </group>
  )
}

function Arch({ p }) {
  const w = p.w || 20
  return (
    <group position={[p.x, p.y, p.z]}>
      {[1, -1].map((s) => (
        <mesh key={s} geometry={BOX} material={stoneMat} position={[s * (w / 2 + 1), 5, 0]} scale={[2, 10, 3]} castShadow />
      ))}
      <mesh geometry={BOX} material={stoneMat} position={[0, 10.5, 0]} scale={[w + 4, 3, 3]} castShadow />
      <Label text="BOULDERS!" style="warn" height={1.4} position={[0, 10.5, 1.55]} />
    </group>
  )
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
      <pointLight color="#ffd84a" intensity={60} distance={30} position={[0, 8, 0]} />
    </group>
  )
}

function GoldenDuck({ p }) {
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh geometry={CYL} material={goldMat} position={[0, 0.6, 0]} scale={[2.6, 1.2, 2.6]} castShadow />
      <Spin speed={0.4} position={[0, 1.2, 0]} scale={p.s || 3}>
        <Duck id="golden" particles />
      </Spin>
    </group>
  )
}

function Fan({ p }) {
  const blades = useRef()
  useFrame((_s, dt) => {
    if (blades.current) blades.current.rotation.x += dt * 14
  })
  return (
    <group position={[p.x, p.y + 1.6, p.z]} rotation={[0, p.dir > 0 ? 0 : Math.PI, 0]}>
      <mesh geometry={CYL} material={fanDark} rotation={[0, 0, Math.PI / 2]} scale={[2.6, 1.2, 2.6]} castShadow />
      <group ref={blades} position={[0.7, 0, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} geometry={BOX} material={fanMat} rotation={[(i / 4) * Math.PI * 2, 0, 0]} position={[0, 0, 0]} scale={[0.1, 4.4, 0.7]} />
        ))}
      </group>
      <mesh geometry={CYL} material={fanDark} position={[0, -2.6, 0]} scale={[0.4, 2.6, 0.4]} />
    </group>
  )
}

function Column({ p }) {
  const h = p.h || 12
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh geometry={CYL} material={std('#c9a46a')} position={[0, h / 2, 0]} scale={[0.9, h, 0.9]} castShadow />
      <mesh geometry={BOX} material={std('#b08a4a')} position={[0, h + 0.3, 0]} scale={[2.4, 0.6, 2.4]} castShadow />
      <mesh geometry={BOX} material={std('#b08a4a')} position={[0, 0.3, 0]} scale={[2.4, 0.6, 2.4]} />
    </group>
  )
}

function Crystals({ p }) {
  const mats = useMemo(() => [surfaceMaterial('#7ff7ff', 'crystal'), surfaceMaterial('#ff7af0', 'crystal'), surfaceMaterial('#b48cff', 'crystal')], [])
  const s = p.s || 1
  return (
    <group position={[p.x, p.y, p.z]} scale={s}>
      {[
        [0, 0, 0, 1, 4, 0],
        [0.9, 0, 0.4, 0.6, 2.6, 0.4],
        [-0.8, 0, -0.3, 0.7, 3, -0.35],
        [0.2, 0, -0.9, 0.5, 2, 0.2],
      ].map(([x, y, z, r, h, tilt], i) => (
        <mesh key={i} geometry={HEX} material={mats[i % 3]} position={[x, y + h / 2, z]} rotation={[tilt, 0, tilt]} scale={[r, h, r]} />
      ))}
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
      <pointLight color="#ff7a1a" intensity={25} distance={14} position={[0, 7, 0]} />
    </group>
  )
}

function Cloud({ p }) {
  const s = p.s || 4
  const mat = useMemo(() => (p.tint ? std(p.tint, { roughness: 1, flatShading: true }) : whiteMat), [p.tint])
  return (
    <group position={[p.x, p.y, p.z]} scale={s}>
      {[
        [0, 0, 0, 1],
        [0.9, -0.15, 0.1, 0.75],
        [-0.95, -0.1, -0.1, 0.8],
        [0.3, 0.45, 0, 0.7],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} geometry={SPHERE} material={mat} position={[x, y, z]} scale={[r, r * 0.8, r]} />
      ))}
    </group>
  )
}

const PORTAL_COLORS = ['#29c8ff', '#7a3dff']
export function Portal({ x, y, z, ry = 0, title, sub, colors = PORTAL_COLORS, scale = 1 }) {
  const [ca, cb] = colors
  const mat = useMemo(() => swirlMaterial(ca, cb), [ca, cb])
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
  })
  return (
    <group position={[x, y, z]} rotation={[0, ry, 0]} scale={scale}>
      <mesh geometry={BOX} material={surfaceMaterial('#27304c', 'smooth')} position={[0, 0.17, 0]} scale={[9.4, 0.3, 3.2]} receiveShadow />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 4.05, 0, 0]}>
          <mesh geometry={BOX} material={surfaceMaterial('#283754', 'smooth')} position={[0, 3.9, -0.1]} scale={[0.72, 7.6, 0.9]} castShadow />
          <mesh geometry={BOX} material={goldMat} position={[0, 0.34, 0]} scale={[1.15, 0.38, 1.3]} />
          <mesh geometry={BOX} material={goldMat} position={[0, 7.75, 0]} scale={[1.15, 0.38, 1.3]} />
          <mesh geometry={BOX} material={additiveMaterial(ca, 0.8)} position={[0, 3.9, 0.38]} scale={[0.12, 6.7, 0.06]} />
        </group>
      ))}
      <mesh geometry={BOX} material={surfaceMaterial('#283754', 'smooth')} position={[0, 8.1, -0.1]} scale={[9.1, 0.6, 1]} castShadow />
      <mesh geometry={TORUS} material={additiveMaterial(ca, 0.95)} position={[0, 4.2, 0]} scale={3.6} />
      <mesh geometry={TORUS} material={surfaceMaterial('#1b2140', 'smooth')} position={[0, 4.2, -0.75]} scale={[3.95, 3.95, 1.6]} />
      <mesh geometry={DISC} material={mat} position={[0, 4.2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[3.45, 1, 3.45]} />
      <Spin speed={0.6} axis="z" position={[0, 4.2, 0.1]}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const a = (i / 8) * Math.PI * 2
          return <mesh key={i} geometry={BOX} material={additiveMaterial('#ffffff', 0.85)} position={[Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0]} rotation={[0, 0, a]} scale={[0.15, 0.6, 0.15]} />
        })}
      </Spin>
      {title && <Label text={title} style="stage" height={1.3} position={[0, 9.2, 0.2]} px={140} />}
      {sub && <Label text={sub} style="gold" height={0.58} position={[0, 7.7, 0.48]} />}
      <pointLight color={ca} intensity={35} distance={16} position={[0, 4, 2]} />
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
const bushMats = GREENS.map((c) => std(c, { flatShading: true, roughness: 0.85 }))
const flowerMats = ['#ff5ad8', '#ffe14a', '#ffffff'].map((c) => std(c, { emissive: c, emissiveIntensity: 0.3 }))
const WATER_DISC = new CylinderGeometry(1, 1, 0.12, 48)
const RAINBOW = ['#ff3a3a', '#ff8a1a', '#ffe11a', '#3dff5a', '#29c8ff', '#6b6bff', '#c23dff']

/** Bakes transformed copies of geometries (optionally vertex-coloured) into one mesh. */
function bakeParts(list) {
  const geos = list.map(([geo, pos, scale, color]) => {
    const src = geo.index ? geo.toNonIndexed() : geo.clone()
    const g = new BufferGeometry()
    for (const k of ['position', 'normal']) g.setAttribute(k, src.attributes[k])
    g.scale(...(Array.isArray(scale) ? scale : [scale, scale, scale])).translate(...pos)
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

function WelcomeArch({ p }) {
  return (
    <group position={[p.x, p.y, p.z]}>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 5.6, 0, 0]}>
          <mesh geometry={BOX} material={std('#4a4f6e', { roughness: 0.8 })} position={[0, 4.6, 0]} scale={[1.5, 9.2, 1.5]} castShadow />
          <mesh geometry={BOX} material={goldMat} position={[0, 0.35, 0]} scale={[2.1, 0.7, 2.1]} />
          <mesh geometry={BOX} material={goldMat} position={[0, 9.3, 0]} scale={[2.1, 0.6, 2.1]} />
        </group>
      ))}
      {/* Bands are thinner than their spacing (and staggered in depth) so neighbours never
          intersect - overlapping tubes z-fight along their seams. */}
      {RAINBOW.map((c, i) => (
        <mesh key={c} position={[0, 9.4, (i % 2) * 0.06]}>
          <torusGeometry args={[5.1 - i * 0.34, 0.16, 8, 48, Math.PI]} />
          <meshBasicMaterial color={c} toneMapped={false} />
        </mesh>
      ))}
      <Label text="+1 Speed Duck Escape" style="stage" height={1.5} position={[0, 12.8, 0.1]} px={140} />
      <Label text="Waddle faster. Win bigger!" style="gold" height={0.7} position={[0, 11.1, 0.1]} />
    </group>
  )
}

function Bob({ children, r, speed, phase, y = 0.2 }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime * speed + phase
    ref.current.position.set(Math.cos(t) * r, y + Math.sin(clock.elapsedTime * 2 + phase) * 0.05, Math.sin(t) * r)
    ref.current.rotation.y = -t
  })
  return <group ref={ref}>{children}</group>
}

function Pond({ p }) {
  const water = useMemo(() => liquidMaterial('water'), [])
  const stones = useMemo(() => Array.from({ length: 16 }, (_, i) => [Math.cos((i / 16) * 6.28) * (p.r + 0.4), Math.sin((i / 16) * 6.28) * (p.r + 0.4), 0.7 + ((i * 37) % 10) / 20]), [p.r])
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh geometry={WATER_DISC} material={water} position={[0, 0.07, 0]} scale={[p.r, 1, p.r]} />
      {stones.map(([x, z, s], i) => (
        <mesh key={i} geometry={SPHERE} material={stoneMat} position={[x, 0.2, z]} scale={[s, s * 0.5, s]} castShadow />
      ))}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = i * 1.3 + 0.4
        return (
          <group key={i} position={[Math.cos(a) * p.r * 0.62, 0.15, Math.sin(a) * p.r * 0.62]}>
            <mesh geometry={DISC} material={bushMats[0]} scale={0.8} />
            <mesh geometry={SPHERE} material={flowerMats[i % 3]} position={[0.1, 0.12, 0]} scale={[0.16, 0.1, 0.16]} />
          </group>
        )
      })}
      {[0, 1, 2].map((i) => (
        <Bob key={i} r={p.r * (0.3 + i * 0.16)} speed={0.25 + i * 0.07} phase={i * 2.1} y={0.1}>
          <group scale={0.3}>
            <Duck id={['rubber', 'love', 'frost'][i]} particles={false} glow={false} />
          </group>
        </Bob>
      ))}
      <Label text="Duck Pond" style="gold" height={0.7} position={[0, 2.6, 0]} billboard />
    </group>
  )
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
      case 'demon':
        return <Demon key={i} p={p} />
      case 'arch':
        return p.w ? <Arch key={i} p={p} /> : <WelcomeArch key={i} p={p} />
      case 'lamp':
        return <Lamp key={i} p={p} />
      case 'bush':
        return <Bush key={i} p={p} />
      case 'pond':
        return <Pond key={i} p={p} />
      case 'temple':
        return <Temple key={i} p={p} />
      case 'goldenDuck':
        return <GoldenDuck key={i} p={p} />
      case 'fan':
        return <Fan key={i} p={p} />
      case 'column':
        return <Column key={i} p={p} />
      case 'crystals':
        return <Crystals key={i} p={p} />
      case 'firePillar':
        return <FirePillar key={i} p={p} />
      case 'cloud':
        return <Cloud key={i} p={p} />
      case 'worldGate':
        return <Portal key={i} x={p.x} y={p.y} z={p.z} title="World 2" sub="Needs 3 Rebirths" />
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
