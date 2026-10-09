import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { play, setMusic, setSfx } from '../audio/sfx'
import { send } from '../net/net'
import {
  DUCKS,
  GIFTS,
  STAGE_COUNT,
  STAGE_NAMES,
  STAGE_WINS,
  WHEEL,
  WORLD2_REBIRTHS,
  formatNum,
  formatTime,
  giftWins,
  rebirthLevel,
  speedStat,
  stageLevel,
  stageWorld,
  stepMultiplier,
  winMultiplier,
} from '../shared/gameData'
import { useGame } from '../state/store'
import { Bolt, CloseX, DuckIcon, Gear, Gift, Lock, MapIcon, Rebirth, Sneaker, Trophy, WheelIcon } from './icons'

function Panel({ title, subtitle, icon: Icon, theme = 'blue', children, width }) {
  const close = useGame((s) => s.closePanel)
  const titleId = useId()
  const panelRef = useRef()
  useEffect(() => {
    const previous = document.activeElement
    panelRef.current?.querySelector('.close')?.focus({ preventScroll: true })
    return () => { if (previous?.isConnected) previous.focus?.({ preventScroll: true }) }
  }, [])
  return (
    <div
      className="shade"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          play('close')
          close()
        }
      }}
    >
      <section
        ref={panelRef}
        className="panel"
        data-theme={theme}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? `${titleId}-sub` : undefined}
        style={width ? { width } : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            play('close')
            close()
          }
          if (e.key !== 'Tab') return
          const buttons = [...e.currentTarget.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
          const first = buttons[0]
          const last = buttons[buttons.length - 1]
          if ((e.shiftKey && document.activeElement === first) || (!e.shiftKey && document.activeElement === last)) {
            e.preventDefault()
            ;(e.shiftKey ? last : first)?.focus()
          }
        }}
      >
        <header className="panel-head">
          <div className="panel-icon" aria-hidden="true">{Icon ? <Icon size={48} /> : <DuckIcon size={48} />}</div>
          <div className="panel-heading">
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p id={`${titleId}-sub`}>{subtitle}</p>}
          </div>
        </header>
        <button
          type="button"
          className="close"
          aria-label="Close panel (Esc)"
          aria-keyshortcuts="Escape"
          title="Close - Esc"
          onClick={() => {
            play('close')
            close()
          }}
        >
          <kbd className="shortcut wide" aria-hidden="true">ESC</kbd>
          <CloseX />
        </button>
        <div className="body">{children}</div>
      </section>
    </div>
  )
}

/* ---- Rebirth --------------------------------------------------------- */
function RebirthPanel({ p }) {
  const need = rebirthLevel(p.rebirths)
  const k = Math.min(1, p.level / need)
  const ok = p.level >= need
  return (
    <Panel title="Rebirth" subtitle="A fresh start with bigger rewards." icon={Rebirth} theme="rebirth" width="min(600px, 94vw)">
      <div className="rebirth-hero">
        <div className="hero-icon" aria-hidden="true"><Rebirth size={80} /></div>
        <div>
          <span className="panel-eyebrow">YOUR NEXT REBIRTH</span>
          <div className="hero-count">{p.rebirths + 1}</div>
          <p>{ok ? 'Ready for your next adventure!' : `${Math.max(0, need - p.level)} more levels to unlock`}</p>
        </div>
      </div>
      <div className="progress-label"><span>Level progress</span><strong>{p.level} / {need}</strong></div>
      <div className="pbar" role="progressbar" aria-label="Rebirth level progress" aria-valuemin={0} aria-valuemax={need} aria-valuenow={Math.min(p.level, need)}>
        <div style={{ width: `${k * 100}%` }} />
      </div>
      <div className="benefit-grid">
        <div className="benefit">
          <Sneaker size={34} />
          <span>Step multiplier</span>
          <strong>x{stepMultiplier(p.rebirths + 1)}</strong>
          <small>Current: x{stepMultiplier(p.rebirths)}</small>
        </div>
        <div className="benefit">
          <Trophy size={34} />
          <span>Win multiplier</span>
          <strong>x{winMultiplier(p.rebirths + 1)}</strong>
          <small>Current: x{winMultiplier(p.rebirths)}</small>
        </div>
      </div>
      {p.rebirths + 1 === WORLD2_REBIRTHS && <div className="unlock-note"><MapIcon size={28} />World 2 unlocks with this rebirth!</div>}
      <p className="panel-note">Resets your Level &amp; Speed. You keep your Wins, Ducks and Treadmills.</p>
      <div className="panel-action">
        <button
          type="button"
          className="gbtn rebirth-action"
          disabled={!ok}
          onClick={() => {
            send('rebirth')
            useGame.getState().closePanel()
          }}
        >
          {ok ? 'REBIRTH!' : `Reach Level ${need}`}
        </button>
      </div>
    </Panel>
  )
}

