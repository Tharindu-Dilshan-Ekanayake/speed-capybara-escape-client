import { useFrame } from '@react-three/fiber'
import { memo, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  Euler,
  Matrix4,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  Quaternion,
  RedFormat,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { capyById } from '../shared/gameData'
import { additiveMaterial } from './materials'
import { shapeTexture } from './textures'

/**
 * A chunky, chill capybara: barrel body, big boxy head with a dark nose, tiny ears and
 * four stubby legs that trot. Skins change the fur colours and add accessories (hats,
 * yuzu, shades, wings, halos...) and particles.
 *
 * Local frame: facing +z, feet at y = 0, back at about y = 1.2 (where the saddle sits).
 */

/* ------------------------------------------------------------------ */
/* Shared geometry + helpers                                            */
/* ------------------------------------------------------------------ */

const BODY = new RoundedBoxGeometry(1.0, 0.74, 1.78, 4, 0.33)
const BELLY = new RoundedBoxGeometry(0.86, 0.36, 1.5, 3, 0.16)
const HEAD = new RoundedBoxGeometry(0.62, 0.56, 0.74, 4, 0.22)
const SPHERE = new SphereGeometry(1, 20, 14)
const SPHERE_LO = new SphereGeometry(1, 12, 8)
const CYL = new CylinderGeometry(1, 1, 1, 20)
const CONE = new ConeGeometry(1, 1, 16)
const HALO = new TorusGeometry(1, 0.09, 10, 36)
const RING = new TorusGeometry(1, 0.14, 8, 24)

const TOON_RAMP = new DataTexture(new Uint8Array([90, 160, 215, 255]), 4, 1, RedFormat)
TOON_RAMP.minFilter = TOON_RAMP.magFilter = NearestFilter
TOON_RAMP.needsUpdate = true
const toon = (color, extra = {}) => new MeshToonMaterial({ color, gradientMap: TOON_RAMP, ...extra })

/** Cartoon ink line: back faces pushed out along their normals (inverted hull). */
const outline = (color, thick = 0.022) =>
  new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uThick: { value: thick } },
    vertexShader: `
      uniform float uThick;
      void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normalize(normal) * uThick, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); }`,
    side: BackSide,
  })

const _m4 = new Matrix4()
const _q = new Quaternion()
const _e = new Euler()
const _p = new Vector3()
const _s = new Vector3()

/** A transformed, vertex-coloured copy of `geo` (position / normal / uv only). */
function part(geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
  const src = geo.index ? geo.toNonIndexed() : geo.clone()
  const g = new BufferGeometry()
  for (const k of ['position', 'normal', 'uv']) if (src.attributes[k]) g.setAttribute(k, src.attributes[k])
  const sc = Array.isArray(scale) ? scale : [scale, scale, scale]
  g.applyMatrix4(_m4.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...sc)))
  const c = new Color(color)
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i += 1) arr.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new BufferAttribute(arr, 3))
  return g
}
const bake = (parts) => {
  const g = mergeGeometries(parts, false)
  parts.forEach((x) => x.dispose())
  g.computeBoundingSphere()
  return g
}

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
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 26; i += 1) {
    let x = rnd() * 256
    let y = rnd() * 256
    g.beginPath()
    g.moveTo(x, y)
    for (let k = 0; k < 6; k += 1) {
      x += (rnd() - 0.5) * 40
      y += (rnd() - 0.5) * 40
      g.lineTo(x, y)
    }
    g.stroke()
  }
  crackTex = new CanvasTexture(c)
  crackTex.colorSpace = SRGBColorSpace
  return crackTex
}

/* ------------------------------------------------------------------ */
/* Per-skin baked parts + materials                                     */
/* ------------------------------------------------------------------ */

