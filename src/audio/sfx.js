/**
 * Synthesized sound kit + background music (WebAudio). Nothing to download.
 * Browsers only allow audio after a user gesture, so the context is created lazily.
 */

let ctx = null
let master = null
let sfxBus = null
let musicBus = null
let reverb = null
let sfxOn = true
let musicOn = true
let musicTimer = null
let musicHall = null
const MUSIC_VOL = 0.085
const SFX_VOL = 0.8

function impulse(c, seconds = 1.6, decay = 3) {
  const len = Math.floor(c.sampleRate * seconds)
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch += 1) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

function ensure() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.7
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 3
  master.connect(comp)
  comp.connect(ctx.destination)
  sfxBus = ctx.createGain()
  sfxBus.gain.value = sfxOn ? SFX_VOL : 0
  sfxBus.connect(master)
  musicBus = ctx.createGain()
  musicBus.gain.value = musicOn ? MUSIC_VOL : 0
  musicBus.connect(master)
  reverb = ctx.createConvolver()
  reverb.buffer = impulse(ctx)
  const wet = ctx.createGain()
  wet.gain.value = 0.22
  reverb.connect(wet)
  wet.connect(master)
  // The music sits in a big soft hall (sent after musicBus, so muting music mutes it too).
  musicHall = ctx.createConvolver()
  musicHall.buffer = impulse(ctx, 3.2, 2.2)
  const hallSend = ctx.createGain()
  hallSend.gain.value = 0.9
  musicBus.connect(hallSend)
  hallSend.connect(musicHall)
  musicHall.connect(master)
  startMusic()
  return ctx
}

export function unlockAudio() {
  const c = ensure()
  if (c && c.state === 'suspended') c.resume()
}

export function setSfx(on) {
  sfxOn = on
  if (sfxBus) sfxBus.gain.setTargetAtTime(on ? SFX_VOL : 0, ctx.currentTime, 0.05)
}
export function setMusic(on) {
  musicOn = on
  if (musicBus) musicBus.gain.setTargetAtTime(on ? MUSIC_VOL : 0, ctx.currentTime, 0.2)
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function tone(freq, { dur = 0.12, type = 'sine', vol = 0.25, at = 0, slide = 0, attack = 0.008, out, wet = 0.3, vib = 0 } = {}) {
  if (!ctx) return
  const t = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur)
  if (vib) {
    const lfo = ctx.createOscillator()
    const lg = ctx.createGain()
    lfo.frequency.value = 7
    lg.gain.value = vib
    lfo.connect(lg)
    lg.connect(osc.frequency)
    lfo.start(t)
    lfo.stop(t + dur + 0.05)
  }
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g)
  g.connect(out || sfxBus)
  if (wet && !out) {
    const s = ctx.createGain()
    s.gain.value = wet
    g.connect(s)
    s.connect(reverb)
  }
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

function noise({ dur = 0.3, vol = 0.25, at = 0, type = 'lowpass', freq = 1200, endFreq = 0, q = 0.8, out } = {}) {
  if (!ctx) return
  const t = ctx.currentTime + at
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(freq, t)
  if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t + dur)
  const g = ctx.createGain()
  g.gain.value = vol
  src.connect(f)
  f.connect(g)
  g.connect(out || sfxBus)
  src.start(t)
}

/** A capybara "wheek": a soft whistle-chirp that rises then falls, with a little wobble. */
function squeak(at = 0, pitch = 1, vol = 0.2) {
  if (!ctx) return
  const t = ctx.currentTime + at
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
  g.gain.exponentialRampToValueAtTime(vol * 0.6, t + 0.1)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1500 * pitch
  bp.Q.value = 0.9
  bp.connect(g)
  for (const [type, mul, gain] of [['triangle', 1, 1], ['sine', 2, 0.35]]) {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(680 * pitch * mul, t)
    osc.frequency.exponentialRampToValueAtTime(1150 * pitch * mul, t + 0.06)
    osc.frequency.exponentialRampToValueAtTime(820 * pitch * mul, t + 0.18)
    const og = ctx.createGain()
    og.gain.value = gain
    osc.connect(og)
    og.connect(bp)
    osc.start(t)
    osc.stop(t + 0.24)
  }
  g.connect(sfxBus)
}

const chord = (notes, opts) => notes.forEach((f, i) => tone(f, { ...opts, at: (opts?.at || 0) + i * (opts?.spread || 0) }))

