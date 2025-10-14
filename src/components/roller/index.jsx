import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Roller({
  // Transform
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale    = [1, 1, 1],

  // Base
  size = [0.1, 0.1],
  baseColor = '#6987f5',

  // Disk
  diskThickness = 0.035,
  diskSegments  = 8,
  diskColor     = '#fc45c8',

  // Value space (we emit/accept normalized but keep an internal [min,max])
  minValue = 0,
  maxValue = 1,

  // Controlled normalized value (0..1). If undefined, behaves uncontrolled.
  value,

  // Behavior
  hardStops = true,
  friction = 0.92,
  sensitivity = 1.0,

  // Unified callback (normalized 0..1)
  onChange = () => {},
}) {
  const groupRef = useRef()
  const baseRef  = useRef()
  const diskRef  = useRef()

  // Geometries
  const baseGeo = useMemo(() => new THREE.PlaneGeometry(size[0], size[1]), [size])
  const diskRadius = useMemo(() => Math.min(size[0], size[1]) * 0.45, [size])
  const diskGeo = useMemo(
    () => new THREE.CylinderGeometry(diskRadius, diskRadius, diskThickness, diskSegments),
    [diskRadius, diskThickness, diskSegments]
  )

  // State
  const dragging = useRef(false)
  const lastLocalZ = useRef(0)
  const spinVel = useRef(0)          // angular velocity
  const lastSent = useRef(NaN)

  const tmpV3 = useMemo(() => new THREE.Vector3(), [])
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
  const radiusSafe = Math.max(diskRadius, 1e-4)
  const span = Math.max(1e-6, maxValue - minValue)

  // Internal value in [minValue,maxValue]
  const valueRef = useRef((minValue + maxValue) / 2)
  const externalSet = useRef(false) // guard: don't re-emit when syncing from props

  // ⬇️ Option A: seed lastSent on mount so first delta logs correctly
  useEffect(() => {
    lastSent.current = valueRef.current
  }, [])

  // Sync from controlled `value` (0..1)
  useEffect(() => {
    if (value == null || !Number.isFinite(value)) return
    const v = minValue + Math.min(1, Math.max(0, value)) * span
    valueRef.current = v
    externalSet.current = true
    if (hardStops && diskRef.current) {
      const t = (v - minValue) / span
      const target = THREE.MathUtils.lerp(-Math.PI * 0.9, Math.PI * 0.9, t)
      diskRef.current.rotation.x = target
    }
    const EPS = 1e-4
    if (Math.abs(v - lastSent.current) > EPS) {
      lastSent.current = v
      // LOG (external change)
  
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, minValue, span, hardStops])

  // Map value → bounded angle
  const valueToAngle = (v) => {
    const t = (v - minValue) / span
    return THREE.MathUtils.lerp(-Math.PI * 0.9, Math.PI * 0.9, t)
  }

  // Pointer helpers
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
    spinVel.current *= 0.4 // stabilize grab
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

    // linear dz → angular delta
    let dTheta = (dz / radiusSafe) * sensitivity

    if (hardStops) {
      const atMin = Math.abs(valueRef.current - minValue) < 1e-6
      const atMax = Math.abs(valueRef.current - maxValue) < 1e-6
      const outwardNeg = dTheta < 0 // decreases value
      const outwardPos = dTheta > 0 // increases value
      if ((atMin && outwardNeg) || (atMax && outwardPos)) {
        dTheta = 0
      }
    }

    spinVel.current += dTheta
  }

  useFrame(() => {
    const disk = diskRef.current
    if (!disk) return

    // Integrate to value space
    let nextValue = valueRef.current + spinVel.current * 0.15 * span

    if (hardStops) {
      if (nextValue <= minValue) {
        nextValue = minValue
        if (spinVel.current < 0) spinVel.current = 0
      } else if (nextValue >= maxValue) {
        nextValue = maxValue
        if (spinVel.current > 0) spinVel.current = 0
      }
    } else {
      nextValue = clamp(nextValue, minValue, maxValue)
    }

    valueRef.current = nextValue

    // Visuals
    if (hardStops) {
      const target = valueToAngle(valueRef.current)
      const k = 0.25
      disk.rotation.x = THREE.MathUtils.lerp(disk.rotation.x, target, k)
    } else {
      disk.rotation.x += spinVel.current
    }

    // Emit + LOG only when the value actually changed (user-driven)
    const EPS = 1e-4
    if (Math.abs(valueRef.current - lastSent.current) > EPS) {
      lastSent.current = valueRef.current
      const t01 = (valueRef.current - minValue) / span
      if (externalSet.current) {
        // external change already logged in the effect
        externalSet.current = false
      } else {
        
        onChange?.(t01)
      }
    }

    // Friction
    spinVel.current *= friction
    if (Math.abs(spinVel.current) < 1e-5) spinVel.current = 0
  })

  useEffect(() => {
    // cylinder axis → X so faces are vertical
    if (diskRef.current) {
      diskRef.current.rotation.z = Math.PI / 2
    }
  }, [])

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <Suspense fallback={null}>
        <mesh ref={baseRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <primitive object={baseGeo} attach="geometry" />
          <meshStandardMaterial color={baseColor} metalness={0.1} roughness={0.8} transparent opacity={0.6} />
        </mesh>

        <mesh
          ref={diskRef}
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