const bakedCache = new Map()
/** Head details (snout, nose, nostrils, ears), each leg with its paw, and one eye. */
function bakedParts(def) {
  if (bakedCache.has(def.id)) return bakedCache.get(def.id)
  const fur = new Color(def.fur)
  const snout = fur.clone().multiplyScalar(0.86)
  const ear = fur.clone().multiplyScalar(0.7)
  const paw = new Color(def.nose).lerp(fur, 0.35)
  const out = {
    // Head-local frame: centre of the head box.
    face: bake([
      part(new RoundedBoxGeometry(0.5, 0.36, 0.3, 3, 0.12), snout, [0, -0.08, 0.3]),
      part(new RoundedBoxGeometry(0.34, 0.15, 0.1, 2, 0.05), def.nose, [0, 0.03, 0.44]),
      part(SPHERE_LO, '#1a0e08', [0.07, 0.0, 0.49], [0, 0, 0], [0.03, 0.02, 0.012]),
      part(SPHERE_LO, '#1a0e08', [-0.07, 0.0, 0.49], [0, 0, 0], [0.03, 0.02, 0.012]),
      part(SPHERE_LO, '#3a1a10', [0, -0.13, 0.44], [0, 0, 0], [0.09, 0.012, 0.012]),
    ]),
    ears: [1, -1].map((s) => bake([part(new RoundedBoxGeometry(0.15, 0.13, 0.08, 2, 0.04), ear, [0, 0.05, 0], [0, 0, -s * 0.3])])),
    leg: bake([
      part(new RoundedBoxGeometry(0.26, 0.5, 0.3, 2, 0.1), def.fur, [0, -0.23, 0]),
      part(new RoundedBoxGeometry(0.28, 0.1, 0.34, 2, 0.04), paw, [0, -0.47, 0.03]),
    ]),
    eye: bake([
      part(SPHERE_LO, '#120c0a', [0, 0, 0], [0, 0, 0], [0.07, 0.08, 0.05]),
      part(SPHERE_LO, '#ffffff', [0.02, 0.03, 0.04], [0, 0, 0], [0.024, 0.026, 0.012]),
      part(SPHERE_LO, '#ffffff', [-0.02, -0.03, 0.045], [0, 0, 0], 0.01),
    ]),
  }
  bakedCache.set(def.id, out)
  return out
}

const eyeMaterial = new MeshBasicMaterial({ vertexColors: true, toneMapped: false })
const sleepyMaterial = new MeshBasicMaterial({ color: '#2a1810', toneMapped: false })

const matCache = new Map()
function capyMaterials(def) {
  if (matCache.has(def.id)) return matCache.get(def.id)
  const fx = def.fx || {}
  const opts = {
    emissive: new Color(fx.glow && !fx.gold ? fx.glow : def.fur),
    emissiveIntensity: fx.ghost ? 0.4 : fx.glow ? 0.14 : 0.05,
    transparent: !!fx.ghost,
    opacity: fx.ghost ? 0.8 : 1,
  }
  const fur = fx.gold
    ? new MeshPhysicalMaterial({ color: new Color(def.fur), ...opts, roughness: 0.3, metalness: 0.7 })
    : toon(def.fur, opts)
  if (fx.cracks) {
    fur.emissiveMap = crackTexture()
    fur.emissive = new Color(fx.cracks)
    fur.emissiveIntensity = 1.4
  }
  if (fx.galaxy) {
    fur.emissive = new Color('#5a2bff')
    fur.emissiveIntensity = 0.35
  }
  const ink = new Color(def.fur).multiplyScalar(0.25).lerp(new Color('#24140c'), 0.4)
  const m = {
    fur,
    belly: toon(def.belly, { transparent: !!fx.ghost, opacity: fx.ghost ? 0.8 : 1 }),
    bits: toon('#ffffff', { vertexColors: true, transparent: !!fx.ghost, opacity: fx.ghost ? 0.85 : 1 }),
    ink: outline(ink, 0.026),
    inkHead: outline(ink, 0.03),
    cheek: new MeshStandardMaterial({ color: '#ff8fb3', transparent: true, opacity: 0.5, roughness: 0.6 }),
    wing: toon(fx.wings || '#ffffff', { emissive: new Color(fx.wings || '#ffffff'), emissiveIntensity: 0.25, transparent: !!fx.ghost, opacity: fx.ghost ? 0.8 : 1 }),
    horn: new MeshStandardMaterial({ color: fx.horns || '#ffcf4a', emissive: fx.horns || '#ffcf4a', emissiveIntensity: 0.35, roughness: 0.4 }),
  }
  matCache.set(def.id, m)
  return m
}

