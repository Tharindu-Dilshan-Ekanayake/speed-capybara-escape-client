import { useFrame } from '@react-three/fiber'
import { memo, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute as Attr,
  Euler,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  ExtrudeGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  Shape,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from 'three'

import { duckById } from '../shared/gameData'
import { DUCK_BILL, DUCK_BODY, DUCK_NECK, DUCK_TAIL, DUCK_WING } from './duckGeometry'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { additiveMaterial } from './materials'
import { shapeTexture } from './textures'

/**
 * Sculpted anime duck: one tapered torso, a slender neck and scalloped feather wings.
 * Skin identities use colour, accessories and particles.
 *
 * Local frame: facing +z, feet at y = 0, about 1.6 m tall.
 */

const SPHERE = new SphereGeometry(1, 28, 20)
/** Low-poly sphere for the small face parts (eyes, nostrils, cheeks). */
const SPHERE_LO = new SphereGeometry(1, 14, 10)
const CYL = new CylinderGeometry(1, 1, 1, 24)
const CONE = new ConeGeometry(1, 1, 18)
const HALO = new TorusGeometry(1, 0.09, 12, 40)
/** Upper lash line of an anime eye: a thick arc over the top of the eye. */
const LASH = new TorusGeometry(1, 0.16, 8, 24, Math.PI * 0.8)
const TOON_RAMP = new DataTexture(new Uint8Array([85, 150, 208, 255]), 4, 1, RedFormat)
TOON_RAMP.minFilter = TOON_RAMP.magFilter = NearestFilter
TOON_RAMP.needsUpdate = true
const toon = (color, extra = {}) => new MeshToonMaterial({ color, gradientMap: TOON_RAMP, ...extra })

/** Anime ink line: back faces pushed out along their normals (inverted hull). */
const outline = (color, thick = 0.022) =>
  new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uThick: { value: thick } },
    vertexShader: `
      uniform float uThick;
      void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normalize(normal) * uThick, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); }`,
    side: BackSide,
  })

const FOOT = (() => {
  const s = new Shape()
  s.moveTo(0, -0.04)
  s.lineTo(-0.17, 0.26)
  s.quadraticCurveTo(-0.11, 0.3, -0.06, 0.24)
  s.quadraticCurveTo(0, 0.31, 0.06, 0.24)
  s.quadraticCurveTo(0.11, 0.3, 0.17, 0.26)
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 })
  g.rotateX(Math.PI / 2)
  return g
})()

let crackTex = null
function crackTexture() {
  if (crackTex) return crackTex
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, 256, 256)
  g.strokeStyle = '#fff'
  g.lineWidth = 3
  for (let i = 0; i < 26; i += 1) {
    let x = Math.random() * 256
    let y = Math.random() * 256
    g.beginPath()
    g.moveTo(x, y)
    for (let k = 0; k < 6; k += 1) {
      x += (Math.random() - 0.5) * 40
      y += (Math.random() - 0.5) * 40
      g.lineTo(x, y)
    }
    g.stroke()
  }
  crackTex = new CanvasTexture(c)
  crackTex.colorSpace = SRGBColorSpace
  return crackTex
}

/* ------------------------------------------------------------------ */
/* Baking: many small static parts -> one mesh (one draw call)          */
/* ------------------------------------------------------------------ */

const _m4 = new Matrix4()
const _q = new Quaternion()
const _e = new Euler()
const _p = new Vector3()
const _s = new Vector3()

/** A transformed copy of `geo` (position / normal / uv only), optionally vertex-coloured. */
function part(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
  const src = geo.index ? geo.toNonIndexed() : geo.clone()
  const g = new BufferGeometry()
  for (const k of ['position', 'normal', 'uv']) g.setAttribute(k, src.attributes[k])
  const sc = Array.isArray(scale) ? scale : [scale, scale, scale]
  g.applyMatrix4(_m4.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...sc)))
  if (color) {
    const c = new Color(color)
    const n = g.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i += 1) arr.set([c.r, c.g, c.b], i * 3)
    g.setAttribute('color', new Attr(arr, 3))
  }
  return g
}
const bake = (parts) => {
  const g = mergeGeometries(parts, false)
  parts.forEach((x) => x.dispose())
  g.computeBoundingSphere()
  return g
}

