// components/roller.jsx
import { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useDisposable } from '../../hooks/useDisposable'// adjust path if using alias like '@/hooks/useDisposable'

/**
 * Step Roller (axis = X, faces ∥ YZ, spin around X via local Z motion)
 * - One tick per contact (locks until pointer leaves).
 */
export default function Roller({
  // Transform
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],

  // Visuals
  size = [0.1, 0.1],
  baseColor = '#324966',
  diskColor = '#fc45c8',
  diskThickness = 0.035,
  diskSegments = 8,

  // Value space
  range = [0, 1],
  step = 0.05,
  stepAngle = Math.PI / 4.5, // ~10°

  // Controlled value
  value = 0,

  onChange = () => {},
}) {
  const groupRef = useRef()
  const wheelSpinRef = useRef()
  const wheelPoseRef = useRef()

  // ✅ Use disposable geometries (auto-dispose + clean on unmount)
  const baseGeo = useDisposable(
    () => new THREE.PlaneGeometry(size[0], size[1]),
    [size[0], size[1]]
  )

  const radius = useMemo(() => Math.min(size[0], size[1]) * 0.45, [size])
  const diskGeo = useDisposable(
    () => new THREE.CylinderGeometry(radius, radius, diskThickness, diskSegments),
    [radius, diskThickness, diskSegments]
  )

  // Explicit cleanup for GC
  useEffect(() => {
    return () => {
      if (wheelPoseRef.current) wheelPoseRef.current.geometry = null
    }
  }, [])

  // Interaction state
  const isActive = useRef(false)
  const locked = useRef(false)
  const startAngle = useRef(0)
  const lastZ = useRef(0)
  const accum = useRef(0)

  const [min, max] = range
  const clamp = (x) => Math.min(max, Math.max(min, x))

  // Rotate the wheel to align cylinder’s axis to X
  useEffect(() => {
    if (wheelPoseRef.current) wheelPoseRef.current.rotation.set(0, 0, Math.PI / 2)
  }, [])

  // Keep wheel spin synced to controlled value
  useEffect(() => {
    if (!wheelSpinRef.current) return
    const stepsFromMin = Math.round((value - min) / step)
    wheelSpinRef.current.rotation.x = stepsFromMin * stepAngle
  }, [value, min, step, stepAngle])

  // World → local Z conversion
  const toLocalZ = (worldPoint) => {
    const tmp = new THREE.Vector3().copy(worldPoint)
    groupRef.current?.worldToLocal(tmp)
    return tmp.z
  }

  // Pointer interactions
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

    const z = toLocalZ(e.point)
    const dz = z - lastZ.current
    lastZ.current = z

    // Approximate wheel rotation based on Z motion
    const dTheta = dz / Math.max(radius, 1e-4)
    accum.current += dTheta

    const dir = Math.sign(accum.current)
    if (Math.abs(accum.current) >= stepAngle && dir !== 0) {
      const candidate = clamp(value + dir * step)
      if (candidate !== value) {
        if (wheelSpinRef.current) {
          wheelSpinRef.current.rotation.x = startAngle.current + dir * stepAngle
        }
        locked.current = true
        onChange(candidate)
      } else {
        locked.current = true
      }
    }
  }

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Base plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={baseGeo}>
        <meshStandardMaterial
          color={baseColor}
          metalness={0.1}
          roughness={0.8}
          transparent
          opacity={0.6}
          // side={THREE.DoubleSide} // uncomment if you need backface hits in VR
        />
      </mesh>

      {/* Roller wheel */}
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
          <mesh castShadow geometry={diskGeo}>
            <meshStandardMaterial color={diskColor} metalness={0.3} roughness={0.4} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
