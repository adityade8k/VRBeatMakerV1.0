import * as THREE from 'three'

export const DEFAULT_CHARSET =
  " !\"#$%&'()*+,-./0123456789:;<=>?@" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`" +
  "abcdefghijklmnopqrstuvwxyz{|}~"

export function makeMonospaceAtlas({
  fontFamily = 'Roboto Mono, Menlo, monospace',
  fontSizePx = 64,
  padding = 8,
  charset = DEFAULT_CHARSET,
  gridCols = 16,
  gridRows = 6,
  background = 'rgba(0,0,0,0)',
  glyphColor = 'rgba(255,255,255,1)',
} = {}) {
  if (charset.length > gridCols * gridRows) {
    throw new Error(`Atlas grid too small for charset (${charset.length} > ${gridCols * gridRows})`)
  }

  const cellW = fontSizePx + padding * 2
  const cellH = fontSizePx + padding * 2
  const w = gridCols * cellW
  const h = gridRows * cellH

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = glyphColor
  ctx.font = `700 ${fontSizePx}px ${fontFamily}`

  const map = new Map()
  for (let i = 0; i < charset.length; i++) {
    const ch = charset[i]
    const col = i % gridCols
    const row = Math.floor(i / gridCols)
    const cx = col * cellW + cellW / 2
    const cy = row * cellH + cellH / 2
    ctx.fillText(ch, cx, cy + 1)
    map.set(ch, { col, row })
  }

  const texture = new THREE.CanvasTexture(canvas)
  // IMPORTANT: prevent vertical flip (otherwise text appears upside-down)
  texture.flipY = false
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true

  // UV helper returns top-left (u0,v0) and bottom-right (u1,v1)
  const getCellUV = (ch) => {
    const hit = map.get(ch) || map.get(' ') || map.get('?')
    const u0 = (hit.col * cellW) / w
    const v0 = (hit.row * cellH) / h
    const u1 = ((hit.col + 1) * cellW) / w
    const v1 = ((hit.row + 1) * cellH) / h
    return { u0, v0, u1, v1 }
  }

  return { texture, cellW, cellH, gridCols, gridRows, canvasW: w, canvasH: h, map, charset, getCellUV }
}
