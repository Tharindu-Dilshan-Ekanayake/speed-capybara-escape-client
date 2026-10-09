import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three'

/**
 * Procedural canvas textures - nothing is downloaded. Built lazily, cached forever.
 */

export const FONT_TITLE = '"Lilita One", "Fredoka", "Arial Black", sans-serif'
export const FONT_UI = '"Fredoka", "Arial Rounded MT Bold", sans-serif'
export const FONT_STAGE = '"Montserrat", "Arial Black", sans-serif'

const cache = new Map()
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}

function canvas(w, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function finish(c, { repeat = true, srgb = true } = {}) {
  const t = new CanvasTexture(c)
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping
  if (srgb) t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  t.minFilter = LinearMipmapLinearFilter
  return t
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** Classic Roblox studs: an embossed square per tile, light top-left / dark bottom-right. */
export const studTexture = () =>
  cached('stud', () => {
    const s = 512
    const [c, g] = canvas(s)
    g.fillStyle = '#e6e6e6'
    g.fillRect(0, 0, s, s)
    const k = s / 128
    g.scale(k, k)
    // Faint grain.
    for (let i = 0; i < 900; i += 1) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.05)'
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2)
    }
    g.fillStyle = 'rgba(0,0,0,0.13)'
    g.fillRect(0, 126, 128, 2)
    g.fillRect(126, 0, 2, 128)
    g.fillStyle = 'rgba(255,255,255,0.35)'
    g.fillRect(0, 0, 128, 2)
    g.fillRect(0, 0, 2, 128)
    g.lineWidth = 7
    g.strokeStyle = 'rgba(0,0,0,0.2)'
    roundRect(g, 36, 38, 58, 58, 10)
    g.stroke()
    g.lineWidth = 5
    g.strokeStyle = 'rgba(255,255,255,0.55)'
    roundRect(g, 33, 34, 58, 58, 10)
    g.stroke()
    return finish(c)
  })

/** Light stone bricks with mortar. */
export const brickTexture = () =>
  cached('brick', () => {
    const s = 512
    const [c, g] = canvas(s)
    g.fillStyle = '#b9bcc9'
    g.fillRect(0, 0, s, s)
    const rows = 8
    const bh = s / rows
    for (let r = 0; r < rows; r += 1) {
      const off = r % 2 ? s / 8 : 0
      for (let x = -s / 4; x < s; x += s / 4) {
        const v = 225 + Math.floor(Math.random() * 25)
        g.fillStyle = `rgb(${v},${v},${v + 6})`
        roundRect(g, x + off + 4, r * bh + 4, s / 4 - 8, bh - 8, 6)
        g.fill()
        g.fillStyle = 'rgba(255,255,255,0.35)'
        g.fillRect(x + off + 8, r * bh + 6, s / 4 - 16, 4)
      }
    }
    return finish(c)
  })

/** Conveyor belt: dark rubber with yellow chevrons pointing along +v. */
export const beltTexture = () =>
  cached('belt', () => {
    const s = 256
    const [c, g] = canvas(s)
    g.fillStyle = '#2b2f3a'
    g.fillRect(0, 0, s, s)
    g.fillStyle = '#ffd01a'
    for (const y0 of [0, s / 2]) {
      g.beginPath()
      g.moveTo(s * 0.18, y0 + s * 0.38)
      g.lineTo(s * 0.5, y0 + s * 0.12)
      g.lineTo(s * 0.82, y0 + s * 0.38)
      g.lineTo(s * 0.82, y0 + s * 0.5)
      g.lineTo(s * 0.5, y0 + s * 0.24)
      g.lineTo(s * 0.18, y0 + s * 0.5)
      g.closePath()
      g.fill()
    }
    g.fillStyle = 'rgba(255,255,255,0.06)'
    for (let y = 0; y < s; y += 16) g.fillRect(0, y, s, 2)
    return finish(c)
  })

