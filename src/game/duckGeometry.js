import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, Shape, Vector2 } from 'three'

const smooth = (a, b, c, d, t) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)

/** One continuous pear-shaped torso, with a lifted rump and a narrower chest. */
export const DUCK_BODY = (() => {
  const profile = [
    [-1.04, 1.05, 0.012, 0.012], [-0.87, 0.94, 0.25, 0.19],
    [-0.61, 0.83, 0.47, 0.33], [-0.23, 0.80, 0.60, 0.39],
    [0.14, 0.84, 0.55, 0.42], [0.43, 0.98, 0.36, 0.39],
    [0.66, 1.13, 0.16, 0.24], [0.75, 1.20, 0.012, 0.012],
  ]
  const rings = 40
  const sides = 26
  const vertices = []
  const indices = []
  for (let i = 0; i <= rings; i += 1) {
    const u = (i / rings) * (profile.length - 1)
    const k = Math.min(profile.length - 2, Math.floor(u))
    const t = u - k
    const p = Array.from({ length: 4 }, (_, channel) => smooth(
      profile[Math.max(0, k - 1)][channel], profile[k][channel],
      profile[k + 1][channel], profile[Math.min(profile.length - 1, k + 2)][channel], t,
    ))
    for (let j = 0; j <= sides; j += 1) {
      const angle = j * Math.PI * 2 / sides
      vertices.push(Math.max(0.008, p[2]) * Math.cos(angle), p[1] + Math.max(0.008, p[3]) * Math.sin(angle), p[0])
      if (i < rings && j < sides) {
        const a = i * (sides + 1) + j
        const b = a + sides + 1
        indices.push(a, a + 1, b, b, a + 1, b + 1)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
})()

function sculpt(shape, depth = 0.08) {
  const geometry = new ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.025, bevelSegments: 3, curveSegments: 14 })
  geometry.translate(0, 0, -depth / 2)
  geometry.computeVertexNormals()
  return geometry
}

export const DUCK_WING = (() => {
  const s = new Shape()
  s.moveTo(0.42, 0.15)
  s.quadraticCurveTo(0.45, -0.05, 0.22, -0.24)
  s.quadraticCurveTo(-0.02, -0.36, -0.28, -0.32)
  s.quadraticCurveTo(-0.50, -0.30, -0.51, -0.20)
  s.quadraticCurveTo(-0.43, -0.22, -0.36, -0.13)
  s.quadraticCurveTo(-0.53, -0.14, -0.54, -0.04)
  s.quadraticCurveTo(-0.40, -0.07, -0.35, 0.03)
  s.quadraticCurveTo(-0.49, 0.07, -0.43, 0.17)
  s.quadraticCurveTo(-0.24, 0.30, 0.07, 0.29)
  s.quadraticCurveTo(0.32, 0.28, 0.42, 0.15)
  const geometry = sculpt(s)
  geometry.rotateY(-Math.PI / 2)
  return geometry
})()

export const DUCK_TAIL = (() => {
  const s = new Shape()
  s.moveTo(-0.18, 0)
  s.quadraticCurveTo(-0.37, 0.25, -0.28, 0.45)
  s.quadraticCurveTo(-0.08, 0.36, 0, 0.47)
  s.quadraticCurveTo(0.10, 0.36, 0.28, 0.45)
  s.quadraticCurveTo(0.36, 0.20, 0.18, 0)
  s.closePath()
  return sculpt(s, 0.10)
})()

export const DUCK_BILL = (() => {
  const s = new Shape()
  s.moveTo(-0.14, -0.06)
  s.quadraticCurveTo(-0.26, 0.04, -0.24, 0.25)
  s.quadraticCurveTo(-0.18, 0.43, 0, 0.45)
  s.quadraticCurveTo(0.18, 0.43, 0.24, 0.25)
  s.quadraticCurveTo(0.26, 0.04, 0.14, -0.06)
  s.closePath()
  const geometry = sculpt(s, 0.045)
  geometry.rotateX(Math.PI / 2)
  return geometry
})()

export const DUCK_NECK = new LatheGeometry([
  new Vector2(0.22, 0), new Vector2(0.24, 0.12), new Vector2(0.21, 0.30),
  new Vector2(0.18, 0.46), new Vector2(0.19, 0.56),
], 32)
