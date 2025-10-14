import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Roller({
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale    = [1, 1, 1],

  size = [0.1, 0.1],
  baseColor = '#6987f5',

  diskThickness = 0.035,
  diskSegments  = 8,
  diskColor     = '#fc45c8',

  minValue = 0,
  maxValue = 1,
  friction = 0.92,
  sensitivity = 1.0,
  onValueChange = () => {},

  // NEW: prevent rotation/value from exceeding bounds (and ignore outward pushes)
  hardStops = true,
}) {
  const groupRef = useRef()
  const baseRef  = useRef()
  const diskRef  = useRef()

  const baseGeo = useMemo(() => new THREE.PlaneGeometry(size[0], size[1]), [size])
  const diskRadius = useMemo(() => Math.min(size[0], size[1]) * 0.45, [size])
  const diskGeo = useMemo(
    () => new THREE.CylinderGeometry(diskRadius, diskRadius, diskThickness, diskSegments),
    [diskRadius, diskThickness, diskSegments]
  )

  const dragging = useRef(false)
  const lastLocalZ = useRef(0)
  const spinVel = useRef(0)          // angular velocity
  const valueRef = useRef((minValue + maxValue) / 2) // current value
  const lastSent = useRef(NaN)

  const tmpV3 = useMemo(() => new THREE.Vector3(), [])
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
  const radiusSafe = Math.max(diskRadius, 1e-4)
  const span = Math.max(1e-6, maxValue - minValue)

  // Map value → visual angle (keep it bounded even if hardStops)
  const valueToAngle = (v) => {
    // Map [min,max] → [-PI * 0.9, +PI * 0.9] (about 324° total range)
    const t = (v - minValue) / span
    return THREE.MathUtils.lerp(-Math.PI * 0.9, Math.PI * 0.9, t)
  }

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
    // soften velocity to stabilize grab
    spinVel.current *= 0.4
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
      // If we are at min and pushing downwards (reduce value), ignore.
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

    // Predict next value from velocity
    let nextValue = valueRef.current + spinVel.current * 0.15 * span // scale vel to value space

    if (hardStops) {
      // Clamp value and kill outward velocity at bounds
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

    // Visual rotation:
    if (hardStops) {
      // derive angle from value so it cannot exceed bounds visually
      const target = valueToAngle(valueRef.current)
      // quick, smooth follow
      const k = 0.25
      disk.rotation.x = THREE.MathUtils.lerp(disk.rotation.x, target, k)
    } else {
      // free-spinning visualization
      disk.rotation.x += spinVel.current
    }

    // emit only on meaningful change
    const EPS = 1e-4
    if (Math.abs(valueRef.current - lastSent.current) > EPS) {
      lastSent.current = valueRef.current
      onValueChange((valueRef.current - minValue) / span) // normalized 0..1
    }

    // friction
    spinVel.current *= friction
    if (Math.abs(spinVel.current) < 1e-5) spinVel.current = 0
  })

  useEffect(() => {
    // faces vertical
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
