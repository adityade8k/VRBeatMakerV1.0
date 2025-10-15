import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { useRef } from 'react'

/**
 * XRPadTransformControls
 * - While buttons are held, applies continuous deltas to targetRef.current
 * - Mappings are lenient across Touch-like controllers (A/B/X/Y ≈ buttons[3|4])
 *
 * Right controller:
 *   A  → +X,  B  → -X
 *   Trigger → +Z,  Grip → +RotX (radians)
 *   Thumbstick click → Scale up
 *
 * Left controller:
 *   X  → +Y,  Y  → -Y
 *   Trigger → -Z,  Grip → -RotX
 *   Thumbstick click → Scale down
 */
export default function XRPadTransformControls({
  targetRef,                 // THREE.Group ref (ConsolePad)
  movePerSec = 0.25,         // meters / second
  rotPerSec  = Math.PI / 6,  // radians / second (≈30°/s)
  scalePerSec = 0.5,         // units / second (uniform)
  minScale = 0.25,
  maxScale = 2.5,
}) {
  const { controllers } = useXR()
  const scaleCache = useRef(1)

  // utility: tolerant button check across devices
  const pressed = (gp, ids) => {
    if (!gp?.buttons) return false
    for (const id of ids) {
      const b = gp.buttons[id]
      if (b && (b.pressed || b.value > 0.5)) return true
    }
    return false
  }

  // typical indices seen on Touch-like pads
  const idx = {
    trigger: [0],           // select
    grip:    [1],           // squeeze
    stick:   [2],           // thumbstick click
    primary: [3],           // A/X
    secondary: [4],         // B/Y
  }

  useFrame((_, dt) => {
    const t = targetRef?.current
    if (!t) return

    // cache current scale (assumes uniform)
    const curScale = t.scale.x
    scaleCache.current = curScale

    // find left/right controllers (by handedness)
    const left  = controllers.find(c => c.inputSource?.handedness === 'left')
    const right = controllers.find(c => c.inputSource?.handedness === 'right')
    const gl = (left  && left.inputSource?.gamepad)  || null
    const gr = (right && right.inputSource?.gamepad) || null

    // ---- POSITION X (right A/B)
    if (pressed(gr, idx.primary))  t.position.x += movePerSec * dt   // A → +X
    if (pressed(gr, idx.secondary)) t.position.x -= movePerSec * dt  // B → -X

    // ---- POSITION Y (left X/Y)
    if (pressed(gl, idx.primary))   t.position.y += movePerSec * dt  // X → +Y
    if (pressed(gl, idx.secondary)) t.position.y -= movePerSec * dt  // Y → -Y

    // ---- POSITION Z (triggers)
    if (pressed(gr, idx.trigger))   t.position.z += movePerSec * dt  // right trigger → +Z (toward you)
    if (pressed(gl, idx.trigger))   t.position.z -= movePerSec * dt  // left  trigger → -Z

    // ---- ROTATION X (grips)
    if (pressed(gr, idx.grip)) t.rotation.x += rotPerSec * dt        // right grip → +rotX
    if (pressed(gl, idx.grip)) t.rotation.x -= rotPerSec * dt        // left  grip → -rotX

    // ---- SCALE (thumbstick clicks)
    let nextScale = curScale
    if (pressed(gr, idx.stick)) nextScale += scalePerSec * dt        // right stick click → scale up
    if (pressed(gl, idx.stick)) nextScale -= scalePerSec * dt        // left  stick click → scale down
    nextScale = Math.min(maxScale, Math.max(minScale, nextScale))
    if (nextScale !== curScale) t.scale.setScalar(nextScale)
  })

  return null
}
