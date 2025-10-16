// components/dial.jsx
import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useDisposable } from '../../hooks/useDisposable' // adjust if you use an alias like '@/hooks/useDisposable'

/**
 * Step Dial
 * - Emits exactly ONE step per pointer/ray "contact".
 * - After a step fires, it ignores further motion until pointer leaves / is released.
 *
 * Props:
 *   position, rotation, scale, size, baseColor, dialColor
 *   range: [min, max]      // value domain
 *   step: number           // value increment
 *   stepAngle: number      // radians required to commit one step
 *   value: number          // controlled value in domain units (min..max)
 *   onChange(nextValue)    // fires only when a step is committed
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
  stepAngle = Math.PI / 6, // ~30°

  // Controlled value (domain units)
  value = 0,

  onChange = () => {},
}) {
  const groupRef = useRef()
  const dialRef  = useRef()
  const tmpVec   = useRef(new THREE.Vector3())

  const [min, max] = range
  const clamp = (x) => Math.min(max, Math.max(min, x))

  // Geometry
  const baseGeo = useDisposable(
    () => new THREE.PlaneGeometry(size[0], size[1]),
    [size[0], size[1]]
  )
  const radius = useMemo(() => Math.min(size[0], size[1]) * 0.45, [size[0], size[1]])
  const dialGeo = useDisposable(
    () => new THREE.CylinderGeometry(radius, radius, dialThickness, dialSegments),
    [radius, dialThickness, dialSegments]
  )

  // Break lingering refs on unmount to help GC
  useEffect(() => {
    return () => {
      if (dialRef.current) dialRef.current.geometry = null
    }
  }, [])

  // Keep dial's visual rotation in sync with the controlled value (discrete snapping).
  useEffect(() => {
    if (!dialRef.current) return
    const stepsFromMin = Math.round((value - min) / step)
    dialRef.current.rotation.y = stepsFromMin * stepAngle
  }, [value, min, step, stepAngle])

  // interaction refs
  const isActive    = useRef(false)  // pointer is down / ray is captured
  const locked      = useRef(false)  // one step already fired for this contact
  const startAngle  = useRef(0)      // angle when contact begins (visual baseline)
  const lastPointer = useRef(0)      // last pointer polar angle (local)
  const accum       = useRef(0)      // accumulated delta angle since contact begin

  // Helpers
  const localAngleFromWorldPoint = (worldPoint) => {
    const v = tmpVec.current.copy(worldPoint)
    groupRef.current?.worldToLocal(v)
    // atan2(x, z): around Y axis, consistent with visual rotation.y
    return Math.atan2(v.x, v.z)
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
      const candidate = clamp(value + dir * step)
      if (candidate !== value) {
        // snap visual by one step from the starting baseline
        if (dialRef.current) {
          dialRef.current.rotation.y = startAngle.current + dir * stepAngle
        }
        locked.current = true
        onChange(candidate)
      } else {
        // at a limit in that direction; lock to prevent repeated firing
        locked.current = true
      }
    }
  }

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={baseGeo}>
        <meshStandardMaterial
          color={baseColor}
          metalness={0.1}
          roughness={0.8}
          transparent
          opacity={0.6}
          // side={THREE.DoubleSide} // uncomment if you need backface hits in XR
        />
      </mesh>

      {/* dial */}
      <mesh
        ref={dialRef}
        position={[0, dialThickness * 0.5 + 0.001, 0]}
        castShadow
        geometry={dialGeo}
        onPointerDown={onDown}
        onPointerUp={onUpOrOut}
        onPointerCancel={onUpOrOut}
        onPointerOut={onUpOrOut}
        onPointerMove={onMove}
      >
        <meshStandardMaterial color={dialColor} metalness={0.35} roughness={0.45} />
      </mesh>
    </group>
  )
}