/** Soft rippled water / lava surface. `hot` paints lava blobs. */
export const liquidTexture = (kind) =>
  cached(`liquid-${kind}`, () => {
    const s = 512
    const [c, g] = canvas(s)
    const base = { water: '#2fe2ff', lava: '#ff4a0a', toxic: '#7dff1a' }[kind] || '#2fe2ff'
    g.fillStyle = base
    g.fillRect(0, 0, s, s)
    for (let i = 0; i < 70; i += 1) {
      const x = Math.random() * s
      const y = Math.random() * s
      const r = 10 + Math.random() * 46
      const grd = g.createRadialGradient(x, y, 0, x, y, r)
      const col = kind === 'lava' ? (Math.random() < 0.5 ? 'rgba(255,220,60,0.55)' : 'rgba(140,10,0,0.45)') : 'rgba(255,255,255,0.28)'
      grd.addColorStop(0, col)
      grd.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grd
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) g.fillRect(x - r + ox, y - r + oy, r * 2, r * 2)
    }
    // Stud grid like Roblox terrain parts.
    g.strokeStyle = 'rgba(255,255,255,0.12)'
    g.lineWidth = 3
    for (let x = 0; x < s; x += 64) for (let y = 0; y < s; y += 64) {
      roundRect(g, x + 16, y + 16, 32, 32, 6)
      g.stroke()
    }
    return finish(c)
  })

/** Soft cloud sea seen from above. */
export const cloudSeaTexture = () =>
  cached('cloudsea', () => {
    const s = 512
    const [c, g] = canvas(s)
    g.clearRect(0, 0, s, s)
    for (let i = 0; i < 110; i += 1) {
      const x = Math.random() * s
      const y = Math.random() * s
      const r = 30 + Math.random() * 70
      const grd = g.createRadialGradient(x, y, 0, x, y, r)
      grd.addColorStop(0, 'rgba(255,255,255,0.9)')
      grd.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grd
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) g.fillRect(x - r + ox, y - r + oy, r * 2, r * 2)
    }
    return finish(c)
  })

