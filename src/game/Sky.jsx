import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Fog,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  SphereGeometry,
} from 'three'

import { LOBBY, STAGES } from '../shared/course'
import { runtime, useGame } from '../state/store'

/**
 * Sky dome + clouds + stars, and the matching sun / hemisphere light.
 * Each stage theme picks a sky; colours blend smoothly when you cross into a new stage.
 */

export const SKIES = {
  day: { top: '#1652f0', mid: '#3f93ff', bottom: '#b4dcff', fog: '#a9d4ff', hemiSky: '#dcecff', hemiGround: '#4a6a2a', sun: 2.5, hemi: 0.8, stars: 0, cloud: '#ffffff' },
  ember: { top: '#240812', mid: '#7a2416', bottom: '#ff8a3a', fog: '#a8482a', hemiSky: '#ffb08a', hemiGround: '#3a1410', sun: 1.8, hemi: 0.9, stars: 0.2, cloud: '#ff9a6a' },
  high: { top: '#2b78ff', mid: '#86c4ff', bottom: '#ffffff', fog: '#d6ebff', hemiSky: '#ffffff', hemiGround: '#9fc6ff', sun: 2.6, hemi: 1.25, stars: 0, cloud: '#ffffff' },
  dusk: { top: '#0e0820', mid: '#2e1636', bottom: '#5a2234', fog: '#22101e', hemiSky: '#8a4a6a', hemiGround: '#1a0a14', sun: 1.1, hemi: 0.75, stars: 0.6, cloud: '#4a2a4a' },
  night: { top: '#050716', mid: '#1a1450', bottom: '#4a2a8a', fog: '#251c52', hemiSky: '#9a8aff', hemiGround: '#2a1a4a', sun: 1.6, hemi: 1.0, stars: 1, cloud: '#6a5aaa' },
  sunset: { top: '#33268a', mid: '#c0588a', bottom: '#ffb46a', fog: '#e09486', hemiSky: '#ffd0b0', hemiGround: '#5a3a5a', sun: 2.2, hemi: 1.05, stars: 0.2, cloud: '#ffd6e0' },
  golden: { top: '#ff962a', mid: '#ffd07a', bottom: '#fff4d2', fog: '#ffe2a6', hemiSky: '#fff2c8', hemiGround: '#8a6a2a', sun: 2.6, hemi: 1.2, stars: 0, cloud: '#ffffff' },
}

export function skyFor(region) {
  if (region.stage) return STAGES[region.stage].theme.sky
  return LOBBY.theme.sky
}

/** Live (blended) sky colours, read by Lights + fog every frame. */
export const liveSky = {
  top: new Color(SKIES.day.top),
  mid: new Color(SKIES.day.mid),
  bottom: new Color(SKIES.day.bottom),
  fog: new Color(SKIES.day.fog),
  hemiSky: new Color(SKIES.day.hemiSky),
  hemiGround: new Color(SKIES.day.hemiGround),
  cloud: new Color(SKIES.day.cloud),
  sun: SKIES.day.sun,
  hemi: SKIES.day.hemi,
  stars: 0,
}