/** The three small feathers under each folded wing. */
const FEATHERS = [1, -1].map((s) =>
  bake([0, 1, 2].map((i) => part(DUCK_WING, null, [s * (0.052 + i * 0.005), -0.04 - i * 0.035, -0.12 - i * 0.06], [0, 0, 0], [0.7, 0.32, 0.52]))),
)
/** Leg + webbed foot (one per side, animated by its parent group). */
let LEG = null
const legGeometry = () =>
  (LEG ||= bake([part(CYL, null, [0, -0.2, 0], [0, 0, 0], [0.05, 0.4, 0.05]), part(FOOT, null, [0, -0.38, -0.04], [0, 0, 0], 1.15)]))
/** Both blush cheeks. */
const CHEEKS = bake([1, -1].map((s) => part(SPHERE_LO, null, [s * 0.26, -0.085, 0.23], [0, s * 0.8, 0], [0.07, 0.04, 0.02])))
/** Vertex-coloured, unlit: anime eyes read best flat. */
const eyeMaterial = new MeshBasicMaterial({ vertexColors: true, toneMapped: false })

const bakedCache = new Map()
/** Per-duck baked eyes (iris colour) and bill (beak colour). */
function bakedParts(def, iris) {
  if (bakedCache.has(def.id)) return bakedCache.get(def.id)
  const seam = new Color(def.beak).multiplyScalar(0.65)
  const eye = (s) =>
    bake([
      part(SPHERE_LO, '#111018', [0, 0, 0], [0, 0, 0], [0.092, 0.125, 0.04]),
      part(SPHERE_LO, iris, [0, -0.03, 0.012], [0, 0, 0], [0.07, 0.075, 0.034]),
      part(SPHERE_LO, '#0b0a12', [0, -0.022, 0.03], [0, 0, 0], [0.036, 0.046, 0.018]),
      part(SPHERE_LO, '#ffffff', [s * -0.03, 0.045, 0.036], [0, 0, 0], [0.032, 0.036, 0.012]),
      part(SPHERE_LO, '#ffffff', [s * 0.03, -0.055, 0.036], [0, 0, 0], 0.014),
      part(LASH, '#1a1020', [0, -0.004, 0.022], [0, 0, Math.PI * 0.1], [0.098, 0.128, 0.1]),
    ])
  const out = {
    eyeL: eye(1),
    eyeR: eye(-1),
    bill: bake([
      part(DUCK_BILL, def.beak, [0, -0.075, 0.29]),
      part(DUCK_BILL, seam, [0, -0.12, 0.29], [0, 0, 0], [0.95, 0.5, 0.95]),
      part(DUCK_BILL, def.beak, [0, -0.145, 0.29], [0, 0, 0], [0.92, 0.75, 0.9]),
      ...[1, -1].map((s) => part(SPHERE_LO, seam, [s * 0.085, -0.055, 0.55], [0, 0, 0], [0.018, 0.009, 0.025])),
    ]),
  }
  bakedCache.set(def.id, out)
  return out
}

