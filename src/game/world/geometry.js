import {
  BoxGeometry,
  BufferAttribute,
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  SphereGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Low-poly nature geometry with baked vertex colours (one draw call per instanced set).
 */

/** Polyhedra are already non-indexed; boxes / cylinders / spheres are not. */
const flat = (g) => (g.index ? g.toNonIndexed() : g)

function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Jitters shared vertex positions consistently so faces stay connected. */
function jitter(geo, amount, rand, scaleY = 1) {
  const pos = geo.attributes.position
  const offsets = new Map()
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`
    if (!offsets.has(k)) offsets.set(k, [(rand() - 0.5) * amount, (rand() - 0.5) * amount, (rand() - 0.5) * amount])
    const o = offsets.get(k)
    pos.setXYZ(i, x + o[0], (y + o[1]) * scaleY, z + o[2])
  }
  pos.needsUpdate = true
}

/** Faceted cliff rock: grass-capped top faces, two-tone cliff sides. */
export function rockGeometry(variant, theme) {
  const rand = seeded(variant * 97 + 3)
  const geo = flat(new IcosahedronGeometry(1, 1))
  const sy = 1.25 + variant * 0.12
  jitter(geo, 0.38, rand, sy)
  // Flat grassy plateau on top (trees stand on it).
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i += 1) if (p.getY(i) > 0.75 * sy) p.setY(i, 0.75 * sy)
  geo.computeVertexNormals()
  const n = geo.attributes.normal
  const colors = new Float32Array(n.count * 3)
  const cliff = new Color(theme.cliff)
  const shade = new Color(theme.cliffShade)
  const cap = new Color(theme.cap)
  const tmp = new Color()
  for (let f = 0; f < n.count; f += 3) {
    const ny = (n.getY(f) + n.getY(f + 1) + n.getY(f + 2)) / 3
    if (ny > 0.62) tmp.copy(cap)
    else tmp.copy(rand() < 0.5 ? cliff : shade).lerp(cap, ny > 0.45 ? 0.15 : 0)
    for (let v = 0; v < 3; v += 1) {
      colors[(f + v) * 3] = tmp.r
      colors[(f + v) * 3 + 1] = tmp.g
      colors[(f + v) * 3 + 2] = tmp.b
    }
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3))
  return geo
}

function paint(geo, color) {
  const c = new Color(color)
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i += 1) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new BufferAttribute(arr, 3))
  return geo
}

/** Trunk + three-blob canopy. Canopy blobs are white so instance colour tints them. */
export function treeGeometries() {
  const rand = seeded(42)
  const trunk = flat(new CylinderGeometry(0.22, 0.42, 3.6, 7))
  trunk.translate(0, 1.8, 0)
  // A couple of branches.
  const b1 = flat(new CylinderGeometry(0.1, 0.16, 1.6, 5))
  b1.rotateZ(0.9)
  b1.translate(0.6, 3.0, 0)
  const b2 = flat(new CylinderGeometry(0.1, 0.16, 1.5, 5))
  b2.rotateZ(-0.8)
  b2.translate(-0.55, 3.2, 0.1)
  const trunkAll = mergeGeometries([trunk, b1, b2])
  trunkAll.computeVertexNormals()
  paint(trunkAll, '#8a5a3c')

  const blobs = []
  for (const [x, y, z, s] of [
    [0, 4.6, 0, 1.9],
    [1.35, 4.1, 0.3, 1.3],
    [-1.3, 4.2, -0.2, 1.35],
    [0.2, 5.4, 0.4, 1.2],
  ]) {
    const g = flat(new IcosahedronGeometry(1, 1))
    jitter(g, 0.3, rand, 0.72)
    g.scale(s, s, s)
    g.translate(x, y, z)
    blobs.push(g)
  }
  const canopy = mergeGeometries(blobs)
  canopy.computeVertexNormals()
  // Slight top-lighter gradient baked in.
  const pos = canopy.attributes.position
  const col = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i += 1) {
    const k = 0.78 + Math.min(0.22, Math.max(0, (pos.getY(i) - 3.6) * 0.1))
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k
  }
  canopy.setAttribute('color', new BufferAttribute(col, 3))
  return { trunk: trunkAll, canopy }
}

/**
 * Blocky jungle palm: a stack of slightly offset trunk blocks with coconuts, and seven
 * drooping fronds made of tilted slabs. Fronds are white so instance colour tints them.
 */
export function palmGeometries() {
  const parts = []
  const shades = ['#8a5a3c', '#a5703f']
  const off = [0, 0.06, 0.16, 0.3, 0.48, 0.7]
  for (let i = 0; i < 6; i += 1) {
    const g = flat(new BoxGeometry(0.52 - i * 0.03, 0.92, 0.52 - i * 0.03))
    g.translate(off[i], 0.46 + i * 0.9, 0)
    parts.push(paint(g, shades[i % 2]))
  }
  for (const [x, z] of [[0.5, 0.26], [0.95, -0.18], [0.62, -0.3]]) {
    const g = flat(new BoxGeometry(0.34, 0.34, 0.34))
    g.translate(x, 5.2, z)
    parts.push(paint(g, '#5a3620'))
  }
  const trunk = mergeGeometries(parts)
  trunk.computeVertexNormals()

  const fronds = []
  for (let k = 0; k < 7; k += 1) {
    const a = (k / 7) * Math.PI * 2 + 0.3
    for (let j = 0; j < 3; j += 1) {
      const g = flat(new BoxGeometry(1.1, 0.14, 0.66 - j * 0.14))
      g.rotateZ(-(0.12 + j * 0.38))
      g.translate(0.5 + j * 0.98, -(j * j * 0.3 + j * 0.1), 0)
      g.rotateY(a)
      g.translate(0.72, 5.6, 0)
      fronds.push(paint(g, j === 1 ? '#e6e6e6' : j === 2 ? '#d2d2d2' : '#ffffff'))
    }
  }
  const crown = flat(new BoxGeometry(0.8, 0.4, 0.8))
  crown.translate(0.72, 5.55, 0)
  fronds.push(paint(crown, '#cfcfcf'))
  const canopy = mergeGeometries(fronds)
  canopy.computeVertexNormals()
  return { trunk, canopy }
}

/** Stems (fixed green) and heads (tinted per instance) are separate instanced sets. */
export function flowerGeometry() {
  const stem = paint(flat(new CylinderGeometry(0.03, 0.03, 0.5, 4)), '#1f9a1f')
  stem.translate(0, 0.25, 0)
  const leaf = paint(flat(new BoxGeometry(0.22, 0.02, 0.08)), '#1f9a1f')
  leaf.translate(0.1, 0.2, 0)
  const stems = mergeGeometries([stem, leaf])
  stems.computeVertexNormals()
  const head = paint(flat(new SphereGeometry(0.16, 8, 6)), '#ffffff')
  head.scale(1, 0.55, 1)
  head.translate(0, 0.52, 0)
  head.computeVertexNormals()
  return { stems, head }
}

/** Jittered grey boulder. */
export function boulderGeometry() {
  const geo = flat(new IcosahedronGeometry(1, 1))
  jitter(geo, 0.25, seeded(7))
  geo.computeVertexNormals()
  return geo
}