/** Radial soft dot used for glows / particles. */
export const dotTexture = () =>
  cached('dot', () => {
    const s = 128
    const [c, g] = canvas(s)
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    grd.addColorStop(0, 'rgba(255,255,255,1)')
    grd.addColorStop(0.35, 'rgba(255,255,255,0.6)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, s, s)
    return finish(c, { repeat: false })
  })

/** Particle sprite shapes. */
export const shapeTexture = (shape) =>
  cached(`shape-${shape}`, () => {
    const s = 128
    const [c, g] = canvas(s)
    g.fillStyle = '#ffffff'
    g.translate(s / 2, s / 2)
    if (shape === 'heart') {
      g.beginPath()
      g.moveTo(0, 38)
      g.bezierCurveTo(-60, -4, -30, -52, 0, -18)
      g.bezierCurveTo(30, -52, 60, -4, 0, 38)
      g.fill()
    } else if (shape === 'star') {
      g.beginPath()
      for (let i = 0; i < 10; i += 1) {
        const r = i % 2 ? 22 : 54
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      g.closePath()
      g.fill()
    } else if (shape === 'snow') {
      g.strokeStyle = '#ffffff'
      g.lineWidth = 9
      g.lineCap = 'round'
      for (let i = 0; i < 6; i += 1) {
        g.rotate(Math.PI / 3)
        g.beginPath()
        g.moveTo(0, 0)
        g.lineTo(0, 48)
        g.moveTo(0, 30)
        g.lineTo(14, 42)
        g.moveTo(0, 30)
        g.lineTo(-14, 42)
        g.stroke()
      }
    } else if (shape === 'bolt') {
      g.beginPath()
      g.moveTo(10, -56)
      g.lineTo(-26, 6)
      g.lineTo(0, 6)
      g.lineTo(-12, 56)
      g.lineTo(28, -10)
      g.lineTo(2, -10)
      g.closePath()
      g.fill()
    } else if (shape === 'ring') {
      g.strokeStyle = '#fff'
      g.lineWidth = 12
      g.beginPath()
      g.arc(0, 0, 44, 0, Math.PI * 2)
      g.stroke()
    } else if (shape === 'sneaker') {
      // Chunky running shoe: red upper with a highlight, white sole, laces, side stripe, toe cap.
      const grd = g.createLinearGradient(0, -50, 0, 30)
      grd.addColorStop(0, '#ff6a78')
      grd.addColorStop(1, '#e0182c')
      g.lineJoin = 'round'
      g.strokeStyle = '#2a0710'
      g.lineWidth = 7
      g.beginPath()
      g.moveTo(-56, 22)
      g.lineTo(-56, -6)
      g.quadraticCurveTo(-56, -44, -22, -44)
      g.lineTo(-8, -44)
      g.quadraticCurveTo(-2, -16, 22, -8)
      g.quadraticCurveTo(56, -2, 58, 22)
      g.closePath()
      g.fillStyle = grd
      g.fill()
      g.stroke()
      g.fillStyle = '#ffffff'
      roundRect(g, -60, 18, 122, 20, 9)
      g.fill()
      g.stroke()
      g.fillStyle = '#ffd84a'
      g.beginPath()
      g.moveTo(-36, 4)
      g.quadraticCurveTo(-4, -2, 36, 14)
      g.lineTo(32, 4)
      g.quadraticCurveTo(-4, -12, -36, -6)
      g.closePath()
      g.fill()
      g.fillStyle = 'rgba(255,255,255,0.55)'
      roundRect(g, -46, -34, 22, 8, 4)
      g.fill()
      g.strokeStyle = '#ffffff'
      g.lineWidth = 6
      g.lineCap = 'round'
      for (let k = 0; k < 3; k += 1) {
        g.beginPath()
        g.moveTo(-22 + k * 9, -36 + k * 3)
        g.lineTo(-10 + k * 9, -26 + k * 3)
        g.stroke()
      }
    } else {
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, 60)
      grd.addColorStop(0, 'rgba(255,255,255,1)')
      grd.addColorStop(0.3, 'rgba(255,255,255,0.8)')
      grd.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grd
      g.fillRect(-64, -64, 128, 128)
    }
    return finish(c, { repeat: false })
  })

/**
 * Text drawn onto a canvas. Returns { texture, aspect }.
 * style: 'stage' (white + blue glow italic), 'label' (white + dark stroke),
 *        'red' (red italic like "3 Wins Required"), 'green', 'gold', 'tag' (name tag).
 */
export function textTexture(text, style = 'label', px = 96) {
  return cached(`txt|${style}|${px}|${text}`, () => {
    const font = {
      stage: `italic 900 ${px}px ${FONT_STAGE}`,
      stageSub: `italic 800 ${px}px ${FONT_STAGE}`,
      red: `italic 400 ${px}px ${FONT_TITLE}`,
      green: `italic 400 ${px}px ${FONT_TITLE}`,
      gold: `400 ${px}px ${FONT_TITLE}`,
      label: `400 ${px}px ${FONT_TITLE}`,
      warn: `400 ${px}px ${FONT_TITLE}`,
      tag: `700 ${px}px ${FONT_UI}`,
      board: `700 ${px}px ${FONT_UI}`,
    }[style] || `400 ${px}px ${FONT_TITLE}`
    const [m, mg] = canvas(4, 4)
    mg.font = font
    const tw = Math.ceil(mg.measureText(text).width)
    m.remove?.()
    const pad = Math.ceil(px * 0.45)
    const w = Math.min(4096, tw + pad * 2)
    const h = Math.ceil(px * 1.5)
    const [c, g] = canvas(w, h)
    g.font = font
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const cx = w / 2
    const cy = h / 2 + px * 0.04
    g.lineJoin = 'round'
    if (style === 'stage' || style === 'stageSub') {
      g.shadowColor = '#1e7bff'
      g.shadowBlur = px * 0.35
      g.strokeStyle = '#1a6bff'
      g.lineWidth = px * 0.16
      g.strokeText(text, cx, cy)
      g.shadowBlur = 0
      g.fillStyle = '#f4f8ff'
      g.fillText(text, cx, cy)
    } else {
      const fill = { red: '#ff2a2a', green: '#36ff4a', gold: '#ffd84a', warn: '#ffe14a', tag: '#ffffff', board: '#ffffff' }[style] || '#ffffff'
      const stroke = { red: '#4a0000', green: '#003a08', gold: '#4a2a00', warn: '#5a1a00' }[style] || '#101320'
      g.strokeStyle = stroke
      g.lineWidth = px * (style === 'tag' ? 0.2 : 0.18)
      g.strokeText(text, cx, cy)
      if (style === 'gold') {
        const grd = g.createLinearGradient(0, cy - px / 2, 0, cy + px / 2)
        grd.addColorStop(0, '#fff6b0')
        grd.addColorStop(0.5, '#ffd23a')
        grd.addColorStop(1, '#ff9a1a')
        g.fillStyle = grd
      } else g.fillStyle = fill
      g.fillText(text, cx, cy)
    }
    const texture = finish(c, { repeat: false })
    return { texture, aspect: w / h }
  })
}