/* ---- Ducks inventory ---------------------------------------------------- */
function DucksPanel({ p }) {
  return (
    <Panel title="Ducks" subtitle="Find your favourite waddling companion." icon={DuckIcon} theme="gifts">
      <div className="r-sub" style={{ marginBottom: 10, fontSize: 16 }}>
        Buy ducks at the red pads in the lobby (walk up &amp; press E). Every duck you own can be equipped here.
      </div>
      <div className="grid">
        {DUCKS.map((d) => {
          const owned = p.ducks.includes(d.id)
          const eq = p.duck === d.id
          const locked = !owned && p.rebirths < d.reb
          return (
            <div key={d.id} className={`card ${owned ? 'owned' : ''} ${eq ? 'eq' : ''} ${locked ? 'locked' : ''}`}>
              <DuckIcon size={74} body={d.body} beak={d.beak} glow={d.fx?.glow} />
              <div className="t ol">{d.name}</div>
              <div className="s ol">+{formatNum(d.perStep)} / Step</div>
              {owned ? (
                <button
                  className={`gbtn ${eq ? 'gold' : ''}`}
                  disabled={eq}
                  onClick={() => {
                    play('click')
                    send('equip', { id: d.id })
                  }}
                >
                  {eq ? 'Equipped' : 'Equip'}
                </button>
              ) : (
                <div className="s ol" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#fff' }}>
                  {d.wheel ? (
                    'Lucky Wheel only!'
                  ) : locked ? (
                    <>
                      <Lock size={20} /> {d.reb} Rebirths
                    </>
                  ) : (
                    <>
                      {formatNum(d.cost)} <Trophy size={20} /> • World {d.world}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

/* ---- Stages: what each one pays and needs (runs always start in the lobby) ---- */
function StagesPanel({ p }) {
  const tp = (to) => {
    send('tp', { to })
    useGame.getState().closePanel()
  }
  const w2 = p.rebirths >= WORLD2_REBIRTHS
  return (
    <Panel title="Stages" subtitle="Explore the course and your next challenge." icon={MapIcon}>
      <div className="r-sub" style={{ marginBottom: 10 }}>
        Every run starts in the lobby. Touch a wins pad to cash out and go back - or keep running to a later stage for far more Wins. Each gate needs a higher Level.
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="gbtn blue" onClick={() => tp('w1')}>
          World 1 Lobby
        </button>
        <button className="gbtn blue" disabled={!w2} onClick={() => tp('w2')}>
          {w2 ? 'World 2 Lobby' : `World 2 (${WORLD2_REBIRTHS} Rebirths)`}
        </button>
      </div>
      {Array.from({ length: STAGE_COUNT }, (_, i) => i + 1).map((n) => {
        const worldOk = stageWorld(n) === 1 || w2
        const open = n <= p.maxStage && worldOk
        return (
          <div key={n} className="row" style={{ opacity: open ? 1 : 0.6 }}>
            <div>
              <div className="ol">
                Stage {n} • {STAGE_NAMES[n]}
              </div>
              <div className="r-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                World {stageWorld(n)} • +{formatNum(Math.round(STAGE_WINS[n] * winMultiplier(p.rebirths)))} <Trophy size={16} />
              </div>
            </div>
            {!worldOk ? (
              <span className="ol" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16 }}>
                <Lock size={22} /> {WORLD2_REBIRTHS} Rebirths
              </span>
            ) : p.level < stageLevel(n) ? (
              <span className="ol" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, color: '#b54d5e' }}>
                <Lock size={22} /> Level {stageLevel(n)} • Speed {speedStat(stageLevel(n))}
              </span>
            ) : (
              <span className="ol" style={{ fontSize: 16, color: open ? '#238564' : '#a36c1d' }}>{open ? 'Reached' : 'Ready!'}</span>
            )}
          </div>
        )
      })}
    </Panel>
  )
}

/* ---- Settings ---------------------------------------------------------- */
function SettingToggle({ active, label, children, onClick }) {
  return (
    <button type="button" className={`toggle ${active ? 'on' : ''}`} aria-pressed={active} aria-label={`${label}: ${children}`} onClick={onClick}>
      <span className="toggle-dot" aria-hidden="true" />
      <span>{children}</span>
    </button>
  )
}

function SettingsPanel() {
  const settings = useGame((s) => s.settings)
  const setSetting = useGame((s) => s.setSetting)
  const toggle = (k, apply) => {
    play('click')
    const v = !settings[k]
    setSetting(k, v)
    apply?.(v)
  }
  return (
    <Panel title="Settings" subtitle="Make the game feel right for you." icon={Gear} theme="settings" width="min(620px, 94vw)">
      <div className="panel-section-label">AUDIO</div>
      <div className="row">
        <span className="ol">Music</span>
        <SettingToggle active={settings.music} label="Music" onClick={() => toggle('music', setMusic)}>
          {settings.music ? 'ON' : 'OFF'}
        </SettingToggle>
      </div>
      <div className="row">
        <span className="ol">Sound Effects</span>
        <SettingToggle active={settings.sfx} label="Sound effects" onClick={() => toggle('sfx', setSfx)}>
          {settings.sfx ? 'ON' : 'OFF'}
        </SettingToggle>
      </div>
      <div className="panel-section-label">GAMEPLAY</div>
      <div className="row">
        <span className="ol">Step Popups</span>
        <SettingToggle active={settings.popups} label="Step popups" onClick={() => toggle('popups')}>
          {settings.popups ? 'ON' : 'OFF'}
        </SettingToggle>
      </div>
      <div className="row">
        <div>
          <div className="ol">A / D Keys</div>
          <div className="r-sub">Turn the camera as you run, or strafe sideways.</div>
        </div>
        <SettingToggle active={settings.turnKeys} label="Camera controls" onClick={() => toggle('turnKeys')}>
          {settings.turnKeys ? 'TURN' : 'STRAFE'}
        </SettingToggle>
      </div>
      <div className="row">
        <div>
          <div className="ol">Graphics</div>
          <div className="r-sub">Low turns off shadows for slower devices.</div>
        </div>
        <SettingToggle
          active={settings.quality === 'high'}
          label="Graphics"
          onClick={() => {
            play('click')
            setSetting('quality', settings.quality === 'high' ? 'low' : 'high')
          }}
        >
          {settings.quality === 'high' ? 'HIGH' : 'LOW'}
        </SettingToggle>
      </div>
      <div className="row" style={{ flexDirection: 'column', alignItems: 'flex-start', fontSize: 16 }}>
        <div className="ol">Controls</div>
        <div className="r-sub">W / S - run • A / D - turn camera • Space - jump (hold to keep hopping) • Drag - turn camera • Wheel - zoom</div>
        <div className="r-sub">E - buy / equip / spin • R Rebirth • Q Ducks • T Stages • F Free gifts • O Settings • Esc close</div>
      </div>
    </Panel>
  )
}

/* ---- Free gifts --------------------------------------------------------- */
function GiftsPanel({ p }) {
  const session = useGame((s) => s.session)
  const sessionAt = useGame((s) => s.sessionAt)
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [])
  const ms = session.ms + (Date.now() - sessionAt)
  return (
    <Panel title="Free Gifts" subtitle="Little rewards for every adventure." icon={Gift} theme="gifts" width="min(760px, 94vw)">
      <div className="r-sub" style={{ marginBottom: 10, fontSize: 16 }}>
        Keep playing to unlock gifts. They reset when you rejoin.
      </div>
      <div className="grid gift-grid">
        {GIFTS.map((g, i) => {
          const claimed = session.claimed.includes(i)
          const left = g.min * 60000 - ms
          const ready = !claimed && left <= 0
          const label = g.kind === 'wins' ? `+${formatNum(giftWins(g.f, p.maxStage, p.rebirths))} Wins` : g.label
          return (
            <div key={i} className={`card gift-card ${claimed ? 'claimed' : ready ? 'ready' : ''}`}>
              <span className="gift-status">{claimed ? 'COLLECTED' : ready ? 'READY' : `${g.min} MIN`}</span>
              <div className="gift-icon" aria-hidden="true">{g.kind === 'wins' ? <Trophy size={48} /> : g.kind === 'spins' ? <WheelIcon size={48} /> : g.kind === 'boost' ? <Bolt size={48} /> : <Gift size={48} />}</div>
              <div className="t ol">{label}</div>
              <button
                type="button"
                className="gbtn"
                disabled={claimed || left > 0}
                onClick={() => {
                  send('gift', { i })
                }}
              >
                {claimed ? 'Claimed' : left > 0 ? formatTime(left) : 'Claim!'}
              </button>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

/* ---- Lucky wheel ------------------------------------------------------------ */
function WheelPanel({ p }) {
  const wheel = useGame((s) => s.wheel)
  const [angle, setAngle] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState(null)
  const seenAt = useRef(wheel?.at || 0)
  const tickTimer = useRef(null)
  const seg = 360 / WHEEL.length
  const bg = useMemo(() => `conic-gradient(${WHEEL.map((w, i) => `${w.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(',')})`, [seg])

  useEffect(() => {
    if (!wheel || wheel.at === seenAt.current) return undefined
    seenAt.current = wheel.at
    const target = 360 * 6 + (360 - (wheel.idx + 0.5) * seg)
    setSpinning(true)
    setResult(null)
    setAngle((a) => a - (a % 360) + target)
    let n = 0
    tickTimer.current = setInterval(() => {
      n += 1
      if (n < 34) play('tick')
    }, 110)
    const done = setTimeout(() => {
      clearInterval(tickTimer.current)
      setSpinning(false)
      setResult(wheel.reward)
      play(wheel.reward.duck ? 'quack' : 'wheelWin')
      if (wheel.reward.duck) useGame.getState().showBig({ kind: 'duck', text: 'LUCKY DUCK!', sub: '+4K / Step - equipped!', ms: 3000 })
    }, 4100)
    return () => {
      clearInterval(tickTimer.current)
      clearTimeout(done)
    }
  }, [wheel, seg])

  return (
    <Panel title="Lucky Wheel" subtitle="Give it a spin and see what you win." icon={WheelIcon} theme="rebirth" width="min(560px, 94vw)">
      <div className="wheel2d">
        <div className="ptr" />
        <div className="disc" style={{ background: bg, transform: `rotate(${angle}deg)`, transition: spinning ? 'transform 4s cubic-bezier(0.12, 0.8, 0.18, 1)' : 'none' }}>
          {WHEEL.map((w, i) => (
            <div key={w.id} className="lab" style={{ transform: `rotate(${(i + 0.5) * seg - 90}deg)` }}>
              <span className="ol">{w.label}</span>
            </div>
          ))}
        </div>
        <div className="hub" />
      </div>
      <div style={{ textAlign: 'center' }}>
        {result && (
          <div className="gold" style={{ fontFamily: 'var(--title)', fontSize: 40, marginBottom: 8 }}>
            {result.text}
          </div>
        )}
        <div className="ol" style={{ fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
          Spins: {p.spins}
        </div>
        <button
          className="gbtn big gold"
          disabled={spinning || p.spins < 1}
          onClick={() => {
            play('click')
            send('spin')
          }}
        >
          {spinning ? 'Spinning…' : p.spins < 1 ? 'No spins' : 'SPIN!'}
        </button>
        <div className="r-sub" style={{ marginTop: 10 }}>
          You get a free spin every 10 minutes. The ??? slice is the exclusive Lucky Duck!
        </div>
      </div>
    </Panel>
  )
}

export function Panels() {
  const panel = useGame((s) => s.panel)
  const p = useGame((s) => s.profile)
  if (!panel || !p) return null
  switch (panel) {
    case 'rebirth':
      return <RebirthPanel p={p} />
    case 'ducks':
      return <DucksPanel p={p} />
    case 'stages':
      return <StagesPanel p={p} />
    case 'settings':
      return <SettingsPanel />
    case 'gifts':
      return <GiftsPanel p={p} />
    case 'wheel':
      return <WheelPanel p={p} />
    default:
      return null
  }
}

export default Panels