let stepFlip = false
const SOUNDS = {
  click: () => tone(880, { dur: 0.06, type: 'sine', vol: 0.18, slide: -300, wet: 0.1 }),
  open: () => {
    tone(660, { dur: 0.07, type: 'triangle', vol: 0.16, wet: 0.1 })
    tone(990, { dur: 0.09, type: 'triangle', vol: 0.16, at: 0.05, wet: 0.1 })
  },
  close: () => {
    tone(880, { dur: 0.07, type: 'triangle', vol: 0.14, wet: 0.1 })
    tone(590, { dur: 0.09, type: 'triangle', vol: 0.14, at: 0.05, wet: 0.1 })
  },
  // A soft paw "pat": a muffled thump plus a tiny scuff, alternating feet.
  step: () => {
    stepFlip = !stepFlip
    tone(stepFlip ? 190 : 165, { dur: 0.07, type: 'sine', vol: 0.09, slide: -70, wet: 0 })
    noise({ dur: 0.045, vol: 0.05, type: 'bandpass', freq: stepFlip ? 1300 : 1100, q: 1.4 })
  },
  // The capybara chirps every time it jumps.
  jump: () => {
    squeak(0, 1.04 + Math.random() * 0.1, 0.2)
    noise({ dur: 0.22, vol: 0.05, type: 'bandpass', freq: 500, endFreq: 1800, q: 1.2 })
  },
  land: () => {
    tone(150, { dur: 0.12, type: 'sine', vol: 0.18, slide: -70, wet: 0 })
    noise({ dur: 0.1, vol: 0.06, freq: 500 })
  },
  bounce: () => {
    tone(260, { dur: 0.32, type: 'sine', vol: 0.24, slide: 900, vib: 30, wet: 0.2 })
    tone(520, { dur: 0.22, type: 'triangle', vol: 0.08, slide: 900, wet: 0.2 })
  },
  squeak: () => {
    squeak(0, 1)
    squeak(0.15, 1.12, 0.18)
  },
  levelUp: () => {
    chord([523, 659, 784, 1047, 1319], { dur: 0.22, type: 'triangle', vol: 0.14, spread: 0.07 })
    tone(1568, { dur: 0.7, type: 'sine', vol: 0.16, at: 0.36, vib: 12 })
    noise({ dur: 0.5, vol: 0.05, at: 0.3, type: 'highpass', freq: 6000 })
  },
  // Wins rain: a shower of little "chings" over a bright fanfare.
  coins: () => {
    chord([523, 659, 784, 1047], { dur: 0.16, type: 'triangle', vol: 0.08, spread: 0.07 })
    for (let i = 0; i < 26; i += 1) {
      const f = 1800 + Math.random() * 1800
      tone(f, { dur: 0.09, type: 'sine', vol: 0.05 + Math.random() * 0.04, at: 0.2 + i * 0.07 + Math.random() * 0.05, slide: -f * 0.15, wet: 0.3 })
      tone(f * 1.5, { dur: 0.05, type: 'triangle', vol: 0.03, at: 0.2 + i * 0.07, wet: 0.2 })
    }
    noise({ dur: 1.8, vol: 0.04, at: 0.2, type: 'highpass', freq: 7000 })
  },
  win: () => {
    chord([523, 659, 784, 1047], { dur: 0.18, type: 'square', vol: 0.06, spread: 0.08 })
    chord([1047, 1319, 1568], { dur: 0.9, type: 'triangle', vol: 0.12, at: 0.34 })
    tone(2093, { dur: 0.6, type: 'sine', vol: 0.06, at: 0.42, vib: 20 })
    noise({ dur: 0.6, vol: 0.06, at: 0.32, type: 'highpass', freq: 7000 })
  },
  buy: () => {
    tone(1318, { dur: 0.08, type: 'square', vol: 0.07, wet: 0.2 })
    tone(1975, { dur: 0.3, type: 'triangle', vol: 0.14, at: 0.07, wet: 0.3 })
    noise({ dur: 0.18, vol: 0.05, at: 0.05, type: 'highpass', freq: 5000 })
  },
  equip: () => {
    squeak(0, 1.1, 0.18)
    tone(1175, { dur: 0.25, type: 'sine', vol: 0.12, at: 0.12 })
  },
  boost: () => {
    tone(400, { dur: 0.5, type: 'sawtooth', vol: 0.06, slide: 1200 })
    chord([784, 988, 1175], { dur: 0.5, type: 'triangle', vol: 0.1, at: 0.25 })
  },
  error: () => {
    tone(220, { dur: 0.14, type: 'square', vol: 0.08, wet: 0 })
    tone(180, { dur: 0.2, type: 'square', vol: 0.08, at: 0.1, wet: 0 })
  },
  portal: () => {
    noise({ dur: 0.9, vol: 0.14, type: 'bandpass', freq: 300, endFreq: 3000, q: 2 })
    chord([523, 784, 1047], { dur: 0.8, type: 'sine', vol: 0.08, at: 0.3, spread: 0.08 })
  },
  // Falling into water: a big "ker-sploosh", a gulp, then bubbles rising.
  splash: () => {
    tone(520, { dur: 0.22, type: 'sine', vol: 0.22, slide: -400, wet: 0.2 })
    noise({ dur: 0.9, vol: 0.32, type: 'bandpass', freq: 2200, endFreq: 260, q: 0.8 })
    noise({ dur: 0.5, vol: 0.18, type: 'lowpass', freq: 700, endFreq: 120 })
    for (let i = 0; i < 9; i += 1) {
      const f = 380 + Math.random() * 520
      tone(f, { dur: 0.06 + Math.random() * 0.05, type: 'sine', vol: 0.07, slide: f * 0.9, at: 0.28 + i * 0.075 + Math.random() * 0.04, wet: 0.25 })
    }
    squeak(0.12, 0.82, 0.12)
  },
  zap: () => {
    tone(1400, { dur: 0.3, type: 'sawtooth', vol: 0.09, slide: -1250, wet: 0.1 })
    noise({ dur: 0.25, vol: 0.08, type: 'highpass', freq: 3000 })
  },
  // Falling into lava: a hot hiss with crackles and a startled squeak.
  burn: () => {
    noise({ dur: 1.3, vol: 0.2, type: 'highpass', freq: 3200 })
    noise({ dur: 0.9, vol: 0.16, type: 'bandpass', freq: 5200, endFreq: 1800, q: 0.9 })
    noise({ dur: 0.35, vol: 0.14, type: 'lowpass', freq: 600, endFreq: 150 })
    for (let i = 0; i < 14; i += 1) noise({ dur: 0.018, vol: 0.2 + Math.random() * 0.15, at: 0.05 + Math.random() * 1.0, type: 'highpass', freq: 1800 + Math.random() * 3000 })
    squeak(0, 1.45, 0.16)
    squeak(0.13, 1.6, 0.1)
  },
  bonk: () => {
    tone(240, { dur: 0.16, type: 'sine', vol: 0.26, slide: -150, wet: 0.1 })
    noise({ dur: 0.08, vol: 0.12, freq: 900 })
    squeak(0.1, 1.3, 0.12)
  },
  fall: () => tone(700, { dur: 0.6, type: 'sine', vol: 0.12, slide: -560 }),
  wave: () => {
    noise({ dur: 2.2, vol: 0.28, type: 'lowpass', freq: 200, endFreq: 900, q: 0.6 })
    noise({ dur: 1.6, vol: 0.12, at: 0.4, type: 'bandpass', freq: 1500, endFreq: 600, q: 0.7 })
  },
  sink: () => noise({ dur: 0.35, vol: 0.07, type: 'lowpass', freq: 700, endFreq: 200 }),
  tick: () => tone(1800, { dur: 0.025, type: 'square', vol: 0.05, wet: 0 }),
  countdown: () => tone(880, { dur: 0.18, type: 'triangle', vol: 0.18 }),
  go: () => chord([1047, 1319, 1568], { dur: 0.45, type: 'triangle', vol: 0.14 }),
  spawn: () => chord([784, 1175], { dur: 0.3, type: 'sine', vol: 0.08, spread: 0.06 }),
  rebirth: () => {
    tone(200, { dur: 1.2, type: 'sawtooth', vol: 0.07, slide: 1600 })
    chord([523, 659, 784, 1047, 1319, 1568], { dur: 0.9, type: 'triangle', vol: 0.1, at: 0.8, spread: 0.06 })
    noise({ dur: 1.2, vol: 0.06, at: 0.8, type: 'highpass', freq: 6000 })
  },
  gift: () => chord([1047, 1319, 1568, 2093], { dur: 0.35, type: 'sine', vol: 0.1, spread: 0.06 }),
  wheelWin: () => {
    chord([784, 988, 1175, 1568], { dur: 0.4, type: 'triangle', vol: 0.12, spread: 0.07 })
    tone(2093, { dur: 0.7, type: 'sine', vol: 0.08, at: 0.3, vib: 18 })
  },
}

