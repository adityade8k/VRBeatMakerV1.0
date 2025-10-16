// components/roller.jsx
import { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useDisposable } from '../../hooks/useDisposable' // adjust alias if needed

/**
 * Continuous Roller (wheel spins around X)
 * - Drag along local Z to spin; emits continuous values.
 * - Value ↔ angle mapping is linear between [minAngle, maxAngle] and [range[0], range[1]].
 *
 * Notes:
 * - We rotate a child 'pose' group to align cylinder axis to X.
 * - We derive angle delta by dz / radius to approximate rolling.
 */
export default function Roller({
  // Transform
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale    = [1, 1, 1],

  // Visuals
  size = [0.1, 0.1],
  baseColor = '#324966',
  diskColor = '#fc45c8',
  diskThickness = 0.035,
  diskSegments = 16,

  // Value space
  range = [0, 1],

  // Angular sweep (around X)
  minAngle = -Math.PI * 0.75,
  maxAngle =  Math.PI * 0.75,

  // Controlled value
  value = 0,

  onChange = () => {},
}) {
  const groupRef = useRef()
  const wheelSpinRef = useRef() // the node we actually spin (rotation.x)
  const wheelPoseRef = useRef() // reorients cylinder to spin around X

  const [minV, maxV] = range
  const clampV = (x) => Math.min(maxV, Math.max(minV, x))
  const clampA = (a) => Math.min(maxAngle, Math.max(minAngle, a))

  // Linear maps
  const v2a = (v) => {
    const t = (v - minV) / Math.max(1e-9, (maxV - minV))
    return minAngle + t * (maxAngle - minAngle)
  }
  const a2v = (a) => {
    const t = (a - minAngle) / Math.max(1e-9, (maxAngle - minAngle))
    return clampV(minV + t * (maxV - minV))
  }

  // Disposable geometries
  const baseGeo = useDisposable(
    () => new THREE.PlaneGeometry(size[0], size[1]),
    [size[0], size[1]]
  )

  const radius = useMemo(() => Math.min(size[0], size[1]) * 0.45, [size])
  const diskGeo = useDisposable(
    () => new THREE.CylinderGeometry(radius, radius, diskThickness, diskSegments),
    [radius, diskThickness, diskSegments]
  )

  useEffect(() => {
    // align cylinder axis along X (cylinder default axis is Y)
    if (wheelPoseRef.current) wheelPoseRef.current.rotation.set(0, 0, Math.PI / 2)
  }, [])

  // Keep visual synced to controlled value
  useEffect(() => {
    if (!wheelSpinRef.current) return
    wheelSpinRef.current.rotation.x = v2a(value)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // GC-friendly cleanup
  useEffect(() => {
    return () => {
      if (wheelPoseRef.current) wheelPoseRef.current.geometry = null
    }
  }, [])

  // Interaction state
  const isActive   = useRef(false)
  const startAngle = useRef(0) // wheelSpinRef.rotation.x at pointer down
  const startZ     = useRef(0) // local Z at pointer down

  const toLocalZ = (worldPoint) => {
    const tmp = new THREE.Vector3().copy(worldPoint)
    groupRef.current?.worldToLocal(tmp)
    return tmp.z
  }

  const onDown = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    isActive.current = true
    startAngle.current = wheelSpinRef.current?.rotation.x ?? v2a(value)
    startZ.current = toLocalZ(e.point)
  }

  const onUpOrOut = (e) => {
    e.stopPropagation()
    e.target?.releasePointerCapture?.(e.pointerId)
    isActive.current = false
  }

  const onMove = (e) => {
    if (!isActive.current) return
    e.stopPropagation()

    const z = toLocalZ(e.point)
    const dz = z - startZ.current
    const dTheta = dz / Math.max(radius, 1e-4) // roll approximation

    const newAngle = clampA(startAngle.current + dTheta)

    // Optimistic visual update
    if (wheelSpinRef.current) wheelSpinRef.current.rotation.x = newAngle

    const nextV = a2v(newAngle)
    if (nextV !== value) onChange(nextV)
  }

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={baseGeo}>
        <meshStandardMaterial
          color={baseColor}
          metalness={0.1}
          roughness={0.8}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Roller */}
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
