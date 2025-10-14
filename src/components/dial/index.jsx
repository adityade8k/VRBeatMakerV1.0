import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Dial({
  // Transform
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale    = [1, 1, 1],

  // Base / visuals
  size = [0.1, 0.1],
  baseColor = '#6987f5',
  dialThickness = 0.02,
  dialSegments  = 16,
  dialColor     = '#f08c00',

  // Angular limits
  minAngle = -Math.PI * 0.75,
  maxAngle =  Math.PI * 0.75,
  initialAngle = 0,

  // Value mapping (we emit normalized 0..1 but keep these for mapping if needed)
  minValue = 0,
  maxValue = 1,

  // Controlled normalized value (0..1). If undefined → uncontrolled.
  value,

  // Feel
  sensitivity = 0.5,
  friction    = 0.92,

  // Behavior
  hardStops = true,

  onValueChange = () => {}, onChange
}) {
  const groupRef = useRef()
  const baseRef  = useRef()
  const dialRef  = useRef()

  // Geometries
  const baseGeo = useMemo(() => new THREE.PlaneGeometry(size[0], size[1]), [size])
  const dialRadius = useMemo(() => Math.min(size[0], size[1]) * 0.45, [size])
  const dialGeo = useMemo(
    () => new THREE.CylinderGeometry(dialRadius, dialRadius, dialThickness, dialSegments),
    [dialRadius, dialThickness, dialSegments]
  )

  // Interaction state
  const dragging = useRef(false)
  const lastPointerAngle = useRef(0)
  const spinVel = useRef(0)
  const lastSent = useRef(NaN)
  const externalSet = useRef(false) // prevent echo when syncing from props

  // Helpers
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
  const angleSpan = Math.max(1e-6, maxAngle - minAngle)

  const getAngle = () => (dialRef.current?.rotation.y ?? 0)
  const setAngle = (a) => { if (dialRef.current) dialRef.current.rotation.y = a }

  const valueToAngle = (t01) => minAngle + angleSpan * Math.min(1, Math.max(0, t01))
  const angleToT01   = (a)   => (a - minAngle) / angleSpan

  // Sync from controlled value
  useEffect(() => {
    if (value == null || !Number.isFinite(value)) return
    const a = valueToAngle(value)
    externalSet.current = true
    setAngle(a)
    // we don't emit here; emit guard prevents loops anyway
  }, [value, minAngle, angleSpan])

  const getPointerAngleLocal = (worldPoint) => {
    tmp.copy(worldPoint)
    groupRef.current?.worldToLocal(tmp)
    return Math.atan2(tmp.x, tmp.z)
  }

  const emitNormalizedIfChanged = (a) => {
    const t01 = angleToT01(a)
    if (Math.abs(t01 - lastSent.current) > 1e-4) {
      lastSent.current = t01
      if (externalSet.current) {
        externalSet.current = false
      } else {
        (onValueChange || onChange)?.(t01) // normalized 0..1
      }
    }
  }

  // Pointer events
  const onDown = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    dragging.current = true
    lastPointerAngle.current = getPointerAngleLocal(e.point)
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

    const currentPointer = getPointerAngleLocal(e.point)
    let dA = currentPointer - lastPointerAngle.current
    dA = Math.atan2(Math.sin(dA), Math.cos(dA)) // wrap [-PI, PI]
    lastPointerAngle.current = currentPointer

    if (hardStops) {
      const a = getAngle()
      const atMin = Math.abs(a - minAngle) < 1e-6
      const atMax = Math.abs(a - maxAngle) < 1e-6
      const outwardNeg = dA < 0 // toward min
      const outwardPos = dA > 0 // toward max
      if ((atMin && outwardNeg) || (atMax && outwardPos)) dA = 0
    }

    spinVel.current += dA * sensitivity
  }

  // Animate
  useFrame(() => {
    if (!dialRef.current) return

    let a = getAngle()
    a += spinVel.current

    if (hardStops) {
      if (a < minAngle) {
        a = minAngle
        if (spinVel.current < 0) spinVel.current = 0
      } else if (a > maxAngle) {
        a = maxAngle
        if (spinVel.current > 0) spinVel.current = 0
      }
    } else {
      a = clamp(a, minAngle, maxAngle)
    }

    setAngle(a)
    emitNormalizedIfChanged(a)

    // Friction
    spinVel.current *= friction
    if (Math.abs(spinVel.current) < 1e-5) spinVel.current = 0
  })

  // Init angle
  useEffect(() => {
    const a0 = clamp(initialAngle, minAngle, maxAngle)
    setAngle(a0)
    emitNormalizedIfChanged(a0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAngle, minAngle, maxAngle])

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <Suspense fallback={null}>
        {/* Base */}
        <mesh ref={baseRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <primitive object={baseGeo} attach="geometry" />
          <meshStandardMaterial color={baseColor} metalness={0.1} roughness={0.8} transparent opacity={0.6} />
        </mesh>

        {/* Dial */}
        <mesh
          ref={dialRef}
          position={[0, dialThickness * 0.5 + 0.001, 0]}
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
