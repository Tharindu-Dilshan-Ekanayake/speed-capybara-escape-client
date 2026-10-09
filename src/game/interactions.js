import { play } from '../audio/sfx'
import { send } from '../net/net'
import { LOBBIES, STAGES } from '../shared/course'
import { DUCKS, TREADMILLS, WORLD2_REBIRTHS, formatNum } from '../shared/gameData'
import { useGame } from '../state/store'

/**
 * Everything you can walk up to and press E on: duck pedestals, treadmills, the lucky
 * wheel, world portals and the end-of-world teleporters.
 */

const SPOTS = []
for (const w of [1, 2]) {
  const L = LOBBIES[w]
  for (const p of L.pedestals) SPOTS.push({ type: 'duck', id: p.id, x: p.x, z: p.z, r: 3, world: w })
  for (const t of L.treads) SPOTS.push({ type: 'tread', id: t.id, x: t.x, z: t.z, r: 4.6, world: w, t })
  SPOTS.push({ type: 'wheel', x: L.wheel.x + 2.5, z: L.wheel.z, r: 7, world: w })
  const facing = L.portal.ry || 0
  SPOTS.push({ type: 'portal', to: L.portal.to, x: L.portal.x + Math.sin(facing) * 1.3, z: L.portal.z + Math.cos(facing) * 1.3, doorX: L.portal.x, doorZ: L.portal.z, facing, r: 4.5, world: w })
}
for (let n = 1; n < STAGES.length; n += 1) {
  for (const pr of STAGES[n].props) {
    if (pr.type === 'worldGate') SPOTS.push({ type: 'portal', to: 2, x: pr.x, z: pr.z + 1.3, doorX: pr.x, doorZ: pr.z, facing: 0, r: 4.5, world: 1 })
    if (pr.type === 'teleporter') SPOTS.push({ type: 'home', x: pr.x, z: pr.z, r: 3, world: STAGES[n].world })
  }
}

const duckDef = (id) => DUCKS.find((d) => d.id === id)
const treadDef = (id) => TREADMILLS.find((t) => t.id === id)

/** Prompt for the nearest spot, or null. */
export function findPrompt(x, z, world, profile) {
  if (!profile) return null
  let best = null
  let bestD = Infinity
  for (const s of SPOTS) {
    if (s.world !== world) continue
    const d = s.type === 'tread' ? (Math.abs(x - s.x) < s.t.w / 2 + 1.2 && Math.abs(z - s.z) < s.t.l / 2 + 1.2 ? 0 : Infinity) : Math.hypot(x - s.x, z - s.z)
    if (d < s.r && d < bestD) {
      best = s
      bestD = d
    }
  }
  if (!best) return null
  return describe(best, profile)
}

function describe(s, p) {
  switch (s.type) {
    case 'duck': {
      const d = duckDef(s.id)
      const owned = p.ducks.includes(d.id)
      if (p.duck === d.id) return { key: `duck-${d.id}-eq`, title: `${d.name}`, sub: 'Equipped!', done: true }
      if (owned) return { key: `duck-${d.id}-own`, title: `Equip ${d.name}`, sub: `+${formatNum(d.perStep)} / Step`, action: () => send('duck', { id: d.id }) }
      if (d.wheel) return { key: `duck-${d.id}-wheel`, title: d.name, sub: 'Win it on the Lucky Wheel!', done: true }
      if (p.rebirths < d.reb) return { key: `duck-${d.id}-reb`, title: d.name, sub: `Needs ${d.reb} Rebirths`, locked: true }
      return {
        key: `duck-${d.id}-buy${p.wins >= d.cost}`,
        title: `Buy ${d.name}`,
        sub: `${formatNum(d.cost)} Wins  -  +${formatNum(d.perStep)} / Step`,
        cost: d.cost,
        locked: p.wins < d.cost,
        action: () => send('duck', { id: d.id }),
      }
    }
    case 'tread': {
      const t = treadDef(s.id)
      if (p.treads.includes(t.id)) return null
      if (p.rebirths < t.reb) return { key: `tread-${t.id}-reb`, title: `${t.mult}X Treadmill`, sub: `Needs ${t.reb} Rebirths`, locked: true }
      return {
        key: `tread-${t.id}-${p.wins >= t.cost}`,
        title: `Buy ${t.mult}X Treadmill`,
        sub: `${formatNum(t.cost)} Wins  -  ${t.mult}x free Steps`,
        cost: t.cost,
        locked: p.wins < t.cost,
        action: () => send('tread', { id: t.id }),
      }
    }
    case 'wheel':
      return {
        key: `wheel-${p.spins}`,
        title: 'Spin the Lucky Wheel',
        sub: `Spins: ${p.spins}`,
        action: () => {
          play('open')
          useGame.getState().setPanel('wheel')
        },
      }
    case 'portal':
      if (s.to === 2 && p.rebirths < WORLD2_REBIRTHS) {
        return { key: 'portal-locked', title: 'World 2', sub: `Needs ${WORLD2_REBIRTHS} Rebirths`, locked: true }
      }
      return { key: `portal-${s.to}`, title: s.to === 2 ? 'Enter World 2' : 'Back to World 1', sub: 'Teleport', action: () => send('tp', { to: s.to === 2 ? 'w2' : 'w1' }) }
    case 'home':
      return { key: 'home', title: 'Back to Lobby', sub: 'Teleport', action: () => send('tp', { to: 'lobby' }) }
    default:
      return null
  }
}

/** Distance-based auto-portal (walking into a portal ring teleports you). */
export function portalAt(x, z, world) {
  for (const s of SPOTS) {
    if (s.type !== 'portal' || s.world !== world) continue
    if (Math.hypot(x - (s.doorX + Math.sin(s.facing) * 0.6), z - (s.doorZ + Math.cos(s.facing) * 0.6)) < 1.4) return s
  }
  return null
}
