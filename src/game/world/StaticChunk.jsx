import { memo, useEffect, useMemo } from 'react'
import { BoxGeometry, CylinderGeometry, PlaneGeometry, SphereGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { cloudSeaMaterial, glowPlaneMaterial, liquidMaterial, surfaceMaterial } from '../materials'

/**
 * Renders a list of boxes + cylinders as one merged mesh per material - a whole stage
 * costs a handful of draw calls. Geometry is built in world space.
 */

function boxGeo(b) {
  const g = new BoxGeometry(b.w, b.h, b.d)
  g.translate(b.x, b.y, b.z)
  return g
}

function cylGeo(x, y, z, r, h, seg = 28) {
  const g = new CylinderGeometry(r, r, h, seg)
  g.translate(x, y, z)
  return g
}

/** Visual parts for a cylinder entry (islands get a grass cap, yuzu get a citrus slice). */
function cylinderParts(c) {
  const out = []
  if (c.island) {
    out.push({ c: '#3fcf2c', m: 'stud', geo: cylGeo(c.x, c.top - 0.35, c.z, c.r, 0.7, 36) })
    out.push({ c: '#a8622e', m: 'stud', geo: cylGeo(c.x, c.top - 0.7 - (c.h - 0.7) / 2, c.z, c.r - 0.15, c.h - 0.7, 36) })
  } else if (c.citrus) {
    // A giant yuzu half: orange peel, pale pith ring, juicy segments.
    out.push({ c: c.c, m: 'smooth', geo: cylGeo(c.x, c.top - c.h / 2, c.z, c.r, c.h, 36) })
    const dome = new SphereGeometry(c.r, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
    dome.scale(1, 0.45, 1)
    dome.translate(c.x, c.top - c.h, c.z)
    out.push({ c: c.c, m: 'smooth', geo: dome })
    out.push({ c: '#fff3c8', m: 'smooth', geo: cylGeo(c.x, c.top + 0.01, c.z, c.r * 0.9, 0.02, 36) })
    out.push({ c: '#ffc23a', m: 'smooth', geo: cylGeo(c.x, c.top + 0.025, c.z, c.r * 0.8, 0.02, 36) })
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI
      const seg = new BoxGeometry(c.r * 1.6, 0.02, 0.07)
      seg.rotateY(a)
      seg.translate(c.x, c.top + 0.04, c.z)
      out.push({ c: '#fff3c8', m: 'smooth', geo: seg })
    }
  } else if (c.mushroom) {
    out.push({ c: c.c, m: 'smooth', geo: cylGeo(c.x, c.top - c.h / 2, c.z, c.r, c.h, 36) })
    const dome = new SphereGeometry(c.r, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
    dome.scale(1, 0.35, 1)
    dome.translate(c.x, c.top - c.h, c.z)
    out.push({ c: c.c, m: 'smooth', geo: dome })
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + c.x
      const rr = i % 2 ? c.r * 0.55 : c.r * 0.25
      const spot = new CylinderGeometry(0.32, 0.32, 0.04, 14)
      spot.translate(c.x + Math.cos(a) * rr, c.top + 0.02, c.z + Math.sin(a) * rr)
      out.push({ c: '#ffffff', m: 'smooth', geo: spot })
    }
  } else if (c.m === 'crystal') {
    out.push({ c: c.c, m: 'crystal', geo: cylGeo(c.x, c.top - c.h / 2, c.z, c.r, c.h, 6) })
  } else {
    out.push({ c: c.c, m: c.m, geo: cylGeo(c.x, c.top - c.h / 2, c.z, c.r, c.h) })
  }
  return out
}

export const StaticChunk = memo(function StaticChunk({ boxes = [], cyls = [], planes = [], castShadow = true }) {
  const meshes = useMemo(() => {
    const groups = new Map()
    const add = (c, m, geo, extra) => {
      const key = `${c}|${m}|${extra?.cv ? extra.cv.join(',') : ''}`
      if (!groups.has(key)) groups.set(key, { c, m, extra, geos: [] })
      groups.get(key).geos.push(geo.index ? geo.toNonIndexed() : geo)
    }
    for (const b of boxes) {
      if (b.m === 'invisible') continue
      add(b.c, b.m, boxGeo(b), b.cv ? { cv: b.cv } : null)
    }
    for (const c of cyls) for (const p of cylinderParts(c)) add(p.c, p.m, p.geo)
    const out = []
    for (const g of groups.values()) {
      const geometry = mergeGeometries(g.geos, false)
      g.geos.forEach((x) => x.dispose())
      geometry.computeBoundingSphere()
      const material = surfaceMaterial(g.c, g.m, g.extra || {})
      if (material) out.push({ key: `${g.c}|${g.m}|${g.extra?.cv || ''}`, geometry, material, glow: g.m === 'neon' || g.m === 'laser' })
    }
    return out
  }, [boxes, cyls])
  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes])

  const planeMeshes = useMemo(
    () =>
      planes.map((p, i) => {
        const geometry = new PlaneGeometry(p.w, p.d)
        geometry.rotateX(-Math.PI / 2)
        const material =
          p.kind === 'clouds'
            ? cloudSeaMaterial(p.c)
            : p.kind === 'glow'
              ? glowPlaneMaterial(p.c)
              : p.kind === 'ground'
                ? surfaceMaterial(p.c, 'stud')
                : liquidMaterial(p.kind)
        return { key: i, geometry, material, p }
      }),
    [planes],
  )

  return (
    <>
      {meshes.map((m) => (
        <mesh key={m.key} geometry={m.geometry} material={m.material} castShadow={castShadow && !m.glow} receiveShadow={!m.glow} />
      ))}
      {planeMeshes.map(({ key, geometry, material, p }) => (
        <mesh key={key} geometry={geometry} material={material} position={[p.x, p.y, p.z]} receiveShadow={p.kind === 'ground'} renderOrder={p.kind === 'water' || p.kind === 'swamp' || p.kind === 'spring' ? 3 : 0} />
      ))}
    </>
  )
})

export default StaticChunk