const IRIS = ['#3b7bff', '#8a4dff', '#2fb86a', '#ff6a9a', '#ff9a1a', '#2ac7d8']
const matCache = new Map()
function duckMaterials(def) {
  if (matCache.has(def.id)) return matCache.get(def.id)
  const fx = def.fx || {}
  const bodyOptions = {
    color: new Color(def.body),
    emissive: new Color(fx.glow && !fx.gold ? fx.glow : def.body),
    emissiveIntensity: fx.ghost ? 0.4 : fx.glow ? 0.16 : 0.08,
    transparent: !!(fx.ghost || fx.crystal),
    opacity: fx.ghost ? 0.82 : fx.crystal ? 0.88 : 1,
  }
  const body = fx.gold || fx.crystal
    ? new MeshPhysicalMaterial({ ...bodyOptions, roughness: fx.gold ? 0.3 : 0.2, metalness: fx.gold ? 0.65 : 0.15 })
    : toon(def.body, bodyOptions)
  if (fx.cracks) {
    body.emissiveMap = crackTexture()
    body.emissive = new Color(fx.cracks)
    body.emissiveIntensity = 1.6
  }
  const featherColor = new Color(fx.wings || def.body).lerp(new Color('#ffffff'), 0.13)
  const ink = new Color(def.body).multiplyScalar(0.28).lerp(new Color('#2a1530'), 0.35)
  const m = {
    ink: outline(ink, 0.024),
    inkHead: outline(ink, 0.06),
    iris: new MeshStandardMaterial({ color: fx.eye || IRIS[def.id.length % IRIS.length], emissive: fx.eye || IRIS[def.id.length % IRIS.length], emissiveIntensity: 0.35, roughness: 0.2 }),
    lid: new MeshStandardMaterial({ color: '#1a1020', roughness: 0.6 }),
    body,
    beak: toon(def.beak, { emissive: def.beak, emissiveIntensity: 0.12 }),
    bill: toon('#ffffff', { vertexColors: true }),
    billSeam: toon(new Color(def.beak).multiplyScalar(0.65)),
    feet: toon(def.beak, { emissive: def.beak, emissiveIntensity: 0.08 }),
    eye: new MeshStandardMaterial({ color: '#111018', roughness: 0.15 }),
    shine: new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.6 }),
    cheek: new MeshStandardMaterial({ color: '#ff8fb3', transparent: true, opacity: 0.55, roughness: 0.6 }),
    black: new MeshStandardMaterial({ color: '#15151c', roughness: 0.5 }),
    band: new MeshStandardMaterial({ color: '#d4142e', roughness: 0.5 }),
    gold: new MeshStandardMaterial({ color: '#ffcc1a', roughness: 0.25, metalness: 0.85, emissive: '#ff9a00', emissiveIntensity: 0.2 }),
    horn: new MeshStandardMaterial({ color: fx.horns || '#ff6a00', emissive: fx.horns || '#ff6a00', emissiveIntensity: 0.7 }),
    wing: toon(fx.wings || def.body, {
      color: new Color(fx.wings || def.body),
      emissive: new Color(fx.wings || def.body),
      emissiveIntensity: fx.wings ? 0.35 : 0.04,
      transparent: !!fx.ghost,
      opacity: fx.ghost ? 0.8 : 1,
    }),
    feather: toon(featherColor, {
      color: featherColor,
      transparent: !!fx.ghost,
      opacity: fx.ghost ? 0.8 : 1,
    }),
  }
  matCache.set(def.id, m)
  return m
}

/* ------------------------------------------------------------------ */
/* Particles: one Points draw call per duck                             */
/* ------------------------------------------------------------------ */

const PARTICLE_SHAPE = { sparkle: 'star', fire: 'dot', hearts: 'heart', snow: 'snow', wind: 'dot', bolts: 'bolt', stars: 'star', bubbles: 'ring' }

