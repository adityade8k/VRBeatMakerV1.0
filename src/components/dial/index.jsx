import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Dial({
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale    = [1, 1, 1],

  size = [0.1, 0.1],
  baseColor = '#6987f5',

  dialThickness = 0.02,
  dialSegments  = 16,
  dialColor     = '#f08c00',

  minAngle = -Math.PI * 0.75,
  maxAngle =  Math.PI * 0.75,
  initialAngle = 0,

  minValue = 0,
  maxValue = 1,
  onValueChange = () => {},

  sensitivity = 0.5,
  friction    = 0.92,

  // NEW: prevent rotation beyond [minAngle, maxAngle] and ignore outward pushes
  hardStops = true,
}) {
  const groupRef = useRef()
  const baseRef  = useRef()
  const dialRef  = useRef()

  const baseGeo = useMemo(() => new THREE.PlaneGeometry(size[0], size[1]), [size])
  const dialRadius = useMemo(() => Math.min(size[0], size[1]) * 0.45, [size])
  const dialGeo = useMemo(
    () => new THREE.CylinderGeometry(dialRadius, dialRadius, dialThickness, dialSegments),
    [dialRadius, dialThickness, dialSegments]
  )

  const dragging = useRef(false)
  const lastPointerAngle = useRef(0)
  const spinVel = useRef(0)
  const lastSent = useRef(NaN)

  const tmp = useMemo(() => new THREE.Vector3(), [])
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
  const angleSpan = Math.max(1e-6, maxAngle - minAngle)
  const valueSpan = Math.max(1e-6, maxValue - minValue)

  const getAngle = () => (dialRef.current?.rotation.y ?? 0)
  const setAngle = (a) => { if (dialRef.current) dialRef.current.rotation.y = a }

  const angleToValue = (a) => {
    const t = (a - minAngle) / angleSpan
    return minValue + t * valueSpan
  }

  const getPointerAngleLocal = (worldPoint) => {
    tmp.copy(worldPoint)
    groupRef.current?.worldToLocal(tmp)
    return Math.atan2(tmp.x, tmp.z)
  }

  const emitValue = (a) => {
    const v = angleToValue(a)
    if (Math.abs(v - lastSent.current) > 1e-4) {
      lastSent.current = v
      // normalized 0..1 expected by your controller
      onValueChange((v - minValue) / valueSpan)
    }
  }

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
      if ((atMin && outwardNeg) || (atMax && outwardPos)) {
        dA = 0
      }
    }

    spinVel.current += dA * sensitivity
  }

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
    emitValue(a)

    spinVel.current *= friction
    if (Math.abs(spinVel.current) < 1e-5) spinVel.current = 0
  })

  useEffect(() => {
    // Initialize angle safely within bounds
    const a0 = clamp(initialAngle, minAngle, maxAngle)
    setAngle(a0)
    emitValue(a0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAngle, minAngle, maxAngle, minValue, maxValue])

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <Suspense fallback={null}>
        <mesh ref={baseRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <primitive object={baseGeo} attach="geometry" />
          <meshStandardMaterial color={baseColor} metalness={0.1} roughness={0.8} transparent opacity={0.6} />
        </mesh>

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