/** Materials shared by every capybara's accessories. */
const ACC = {
  black: new MeshStandardMaterial({ color: '#15151c', roughness: 0.5 }),
  band: new MeshStandardMaterial({ color: '#d4142e', roughness: 0.5 }),
  gold: new MeshStandardMaterial({ color: '#ffcc1a', roughness: 0.25, metalness: 0.85, emissive: '#ff9a00', emissiveIntensity: 0.2 }),
  yuzu: toon('#ffb21a', { emissive: '#ff8a00', emissiveIntensity: 0.15 }),
  leaf: toon('#2fbf3a'),
  glass: new MeshStandardMaterial({ color: '#0d0f1c', roughness: 0.05, metalness: 0.6 }),
  towel: toon('#ffffff'),
  party: toon('#ff4fd8', { emissive: '#ff4fd8', emissiveIntensity: 0.15 }),
  partyDot: toon('#ffe14a'),
  flower: toon('#ff7ac8', { emissive: '#ff3fa8', emissiveIntensity: 0.15 }),
  flowerMid: toon('#ffe14a'),
  clover: toon('#2fdc6a', { emissive: '#1fbf4a', emissiveIntensity: 0.2 }),
}

/* ------------------------------------------------------------------ */
/* Particles: one Points draw call per capybara                         */
/* ------------------------------------------------------------------ */

const PARTICLE_SHAPE = { sparkle: 'star', fire: 'dot', hearts: 'heart', snow: 'snow', bolts: 'bolt', stars: 'star', bubbles: 'ring' }

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
function CapyParticles({ type, color, scale = 1 }) {
  const data = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(N * 3), 3))
    geo.setAttribute('aSize', new BufferAttribute(new Float32Array(N), 1))
    geo.setAttribute('aAlpha', new BufferAttribute(new Float32Array(N), 1))
    const seeds = Array.from({ length: N }, (_, i) => ({ a: (i / N) * 6.28 + i * 0.37, r: 0.55 + ((i * 7) % 10) / 16, s: ((i * 13) % 10) / 10, off: ((i * 29) % 16) / 16 }))
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
          x = Math.cos(sd.a) * sd.r * 0.6 * (1 - life)
          z = Math.sin(sd.a) * sd.r * 0.9 * (1 - life)
          y = 0.7 + life * 1.5
          s = 0.5 * (1 - life) + 0.1
          break
        case 'snow':
          x = Math.cos(sd.a + t * 0.3) * sd.r * 1.3
          z = Math.sin(sd.a + t * 0.3) * sd.r * 1.3
          y = 2.2 - life * 2.2
          s = 0.22
          break
        case 'hearts':
        case 'bubbles':
          x = Math.cos(sd.a) * sd.r + Math.sin(t * 2 + sd.a) * 0.12
          z = Math.sin(sd.a) * sd.r
          y = 0.5 + life * 2
          s = type === 'hearts' ? 0.3 : 0.22
          break
        case 'bolts':
          x = Math.cos(sd.a + Math.floor(t * 6 + sd.off * 9)) * sd.r * 1.2
          z = Math.sin(sd.a + Math.floor(t * 6 + sd.off * 9)) * sd.r * 1.2
          y = 0.5 + sd.s * 1.5
          s = 0.35
          a = (t * 6 + sd.off * 9) % 1 < 0.5 ? 1 : 0
          break
        case 'stars': {
          const ang = sd.a + t * 1.2
          x = Math.cos(ang) * (1.05 + sd.s * 0.3)
          z = Math.sin(ang) * (1.05 + sd.s * 0.3)
          y = 0.7 + Math.sin(t * 2 + sd.a) * 0.4 + sd.s
          s = 0.24
          a = 0.6 + 0.4 * Math.sin(t * 5 + sd.a)
          break
        }
        default:
          x = Math.cos(sd.a) * sd.r * 1.2
          z = Math.sin(sd.a) * sd.r * 1.2
          y = 0.4 + sd.s * 1.7 + life * 0.4
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

  return <points geometry={data.geo} material={data.mat} frustumCulled={false} />
}

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

