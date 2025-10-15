import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useRef } from 'react'

export default function XRPadTransformControls({
  targetRef,
  movePerSec = 0.25,
  rotPerSec  = Math.PI / 6,
  scalePerSec = 0.5,
  minScale = 0.25,
  maxScale = 2.5,
}) {
  const xr = useXR()
  const scaleCache = useRef(1)

  const pressed = (gp, ids) => {
    if (!gp || !gp.buttons) return false
    for (const id of ids) {
      const b = gp.buttons[id]
      if (b && (b.pressed || b.value > 0.5)) return true
    }
    return false
  }

  const idx = {
    trigger: [0],
    grip:    [1],
    stick:   [2],
    primary: [3],
    secondary: [4],
  }

  useFrame((_, dt) => {
    const t = targetRef?.current
    if (!t) return

    // No controllers yet? bail quietly.
    const ctrls = Array.isArray(xr?.controllers) ? xr.controllers : []
    if (ctrls.length === 0) return

    // Find left/right safely
    const left =
      ctrls.find(c => c?.inputSource?.handedness === 'left') ?? null
    const right =
      ctrls.find(c => c?.inputSource?.handedness === 'right') ?? null

    const gl = left?.inputSource?.gamepad ?? null
    const gr = right?.inputSource?.gamepad ?? null

    // If neither has a gamepad, nothing to do.
    if (!gl && !gr) return

    const curScale = t.scale.x
    scaleCache.current = curScale

    // ---- POSITION X (right A/B)
    if (pressed(gr, idx.primary))   t.position.x += movePerSec * dt
    if (pressed(gr, idx.secondary)) t.position.x -= movePerSec * dt

    // ---- POSITION Y (left X/Y)
    if (pressed(gl, idx.primary))   t.position.y += movePerSec * dt
    if (pressed(gl, idx.secondary)) t.position.y -= movePerSec * dt

    // ---- POSITION Z (triggers)
    if (pressed(gr, idx.trigger))   t.position.z += movePerSec * dt
    if (pressed(gl, idx.trigger))   t.position.z -= movePerSec * dt

    // ---- ROTATION X (grips)
    if (pressed(gr, idx.grip)) t.rotation.x += rotPerSec * dt
    if (pressed(gl, idx.grip)) t.rotation.x -= rotPerSec * dt

    // ---- SCALE (thumbstick clicks)
    let nextScale = curScale
    if (pressed(gr, idx.stick)) nextScale += scalePerSec * dt
    if (pressed(gl, idx.stick)) nextScale -= scalePerSec * dt
    nextScale = Math.min(maxScale, Math.max(minScale, nextScale))
    if (nextScale !== curScale) t.scale.setScalar(nextScale)
  })

  return null
}
