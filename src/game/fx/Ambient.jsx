import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial } from 'three'

import { runtime, useGame } from '../../state/store'
import { shapeTexture } from '../textures'

/**
 * Drifting cherry petals and fireflies around the player while in a lobby - a gentle
 * "living world" touch. One Points draw call; particles wrap around the player.
 */

const N = 90
const BOX = 44
const HEIGHT = 14

const mat = new ShaderMaterial({
  uniforms: { uMap: { value: shapeTexture('dot') } },
  vertexShader: `
    attribute float aSize; attribute vec3 aColor; attribute float aAlpha; varying vec3 vC; varying float vA;
    void main() {
      vC = aColor; vA = aAlpha;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (300.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform sampler2D uMap; varying vec3 vC; varying float vA;
    void main() { vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb, t.a * vA); }`,
  transparent: true,
  depthWrite: false,
  blending: AdditiveBlending,
})

const PALETTE = ['#ffb3e6', '#ffffff', '#fff3a0', '#ffd0f0']

export function Ambient() {
  const region = useGame((s) => s.region)
  const data = useMemo(() => {
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(N * 3), 3))
    geo.setAttribute('aSize', new BufferAttribute(new Float32Array(N), 1))
    geo.setAttribute('aAlpha', new BufferAttribute(new Float32Array(N), 1))
    const colors = new Float32Array(N * 3)
    const seeds = Array.from({ length: N }, (_, i) => {
      const c = new Color(PALETTE[i % PALETTE.length])
      colors.set([c.r, c.g, c.b], i * 3)
      return { x: Math.random() * BOX, y: Math.random() * HEIGHT, z: Math.random() * BOX, v: 0.3 + Math.random() * 0.5, ph: Math.random() * 6.28, sz: 0.25 + Math.random() * 0.25 }
    })
    geo.setAttribute('aColor', new BufferAttribute(colors, 3))
    return { geo, seeds }
  }, [])

  useFrame(({ clock }, dt) => {
    const me = runtime.me
    if (!me || region.stage !== 0) {
      data.geo.setDrawRange(0, 0)
      return
    }
    data.geo.setDrawRange(0, N)
    const t = clock.elapsedTime
    const pos = data.geo.attributes.position.array
    const size = data.geo.attributes.aSize.array
    const alpha = data.geo.attributes.aAlpha.array
    data.seeds.forEach((s, i) => {
      s.y -= s.v * dt
      s.x += Math.sin(t * 0.7 + s.ph) * dt * 0.6
      if (s.y < 0) s.y += HEIGHT
      // Wrap around the player so petals are always near them.
      const wx = ((((s.x - me.x + BOX / 2) % BOX) + BOX) % BOX) - BOX / 2
      const wz = ((((s.z - me.z + BOX / 2) % BOX) + BOX) % BOX) - BOX / 2
      pos[i * 3] = me.x + wx
      pos[i * 3 + 1] = s.y
      pos[i * 3 + 2] = me.z + wz
      size[i] = s.sz
      alpha[i] = 0.55 + 0.35 * Math.sin(t * 2 + s.ph)
    })
    data.geo.attributes.position.needsUpdate = true
    data.geo.attributes.aSize.needsUpdate = true
    data.geo.attributes.aAlpha.needsUpdate = true
  })

  return <points geometry={data.geo} material={mat} frustumCulled={false} renderOrder={9} />
}

export default Ambient
