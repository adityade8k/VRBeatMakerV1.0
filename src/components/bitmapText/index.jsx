import { useMemo } from 'react'
import * as THREE from 'three'
import { useBitmapTextAtlas } from './BitmapTextProvider'

const matCache = new Map()
function getTintedMaterial(baseMat, color, opacity) {
  const key = `${color}|${opacity}`
  let mat = matCache.get(key)
  if (!mat) {
    mat = baseMat.clone()
    mat.color = new THREE.Color(color)
    mat.opacity = opacity
    mat.transparent = true
    mat.depthWrite = false
    mat.side = THREE.DoubleSide
    matCache.set(key, mat)
  }
  return mat
}

export default function BitmapText({
  text = '',
  position = [0, 0, 0],
  rotation = [Math.PI, 0, 0],
  scale = [0.1, 0.1, 0.1],
  color = '#0f172a',
  opacity = 1.0,

  align = 'left',
  anchorY = 'middle',
  letterSpacing = 0,
  lineHeight = 1.25,
  maxWidth = 0,
  quadWidth = 1.0,
  quadHeight = 1.0,
}) {
  const { atlas, material: sharedMaterial, defaultAdvance } = useBitmapTextAtlas()

  const tokens = useMemo(() => {
    const advance = defaultAdvance + letterSpacing
    const charsPerLine = maxWidth > 0 ? Math.max(1, Math.floor(maxWidth / advance)) : Infinity
    const words = String(text).split(/(\s+)/)
    const lines = []
    let current = ''
    for (const w of words) {
      if (charsPerLine !== Infinity && (current + w).length > charsPerLine && current.length > 0) {
        lines.push(current)
        current = w.trimStart()
      } else {
        current += w
      }
    }
    if (current.length) lines.push(current)
    return { lines, advance }
  }, [text, maxWidth, defaultAdvance, letterSpacing])

  const geometry = useMemo(() => {
    const { lines, advance } = tokens
    let quadCount = 0
    for (const ln of lines) quadCount += ln.length

    const positions = new Float32Array(quadCount * 4 * 3)
    const uvs = new Float32Array(quadCount * 4 * 2)
    const indices = new Uint32Array(quadCount * 6)

    const qW = quadWidth
    const qH = quadHeight
    const atlasGet = atlas.getCellUV

    // NOTE: With texture.flipY=false, v increases downward.
    // UVs here are: top-left, top-right, bottom-right, bottom-left.
    const addQuad = (qi, x, y, ch) => {
      const baseV = qi * 4
      const baseI = qi * 6

      positions.set([
        x,     y,     0,
        x+qW,  y,     0,
        x+qW,  y+qH,  0,
        x,     y+qH,  0
      ], baseV * 3)

      const { u0, v0, u1, v1 } = atlasGet(ch)
      uvs.set([
        u0, v0,   // TL
        u1, v0,   // TR
        u1, v1,   // BR
        u0, v1    // BL
      ], baseV * 2)

      indices.set([
        baseV + 0, baseV + 1, baseV + 2,
        baseV + 0, baseV + 2, baseV + 3
      ], baseI)
    }

    const totalH = lines.length * qH * lineHeight
    let yStart = 0
    if (anchorY === 'top') yStart = 0
    else if (anchorY === 'middle') yStart = -totalH * 0.5
    else if (anchorY === 'bottom') yStart = -totalH

    let qi = 0
    lines.forEach((ln, iLine) => {
      const lineW = ln.length * advance
      let x0 = 0
      if (align === 'left') x0 = 0
      else if (align === 'center') x0 = -lineW / 2
      else if (align === 'right') x0 = -lineW

      const y = yStart + iLine * qH * lineHeight
      for (let i = 0; i < ln.length; i++) {
        const ch = ln[i] || ' '
        const x = x0 + i * advance
        addQuad(qi++, x, y, ch)
      }
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    geo.setIndex(new THREE.BufferAttribute(indices, 1))
    geo.computeBoundingBox()
    geo.computeBoundingSphere()
    return geo
  }, [tokens, atlas, quadWidth, quadHeight, lineHeight, align, anchorY])

  const mat = useMemo(() => getTintedMaterial(sharedMaterial, "ffffff", opacity), [sharedMaterial, color, opacity])

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={geometry} material={mat} />
    </group>
  )
}
