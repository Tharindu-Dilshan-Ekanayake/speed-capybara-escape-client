import { LobbyLogic } from '../shared/lobbyLogic'
import { migrate } from '../shared/rules'

/**
 * Offline play: when the server can't be reached, the very same LobbyLogic the server
 * runs is hosted here in the browser with a single player. Progress is kept in
 * localStorage. It speaks the exact same messages, so the rest of the client cannot
 * tell the difference.
 */

const KEY = 'sde-offline-profile'
const TICK_MS = 100

function loadProfile(name) {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return migrate(JSON.parse(raw), name)
  } catch {
    /* storage blocked or corrupt: start fresh */
  }
  return migrate(null, name)
}

/**
 * @param {{ name: string, dispatch: (type: string, msg: any) => void, existing?: object|null }} opts
 *   `existing` carries on with a live profile when the server dropped mid-game.
 */
export function createOfflineRoom({ name, dispatch, existing = null }) {
  const sid = 'offline'
  const profile = existing ? migrate(structuredClone(existing), name) : loadProfile(name)
  const logic = new LobbyLogic({
    send: (_sid, type, msg) => dispatch(type, msg),
    broadcast: (type, msg, exceptSid) => {
      if (exceptSid !== sid) dispatch(type, msg)
    },
  })

  const save = () => {
    const p = logic.players.get(sid)
    if (!p) return
    p.dirty = false
    p.profile.updatedAt = Date.now()
    try {
      localStorage.setItem(KEY, JSON.stringify(p.profile))
    } catch {
      /* storage blocked: progress only lasts this session */
    }
  }

  const row = (v) => [{ name: profile.name, v, r: profile.rebirths, duck: profile.duck }]
  logic.addPlayer(
    { sid, uid: 'offline', profile },
    {
      roomId: 'offline',
      lb: { wins: row(profile.totalWins || 0), level: row(profile.level), rebirths: row(profile.rebirths) },
      offline: true,
    },
  )

  let last = Date.now()
  let saveTimer = 0
  const timer = setInterval(() => {
    const now = Date.now()
    const dt = Math.min(1000, now - last)
    last = now
    logic.tick(dt)
    saveTimer += dt
    if (saveTimer > 3000) {
      saveTimer = 0
      if (logic.players.get(sid)?.dirty) save()
    }
  }, TICK_MS)
  window.addEventListener('pagehide', save)

  return {
    send(type, msg) {
      logic.handle(sid, type, msg)
    },
    stop() {
      clearInterval(timer)
      window.removeEventListener('pagehide', save)
      save()
    },
  }
}