export function play(name) {
  if (!ctx || !sfxOn) return
  if (ctx.state === 'suspended') ctx.resume()
  try {
    SOUNDS[name]?.()
  } catch {
    /* never let audio break the game */
  }
}

/* ------------------------------------------------------------------ */
/* Music: a calm, slow lo-fi loop - soft pads, a music-box melody,      */
/* a gentle bass and the odd bird chirp. No drums.                      */
/* ------------------------------------------------------------------ */

const BPM = 70
const BEAT = 60 / BPM
// Fmaj7 - Em7 - Dm7 - Cmaj7 (bass root + soft three-note pad voicing).
const PROG = [
  { bass: 87.31, pad: [220.0, 261.63, 329.63], arp: [349.23, 440.0, 523.25, 659.25] },
  { bass: 82.41, pad: [196.0, 246.94, 293.66], arp: [329.63, 392.0, 493.88, 587.33] },
  { bass: 73.42, pad: [174.61, 220.0, 261.63], arp: [293.66, 349.23, 440.0, 523.25] },
  { bass: 65.41, pad: [196.0, 246.94, 329.63], arp: [261.63, 329.63, 392.0, 493.88] },
]
// C major pentatonic, two octaves.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66]
// Melody: index into PENTA per eighth note (-1 = rest); 4 bars x 8 per phrase.
const MELODY = [
  [4, -1, -1, 3, -1, -1, 2, -1, /**/ 3, -1, -1, -1, 1, -1, -1, -1, /**/ 2, -1, -1, 1, -1, 0, -1, -1, /**/ 1, -1, -1, -1, -1, -1, -1, -1],
  [2, -1, 3, -1, 4, -1, -1, -1, /**/ 5, -1, -1, 4, -1, -1, 3, -1, /**/ 4, -1, -1, -1, 2, -1, -1, -1, /**/ 0, -1, -1, -1, -1, -1, -1, -1],
]

