import { create } from 'zustand'

/**
 * Game state.
 *
 * `useGame` (zustand) holds everything the HUD renders. `runtime` is a plain mutable
 * object for per-frame data (positions, input, effects queues) that must never
 * trigger React re-renders.
 */

const SETTINGS_KEY = 'sde-settings'
const DEFAULT_SETTINGS = { music: true, sfx: true, quality: 'high', popups: true, turnKeys: true }

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

let toastId = 0

export const useGame = create((set, get) => ({
  /** 'connecting' | 'online' | 'offline' | 'reconnecting' | 'error' */
  net: 'connecting',
  netError: null,
  sid: null,
  roomId: null,
  loggedIn: false,
  profile: null,
  /** sid -> public player */
  players: {},
  lb: { wins: [], level: [], rebirths: [] },
  race: { phase: 'wait', until: 0 },
  friends: 1,
  session: { ms: 0, claimed: [] },
  sessionAt: 0,
  statsAt: 0,
  region: { world: 1, stage: 0 },
  panel: null,
  prompt: null,
  toasts: [],
  feed: [],
  big: null,
  wheel: null,
  newDuck: null,
  speedPct: 100,
  settings: loadSettings(),
  dev: false,
  sceneReady: false,
  avatarReady: false,

  setPanel: (panel) => set({ panel: get().panel === panel ? null : panel }),
  closePanel: () => set({ panel: null }),
  setSetting: (key, value) => {
    const settings = { ...get().settings, [key]: value }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* storage blocked */
    }
    set({ settings })
  },
  toast: (text, kind = 'info') => {
    const id = ++toastId
    set({ toasts: [...get().toasts.slice(-3), { id, text, kind }] })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3200)
  },
  pushFeed: (text, kind = 'sys') => {
    const id = ++toastId
    set({ feed: [...get().feed.slice(-4), { id, text, kind }] })
    setTimeout(() => set({ feed: get().feed.filter((t) => t.id !== id) }), 9000)
  },
  showBig: (big) => {
    const id = ++toastId
    set({ big: { ...big, id } })
    setTimeout(() => {
      if (get().big?.id === id) set({ big: null })
    }, big.ms || 2200)
  },
}))

export const runtime = {
  /** Local player physics state (see game/physics.js). */
  me: null,
  /** sid -> interpolated remote transform */
  remote: new Map(),
  /** server time = Date.now() + clockOffset */
  clockOffset: 0,
  pendingTeleport: null,
  /** Called by the E key / prompt button. */
  interact: null,
  /** Floating "+N" step popups waiting to spawn. */
  popups: [],
  /** One-shot effects: { kind, x, y, z, at, color } */
  bursts: [],
  /** sid -> performance.now() of their last level-up / rebirth flash */
  flashes: new Map(),
  /** Local hazard state per stage (sinking stones, wave, lava). */
  hazards: { sinks: new Map(), wave: null, rise: null },
  input: { x: 0, z: 0, jump: false, touch: false },
  cameraYaw: 0,
}

/** Synchronised clock in seconds since a fixed epoch (keeps floats small). */
const EPOCH = Date.UTC(2026, 0, 1)
export const serverNow = () => Date.now() + runtime.clockOffset
export const worldTime = () => (serverNow() - EPOCH) / 1000
