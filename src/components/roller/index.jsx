// roller/Roller.jsx
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Roller: a base plate (plane) with a fat disk (cylinder) centered on it.
 * - The disk’s circular faces are perpendicular to the plate (i.e., vertical).
 * - Drag/push forward/back on the disk to spin it forward/back.
 * - Emits a continuous value via onValueChange in the range [minValue, maxValue].
 */
export default function Roller({
  // Outer transform
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale    = [1, 1, 1],

  // Base plate
  size = [0.16, 0.12],          // width, height (world units)
  baseColor = '#6987f5',

  // Disk
  diskThickness = 0.035,        // thickness along its axis
  diskSegments  = 48,
  diskColor     = '#790a59',

  // Motion / output
  minValue = -1,                // normalized output range
  maxValue =  1,
  friction = 0.92,              // 0..1 (higher = spins longer)
  sensitivity = 1.0,            // multiplier for how fast it spins per unit push
  onValueChange = () => {},
}) {
  const groupRef = useRef()
  const baseRef  = useRef()
  const diskRef  = useRef()

  // Geometries
  const baseGeo = useMemo(
    () => new THREE.PlaneGeometry(size[0], size[1]),
    [size]
  )

  // Make the disk fit within the base (a bit of margin)
  const diskRadius = useMemo(
    () => Math.min(size[0], size[1]) * 0.45,
    [size]
  )
  const diskGeo = useMemo(
    () => new THREE.CylinderGeometry(diskRadius, diskRadius, diskThickness, diskSegments),
    [diskRadius, diskThickness, diskSegments]
  )

  // Dragging / spin state
  const dragging = useRef(false)
  const lastLocalZ = useRef(0)
  const spinVel = useRef(0)     // angular velocity (radians/frame-ish)
  const valueRef = useRef(0)    // current output value in [minValue, maxValue]

  // Helpers
  const tmpV3 = useMemo(() => new THREE.Vector3(), [])
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
  const radiusSafe = Math.max(diskRadius, 1e-4)

  // Pointer handlers
  const toLocalZ = (worldPoint) => {
    tmpV3.copy(worldPoint)
    groupRef.current?.worldToLocal(tmpV3)
    return tmpV3.z
  }

  const onDown = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    dragging.current = true
    lastLocalZ.current = toLocalZ(e.point)
  }

  const onUp = (e) => {
    e.stopPropagation()
    e.target.releasePointerCapture?.(e.pointerId)
    dragging.current = false
  }

  const onMove = (e) => {
    if (!dragging.current) return
    e.stopPropagation()
    const z = toLocalZ(e.point)
    const dz = z - lastLocalZ.current
    lastLocalZ.current = z

    // Rolling:
    // linear distance (dz) -> angular change ~= dz / radius
    // accumulate into velocity so we can have inertial spin
    spinVel.current += (dz / radiusSafe) * sensitivity
  }

  // Animate spin + inertial decay
  useFrame(() => {
    const disk = diskRef.current
    if (!disk) return

    // Apply velocity to rotation (roll around local X)
    disk.rotation.x += spinVel.current

    // Convert spin into a continuous value (scroll-like)
    // Map the integrated angle into a bounded range.
    // You can choose any mapping; here we simply add proportionally and clamp.
    valueRef.current = clamp(
      valueRef.current + spinVel.current * 0.15, // tuning scale
      minValue,
      maxValue
    )
    onValueChange(valueRef.current)

    // Friction
    spinVel.current *= friction
    if (Math.abs(spinVel.current) < 1e-5) spinVel.current = 0
  })

  useEffect(() => {
    // Ensure disk has the correct base orientation:
    // Cylinder axis is Y by default; we want axis along X so its faces are vertical.
    if (diskRef.current) {
      // Rotate cylinder so its axis (Y) aligns with X → faces perpendicular to the plate
      diskRef.current.rotation.z = Math.PI / 2
    }
  }, [])

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      scale={scale}
      // pointerEventsType={{ deny: 'grab' }}
    >
      <Suspense fallback={null}>
        {/* Base: rotate -90° about X so it faces up (+Y normal) */}
        <mesh ref={baseRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <primitive object={baseGeo} attach="geometry" />
          <meshStandardMaterial color={baseColor} metalness={0.1} roughness={0.8} />
        </mesh>

        {/* Disk (roller): centered at origin, faces perpendicular to the base.
            We listen on the disk for pointer interactions. */}
        <mesh
          ref={diskRef}
          position={[0, diskThickness * 0.5, 0]}   // lift slightly to avoid z-fighting with base edges
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerOut={onUp}
          onPointerMove={onMove}
        >
          <primitive object={diskGeo} attach="geometry" />
          <meshStandardMaterial color={diskColor} metalness={0.3} roughness={0.4} />
        </mesh>
      </Suspense>
    </group>
  )
}
