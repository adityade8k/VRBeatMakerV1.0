// components/roller.jsx
import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'

/**
 * Step Roller (axis = X, faces ∥ YZ, spin around X via local Z motion)
 * - One tick per contact (locks until pointer leaves).
 */
export default function Roller({
  // Transform
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale    = [1, 1, 1],

  // Visuals
  size = [0.1, 0.1],          // base plane size (lies on XZ)
  baseColor = '#324966',
  diskColor = '#fc45c8',
  diskThickness = 0.035,
  diskSegments = 8,

  // Value space
  range = [0, 1],
  step = 0.05,
  stepAngle = Math.PI / 4.5,   // ~10°

  // Controlled value
  value = 0,

  onChange = () => {},
}) {
  const groupRef     = useRef()  // whole control
  const wheelSpinRef = useRef()  // ROTATES AROUND X (parent)
  const wheelPoseRef = useRef()  // child: fixes cylinder axis -> X (faces ∥ YZ)

  const baseGeo = useMemo(() => new THREE.PlaneGeometry(size[0], size[1]), [size])
  const radius  = useMemo(() => Math.min(size[0], size[1]) * 0.45, [size])
  const diskGeo = useMemo(
    () => new THREE.CylinderGeometry(radius, radius, diskThickness, diskSegments),
    [radius, diskThickness, diskSegments]
  )

  // Interaction state
  const isActive   = useRef(false)
  const locked     = useRef(false)   // prevent repeat within same contact
  const startAngle = useRef(0)       // wheelSpinRef.rotation.x at contact begin
  const lastZ      = useRef(0)       // last local Z
  const accum      = useRef(0)       // accumulated implied angle

  const [min, max] = range
  const clamp = (x) => Math.min(max, Math.max(min, x))

  // Child pose: turn default Y-axis cylinder so its axis becomes X (faces ∥ YZ)
  useEffect(() => {
    if (wheelPoseRef.current) wheelPoseRef.current.rotation.set(0, 0, Math.PI / 2)
  }, [])

  // Keep visual spin in sync with controlled value (apply on wheelSpinRef.rotation.x)
  useEffect(() => {
    if (!wheelSpinRef.current) return
    const stepsFromMin = Math.round((value - min) / step)
    wheelSpinRef.current.rotation.x = stepsFromMin * stepAngle
  }, [value, min, step, stepAngle])

  // World → local Z in control space
  const toLocalZ = (worldPoint) => {
    const tmp = new THREE.Vector3().copy(worldPoint)
    groupRef.current?.worldToLocal(tmp)
    return tmp.z
  }

  const onDown = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    isActive.current = true
    locked.current = false
    lastZ.current = toLocalZ(e.point)
    startAngle.current = wheelSpinRef.current?.rotation.x ?? 0
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

    const z  = toLocalZ(e.point)
    const dz = z - lastZ.current
    lastZ.current = z

    // Forward/back (local Z) → implied wheel angle (θ ≈ dz / r)
    const dTheta = dz / Math.max(radius, 1e-4)
    accum.current += dTheta

    const dir = Math.sign(accum.current)
    if (Math.abs(accum.current) >= stepAngle && dir !== 0) {
      const candidate = clamp(value + dir * step)
      if (candidate !== value) {
        // Snap one tick from baseline around X
        if (wheelSpinRef.current) {
          const nextRot = startAngle.current + dir * stepAngle
          wheelSpinRef.current.rotation.x = nextRot
        }
        locked.current = true
        onChange(candidate)
      } else {
        locked.current = true // at domain limit; suppress repeats
      }
    }
  }

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* base on XZ plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <primitive object={baseGeo} attach="geometry" />
        <meshStandardMaterial
          color={baseColor}
          metalness={0.1}
          roughness={0.8}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Spin first (around X), then pose the cylinder so faces ∥ YZ */}
      <group
        ref={wheelSpinRef}
        position={[0, diskThickness * 0.5 + 0.001, 0]}
        onPointerDown={onDown}
        onPointerUp={onUpOrOut}
        onPointerCancel={onUpOrOut}
        onPointerOut={onUpOrOut}
        onPointerMove={onMove}
      >
        <group ref={wheelPoseRef}>
          <mesh castShadow>
            <primitive object={diskGeo} attach="geometry" />
            <meshStandardMaterial color={diskColor} metalness={0.3} roughness={0.4} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
