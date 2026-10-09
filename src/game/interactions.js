import { play } from '../audio/sfx'
import { send } from '../net/net'
import { LOBBY, onPad, regionAt, STAGES } from '../shared/course'
import { STAGE_WINS, winMultiplier } from '../shared/gameData'
import { CAPYS, TREADMILLS, formatNum } from '../shared/gameData'
import { useGame } from '../state/store'

/**
 * Everything you can walk up to and press E on: capybara pads, treadmills, the lucky
 * wheel and the Golden Temple teleporter home.
 */

const SPOTS = []
for (const p of LOBBY.pedestals) SPOTS.push({ type: 'capy', id: p.id, x: p.x, z: p.z, r: 2.4 })
for (const t of LOBBY.treads) SPOTS.push({ type: 'tread', id: t.id, x: t.x, z: t.z, r: 4.6, t })
SPOTS.push({ type: 'wheel', x: LOBBY.wheel.x + 2.5, z: LOBBY.wheel.z, r: 6 })
for (let n = 1; n < STAGES.length; n += 1) {
  for (const pr of STAGES[n].props) {
    if (pr.type === 'teleporter') SPOTS.push({ type: 'home', x: pr.x, z: pr.z, r: 3 })
  }
}

const capyDef = (id) => CAPYS.find((d) => d.id === id)
const treadDef = (id) => TREADMILLS.find((t) => t.id === id)

/** Prompt for the nearest spot, or null. */
export function findPrompt(x, z, profile) {
  if (!profile) return null
  // Standing on a golden wins pad: press E to cash out.
  const reg = regionAt(x, z)
  if (reg.stage > 0 && onPad(reg.stage, x, z, 0.5)) {
    const wins = Math.round(STAGE_WINS[reg.stage] * winMultiplier(profile.rebirths))
    return { key: `pad-${reg.stage}-${wins}`, title: 'Claim Wins!', sub: `+${wins} Wins - back to the lobby`, action: () => send('pad', { stage: reg.stage }) }
  }
  let best = null
  let bestD = Infinity
  for (const s of SPOTS) {
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
    case 'capy': {
      const d = capyDef(s.id)
      const owned = p.capys.includes(d.id)
      if (p.capy === d.id) return { key: `capy-${d.id}-eq`, title: `${d.name}`, sub: 'Riding this one!', done: true }
      if (owned) return { key: `capy-${d.id}-own`, title: `Ride ${d.name}`, sub: `+${formatNum(d.perStep)} / Step`, action: () => send('capy', { id: d.id }) }
      if (d.wheel) return { key: `capy-${d.id}-wheel`, title: d.name, sub: 'Win it on the Lucky Wheel!', done: true }
      if (p.rebirths < d.reb) return { key: `capy-${d.id}-reb`, title: d.name, sub: `Needs ${d.reb} Rebirth${d.reb === 1 ? '' : 's'}`, locked: true }
      return {
        key: `capy-${d.id}-buy${p.wins >= d.cost}`,
        title: `Buy ${d.name}`,
        sub: `${formatNum(d.cost)} Wins  -  +${formatNum(d.perStep)} / Step`,
        cost: d.cost,
        locked: p.wins < d.cost,
        action: () => send('capy', { id: d.id }),
      }
    }
    case 'tread': {
      const t = treadDef(s.id)
      if (p.treads.includes(t.id)) return null
      if (p.rebirths < t.reb) return { key: `tread-${t.id}-reb`, title: `${t.mult}X Treadmill`, sub: `Needs ${t.reb} Rebirth${t.reb === 1 ? '' : 's'}`, locked: true }
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
    case 'home':
      return { key: 'home', title: 'Back to Lobby', sub: 'Teleport', action: () => send('tp', { to: 'lobby' }) }
    default:
      return null
  }
}
