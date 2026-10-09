import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial } from 'three'

import { runtime } from '../../state/store'
import { shapeTexture } from '../textures'

/**
 * One-shot particle bursts (level up, coins, dust, death poof, rebirth) - a single
 * Points draw call for all particles.
 */

const N = 420

const mat = new ShaderMaterial({
  uniforms: { uMap: { value: shapeTexture('star') } },
  vertexShader: `
    attribute float aSize; attribute float aAlpha; attribute vec3 aColor; varying float vA; varying vec3 vC;
    void main() {
      vA = aAlpha; vC = aColor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (300.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform sampler2D uMap; varying float vA; varying vec3 vC;
    void main() { vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb, t.a * vA); }`,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
})

const PRESET = {
  level: { n: 60, colors: ['#ffe14a', '#ffffff', '#7dff8a'], speed: 7, up: 6, life: 1.2, size: 0.55, gravity: 4 },
  coins: { n: 50, colors: ['#ffd23a', '#fff6b0', '#ff9a1a'], speed: 6, up: 9, life: 1.3, size: 0.6, gravity: 14 },
  dust: { n: 14, colors: ['#ffffff', '#e8e2d0'], speed: 3, up: 1, life: 0.5, size: 0.7, gravity: 0 },
  poof: { n: 40, colors: ['#ffffff'], speed: 6, up: 3, life: 0.8, size: 0.7, gravity: 2 },
  rebirth: { n: 120, colors: ['#ff3a3a', '#ffe14a', '#3dff5a', '#29c8ff', '#c23dff'], speed: 10, up: 8, life: 1.8, size: 0.7, gravity: 3 },
}

const tmp = new Color()

export function Bursts() {
  const pts = useRef()
  const state = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(N * 3), 3))
    geo.setAttribute('aSize', new BufferAttribute(new Float32Array(N), 1))
    geo.setAttribute('aAlpha', new BufferAttribute(new Float32Array(N), 1))
    geo.setAttribute('aColor', new BufferAttribute(new Float32Array(N * 3), 3))
    const parts = Array.from({ length: N }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, size: 0.5 }))
    return { geo, parts, next: 0 }
  }, [])

  useFrame((_s, dt) => {
    const { geo, parts } = state
    while (runtime.bursts.length) {
      const b = runtime.bursts.shift()
      const me = runtime.me
      const x = b.x ?? me?.x ?? 0
      const y = b.y ?? (me ? me.y + 1.2 : 0)
      const z = b.z ?? me?.z ?? 0
      const pr = PRESET[b.kind] || PRESET.poof
      for (let i = 0; i < pr.n; i += 1) {
        const p = parts[state.next]
        state.next = (state.next + 1) % N
        const a = Math.random() * Math.PI * 2
        const sp = pr.speed * (0.4 + Math.random() * 0.6)
        p.life = pr.life * (0.6 + Math.random() * 0.4)
        p.max = p.life
        p.x = x
        p.y = y
        p.z = z
        p.vx = Math.cos(a) * sp
        p.vz = Math.sin(a) * sp
        p.vy = pr.up * (0.3 + Math.random())
        p.g = pr.gravity
        p.size = pr.size * (0.6 + Math.random() * 0.6)
        tmp.set(b.color || pr.colors[i % pr.colors.length])
        p.r = tmp.r
        p.gg = tmp.g
        p.b = tmp.b
      }
    }
    const pos = geo.attributes.position.array
    const size = geo.attributes.aSize.array
    const alpha = geo.attributes.aAlpha.array
    const col = geo.attributes.aColor.array
    for (let i = 0; i < N; i += 1) {
      const p = parts[i]
      if (p.life <= 0) {
        alpha[i] = 0
        continue
      }
      p.life -= dt
      p.vy -= p.g * dt
      const drag = Math.exp(-1.6 * dt)
      p.vx *= drag
      p.vz *= drag
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      pos[i * 3] = p.x
      pos[i * 3 + 1] = p.y
      pos[i * 3 + 2] = p.z
      size[i] = p.size
      alpha[i] = Math.max(0, p.life / p.max)
      col[i * 3] = p.r
      col[i * 3 + 1] = p.gg
      col[i * 3 + 2] = p.b
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.aSize.needsUpdate = true
    geo.attributes.aAlpha.needsUpdate = true
    geo.attributes.aColor.needsUpdate = true
  })

  return (
    <>
      <points ref={pts} geometry={state.geo} material={mat} frustumCulled={false} renderOrder={15} />
    </>
  )
}

export default Bursts
