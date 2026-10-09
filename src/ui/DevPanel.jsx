import { send } from '../net/net'
import { DEV_TOOLS, STAGE_COUNT, STAGE_NAMES } from '../shared/gameData'
import { useGame } from '../state/store'

/**
 * Developer-only stage jumper. Shown while DEV_TOOLS is true (src/shared/gameData.js).
 * To remove: set DEV_TOOLS = false (client + server) or delete this file and its use in App.jsx.
 */
export function DevPanel() {
  const stage = useGame((s) => s.region.stage)
  const dev = useGame((s) => s.dev)
  if (!DEV_TOOLS || !dev) return null
  const go = (n) => send('dev', { action: 'tp', stage: Math.max(0, Math.min(STAGE_COUNT, n)) })
  const b = { pointerEvents: 'auto', cursor: 'pointer', border: '3px solid #160d2a', borderRadius: 10, color: '#fff', font: '700 22px Nunito, sans-serif', padding: '6px 14px', background: '#2a7bff' }
  return (
    <div style={{ position: 'absolute', right: 12, bottom: 260, zIndex: 35, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', padding: 10, borderRadius: 14, background: 'rgba(10,8,30,0.7)', color: '#fff', fontFamily: 'var(--font)', pointerEvents: 'auto' }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#ffd84a' }}>DEV</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button style={b} onClick={() => go(stage - 1)}>◀</button>
        <div style={{ minWidth: 150, textAlign: 'center', fontWeight: 700, fontSize: 18 }}>{stage === 0 ? 'Lobby' : `Stage ${stage}`}<div style={{ fontSize: 12, color: '#cfe0ff' }}>{stage ? STAGE_NAMES[stage] : ''}</div></div>
        <button style={b} onClick={() => go(stage + 1)}>▶</button>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ ...b, fontSize: 14, background: '#1fbf3a' }} onClick={() => send('dev', { action: 'wins', amount: 10000 })}>+10K Wins</button>
        <button style={{ ...b, fontSize: 14, background: '#1fbf3a' }} onClick={() => send('dev', { action: 'level', n: 10 })}>+10 Lv</button>
        <button style={{ ...b, fontSize: 14, background: '#b46bff' }} onClick={() => send('dev', { action: 'rebirth' })}>+Rebirth</button>
      </div>
    </div>
  )
}

export default DevPanel
