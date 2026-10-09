import { useEffect, useState } from 'react'

import { play } from '../audio/sfx'
import { useBloxity } from '../bloxity/BloxityContext'
import { send } from '../net/net'
import {
  CAPYS,
  GAME_ID,
  GAME_NAME,
  PACKS,
  SPIN_EVERY_MS,
  boostPrice,
  formatNum,
  formatTime,
  packPrice,
  rebirthLevel,
  speedStat,
  stepMultiplier,
  xpForLevel,
} from '../shared/gameData'
import { packAmount } from '../shared/rules'
import { runtime, serverNow, useGame } from '../state/store'
import { CapyIcon, Gear, Gift, MapIcon, Rebirth, Sneaker, Trophy, WheelIcon } from './icons'
import './hud.css'

/** Re-render on a timer (for countdowns). */
function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

/** Scales the HUD with the window so it fits phones and 4K alike. */
function useUiScale() {
  useEffect(() => {
    const apply = () => {
      // Very short screens (phones in landscape) may shrink further so the side
      // columns leave room for the touch joystick and JUMP button.
      const floor = window.innerHeight < 380 ? 0.38 : 0.48
      const s = Math.max(floor, Math.min(1.1, Math.min(window.innerWidth / 1750, window.innerHeight / 1000)))
      document.documentElement.style.setProperty('--ui', s.toFixed(3))
    }
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])
}

const MENU = [
  { id: 'capys', label: 'Capys', key: 'Q', cls: 'c-capy', Icon: CapyIcon },
  { id: 'rebirth', label: 'Rebirth', key: 'R', cls: 'c-reb', Icon: Rebirth },
  { id: 'stages', label: 'Stages', key: 'T', cls: 'c-stage', Icon: MapIcon },
  { id: 'gifts', label: 'Free', key: 'F', cls: 'c-gift', Icon: Gift },
  { id: 'settings', label: 'Settings', key: 'O', cls: 'c-set', Icon: Gear },
]
export { MENU }
export const PANEL_SHORTCUTS = Object.fromEntries(MENU.map(({ id, key }) => [key, id]))

export function invite() {
  const url = `https://${GAME_ID}.play.bloxity.io`
  const done = () => useGame.getState().toast('Invite link copied! Friends in your server give +10% Steps each.', 'good')
  if (navigator.share) {
    navigator.share({ title: GAME_NAME, text: `Race me in ${GAME_NAME}!`, url }).catch(() => {})
    return
  }
  navigator.clipboard?.writeText(url).then(done, done)
}

function giftReady(session, sessionAt) {
  if (!session) return false
  const ms = session.ms + (Date.now() - sessionAt)
  return [1, 3, 5, 8, 12, 16, 20, 25, 30].some((min, i) => ms >= min * 60000 && !session.claimed.includes(i))
}

function LeftSide({ profile }) {
  const setPanel = useGame((s) => s.setPanel)
  const panel = useGame((s) => s.panel)
  const session = useGame((s) => s.session)
  const sessionAt = useGame((s) => s.sessionAt)
  const ready = giftReady(session, sessionAt)
  return (
    <div className="corner tl">
      <div className="wins">
        <Trophy size={52} />
        <div className="wins-copy">
          <span className="wins-caption">WINS</span>
          <span className="num gold">{formatNum(profile?.wins || 0)}</span>
        </div>
      </div>
      <nav className="side" aria-label="Game menu">
        {MENU.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`sbtn ${m.cls} ${panel === m.id ? 'active' : ''}`}
            aria-label={`${m.label} (${m.key})`}
            aria-keyshortcuts={m.key}
            aria-pressed={panel === m.id}
            title={`${m.label} - ${m.key}`}
            onClick={() => {
              play(panel === m.id ? 'close' : 'open')
              setPanel(m.id)
            }}
          >
            <kbd className="shortcut" aria-hidden="true">{m.key}</kbd>
            <span className="sbtn-icon" aria-hidden="true"><m.Icon size={48} /></span>
            <span className="lbl ol">{m.label}</span>
            {m.id === 'gifts' && ready && <span className="bang ol">!</span>}
            {m.id === 'rebirth' && profile && profile.level >= rebirthLevel(profile.rebirths) && <span className="bang ol">!</span>}
          </button>
        ))}
      </nav>
    </div>
  )
}

