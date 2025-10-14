// dial/Dial.jsx
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Dial: base plate (plane) + flat disk (cylinder) that rotates around +Y.
 * - Faces parallel to base; axis is +Y (default Cylinder orientation).
 * - Drag to rotate; clamp to [minAngle, maxAngle].
 * - sensitivity: scales how much rotation per pointer movement.
 * - friction: inertial decay factor (0..1) applied every frame when spinning.
 * - Emits normalized value via onValueChange in [minValue, maxValue].
 */
export default function Dial({
  // Outer transform
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale    = [1, 1, 1],

  // Base plate
  size = [0.1, 0.1],          // width, height
  baseColor = '#6987f5',

  // Dial (disk)
  dialThickness = 0.02,       // along Y
  dialSegments  = 16,
  dialColor     = '#f08c00',

  // Range + output
  minAngle = -Math.PI * 0.75, // -135°
  maxAngle =  Math.PI * 0.75, // +135°
  initialAngle = 0,
  minValue = -1,
  maxValue =  1,
  onValueChange = () => {},

  // New: control feel
  sensitivity = 1.0,          // pointer-to-angle multiplier
  friction    = 0.1,         // 0..1 (higher = spins longer)
}) {
  const groupRef = useRef()
  const baseRef  = useRef()
  const dialRef  = useRef()

  // Geometries
  const baseGeo = useMemo(
    () => new THREE.PlaneGeometry(size[0], size[1]),
    [size]
  )
  const dialRadius = useMemo(
    () => Math.min(size[0], size[1]) * 0.45,
    [size]
  )
  const dialGeo = useMemo(
    () => new THREE.CylinderGeometry(dialRadius, dialRadius, dialThickness, dialSegments),
    [dialRadius, dialThickness, dialSegments]
  )

  // Drag/inertia state
  const dragging = useRef(false)
  const lastPointerAngle = useRef(0)   // last atan2(x, z) while dragging
  const spinVel = useRef(0)            // angular velocity (radians/frame)
  const lastEmitted = useRef(NaN)      // to avoid spammy onValueChange
  const tmp = useMemo(() => new THREE.Vector3(), [])

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
  const getAngle = () => (dialRef.current?.rotation.y ?? 0)
  const setAngle = (a) => { if (dialRef.current) dialRef.current.rotation.y = a }

  const getPointerAngleLocal = (worldPoint) => {
    // Convert world -> local (dial group space)
    tmp.copy(worldPoint)
    groupRef.current?.worldToLocal(tmp)
    // Angle around Y: atan2(x, z) keeps 0 at +Z, increasing CCW
    return Math.atan2(tmp.x, tmp.z)
  }

  const emitValueFromAngle = (a) => {
    const t = (a - minAngle) / (maxAngle - minAngle) // 0..1
    const v = minValue + t * (maxValue - minValue)
    if (v !== lastEmitted.current) {
      lastEmitted.current = v
      onValueChange(v)
    }
  }

  const onDown = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    dragging.current = true
    lastPointerAngle.current = getPointerAngleLocal(e.point)
    // On grab, lightly damp velocity so it feels stable
    spinVel.current *= 0.5
  }

  const onUp = (e) => {
    e.stopPropagation()
    e.target.releasePointerCapture?.(e.pointerId)
    dragging.current = false
  }

  const onMove = (e) => {
    if (!dragging.current) return
    e.stopPropagation()

    const currentPointer = getPointerAngleLocal(e.point)
    // Smallest signed angular delta between angles
    let dA = currentPointer - lastPointerAngle.current
    // Wrap to [-PI, PI] to avoid jumps across branch cut
    dA = Math.atan2(Math.sin(dA), Math.cos(dA))

    lastPointerAngle.current = currentPointer

    // Apply sensitivity; add to velocity for inertial feel
    spinVel.current += dA * sensitivity
  }

  // Per-frame: integrate velocity, clamp, apply friction, emit value
  useFrame(() => {
    if (!dialRef.current) return

    let a = getAngle()

    // Integrate velocity
    a += spinVel.current

    // Clamp to limits; if we hit a boundary, reflect or zero velocity
    if (a < minAngle) {
      a = minAngle
      // If still pushing outwards, kill outward component
      if (spinVel.current < 0) spinVel.current = 0
    } else if (a > maxAngle) {
      a = maxAngle
      if (spinVel.current > 0) spinVel.current = 0
    }

    setAngle(a)
    emitValueFromAngle(a)

    // Friction decay
    spinVel.current *= friction
    if (Math.abs(spinVel.current) < 1e-5) spinVel.current = 0
  })

  useEffect(() => {
    const a = clamp(initialAngle, minAngle, maxAngle)
    setAngle(a)
    emitValueFromAngle(a)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAngle, minAngle, maxAngle, minValue, maxValue])

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <Suspense fallback={null}>
        {/* Base: face up (+Y) */}
        <mesh ref={baseRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <primitive object={baseGeo} attach="geometry" />
          <meshStandardMaterial color={baseColor} metalness={0.1} roughness={0.8} />
        </mesh>

        {/* Flat dial: cylinder axis along +Y → faces parallel to base */}
        <mesh
          ref={dialRef}
          position={[0, dialThickness * 0.5 + 0.001, 0]} // float slightly to avoid z-fighting
          castShadow
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerOut={onUp}
          onPointerMove={onMove}
        >
          <primitive object={dialGeo} attach="geometry" />
          <meshStandardMaterial color={dialColor} metalness={0.35} roughness={0.45} />
        </mesh>
      </Suspense>
    </group>
  )
}