const IDLE = { time: 0, ratio: 0, grounded: true, vy: 0, jumpT: 9, landT: 9 }

/**
 * Body sway shared with the rider (Rider.jsx) so the saddle moves with the capybara:
 * a gentle trot bob, a little side-to-side roll and a forward rock.
 */
export function capyBodyMotion(mo, t) {
  const ratio = mo.ratio || 0
  const phase = mo.phase ?? t * (7 + ratio * 7)
  if (!mo.grounded) return { roll: 0, bob: 0, pitch: Math.max(-0.2, Math.min(0.2, -(mo.vy || 0) * 0.012)) }
  return {
    roll: Math.sin(phase) * 0.05 * ratio + Math.sin(t * 1.6) * 0.012,
    bob: Math.abs(Math.cos(phase)) * 0.07 * ratio + Math.sin(t * 2) * 0.012,
    pitch: Math.sin(phase * 2) * 0.03 * ratio,
  }
}

/* ------------------------------------------------------------------ */

/**
 * @param {{ id: string, motionRef?: object, particles?: boolean, look?: string }} props
 * motionRef.current: { time, phase, ratio (0..1 run amount), grounded, vy, jumpT, landT }
 * look (NPCs): 'yuzu' | 'sleepy' | 'party' | 'shades' | 'spa'
 */
