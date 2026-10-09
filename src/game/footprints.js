import { capyById, CAPYS } from '../shared/gameData.js'
import { LOBBY, regionAt, STAGES } from '../shared/course.js'

export const FOOTPRINT_LIFETIME = 1
export const FOOTPRINT_SPACING = 0.55
export const FOOTPRINT_MOTIFS = {
  classic: 'droplet', choco: 'crescent', lime: 'gem', gent: 'bow', yuzu: 'sun', ghost: 'spirit',
  lava: 'flame', frost: 'snow', love: 'heart', storm: 'bolt', lucky: 'clover',
  galaxy: 'comet', angel: 'wings', dragon: 'cracks', golden: 'crown',
}
const styleCache = new Map()

export function footprintStyle(id, level = 1) {
  const capy = capyById(id)
  const grade = Math.max(1, Math.min(129, Math.floor(Number(level) || 1)))
  const key = `${capy.id}:${grade}`
  if (styleCache.has(key)) return styleCache.get(key)
  const tier = Math.min(1, Math.log2(1 + (grade - 1) / 8) / 4)
  const style = { tile: CAPYS.indexOf(capy), motif: FOOTPRINT_MOTIFS[capy.id], color: capy.fur, accent: capy.fx?.glow || capy.belly, tier, size: 0.44 + tier * 0.13 }
  styleCache.set(key, style)
  return style
}

/** Decal paths are decorative boxes above the collision floor; stamp on their top. */
export function footprintSurfaceY(x, y, z) {
  const region = regionAt(x, z)
  const boxes = region.stage ? STAGES[region.stage].boxes : LOBBY.boxes
  let top = y
  for (const b of boxes) {
    const surface = b.y + b.h / 2
    if (b.m === 'invisible' || b.k === 'kill' || surface < y - 0.02 || surface > y + 0.26) continue
    if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2) top = Math.max(top, surface)
  }
  return top + 0.025
}

export class FootprintPool {
  constructor(capacity = 512) {
    this.entries = Array(capacity).fill(null)
    this.cursor = 0
  }
  emit(entry) {
    this.entries[this.cursor] = entry
    this.cursor = (this.cursor + 1) % this.entries.length
  }
  prune(now) {
    for (let i = 0; i < this.entries.length; i += 1) {
      if (this.entries[i] && now - this.entries[i].at >= FOOTPRINT_LIFETIME) this.entries[i] = null
    }
  }
  clearActor(actor) {
    for (let i = 0; i < this.entries.length; i += 1) {
      if (this.entries[i]?.actor === actor) this.entries[i] = null
    }
  }
}

export const footprintPool = new FootprintPool()

/** Distance-based alternating footfalls; stopped, airborne and teleporting capybaras leave no trail. */
export class FootprintTrail {
  constructor(actor) {
    this.actor = actor
    this.previous = null
    this.distance = 0
    this.side = 1
  }
  step(frame, pool = footprintPool) {
    const previous = this.previous
    this.previous = { x: frame.x, z: frame.z, grounded: frame.grounded }
    const moved = previous ? Math.hypot(frame.x - previous.x, frame.z - previous.z) : 0
    if (!previous || !previous.grounded || !frame.grounded || moved > 4 || frame.teleported) {
      this.distance = 0
      if (frame.teleported || moved > 4) pool.clearActor(this.actor)
      return
    }
    if (moved < 0.001) return
    let along = FOOTPRINT_SPACING - this.distance
    const style = footprintStyle(frame.capy, frame.level)
    while (along <= moved) {
      const fraction = along / moved
      const x = previous.x + (frame.x - previous.x) * fraction + Math.cos(frame.yaw) * this.side * 0.19
      const z = previous.z + (frame.z - previous.z) * fraction - Math.sin(frame.yaw) * this.side * 0.19
      const y = footprintSurfaceY(x, frame.y, z)
      const support = frame.supportPose && frame.support
      pool.emit({ actor: this.actor, x, y, z, yaw: frame.yaw, at: frame.now, style,
        support: support || null,
        offset: support ? { x: x - frame.supportPose.x, y: y - frame.supportPose.y, z: z - frame.supportPose.z } : null,
      })
      this.side *= -1
      along += FOOTPRINT_SPACING
    }
    this.distance = (this.distance + moved) % FOOTPRINT_SPACING
  }
}
