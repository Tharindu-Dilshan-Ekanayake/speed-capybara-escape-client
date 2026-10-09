import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, MeshStandardMaterial, Object3D } from 'three'

import { flowerGeometry, rockGeometry, treeGeometries } from './geometry'

/**
 * Instanced canyon cliffs, trees and flowers for one region (one draw call per set).
 */

const rockGeoCache = new Map()
function rockGeo(variant, theme) {
  const k = `${variant}|${theme.cliff}|${theme.cap}`
  if (!rockGeoCache.has(k)) rockGeoCache.set(k, rockGeometry(variant, theme))
  return rockGeoCache.get(k)
}

let trees = null
let flowers = null
const vcMat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 })
const canopyMaterials = new Map()
function canopyMaterial(theme) {
  const night = theme.sky === 'night' || theme.sky === 'dusk'
  const warm = theme.sky === 'ember' || theme.sky === 'golden' || theme.sky === 'sunset'
  const key = night ? 'night' : warm ? 'warm' : 'day'
  if (!canopyMaterials.has(key)) {
    const palette = {
      night: { color: '#9b83ff', intensity: 0.2 },
      warm: { color: '#ffc077', intensity: 0.12 },
      day: { color: '#ffffff', intensity: 0.035 },
    }[key]
    canopyMaterials.set(key, new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.72,
      emissive: palette.color,
      emissiveIntensity: palette.intensity,
    }))
  }
  return canopyMaterials.get(key)
}
const FLOWER_COLORS = ['#ff5ad8', '#ffe14a', '#b46bff', '#ff6a6a']
const dummy = new Object3D()
const tmpColor = new Color()

function Instanced({ geometry, material, items, place, color, castShadow = true }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    items.forEach((it, i) => {
      place(dummy, it, i)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      if (color) mesh.setColorAt(i, tmpColor.set(color(it, i)))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items, place, color])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow frustumCulled />
}

const placeRock = (o, r) => {
  o.position.set(r.x, r.y, r.z)
  o.rotation.set(0, r.ry, 0)
  o.scale.set(r.s * 0.9, r.s, r.s * 0.9)
}
const placeTree = (o, t) => {
  o.position.set(t.x, t.y, t.z)
  o.rotation.set(0, (t.x * 13.7 + t.z * 7.1) % 6.28, 0)
  o.scale.setScalar(t.s)
}
const placeFlower = (o, f) => {
  o.position.set(f.x, 0, f.z)
  o.rotation.set(0, f.x, 0)
  o.scale.setScalar(1)
}

export const Nature = memo(function Nature({ rocks = [], trees: treeList = [], flowers: flowerList = [], theme }) {
  if (!trees) trees = treeGeometries()
  if (!flowers) flowers = flowerGeometry()
  const byVariant = useMemo(() => [0, 1, 2].map((v) => rocks.filter((r) => r.v === v)), [rocks])
  const canopyColor = useMemo(() => (t) => theme.canopy[t.c % theme.canopy.length], [theme])
  const flowerColor = useMemo(() => (f) => FLOWER_COLORS[f.c % FLOWER_COLORS.length], [])
  const canopyMat = canopyMaterial(theme)
  return (
    <>
      {byVariant.map((list, v) => (
        <Instanced key={v} geometry={rockGeo(v, theme)} material={vcMat} items={list} place={placeRock} />
      ))}
      <Instanced geometry={trees.trunk} material={vcMat} items={treeList} place={placeTree} />
      <Instanced geometry={trees.canopy} material={canopyMat} items={treeList} place={placeTree} color={canopyColor} />
      <Instanced geometry={flowers.stems} material={vcMat} items={flowerList} place={placeFlower} castShadow={false} />
      <Instanced geometry={flowers.head} material={canopyMat} items={flowerList} place={placeFlower} color={flowerColor} castShadow={false} />
    </>
  )
})

export default Nature
