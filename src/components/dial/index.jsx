// dial/Dial.jsx
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Dial: base plate (plane) + flat disk (cylinder) that rotates around +Y.
 * - Faces parallel to base; axis is +Y (default Cylinder orientation).
 * - Drag on the disk surface to rotate between minAngle..maxAngle (radians).
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
  dialThickness = 0.02,         // along Y
  dialSegments  = 16,
  dialColor     = '#f08c00',

  // Range + output
  minAngle = -Math.PI * 0.75,   // -135°
  maxAngle =  Math.PI * 0.75,   // +135°
  initialAngle = 0,
  minValue = -1,
  maxValue =  1,
  onValueChange = () => {},
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

  // Drag state
  const dragging = useRef(false)
  const angleOffset = useRef(0)   // dial.rotation.y - pointerAngle at drag start

  const tmp = useMemo(() => new THREE.Vector3(), [])
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

  const getPointerAngleLocal = (worldPoint) => {
    // Convert world -> local (dial group space)
    tmp.copy(worldPoint)
    groupRef.current?.worldToLocal(tmp)
    // Angle around Y: atan2(x, z) keeps 0 at +Z, increasing CCW
    return Math.atan2(tmp.x, tmp.z)
  }

  const applyAngle = (angle) => {
    const a = clamp(angle, minAngle, maxAngle)
    if (dialRef.current) dialRef.current.rotation.y = a

    // Map angle to normalized value
    const t = (a - minAngle) / (maxAngle - minAngle) // 0..1
    const v = minValue + t * (maxValue - minValue)
    onValueChange(v)
  }

  const onDown = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    dragging.current = true
    const pointerA = getPointerAngleLocal(e.point)
    const currentA = dialRef.current?.rotation.y ?? 0
    angleOffset.current = currentA - pointerA
  }

  const onUp = (e) => {
    e.stopPropagation()
    e.target.releasePointerCapture?.(e.pointerId)
    dragging.current = false
  }

  const onMove = (e) => {
    if (!dragging.current) return
    e.stopPropagation()
    const pointerA = getPointerAngleLocal(e.point)
    const desired = pointerA + angleOffset.current
    applyAngle(desired)
  }

  useEffect(() => {
    applyAngle(initialAngle)
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
