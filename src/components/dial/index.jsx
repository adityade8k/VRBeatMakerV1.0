// components/dial.jsx
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * Step Dial
 * - Emits exactly ONE step per pointer/ray "contact".
 * - After a step fires, it ignores further motion until pointer leaves / is released.
 *
 * Props:
 *   position, rotation, scale, size, baseColor, dialColor
 *   range: [min, max]      // value domain
 *   step: number           // value increment
 *   stepAngle: number      // radians required to commit one step (default ~10°)
 *   value: number          // controlled value in domain units (min..max)
 *   onChange(nextValue)    // fires only when a step is committed
 *
 * Behavior:
 *   - Visual rotation snaps by ±stepAngle per committed step.
 *   - When at range limits, further steps in that direction are clamped/suppressed.
 */
export default function Dial({
  // Transform
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale    = [1, 1, 1],

  // Visuals
  size = [0.1, 0.1],
  baseColor = '#324966',
  dialColor = '#f08c00',
  dialThickness = 0.02,
  dialSegments  = 12,

  // Value space
  range = [0, 1],
  step = 0.05,
  stepAngle = Math.PI / 6, // ~10°

  // Controlled value (domain units)
  value = 0,

  onChange = () => {},
}) {
  const groupRef = useRef()
  const baseGeo  = useMemo(() => new THREE.PlaneGeometry(size[0], size[1]), [size])
  const radius   = useMemo(() => Math.min(size[0], size[1]) * 0.45, [size])
  const dialGeo  = useMemo(() => new THREE.CylinderGeometry(radius, radius, dialThickness, dialSegments), [radius, dialThickness, dialSegments])
  const dialRef  = useRef()

  // interaction refs
  const isActive    = useRef(false)       // pointer is down / ray is captured
  const locked      = useRef(false)       // one step already fired for this contact
  const startAngle  = useRef(0)           // angle when contact begins (for visual snap baseline)
  const lastPointer = useRef(0)           // last pointer polar angle (local)
  const accum       = useRef(0)           // accumulated delta angle since contact begin

  const [min, max] = range
  const clamp = (x) => Math.min(max, Math.max(min, x))

  // Keep dial's visual rotation in sync with the controlled value (discrete snapping).
  // We rotate by (value - min)/step * stepAngle, around Y.
  const setVisualFromValue = (v) => {
    if (!dialRef.current) return
    const stepsFromMin = Math.round((v - min) / step)
    dialRef.current.rotation.y = stepsFromMin * stepAngle
  }

  // Sync visuals whenever value changes
  setVisualFromValue(value)

  // Helpers
  const localAngleFromWorldPoint = (worldPoint) => {
    const tmp = new THREE.Vector3().copy(worldPoint)
    groupRef.current?.worldToLocal(tmp)
    // atan2(x, z): match your previous dial math
    return Math.atan2(tmp.x, tmp.z)
  }

  const onDown = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    isActive.current = true
    locked.current = false
    lastPointer.current = localAngleFromWorldPoint(e.point)
    // baseline: current snapped visual
    startAngle.current = dialRef.current?.rotation.y ?? 0
    accum.current = 0
  }

  const onUpOrOut = (e) => {
    e.stopPropagation()
    e.target?.releasePointerCapture?.(e.pointerId)
    isActive.current = false
    locked.current = false
    accum.current = 0
  }

  const onMove = (e) => {
    if (!isActive.current || locked.current) return
    e.stopPropagation()
    const cur = localAngleFromWorldPoint(e.point)
    let dA = cur - lastPointer.current
    // wrap to [-PI, PI]
    dA = Math.atan2(Math.sin(dA), Math.cos(dA))
    lastPointer.current = cur
    accum.current += dA

    const dir = Math.sign(accum.current)
    if (Math.abs(accum.current) >= stepAngle && dir !== 0) {
      // attempt a step
      const candidate = clamp(value + dir * step)
      if (candidate !== value) {
        // snap visual by one step from the starting baseline
        if (dialRef.current) {
          const nextRot = startAngle.current + dir * stepAngle
          dialRef.current.rotation.y = nextRot
        }
        locked.current = true
        onChange(candidate)
      } else {
        // we're at a limit in that direction; just lock to prevent repeated firing
        locked.current = true
      }
    }
  }

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <primitive object={baseGeo} attach="geometry" />
        <meshStandardMaterial color={baseColor} metalness={0.1} roughness={0.8} transparent opacity={0.6} />
      </mesh>

      {/* dial */}
      <mesh
        ref={dialRef}
        position={[0, dialThickness * 0.5 + 0.001, 0]}
        castShadow
        onPointerDown={onDown}
        onPointerUp={onUpOrOut}
        onPointerCancel={onUpOrOut}
        onPointerOut={onUpOrOut}
        onPointerMove={onMove}
      >
        <primitive object={dialGeo} attach="geometry" />
        <meshStandardMaterial color={dialColor} metalness={0.35} roughness={0.45} />
      </mesh>
    </group>
  )
}