const pointsMaterial = (shape, color) =>
  new ShaderMaterial({
    uniforms: { uMap: { value: shapeTexture(shape) }, uColor: { value: new Color(color) } },
    vertexShader: `
      attribute float aSize; attribute float aAlpha; varying float vA;
      void main() {
        vA = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform vec3 uColor; varying float vA;
      void main() {
        vec4 t = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(uColor * t.rgb, t.a * vA);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })

const N = 16
function DuckParticles({ type, color, scale = 1 }) {
  const ref = useRef()
  const data = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(N * 3), 3))
    geo.setAttribute('aSize', new BufferAttribute(new Float32Array(N), 1))
    geo.setAttribute('aAlpha', new BufferAttribute(new Float32Array(N), 1))
    const seeds = Array.from({ length: N }, () => ({ a: Math.random() * 6.28, r: 0.5 + Math.random() * 0.6, s: Math.random(), off: Math.random() }))
    return { geo, seeds, mat: pointsMaterial(PARTICLE_SHAPE[type] || 'dot', color) }
  }, [type, color])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pos = data.geo.attributes.position.array
    const size = data.geo.attributes.aSize.array
    const alpha = data.geo.attributes.aAlpha.array
    data.seeds.forEach((sd, i) => {
      const life = (t * (type === 'fire' ? 1.3 : 0.45) + sd.off) % 1
      let x
      let y
      let z
      let s
      let a = Math.sin(life * Math.PI)
      switch (type) {
        case 'fire':
          x = Math.cos(sd.a) * sd.r * 0.55 * (1 - life)
          z = Math.sin(sd.a) * sd.r * 0.55 * (1 - life)
          y = 0.5 + life * 1.6
          s = 0.5 * (1 - life) + 0.1
          break
        case 'snow':
          x = Math.cos(sd.a + t * 0.3) * sd.r * 1.2
          z = Math.sin(sd.a + t * 0.3) * sd.r * 1.2
          y = 2.2 - life * 2.2
          s = 0.22
          break
        case 'hearts':
        case 'bubbles':
          x = Math.cos(sd.a) * sd.r + Math.sin(t * 2 + sd.a) * 0.12
          z = Math.sin(sd.a) * sd.r
          y = 0.4 + life * 2
          s = type === 'hearts' ? 0.3 : 0.22
          break
        case 'wind': {
          const ang = sd.a + t * 4
          x = Math.cos(ang) * (0.9 + sd.s * 0.3)
          z = Math.sin(ang) * (0.9 + sd.s * 0.3)
          y = 0.3 + sd.s * 1.5
          s = 0.12
          a = 0.7
          break
        }
        case 'bolts':
          x = Math.cos(sd.a + Math.floor(t * 6 + sd.off * 9)) * sd.r * 1.1
          z = Math.sin(sd.a + Math.floor(t * 6 + sd.off * 9)) * sd.r * 1.1
          y = 0.4 + sd.s * 1.6
          s = 0.35
          a = (t * 6 + sd.off * 9) % 1 < 0.5 ? 1 : 0
          break
        case 'stars': {
          const ang = sd.a + t * 1.2
          x = Math.cos(ang) * (1 + sd.s * 0.3)
          z = Math.sin(ang) * (1 + sd.s * 0.3)
          y = 0.6 + Math.sin(t * 2 + sd.a) * 0.4 + sd.s
          s = 0.24
          a = 0.6 + 0.4 * Math.sin(t * 5 + sd.a)
          break
        }
        default:
          x = Math.cos(sd.a) * sd.r * 1.1
          z = Math.sin(sd.a) * sd.r * 1.1
          y = 0.3 + sd.s * 1.8 + life * 0.4
          s = 0.24
          a = Math.max(0, Math.sin(life * Math.PI * 2))
      }
      pos[i * 3] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = z
      size[i] = s * scale
      alpha[i] = a
    })
    data.geo.attributes.position.needsUpdate = true
    data.geo.attributes.aSize.needsUpdate = true
    data.geo.attributes.aAlpha.needsUpdate = true
  })

  return <points ref={ref} geometry={data.geo} material={data.mat} frustumCulled={false} />
}

/* ------------------------------------------------------------------ */

const IDLE = { time: 0, ratio: 0, grounded: true, vy: 0, jumpT: 9, landT: 9 }

/**
 * @param {{ id: string, motionRef?: object, particles?: boolean }} props
 * motionRef.current: { time, ratio (0..1 run amount), grounded, vy, jumpT, landT }
 */
export const Duck = memo(function Duck({ id, motionRef, particles = true }) {
  const def = duckById(id)
  const fx = def.fx || {}
  const m = duckMaterials(def)
  const baked = bakedParts(def, fx.eye || IRIS[def.id.length % IRIS.length])
  const root = useRef()
  const body = useRef()
  const wingL = useRef()
  const wingR = useRef()
  const footL = useRef()
  const footR = useRef()
  const head = useRef()
  const bigWings = useRef()
  const eyeL = useRef()
  const eyeR = useRef()
  const tail = useRef()

  useFrame((state) => {
    const mo = motionRef?.current || IDLE
    const t = motionRef ? mo.time : state.clock.elapsedTime
    const ratio = mo.ratio || 0
    // The waddle phase is integrated (see Rider's newMotion), so speed changes never make
    // the stride skip; display ducks without motion just use the clock.
    const phase = mo.phase ?? t * (7 + ratio * 7)
    const air = !mo.grounded
    // Waddle: roll side to side, alternate feet.
    if (body.current) {
      body.current.rotation.z = air ? 0 : Math.sin(phase) * 0.13 * ratio + Math.sin(t * 1.8) * 0.02
      body.current.position.y = air ? 0 : Math.abs(Math.cos(phase)) * 0.07 * ratio + Math.sin(t * 2) * 0.012
    }
    if (footL.current && footR.current) {
      const kick = air ? 0.7 : Math.sin(phase) * 0.75 * ratio
      footL.current.rotation.x = kick
      footR.current.rotation.x = air ? 0.7 : -kick
    }
    const flap = air ? Math.sin(t * 28) * 0.7 + 0.5 : Math.sin(phase * 0.5) * 0.12 * ratio
    if (wingL.current) wingL.current.rotation.z = 0.2 + flap
    if (wingR.current) wingR.current.rotation.z = -0.2 - flap
    if (head.current) head.current.rotation.x = air ? -0.15 : Math.sin(phase * 2) * 0.04 * ratio
    // Life: blink every few seconds and wag the tail.
    const bt = (state.clock.elapsedTime + id.length * 0.9) % 3.7
    const eyeY = bt > 3.56 ? 0.1 : 1
    if (eyeL.current) eyeL.current.scale.y = eyeY
    if (eyeR.current) eyeR.current.scale.y = eyeY
    if (tail.current) tail.current.rotation.y = Math.sin(t * (air ? 12 : 4 + ratio * 6)) * 0.12
    if (bigWings.current) bigWings.current.children.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * (0.35 + Math.sin(t * (air ? 14 : 3)) * 0.25)))
    // Squash on landing, stretch on take-off.
    if (root.current) {
      const j = Math.max(0, 1 - mo.jumpT / 0.22)
      const l = Math.max(0, 1 - mo.landT / 0.2)
      const sy = 1 + j * 0.16 - l * 0.2
      const sxz = 1 - j * 0.08 + l * 0.14
      root.current.scale.set(sxz, sy, sxz)
    }
    if (fx.rainbow) {
      // Shared material, so drive it from the shared clock (not per-instance deltas).
      const hue = (state.clock.elapsedTime * 0.25) % 1
      m.body.color.setHSL(hue, 0.95, 0.55)
      m.body.emissive.setHSL(hue, 1, 0.4)
      m.wing.color.setHSL(hue, 0.8, 0.58)
      m.feather.color.setHSL(hue, 0.7, 0.67)
    }
  })

  return (
    <group ref={root}>
      <group ref={body}>
        <mesh geometry={DUCK_BODY} material={m.body} castShadow />
        {!fx.ghost && <mesh geometry={DUCK_BODY} material={m.ink} />}
        <mesh ref={tail} geometry={DUCK_TAIL} material={m.feather} position={[0, 0.99, -0.94]} rotation={[-1.05, 0, 0]} scale={[0.8, 0.9, 1]} />
        {/* Feather-shaped folded wings: raised overlapping tips, rather than balls. */}
        <group ref={wingL} position={[0.56, 0.95, -0.16]}>
          <mesh geometry={DUCK_WING} material={m.wing} />
          <mesh geometry={FEATHERS[0]} material={m.feather} />
        </group>
        <group ref={wingR} position={[-0.56, 0.95, -0.16]}>
          <mesh geometry={DUCK_WING} material={m.wing} />
          <mesh geometry={FEATHERS[1]} material={m.feather} />
        </group>
        {fx.wings && (
          <group ref={bigWings} position={[0, 1.12, -0.36]}>
            {[1, -1].map((s) => (
              <group key={s} rotation={[0, s * 0.4, 0]}>
                <mesh geometry={DUCK_WING} material={m.wing} position={[s * 0.64, 0.32, -0.08]} rotation={[0, s * 1.2, s * 0.45]} scale={[1, 1.2, 1.3]} />
                <mesh geometry={DUCK_WING} material={m.feather} position={[s * 0.42, 0.10, -0.15]} rotation={[0, s * 1.1, s * 0.2]} scale={[0.8, 0.8, 0.9]} />
              </group>
            ))}
          </group>
        )}
        {/* Neck + head. */}
        <mesh geometry={DUCK_NECK} material={m.body} position={[0, 1.02, 0.44]} rotation={[0.18, 0, 0]} />
        {!fx.ghost && <mesh geometry={DUCK_NECK} material={m.ink} position={[0, 1.02, 0.44]} rotation={[0.18, 0, 0]} />}
        {/* A slightly oversized chibi head. */}
        <group ref={head} position={[0, 1.7, 0.6]} scale={1.14}>
          <mesh geometry={SPHERE} material={m.body} scale={[0.35, 0.39, 0.38]} />
          {!fx.ghost && <mesh geometry={SPHERE} material={m.inkHead} scale={[0.35, 0.39, 0.38]} />}
          {/* Head tuft + nostrils. */}
          <mesh geometry={DUCK_TAIL} material={m.feather} position={[0, 0.34, -0.035]} rotation={[0.5, 0, -0.1]} scale={[0.23, 0.35, 0.4]} />
          {/* Flat orange bill with nostrils (baked). */}
          <mesh geometry={baked.bill} material={m.bill} />
          {/* Big glossy anime eyes (baked: dark oval, coloured iris, sparkles, lash line). */}
          <group ref={eyeL} position={[0.235, 0.075, 0.262]} rotation={[-0.08, 0.72, 0]}>
            <mesh geometry={baked.eyeL} material={eyeMaterial} />
          </group>
          <group ref={eyeR} position={[-0.235, 0.075, 0.262]} rotation={[-0.08, -0.72, 0]}>
            <mesh geometry={baked.eyeR} material={eyeMaterial} />
          </group>
          <mesh geometry={CHEEKS} material={m.cheek} />
          {fx.hat === 'top' && (
            <group position={[0, 0.4, -0.02]} rotation={[-0.1, 0, 0.08]}>
              <mesh geometry={CYL} material={m.black} scale={[0.36, 0.05, 0.36]} />
              <mesh geometry={CYL} material={m.black} position={[0, 0.24, 0]} scale={[0.23, 0.46, 0.23]} />
              <mesh geometry={CYL} material={m.band} position={[0, 0.07, 0]} scale={[0.235, 0.08, 0.235]} />
            </group>
          )}
          {fx.hat === 'crown' && (
            <group position={[0, 0.4, 0]}>
              <mesh geometry={CYL} material={m.gold} scale={[0.26, 0.16, 0.26]} />
              {[0, 1, 2, 3, 4].map((i) => (
                <mesh key={i} geometry={CONE} material={m.gold} position={[Math.cos((i / 5) * 6.28) * 0.21, 0.17, Math.sin((i / 5) * 6.28) * 0.21]} scale={[0.07, 0.2, 0.07]} />
              ))}
            </group>
          )}
          {fx.horns && [1, -1].map((s) => <mesh key={s} geometry={CONE} material={m.horn} position={[s * 0.26, 0.38, -0.04]} rotation={[0, 0, -s * 0.5]} scale={[0.08, 0.32, 0.08]} />)}
          {fx.halo && <mesh geometry={HALO} material={additiveMaterial(fx.halo, 0.95)} position={[0, 0.66, -0.05]} rotation={[Math.PI / 2 - 0.2, 0, 0]} scale={0.3} />}
        </group>
      </group>
      {/* Long orange legs + webbed feet. */}
      {[
        [0.24, footL],
        [-0.24, footR],
      ].map(([x, ref]) => (
        <group key={x} ref={ref} position={[x, 0.45, 0.08]}>
          <mesh geometry={legGeometry()} material={m.feet} />
        </group>
      ))}
      {particles && fx.particles && <DuckParticles type={fx.particles} color={fx.pc || '#ffffff'} scale={1.2} />}
    </group>
  )
})

export default Duck