function TopRight({ profile, now }) {
  const { identity, isLoggedIn } = useBloxity()
  const pct = useGame((s) => s.speedPct)
  const statsAt = useGame((s) => s.statsAt)
  const setPanel = useGame((s) => s.setPanel)
  const name = profile?.name || identity?.displayName || identity?.username || 'Guest'
  const pfp = identity?.pfp
  const spinLeft = SPIN_EVERY_MS - (((profile?.spinMs || 0) + (now - statsAt)) % SPIN_EVERY_MS)
  const sNow = serverNow()
  const price = boostPrice(profile?.maxStage || 1)
  const boost = (kind) => {
    play('click')
    send('boost', { kind })
  }
  return (
    <div className="corner tr">
      <div className="idcard">
        {pfp ? <img src={pfp} alt="" /> : <div className="pfp">{name.charAt(0).toUpperCase()}</div>}
        <div>
          <div className="nm">{name}</div>
          <div className="sub">
            Lv {profile?.level || 1}
            {profile?.rebirths ? ` • Rebirth ${profile.rebirths}` : ''} • {isLoggedIn ? 'Bloxity' : 'Guest'}
          </div>
        </div>
      </div>
      <div className="pct">
        <button type="button" disabled={pct <= 10} aria-label="Decrease speed (-)" aria-keyshortcuts="-" title="Decrease speed - keyboard -" onClick={() => useGame.setState({ speedPct: Math.max(10, pct - 10) })}>
          <kbd className="shortcut" aria-hidden="true">-</kbd><span className="speed-symbol" aria-hidden="true">−</span>
        </button>
        <div className="v ol">{pct}%</div>
        <button type="button" disabled={pct >= 100} aria-label="Increase speed (+)" aria-keyshortcuts="=" title="Increase speed - keyboard + or =" onClick={() => useGame.setState({ speedPct: Math.min(100, pct + 10) })}>
          <kbd className="shortcut" aria-hidden="true">+</kbd><span className="speed-symbol" aria-hidden="true">+</span>
        </button>
      </div>
      <div className="stat ol">Speed: {formatNum(Math.round(speedStat(profile?.level || 1) * (pct / 100)))}</div>
      <button type="button" className="spin" aria-label="Open Lucky Wheel" onClick={() => setPanel('wheel')}>
        <div>
          <div className="t gold">Free Spin In: {formatTime(spinLeft)}</div>
          <div className="t gold">Spins: {profile?.spins || 0}</div>
        </div>
        <WheelIcon size={64} />
      </button>
      {[
        ['wins', '2x WINS', profile?.boostWins],
        ['speed', '2x SPEED', profile?.boostSpeed],
      ].map(([kind, label, until]) => {
        const left = (until || 0) - sNow
        return (
          <div key={kind} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button type="button" className={`rbtn rbtn-${kind} ${left > 0 ? 'on' : ''}`} onClick={() => boost(kind)}>
              <span className="ic">{kind === 'wins' ? <Trophy size={46} /> : <Sneaker size={46} />}</span>
              <span className="boost-label ol">{label}</span>
            </button>
            <div className="price">
              {left > 0 ? (
                <span className="ol" style={{ color: '#7dff8a' }}>
                  {formatTime(left)} left
                </span>
              ) : (
                <>
                  <span className="ol">ONLY {formatNum(price)}</span>
                  <Trophy size={30} />
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TopCenter() {
  const race = useGame((s) => s.race)
  const left = Math.max(0, race.until - serverNow())
  const label = race.phase === 'wait' ? 'Next Race In' : race.phase === 'countdown' ? 'Race Starting In' : 'Race Ends In'
  const secs = Math.ceil(left / 1000)
  useEffect(() => {
    if (race.phase === 'countdown' && secs > 0 && secs <= 5) play('countdown')
  }, [race.phase, secs])
  return (
    <div className="corner tc">
      <div className={`race-timer ${race.phase === 'countdown' ? 'race-timer-starting' : ''}`} role="timer">
        {label}: <strong>{secs}</strong> {secs === 1 ? 'second' : 'seconds'}
      </div>
    </div>
  )
}

function Bottom({ profile }) {
  const prompt = useGame((s) => s.prompt)
  const level = profile?.level || 1
  const xp = profile?.xp || 0
  const need = xpForLevel(level)
  const k = Math.max(0, Math.min(1, xp / need))
  const mult = stepMultiplier(profile?.rebirths || 0)
  const capy = CAPYS.find((d) => d.id === profile?.capy) || CAPYS[0]
  return (
    <div className="corner bc">
      {prompt && (
        <button type="button" className={`prompt ${prompt.locked ? 'locked' : ''} ${prompt.done ? 'done' : ''}`} disabled={prompt.done} aria-label={`${prompt.title}. ${prompt.sub}`} aria-keyshortcuts={prompt.done ? undefined : 'E'} title={prompt.done ? prompt.title : `${prompt.title} - E`} onClick={() => runtime.interact?.()}>
          <kbd className="shortcut" aria-hidden="true">{prompt.done ? '✓' : 'E'}</kbd>
          <span className="prompt-copy">
            <span className="pt ol">{prompt.title}</span>
            <span className="ps">{prompt.sub}</span>
          </span>
        </button>
      )}
      <div className="lvrow">
        <div className="lvbar">
          <div className="fill" style={{ width: `${k * 100}%` }} />
          <div className="walkers" style={{ left: `${Math.max(12, k * 100)}%` }}>
            <span>
              <CapyIcon size={26} fur={capy.fur} nose={capy.nose} />
            </span>
            <span>
              <CapyIcon size={30} fur={capy.fur} nose={capy.nose} />
            </span>
            <span>
              <CapyIcon size={46} fur={capy.fur} nose={capy.nose} glow={capy.fx?.glow} yuzu={!!capy.fx?.yuzu} />
            </span>
          </div>
          <div className="txt ol">
            {formatNum(xp)}/{formatNum(need)}
          </div>
          <div className="tag ol">LEVEL {level}</div>
          <div className="mult">
            <span className="gold">{mult}X</span>
            <Rebirth size={44} />
          </div>
        </div>
      </div>
      <div className="packs">
        {PACKS.map((pk, i) => {
          const amount = profile ? packAmount(profile, i) : 0
          const price = packPrice(pk, profile?.maxStage || 1)
          return (
            <button
              key={pk.id}
              type="button"
              className={`pack pack-${pk.kind}`}
              onClick={() => {
                play('click')
                send('pack', { i })
              }}
            >
              <span className="a ol">
                +{formatNum(amount)}
                {pk.kind === 'spins' ? <WheelIcon size={34} /> : <Sneaker size={34} />}
              </span>
              <span className="c ol">
                {formatNum(price)} <Trophy size={18} />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Big() {
  const big = useGame((s) => s.big)
  if (!big) return null
  return (
    <div key={big.id} className={`big ${big.kind}`}>
      <div className="band">
        <div className={`txt ${big.kind === 'warn' || big.kind === 'rebirth' || big.kind === 'capy' ? '' : 'gold'}`}>{big.text}</div>
        {big.sub && <div className="sub2 ol">{big.sub}</div>}
      </div>
    </div>
  )
}

/** First-run guide, like the classic speed sims: treadmill first, then the first stage. */
function Hint({ profile }) {
  const region = useGame((s) => s.region)
  const panel = useGame((s) => s.panel)
  if (!profile || panel || (profile.totalWins || 0) > 0) return null
  // The HUD re-renders a few times a second, so reading the per-frame runtime is fine here.
  let text = null
  if (region.stage === 0 && profile.level < 3) text = runtime.onTread ? 'Nice! Steps are flowing in - level up!' : 'Walk onto the Treadmill!'
  else if (region.stage <= 1) text = 'Cross the bridges to the golden pad and press E!'
  if (!text) return null
  return (
    <div className="hint" role="status">
      <span>{text}</span>
    </div>
  )
}

function Toasts() {
  const toasts = useGame((s) => s.toasts)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ol ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function HUD() {
  useUiScale()
  const now = useNow(250)
  const profile = useGame((s) => s.profile)
  return (
    <div className="hud">
      <TopCenter />
      <LeftSide profile={profile} />
      <TopRight profile={profile} now={now} />
      <Bottom profile={profile} />
      <Hint profile={profile} />
      <Toasts />
      <Big />
    </div>
  )
}

export default HUD
