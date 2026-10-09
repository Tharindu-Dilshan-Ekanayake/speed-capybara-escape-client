import { CanvasTexture, LinearFilter } from 'three'
import { CAPYS } from '../../shared/gameData.js'
import { FOOTPRINT_MOTIFS } from '../footprints.js'

export const ATLAS_COLUMNS = 5
export const ATLAS_ROWS = Math.ceil(CAPYS.length / ATLAS_COLUMNS)

function polygon(ctx, points) {
  ctx.beginPath()
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  ctx.closePath()
  ctx.fill()
}

function star(ctx, points = 5, r = 1, inner = 0.45) {
  polygon(ctx, Array.from({ length: points * 2 }, (_, i) => {
    const a = i * Math.PI / points - Math.PI / 2
    const radius = i % 2 ? r * inner : r
    return [Math.cos(a) * radius, Math.sin(a) * radius]
  }))
}

function line(ctx, points) {
  ctx.beginPath()
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  ctx.stroke()
}

function circle(ctx, x, y, radius) {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

function motif(ctx, kind) {
  ctx.lineWidth = 0.13
  ctx.lineCap = ctx.lineJoin = 'round'
  switch (kind) {
    case 'feather':
      line(ctx, [[-0.6, 0.85], [0.5, -0.9]])
      for (let i = 0; i < 4; i++) { const y = -0.55 + i * 0.32; line(ctx, [[-0.48, y - 0.2], [0, y], [0.6, y - 0.3]]) }
      break
    case 'crescent':
      ctx.beginPath(); ctx.arc(0, 0, 0.88, 0.65, 5.6); ctx.quadraticCurveTo(-0.45, 0, 0.7, 0.55); ctx.fill()
      break
    case 'gem': polygon(ctx, [[0, -1], [0.85, 0], [0, 1], [-0.85, 0]]); break
    case 'bow':
      polygon(ctx, [[-0.9, -0.6], [0, 0], [-0.9, 0.6]])
      polygon(ctx, [[0.9, -0.6], [0, 0], [0.9, 0.6]]); circle(ctx, 0, 0, 0.2)
      break
    case 'spirit':
      ctx.beginPath(); ctx.moveTo(-0.75, 0.85); ctx.bezierCurveTo(-1, -1.4, 1, -1.4, 0.75, 0.85)
      ctx.lineTo(0.36, 0.58); ctx.lineTo(0, 0.95); ctx.lineTo(-0.35, 0.58); ctx.closePath(); ctx.fill()
      break
    case 'flame':
      ctx.beginPath(); ctx.moveTo(0, -1.1); ctx.bezierCurveTo(0.6, -0.2, -0.25, -0.1, 0.7, -0.55)
      ctx.bezierCurveTo(1.4, 1.3, -1.3, 1.35, -0.7, -0.3); ctx.quadraticCurveTo(-0.1, -0.2, 0, -1.1); ctx.fill()
      break
    case 'heart':
      ctx.beginPath(); ctx.moveTo(0, 1); ctx.bezierCurveTo(-2, -0.35, -0.65, -1.6, 0, -0.5)
      ctx.bezierCurveTo(0.65, -1.6, 2, -0.35, 0, 1); ctx.fill()
      break
    case 'snow':
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 3); line(ctx, [[0, -1], [0, 1]])
        for (const s of [-1, 1]) line(ctx, [[-0.28, s * 0.5], [0, s * 0.78], [0.28, s * 0.5]])
        ctx.restore()
      }
      break
    case 'wind':
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-0.9, -0.6 + i * 0.55); ctx.bezierCurveTo(0.7, -0.9 + i * 0.55, 1.4, -0.2 + i * 0.4, 0.45, i * 0.3); ctx.stroke() }
      break
    case 'bolt': polygon(ctx, [[0.2, -1.1], [-0.8, 0.15], [-0.05, 0.1], [-0.3, 1.1], [0.9, -0.15], [0.2, -0.1]]); break
    case 'clover':
      for (const [x, y] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) circle(ctx, x, y, 0.5)
      line(ctx, [[0, 0], [0.3, 1.1]]); break
    case 'comet':
      ctx.save(); ctx.translate(-0.35, -0.35); star(ctx, 5, 0.7); ctx.restore()
      line(ctx, [[0, 0.2], [0.9, 1]]); line(ctx, [[0.4, -0.1], [1, 0.6]]); break
    case 'prism':
      line(ctx, [[0, -1], [0.8, -0.25], [0.4, 1], [-0.4, 1], [-0.8, -0.25], [0, -1], [0.4, 1]])
      line(ctx, [[-0.8, -0.25], [0.8, -0.25]]); line(ctx, [[0, -1], [-0.4, 1]]); break
    case 'cracks':
      line(ctx, [[-0.8, -1], [-0.2, -0.3], [-0.5, 0.1], [0.2, 0.7], [0, 1]])
      line(ctx, [[0.9, -0.8], [0.4, -0.2], [-0.1, 0.2], [0.8, 0.85]]); break
    case 'wings':
      for (const s of [-1, 1]) {
        polygon(ctx, [[0, 0.8], [s * 0.2, -0.3], [s, -0.85], [s * 0.8, 0.05], [s * 0.35, 0.5]])
      }
      break
    case 'chevron': line(ctx, [[-0.8, 0.6], [0, -0.1], [0.8, 0.6]]); line(ctx, [[-0.8, -0.05], [0, -0.8], [0.8, -0.05]]); break
    case 'droplet':
      ctx.beginPath(); ctx.moveTo(0, -1); ctx.bezierCurveTo(-1.8, 0.8, -0.3, 1.3, 0, 1); ctx.bezierCurveTo(0.8, 1.3, 1.2, 0.3, 0, -1); ctx.fill(); break
    case 'crown': polygon(ctx, [[-0.8, 0.8], [-1, -0.6], [-0.4, -0.1], [0, -1], [0.4, -0.1], [1, -0.6], [0.8, 0.8]]); break
    case 'vortex':
      ctx.beginPath()
      for (let i = 0; i <= 50; i++) { const a = i * 0.22; const r = 0.08 + i * 0.017; const x = Math.cos(a) * r; const y = Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }
      ctx.stroke(); break
    case 'phoenix':
      line(ctx, [[-1, -0.85], [-0.45, 0.2], [0, 0.8], [0.45, 0.2], [1, -0.85]])
      line(ctx, [[-1, -0.2], [0, 0.8], [1, -0.2]]); polygon(ctx, [[0, -0.6], [-0.18, 0.2], [0.18, 0.2]]); break
    case 'sun':
      circle(ctx, 0, 0, 0.48)
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; line(ctx, [[Math.cos(a) * 0.65, Math.sin(a) * 0.65], [Math.cos(a), Math.sin(a)]]) }
      break
  }
}