const dome = new SphereGeometry(900, 32, 16)
const domeMat = new ShaderMaterial({
  uniforms: { uTop: { value: liveSky.top }, uMid: { value: liveSky.mid }, uBottom: { value: liveSky.bottom } },
  vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBottom; varying vec3 vP;
    void main(){
      float h = normalize(vP).y;
      vec3 c = h > 0.0 ? mix(uMid, uTop, smoothstep(0.0, 0.65, h)) : mix(uMid, uBottom, smoothstep(0.0, -0.25, h));
      c = mix(c, uBottom, smoothstep(0.18, 0.0, abs(h)) * 0.6);
      gl_FragColor = vec4(c, 1.0);
    }`,
  side: BackSide,
  depthWrite: false,
  fog: false,
})

const cloudMat = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, emissive: '#ffffff', emissiveIntensity: 0.25, fog: false })
const puff = new SphereGeometry(1, 10, 7)
const CLOUDS = (() => {
  const out = []
  let s = 17
  const rand = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  for (let i = 0; i < 26; i += 1) {
    const a = (i / 26) * Math.PI * 2 + rand() * 0.2
    const d = 260 + rand() * 260
    const size = 14 + rand() * 18
    const puffs = 4 + Math.floor(rand() * 4)
    for (let k = 0; k < puffs; k += 1) {
      out.push({ x: Math.cos(a) * d + (k - puffs / 2) * size * 0.9, y: 70 + rand() * 90 + (k % 2) * size * 0.3, z: Math.sin(a) * d + (rand() - 0.5) * size, s: size * (0.7 + rand() * 0.5) })
    }
  }
  return out
})()

const starGeo = (() => {
  const n = 1500
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i += 1) {
    const u = Math.random() * 2 - 1
    const th = Math.random() * Math.PI * 2
    const r = Math.sqrt(1 - u * u)
    pos[i * 3] = r * Math.cos(th) * 800
    pos[i * 3 + 1] = Math.abs(u) * 800
    pos[i * 3 + 2] = r * Math.sin(th) * 800
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  return g
})()

const dummy = new Object3D()
const target = {}
for (const k of Object.keys(SKIES)) {
  target[k] = Object.fromEntries(Object.entries(SKIES[k]).map(([key, v]) => [key, typeof v === 'string' ? new Color(v) : v]))
}

export function Sky() {
  const group = useRef()
  const clouds = useRef()
  const stars = useRef()
  const scene = useThree((s) => s.scene)
  const region = useGame((s) => s.region)
  const skyId = skyFor(region)
  const fog = useMemo(() => new Fog(liveSky.fog.clone(), 70, 420), [])

  useEffect(() => {
    scene.fog = fog
    return () => {
      scene.fog = null
    }
  }, [scene, fog])

  useEffect(() => {
    const mesh = clouds.current
    if (!mesh) return
    CLOUDS.forEach((c, i) => {
      dummy.position.set(c.x, c.y, c.z)
      dummy.scale.set(c.s, c.s * 0.7, c.s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  useFrame(({ camera }, dt) => {
    const t = target[skyId] || target.day
    const k = 1 - Math.pow(0.15, dt)
    for (const key of ['top', 'mid', 'bottom', 'fog', 'hemiSky', 'hemiGround', 'cloud']) liveSky[key].lerp(t[key], k)
    for (const key of ['sun', 'hemi', 'stars']) liveSky[key] += (t[key] - liveSky[key]) * k
    fog.color.copy(liveSky.fog)
    cloudMat.color.copy(liveSky.cloud)
    cloudMat.emissive.copy(liveSky.cloud)
    if (group.current) group.current.position.set(camera.position.x, 0, camera.position.z)
    if (clouds.current) clouds.current.rotation.y += dt * 0.004
    if (stars.current) {
      stars.current.visible = liveSky.stars > 0.05
      stars.current.material.opacity = liveSky.stars
    }
    runtime.skyId = skyId
  })

  return (
    <group ref={group}>
      <mesh geometry={dome} material={domeMat} renderOrder={-10} frustumCulled={false} />
      <instancedMesh ref={clouds} args={[puff, cloudMat, CLOUDS.length]} frustumCulled={false} />
      <points ref={stars} geometry={starGeo} frustumCulled={false}>
        <pointsMaterial color="#ffffff" size={2.2} sizeAttenuation={false} transparent opacity={0} fog={false} depthWrite={false} />
      </points>
    </group>
  )
}

/** Sun + hemisphere light; the sun follows the player so shadows stay crisp. */
export function Lights({ shadows }) {
  const sun = useRef()
  const hemi = useRef()
  const scene = useThree((s) => s.scene)
  useFrame(() => {
    const me = runtime.me
    if (sun.current && me) {
      sun.current.position.set(me.x + 40, me.y + 70, me.z + 25)
      sun.current.target.position.set(me.x, me.y, me.z)
      sun.current.target.updateMatrixWorld()
      sun.current.intensity = liveSky.sun
    }
    if (hemi.current) {
      hemi.current.color.copy(liveSky.hemiSky)
      hemi.current.groundColor.copy(liveSky.hemiGround)
      hemi.current.intensity = liveSky.hemi
    }
  })
  useEffect(() => {
    if (sun.current) scene.add(sun.current.target)
  }, [scene])
  return (
    <>
      <hemisphereLight ref={hemi} args={['#d6ecff', '#4a8a3a', 1.1]} />
      <ambientLight intensity={0.12} />
      <directionalLight
        ref={sun}
        intensity={2.6}
        color="#fff0d8"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-near={1}
        shadow-camera-far={200}
      />
    </>
  )
}

export default Sky