/** A soft music-box / bell note: sine + a quiet octave partial, long decay. */
function bell(f, at, out, vol = 0.11) {
  tone(f, { dur: 1.9, type: 'sine', vol, at, out, attack: 0.012 })
  tone(f * 2, { dur: 0.7, type: 'sine', vol: vol * 0.22, at, out, attack: 0.006 })
}

function startMusic() {
  if (musicTimer) return
  let next = ctx.currentTime + 0.3
  let step = 0
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2600
  lp.connect(musicBus)
  const out = lp
  const schedule = () => {
    while (next < ctx.currentTime + 0.5) {
      const bar = Math.floor(step / 8) % 4
      const eighth = step % 8
      const ch = PROG[bar]
      const at = next - ctx.currentTime
      if (eighth === 0) {
        // Warm pad swelling over the whole bar + a long soft bass note.
        ch.pad.forEach((f) => {
          tone(f, { dur: BEAT * 4.3, type: 'sine', vol: 0.09, at, out, attack: BEAT * 1.4 })
          tone(f * 1.003, { dur: BEAT * 4.3, type: 'triangle', vol: 0.025, at, out, attack: BEAT * 1.6 })
        })
        tone(ch.bass, { dur: BEAT * 3.6, type: 'sine', vol: 0.32, at, out, attack: 0.08 })
      }
      if (eighth === 5) tone(ch.bass * 1.5, { dur: BEAT * 1.4, type: 'sine', vol: 0.12, at, out, attack: 0.06 })
      // Slow rolling arpeggio, very quiet, on the off-beats.
      if (eighth % 2 === 1) tone(ch.arp[(eighth >> 1) % 4], { dur: BEAT * 1.2, type: 'triangle', vol: 0.028, at, out, attack: 0.02 })
      // Music-box melody (phrases alternate; every third pass rests to breathe).
      const pass = Math.floor(step / 32)
      if (pass % 3 !== 2) {
        const n = MELODY[pass % 2][step % 32]
        if (n >= 0) bell(PENTA[n], at, out)
      }
      // A distant bird now and then.
      if (eighth === 3 && Math.random() < 0.12) {
        const f = 2600 + Math.random() * 900
        for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k += 1) tone(f, { dur: 0.07, type: 'sine', vol: 0.03, slide: 700, at: at + k * 0.11, out })
      }
      next += BEAT / 2
      step += 1
    }
  }
  musicTimer = setInterval(schedule, 120)
  schedule()
}