/** RGB stores separate masks: capybara paw, skin emblem, and level-dependent sparkles. */
export function footprintTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_COLUMNS * 128
  canvas.height = ATLAS_ROWS * 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  CAPYS.forEach((capy, i) => {
    ctx.save(); ctx.translate((i % ATLAS_COLUMNS) * 128, Math.floor(i / ATLAS_COLUMNS) * 128)
    ctx.globalCompositeOperation = 'screen'
    // Capybara paw: a big rounded pad and three chunky toes.
    ctx.fillStyle = '#ff0000'
    ctx.beginPath(); ctx.ellipse(64, 80, 30, 25, 0, 0, Math.PI * 2); ctx.fill()
    for (const [x, y, rot] of [[34, 44, -0.35], [64, 32, 0], [94, 44, 0.35]]) {
      ctx.beginPath(); ctx.ellipse(x, y, 12, 16, rot, 0, Math.PI * 2); ctx.fill()
    }
    ctx.save(); ctx.translate(64, 80); ctx.scale(15, 15)
    ctx.fillStyle = ctx.strokeStyle = '#00ff00'; motif(ctx, FOOTPRINT_MOTIFS[capy.id]); ctx.restore()
    ctx.fillStyle = '#0000ff'
    for (const [x, y, size] of [[18, 25, 4], [105, 20, 3], [111, 99, 4], [33, 111, 3]]) {
      ctx.save(); ctx.translate(x, y); star(ctx, 4, size); ctx.restore()
    }
    ctx.restore()
  })
  const texture = new CanvasTexture(canvas)
  texture.minFilter = texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  return texture
}