export const Capybara = memo(function Capybara({ id, motionRef, particles = true, look = null }) {
  const def = capyById(id)
  const fx = def.fx || {}
  const m = capyMaterials(def)
  const baked = bakedParts(def)
  const root = useRef()
  const body = useRef()
  const head = useRef()
  const legs = useRef([])
  const eyes = useRef([])
  const ears = useRef([])
  const wings = useRef()

  const yuzu = fx.yuzu || look === 'yuzu' || look === 'spa'
  const shades = fx.shades || look === 'shades'
  const sleepy = look === 'sleepy' || look === 'spa'

  useFrame((state) => {
    const mo = motionRef?.current || IDLE
    const t = motionRef ? mo.time : state.clock.elapsedTime
    const ratio = mo.ratio || 0
    const phase = mo.phase ?? t * (7 + ratio * 7)
    const air = !mo.grounded
    const bm = capyBodyMotion(mo, t)
    if (body.current) {
      body.current.rotation.z = bm.roll
      body.current.rotation.x = bm.pitch
      body.current.position.y = bm.bob
    }
    // Trot: diagonal pairs move together; legs splay out in the air.
    const L = legs.current
    if (L.length === 4) {
      const swing = Math.sin(phase) * 0.75 * ratio
      L[0].rotation.x = air ? -0.7 : swing
      L[3].rotation.x = air ? 0.7 : swing
      L[1].rotation.x = air ? -0.7 : -swing
      L[2].rotation.x = air ? 0.7 : -swing
    }
    if (head.current) head.current.rotation.x = air ? -0.18 : 0.1 + Math.sin(phase * 2) * 0.04 * ratio + Math.sin(t * 1.3) * 0.02
    // Ears twitch now and then; eyes blink every few seconds.
    const tw = (t + id.length) % 4.3 < 0.18 ? Math.sin(t * 60) * 0.25 : 0
    ears.current.forEach((e, i) => e && (e.rotation.z = i ? -tw : tw))
    const bt = (state.clock.elapsedTime + id.length * 0.9) % 3.9
    const eyeY = sleepy ? 0.18 : bt > 3.76 ? 0.12 : 1
    for (const e of eyes.current) if (e) e.scale.y = eyeY
    if (wings.current) wings.current.children.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * (0.4 + Math.sin(t * (air ? 14 : 3)) * 0.25)))
    // Squash on landing, stretch on take-off.
    if (root.current) {
      const j = Math.max(0, 1 - (mo.jumpT ?? 9) / 0.22)
      const l = Math.max(0, 1 - (mo.landT ?? 9) / 0.2)
      const sy = 1 + j * 0.14 - l * 0.18
      const sxz = 1 - j * 0.07 + l * 0.12
      root.current.scale.set(sxz, sy, sxz)
    }
  })

  const legPos = [
    [0.3, 0.52, 0.55],
    [-0.3, 0.52, 0.55],
    [0.31, 0.52, -0.56],
    [-0.31, 0.52, -0.56],
  ]

  return (
    <group ref={root}>
      {legPos.map((p, i) => (
        <group key={i} ref={(el) => (legs.current[i] = el)} position={p}>
          <mesh geometry={baked.leg} material={m.bits} castShadow />
        </group>
      ))}
      <group ref={body}>
        <mesh geometry={BODY} material={m.fur} position={[0, 0.84, -0.04]} castShadow />
        {!fx.ghost && <mesh geometry={BODY} material={m.ink} position={[0, 0.84, -0.04]} />}
        <mesh geometry={BELLY} material={m.belly} position={[0, 0.62, -0.02]} />
        {/* Little tail nub. */}
        <mesh geometry={SPHERE_LO} material={m.fur} position={[0, 0.95, -0.92]} scale={[0.1, 0.08, 0.07]} />
        {fx.wings && (
          <group ref={wings} position={[0, 1.15, -0.25]}>
            {[1, -1].map((s) => (
              <group key={s} rotation={[0, s * 0.4, 0]}>
                <mesh geometry={SPHERE} material={m.wing} position={[s * 0.62, 0.22, -0.1]} rotation={[0, 0, s * 0.5]} scale={[0.5, 0.16, 0.3]} />
                <mesh geometry={SPHERE} material={m.wing} position={[s * 0.95, 0.38, -0.16]} rotation={[0, 0, s * 0.7]} scale={[0.34, 0.11, 0.22]} />
              </group>
            ))}
          </group>
        )}
        {/* Head, tipped slightly down like a relaxed capybara. */}
        <group ref={head} position={[0, 1.1, 0.95]}>
          <mesh geometry={HEAD} material={m.fur} castShadow />
          {!fx.ghost && <mesh geometry={HEAD} material={m.inkHead} />}
          <mesh geometry={baked.face} material={m.bits} />
          {[1, -1].map((s, i) => (
            <group key={s} ref={(el) => (ears.current[i] = el)} position={[s * 0.23, 0.25, -0.2]}>
              <mesh geometry={baked.ears[i]} material={m.bits} />
            </group>
          ))}
          {[1, -1].map((s, i) => (
            <group key={s} ref={(el) => (eyes.current[i] = el)} position={[s * 0.26, 0.1, 0.2]} rotation={[0, s * 0.7, 0]}>
              <mesh geometry={baked.eye} material={sleepy ? sleepyMaterial : eyeMaterial} />
            </group>
          ))}
          <mesh geometry={SPHERE_LO} material={m.cheek} position={[0.25, -0.06, 0.24]} scale={[0.07, 0.04, 0.03]} />
          <mesh geometry={SPHERE_LO} material={m.cheek} position={[-0.25, -0.06, 0.24]} scale={[0.07, 0.04, 0.03]} />
          {shades && (
            <group position={[0, 0.11, 0.28]}>
              <mesh geometry={CYL} material={ACC.glass} position={[0.15, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]} scale={[0.11, 0.04, 0.09]} />
              <mesh geometry={CYL} material={ACC.glass} position={[-0.15, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]} scale={[0.11, 0.04, 0.09]} />
              <mesh geometry={CYL} material={ACC.black} position={[0, 0.02, 0.04]} rotation={[0, 0, Math.PI / 2]} scale={[0.02, 0.5, 0.02]} />
            </group>
          )}
          {fx.monocle && (
            <group position={[-0.17, 0.1, 0.3]}>
              <mesh geometry={RING} material={ACC.gold} scale={0.09} />
              <mesh geometry={CYL} material={ACC.gold} position={[-0.06, -0.14, 0]} rotation={[0, 0, 0.4]} scale={[0.008, 0.28, 0.008]} />
            </group>
          )}
          {fx.hat === 'top' && (
            <group position={[0, 0.31, -0.04]} rotation={[-0.1, 0, 0.1]}>
              <mesh geometry={CYL} material={ACC.black} scale={[0.32, 0.04, 0.32]} />
              <mesh geometry={CYL} material={ACC.black} position={[0, 0.2, 0]} scale={[0.2, 0.4, 0.2]} />
              <mesh geometry={CYL} material={ACC.band} position={[0, 0.06, 0]} scale={[0.205, 0.07, 0.205]} />
            </group>
          )}
          {fx.hat === 'crown' && (
            <group position={[0, 0.33, -0.02]}>
              <mesh geometry={CYL} material={ACC.gold} scale={[0.22, 0.13, 0.22]} />
              {[0, 1, 2, 3, 4].map((i) => (
                <mesh key={i} geometry={CONE} material={ACC.gold} position={[Math.cos((i / 5) * 6.28) * 0.18, 0.14, Math.sin((i / 5) * 6.28) * 0.18]} scale={[0.06, 0.17, 0.06]} />
              ))}
            </group>
          )}
          {yuzu && (
            <group position={[0, 0.4, -0.02]}>
              <mesh geometry={SPHERE} material={ACC.yuzu} scale={[0.17, 0.15, 0.17]} />
              <mesh geometry={SPHERE_LO} material={ACC.leaf} position={[0.06, 0.15, 0]} rotation={[0, 0, -0.6]} scale={[0.07, 0.025, 0.04]} />
            </group>
          )}
          {look === 'spa' && <mesh geometry={HEAD} material={ACC.towel} position={[0, 0.27, -0.05]} scale={[0.75, 0.22, 0.6]} />}
          {look === 'party' && (
            <group position={[0.08, 0.38, -0.04]} rotation={[0, 0, -0.25]}>
              <mesh geometry={CONE} material={ACC.party} scale={[0.14, 0.34, 0.14]} />
              <mesh geometry={SPHERE_LO} material={ACC.partyDot} position={[0, 0.18, 0]} scale={0.045} />
            </group>
          )}
          {fx.flowers &&
            [0, 1, 2, 3, 4, 5].map((i) => {
              const a = (i / 6) * Math.PI * 2
              return <mesh key={i} geometry={SPHERE_LO} material={i % 2 ? ACC.flowerMid : ACC.flower} position={[Math.cos(a) * 0.27, 0.27, Math.sin(a) * 0.3 - 0.04]} scale={0.06} />
            })}
          {fx.clover && (
            <group position={[0.12, 0.33, -0.08]} rotation={[0.3, 0, -0.3]}>
              {[0, 1, 2, 3].map((i) => (
                <mesh key={i} geometry={SPHERE_LO} material={ACC.clover} position={[Math.cos((i / 4) * 6.28) * 0.06, 0.04, Math.sin((i / 4) * 6.28) * 0.06]} scale={[0.06, 0.015, 0.06]} />
              ))}
            </group>
          )}
          {fx.horns && [1, -1].map((s) => <mesh key={s} geometry={CONE} material={m.horn} position={[s * 0.16, 0.36, -0.12]} rotation={[-0.3, 0, -s * 0.35]} scale={[0.06, 0.24, 0.06]} />)}
          {fx.halo && <mesh geometry={HALO} material={additiveMaterial(fx.halo, 0.95)} position={[0, 0.58, -0.08]} rotation={[Math.PI / 2 - 0.15, 0, 0]} scale={0.24} />}
        </group>
      </group>
      {particles && fx.particles && <CapyParticles type={fx.particles} color={fx.pc || '#ffffff'} scale={1.2} />}
    </group>
  )
})

export default Capybara
