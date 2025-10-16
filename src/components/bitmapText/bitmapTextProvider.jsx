import { createContext, useContext, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { makeMonospaceAtlas, DEFAULT_CHARSET } from './bitmapFontAtlas' // ?

const BitmapTextCtx = createContext(null)

export function useBitmapTextAtlas() {
  const ctx = useContext(BitmapTextCtx)
  if (!ctx) throw new Error('useBitmapTextAtlas must be used within <BitmapTextProvider>')
  return ctx
}

/**
 * Provides a single shared atlas + material for all BitmapText in the scene.
 * Memory-lean: one texture, one material. Disposed on unmount.
 */
export default function BitmapTextProvider({
  children,
  // Atlas options
  fontFamily = 'Roboto Mono, Menlo, monospace',
  fontSizePx = 64,
  padding = 8,
  charset = DEFAULT_CHARSET,
  gridCols = 16,
  gridRows = 6,
  // Material options
  transparent = true,
  useMipmaps = false,  // turn on only if you scale text down a lot
  toneMapped = false,  // UI text usually not tone mapped
}) {
  const atlas = useMemo(() => {
    const a = makeMonospaceAtlas({ fontFamily, fontSizePx, padding, charset, gridCols, gridRows })
    if (useMipmaps) {
      a.texture.generateMipmaps = true
      a.texture.minFilter = THREE.LinearMipmapLinearFilter
      a.texture.magFilter = THREE.LinearFilter
      a.texture.needsUpdate = true
    }
    return a
  }, [fontFamily, fontSizePx, padding, charset, gridCols, gridRows, useMipmaps])

  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      map: atlas.texture,
      transparent,
      color: 0xffffff,   // tint per-label with .color later (we reuse one material instance!)
      depthWrite: false, // UI-like; prevent z-fighting artifacts
      toneMapped,
    })
    return mat
  }, [atlas.texture, transparent, toneMapped])

  useEffect(() => {
    return () => {
      material.dispose?.()
      atlas.texture.dispose?.()
    }
  }, [material, atlas.texture])

  const ctxValue = useMemo(() => ({
    atlas,
    material,
    // Recommended advance in world units per glyph (1.0 is the quad width we’ll generate)
    // You can scale the object for overall size; this keeps char spacing sane.
    defaultAdvance: 1.0,
    defaultLineHeight: 1.25,
  }), [atlas, material])

  return (
    <BitmapTextCtx.Provider value={ctxValue}>
      {children}
    </BitmapTextCtx.Provider>
  )
}
