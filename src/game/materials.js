import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  Vector2,
} from 'three'

import { beltTexture, brickTexture, cloudSeaTexture, liquidTexture, studTexture } from './textures'

/**
 * Material factories. Box geometry is merged in world space, so textures are projected
 * triplanar from world position (no UVs needed, studs stay the same size on every box).
 */

const TIME = { value: 0 }
export const tickMaterials = (t) => {
  TIME.value = t
}

const cache = new Map()
const cached = (key, make) => {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}

const HEAD_V = 'varying vec3 vTriPos;\nvarying vec3 vTriN;'
const HEAD_F = `${HEAD_V}\nuniform float uTile;\nuniform float uTime;\nuniform vec2 uScroll;\nuniform vec2 uBeltF;\nuniform float uBeltSpeed;`
const VERT = `#include <project_vertex>
  vec4 triW = vec4(transformed, 1.0);
  vec3 triN = normal;
  #ifdef USE_INSTANCING
    triW = instanceMatrix * triW;
    triN = mat3(instanceMatrix) * triN;
  #endif
  triW = modelMatrix * triW;
  vTriPos = triW.xyz;
  vTriN = normalize(mat3(modelMatrix) * triN);`

const FRAG_TRI = `
  #ifdef USE_MAP
    vec3 tp = vTriPos * uTile;
    vec2 sc = uScroll * uTime;
    vec3 bw = pow(abs(normalize(vTriN)), vec3(6.0));
    bw /= (bw.x + bw.y + bw.z);
    vec4 tex = texture2D(map, tp.zy + sc) * bw.x + texture2D(map, tp.xz + sc) * bw.y + texture2D(map, tp.xy + sc) * bw.z;
    diffuseColor *= tex;
  #endif`

const FRAG_BELT = `
  #ifdef USE_MAP
    vec3 nn = normalize(vTriN);
    if (nn.y > 0.5) {
      vec2 f = uBeltF;
      vec2 side = vec2(f.y, -f.x);
      vec2 uv = vec2(dot(vTriPos.xz, side), dot(vTriPos.xz, f)) * uTile;
      uv.y -= uTime * uBeltSpeed * uTile;
      diffuseColor *= texture2D(map, uv);
    } else {
      diffuseColor.rgb *= vec3(0.75);
    }
  #endif`

function project(mat, { tile = 0.5, scroll = null, belt = null } = {}) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTile = { value: 1 / tile }
    shader.uniforms.uTime = TIME
    shader.uniforms.uScroll = { value: scroll || new Vector2() }
    shader.uniforms.uBeltF = { value: belt ? belt.f : new Vector2(0, 1) }
    shader.uniforms.uBeltSpeed = { value: belt ? belt.speed : 0 }
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${HEAD_V}`).replace('#include <project_vertex>', VERT)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${HEAD_F}`)
      .replace('#include <map_fragment>', belt ? FRAG_BELT : FRAG_TRI)
  }
  mat.customProgramCacheKey = () => (belt ? 'belt' : 'tri')
  return mat
}

/**
 * Material for a box / cylinder surface.
 * @param {string} color
 * @param {string} m stud | smooth | brick | neon | laser | metal | crystal | belt | invisible
 */
export function surfaceMaterial(color, m = 'stud', extra = {}) {
  const key = `${color}|${m}|${extra.cv ? extra.cv.join(',') : ''}`
  return cached(key, () => {
    const c = new Color(color)
    switch (m) {
      case 'invisible':
        return null
      case 'neon':
        return new MeshBasicMaterial({ color: c, toneMapped: false })
      case 'laser':
        return new MeshBasicMaterial({ color: c, toneMapped: false, transparent: true, opacity: 0.5, depthWrite: false })
      case 'brick':
        return project(new MeshStandardMaterial({ color: c, map: brickTexture(), roughness: 0.85 }), { tile: 2.4 })
      case 'smooth':
        return new MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.02 })
      case 'metal':
        return project(new MeshStandardMaterial({ color: c, map: studTexture(), roughness: 0.38, metalness: 0.55 }), { tile: 0.5 })
      case 'crystal':
        return new MeshStandardMaterial({
          color: c,
          emissive: c,
          emissiveIntensity: 0.45,
          roughness: 0.12,
          metalness: 0.15,
          transparent: true,
          opacity: 0.9,
          flatShading: true,
        })
      case 'belt': {
        const [vx, vz] = extra.cv || [0, 1]
        const speed = Math.hypot(vx, vz) || 1
        return project(new MeshStandardMaterial({ color: c, map: beltTexture(), roughness: 0.7 }), {
          tile: 1.6,
          belt: { f: new Vector2(vx / speed, vz / speed), speed },
        })
      }
      case 'gold':
        return project(new MeshStandardMaterial({ color: c, map: studTexture(), roughness: 0.3, metalness: 0.75, emissive: c, emissiveIntensity: 0.12 }), { tile: 0.5 })
      default:
        return project(new MeshStandardMaterial({ color: c, map: studTexture(), roughness: 0.82 }), { tile: 0.5 })
    }
  })
}

/** Big animated liquid planes (water / swamp / hot spring / lava / toxic). */
export function liquidMaterial(kind) {
  return cached(`liquid-${kind}`, () => {
    const hot = kind === 'lava' || kind === 'toxic'
    const base = { water: '#7ff0ff', swamp: '#9fe07a', spring: '#c8fbff', lava: '#ffb070', toxic: '#c8ff7a' }[kind] || '#ffffff'
    const glow = { lava: '#ff3a00', toxic: '#3aff00', swamp: '#1f6a1a', spring: '#2ac7d8' }[kind] || '#0aa0c0'
    const mat = new MeshStandardMaterial({
      color: new Color(base),
      map: liquidTexture(kind),
      roughness: hot ? 0.9 : 0.25,
      metalness: 0,
      emissive: new Color(glow),
      emissiveIntensity: hot ? 0.85 : 0.35,
      transparent: !hot,
      opacity: kind === 'swamp' ? 0.96 : 0.92,
    })
    return project(mat, { tile: 6, scroll: new Vector2(0.02, hot ? 0.015 : 0.04) })
  })
}

export function cloudSeaMaterial(tint = '#ffffff') {
  return cached(`cloudsea-${tint}`, () =>
    project(
      new MeshBasicMaterial({ color: new Color(tint), map: cloudSeaTexture(), transparent: true, opacity: 0.95, depthWrite: false }),
      { tile: 40, scroll: new Vector2(0.004, 0.002) },
    ),
  )
}

export function glowPlaneMaterial(color) {
  return cached(`glowplane-${color}`, () => new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }))
}

/** Fresnel rim glow shell (rendered on a slightly bigger copy of a mesh). */
export function fresnelMaterial(color, intensity = 1.4) {
  return cached(`fresnel-${color}-${intensity}`, () =>
    new ShaderMaterial({
      uniforms: { uColor: { value: new Color(color) }, uI: { value: intensity }, uTime: TIME },
      vertexShader: `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uI; uniform float uTime;
        varying vec3 vN; varying vec3 vV;
        void main() {
          float f = pow(1.0 - abs(dot(vN, vV)), 2.2);
          float pulse = 0.85 + 0.15 * sin(uTime * 3.0);
          gl_FragColor = vec4(uColor * f * uI * pulse, f * pulse);
        }`,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: BackSide,
    }),
  )
}

/** Plain additive glow (halos, rings, beams). */
export function additiveMaterial(color, opacity = 0.8) {
  return cached(`add-${color}-${opacity}`, () =>
    new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, toneMapped: false, side: DoubleSide }),
  )
}
