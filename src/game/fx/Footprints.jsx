import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, InstancedBufferAttribute, Object3D, PlaneGeometry, ShaderMaterial } from 'three'

import { runtime, worldTime } from '../../state/store'
import { dynBox } from '../dynamics'
import { footprintPool } from '../footprints'
import { ATLAS_COLUMNS, ATLAS_ROWS, footprintTexture } from './footprintTexture'

/** All players' one-second footfalls share a single instanced draw call. */
export default function Footprints() {
  const ref = useRef()
  const data = useMemo(() => {
    const capacity = footprintPool.entries.length
    const geometry = new PlaneGeometry(1, 1)
    geometry.rotateX(-Math.PI / 2)
    for (const [name, size] of [['aBirth', 1], ['aTile', 1], ['aTier', 1], ['aColor', 3], ['aAccent', 3]]) {
      geometry.setAttribute(name, new InstancedBufferAttribute(new Float32Array(capacity * size), size))
    }
    const texture = footprintTexture()
    const material = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAtlas: { value: texture } },
      vertexShader: `
        attribute float aBirth, aTile, aTier; attribute vec3 aColor, aAccent;
        uniform float uTime;
        varying vec2 vUv; varying float vAge, vTier; varying vec3 vColor, vAccent;
        void main() {
          vAge = uTime - aBirth; vTier = aTier; vColor = aColor; vAccent = aAccent;
          vec2 cell = vec2(mod(aTile, ${ATLAS_COLUMNS}.0), ${ATLAS_ROWS - 1}.0 - floor(aTile / ${ATLAS_COLUMNS}.0));
          vUv = (cell + uv * 0.94 + 0.03) / vec2(${ATLAS_COLUMNS}.0, ${ATLAS_ROWS}.0);
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uAtlas; varying vec2 vUv; varying float vAge, vTier; varying vec3 vColor, vAccent;
        void main() {
          if (vAge < 0.0 || vAge >= 1.0) discard;
          vec3 masks = texture2D(uAtlas, vUv).rgb;
          float sparkles = masks.b * smoothstep(0.05, 0.75, vTier);
          float alpha = max(masks.r * (0.58 + vTier * 0.28), max(masks.g * 0.95, sparkles));
          alpha *= 1.0 - smoothstep(0.3, 1.0, vAge);
          if (alpha < 0.01) discard;
          vec3 color = mix(vColor, vAccent, masks.g);
          color = mix(color, vec3(1.0), sparkles * (0.7 + 0.3 * sin(vAge * 15.0)));
          gl_FragColor = vec4(color, alpha);
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false,
    })
    return { geometry, material, texture, dummy: new Object3D(), seen: Array(capacity).fill(null), palettes: new Map() }
  }, [])
  useEffect(() => () => { data.geometry.dispose(); data.material.dispose(); data.texture.dispose() }, [data])

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const now = performance.now() / 1000
    const T = worldTime()
    footprintPool.prune(now)
    data.material.uniforms.uTime.value = now
    const attrs = data.geometry.attributes
    let attributesChanged = false
    footprintPool.entries.forEach((entry, i) => {
      const dummy = data.dummy
      if (!entry) {
        dummy.scale.setScalar(0)
        data.seen[i] = null
      } else {
        if (data.seen[i] !== entry) {
          if (!data.palettes.has(entry.style)) data.palettes.set(entry.style, {
            color: new Color(entry.style.color).lerp(new Color(entry.style.accent), 0.4).lerp(new Color('#ffffff'), 0.15 + entry.style.tier * 0.12),
            accent: new Color(entry.style.accent).lerp(new Color('#ffffff'), 0.6),
          })
          const { color, accent } = data.palettes.get(entry.style)
          attrs.aBirth.setX(i, entry.at); attrs.aTile.setX(i, entry.style.tile); attrs.aTier.setX(i, entry.style.tier)
          attrs.aColor.setXYZ(i, color.r, color.g, color.b); attrs.aAccent.setXYZ(i, accent.r, accent.g, accent.b)
          data.seen[i] = entry
          attributesChanged = true
        }
        const b = entry.support ? dynBox(entry.support, T, runtime.hazards.sinks, now) : null
        if (b) dummy.position.set((b.minX + b.maxX) / 2 + entry.offset.x, (b.minY + b.maxY) / 2 + entry.offset.y, (b.minZ + b.maxZ) / 2 + entry.offset.z)
        else dummy.position.set(entry.x, entry.y, entry.z)
        dummy.rotation.set(0, entry.yaw + Math.PI, 0)
        dummy.scale.setScalar(entry.style.size)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    if (attributesChanged) for (const name of ['aBirth', 'aTile', 'aTier', 'aColor', 'aAccent']) attrs[name].needsUpdate = true
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[data.geometry, data.material, footprintPool.entries.length]} frustumCulled={false} renderOrder={4} />
}
