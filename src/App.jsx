import { useEffect, useRef, useState } from 'react'

import { play, setMusic, setSfx, unlockAudio } from './audio/sfx'
import { useBloxityStore } from './bloxity/store'
import GameScene from './game/GameScene'
import { connect, reconnectWithNewIdentity } from './net/net'
import { runtime, useGame } from './state/store'
import HUD, { invite, PANEL_SHORTCUTS } from './ui/HUD'
import LoadingScreen from './ui/LoadingScreen'
import Panels from './ui/Panels'
import TouchControls from './ui/TouchControls'

/** Keyboard shortcuts - each side button shows its key in its corner. */
function useHotkeys() {
  useEffect(() => {
    const onKey = (e) => {
      unlockAudio()
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const g = useGame.getState()
      if (e.key === 'Escape') {
        if (g.panel) play('close')
        g.closePanel()
        return
      }
      if (!g.profile) return
      const key = e.key.toUpperCase()
      if (key === 'E') {
        runtime.interact?.()
        return
      }
      if (key === '-' || key === '_') useGame.setState({ speedPct: Math.max(10, g.speedPct - 10) })
      if (key === '=' || key === '+') useGame.setState({ speedPct: Math.min(100, g.speedPct + 10) })
      if (key === 'I') {
        invite()
        return
      }
      const panel = PANEL_SHORTCUTS[key]
      if (!panel) return
      play(g.panel === panel ? 'close' : 'open')
      g.setPanel(panel)
    }
    const onPointer = () => unlockAudio()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [])
}

/** Connect once Bloxity knows who we are; reconnect if the account changes. */
function useNetwork() {
  const status = useBloxityStore((s) => s.status)
  const userId = useBloxityStore((s) => s.user?._id || s.user?.id || null)
  const started = useRef(false)
  const lastUser = useRef(userId)

  useEffect(() => {
    if (started.current) return undefined
    const go = () => {
      if (started.current) return
      started.current = true
      connect()
    }
    if (status === 'ready' || status === 'error') go()
    const id = setTimeout(go, 5000)
    return () => clearTimeout(id)
  }, [status])

  useEffect(() => {
    if (!started.current || lastUser.current === userId) return
    lastUser.current = userId
    reconnectWithNewIdentity()
  }, [userId])
}

function useAudioSettings() {
  const music = useGame((s) => s.settings.music)
  const sfx = useGame((s) => s.settings.sfx)
  useEffect(() => setMusic(music), [music])
  useEffect(() => setSfx(sfx), [sfx])
}

/** Canvas text uses the web fonts, so wait for them (briefly) before building the world. */
function useFonts() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const done = () => setReady(true)
    const fonts = document.fonts
    const load = fonts
      ? Promise.all(['800 64px "Baloo 2"', '800 32px "Nunito"', '64px "Lilita One"', '700 32px "Fredoka"', 'italic 900 64px "Montserrat"'].map((f) => fonts.load(f))).then(() => fonts.ready)
      : Promise.resolve()
    Promise.race([load, new Promise((r) => setTimeout(r, 3500))]).then(done, done)
  }, [])
  return ready
}

function App() {
  useHotkeys()
  useNetwork()
  useAudioSettings()
  const fontsReady = useFonts()
  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: '#56a6ff' }}>
      {fontsReady && <GameScene />}
      <HUD />
      <Panels />
      <TouchControls />
      <LoadingScreen />
    </div>
  )
}

export default App
