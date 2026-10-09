import { useEffect, useState } from 'react'

import { useBloxity } from '../bloxity/BloxityContext'
import { useGame } from '../state/store'
import { DuckIcon } from './icons'
import './loading.css'

/**
 * Full-screen loading page in the game's theme. Stays up until the world has rendered,
 * the server answered (or we fell back to solo play), and the avatar is ready.
 */
export function LoadingScreen() {
  const { game, status } = useBloxity()
  const net = useGame((s) => s.net)
  const sceneReady = useGame((s) => s.sceneReady)
  const avatarReady = useGame((s) => s.avatarReady)
  const [timedOut, setTimedOut] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), 12000)
    return () => clearTimeout(id)
  }, [])

  const connected = net === 'online' || net === 'offline' || net === 'error'
  const steps = [status === 'ready' || status === 'error', sceneReady, connected, avatarReady || timedOut]
  const progress = steps.filter(Boolean).length / steps.length
  const done = sceneReady && connected && (avatarReady || timedOut)
  const label = !steps[0] ? 'Waking up the ducks…' : !sceneReady ? 'Building the world…' : !connected ? 'Joining a server…' : !steps[3] ? 'Dressing your avatar…' : "Let's go!"

  useEffect(() => {
    game.loadingStep(label)
  }, [game, label])
  useEffect(() => {
    if (!done) return undefined
    game.loadingEnd()
    const id = setTimeout(() => setGone(true), 700)
    return () => clearTimeout(id)
  }, [done, game])

  if (gone) return null
  const pct = Math.round(Math.max(4, progress * 100))
  return (
    <div className={`loading ${done ? 'out' : ''}`}>
      <div className="cloud c1" />
      <div className="cloud c2" />
      <div className="cloud c3" />
      <div className="center">
        <div className="logo">
          <div className="l1">+1 SPEED</div>
          <div className="l2">
            <span>DUCK</span> ESCAPE
          </div>
        </div>
        <div className="hero">
          <DuckIcon size={120} />
          <div className="shadow" />
        </div>
        <div className="bar">
          <div className="fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="lbl">
          {label} <b>{pct}%</b>
        </div>
      </div>
    </div>
  )
}

export default LoadingScreen
