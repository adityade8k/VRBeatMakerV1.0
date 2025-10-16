// switch/ToggleSwitch.jsx
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useDisposable } from '../../hooks/useDisposable'

/**
 * ToggleSwitch:
 * - Base plate (plane) lying flat.
 * - Upright thin cylinder (stem) + sphere knob on top.
 * - Rotates around a hinge located at the stem base (on the plate).
 * - Drag forward/back (local Z) to tilt; snaps to ON/OFF on release.
 *
 * Props:
 *  - onToggle(isOn)
 *  - isOn (controlled)
 *  - defaultOn (uncontrolled)
 *  - tiltOn/tiltOff (radians)
 *  - sensitivity (angle per unit local-Z while dragging)
 *  - speed (lerp)
 */
export default function ToggleSwitch({
  // Outer transform
  position = [0, 0.85, -0.35],
  rotation = [0, 0, 0],
  scale    = [1, 1, 1],

  // Base
  size = [0.1, 0.1],
  baseColor = '#6987f5',

  // Stem + knob
  stemHeight = 0.08,
  stemRadius = 0.006,
  knobRadius = 0.018,
  stemColor  = '#808080',
  knobColor  = '#9c31ee',

  // Feel
  tiltOn  =  +0.6,
  tiltOff =  -0.6,
  sensitivity = 30,
  speed = 20,

  // State
  isOn: controlledOn,
  defaultOn = false,
  onToggle = () => {},
}) {
  const groupRef  = useRef()
  const baseRef   = useRef()
  const stemRef   = useRef()
  const knobRef   = useRef()
  const hingeRef  = useRef()  // pivot at the stem base (rotation happens here)

  // Geometries (auto-disposed on change/unmount)
  const baseGeo = useDisposable(
    () => new THREE.PlaneGeometry(size[0], size[1]),
    [size[0], size[1]]
  )
  const stemGeo = useDisposable(
    () => new THREE.CylinderGeometry(stemRadius, stemRadius, stemHeight, 24),
    [stemRadius, stemHeight]
  )
  const knobGeo = useDisposable(
    () => new THREE.SphereGeometry(knobRadius, 24, 16),
    [knobRadius]
  )

  // Break lingering refs on unmount (helps GC)
  useEffect(() => {
    return () => {
      if (baseRef.current) baseRef.current.geometry = null
      if (stemRef.current) stemRef.current.geometry = null
      if (knobRef.current) knobRef.current.geometry = null
    }
  }, [])

  // Uncontrolled fallback
  const [internalOn, setInternalOn] = useState(defaultOn)
  const isOn = controlledOn ?? internalOn

  // Motion state
  const targetAngle = useRef(isOn ? tiltOn : tiltOff)
  const currentAngle = useRef(targetAngle.current)
  const dragging = useRef(false)
  const startAngle = useRef(0)
  const startLocalZ = useRef(0)
  const tmp = useMemo(() => new THREE.Vector3(), [])

  // Helpers
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
  const midAngle = useMemo(() => 0.5 * (tiltOn + tiltOff), [tiltOn, tiltOff])

  const setOn = (next) => {
    if (controlledOn === undefined) setInternalOn(next)
    onToggle(next)
  }

  // Convert world → local Z in switch group space
  const toLocalZ = (worldPoint) => {
    tmp.copy(worldPoint)
    groupRef.current?.worldToLocal(tmp)
    return tmp.z
  }

  // Pointer events on the knob for precise grabbing
  const onDown = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    dragging.current = true
    startAngle.current = currentAngle.current
    startLocalZ.current = toLocalZ(e.point)
  }

  const onUp = (e) => {
    e.stopPropagation()
    e.target.releasePointerCapture?.(e.pointerId)
    dragging.current = false

    // Snap to nearest state on release
    const snapOn = currentAngle.current >= midAngle
    targetAngle.current = snapOn ? tiltOn : tiltOff
    if (snapOn !== isOn) setOn(snapOn)
  }

  const onMove = (e) => {
    if (!dragging.current) return
    e.stopPropagation()
    const z = toLocalZ(e.point)
    const dz = z - startLocalZ.current

    // Desired angle while dragging
    const desired = clamp(startAngle.current + dz * sensitivity, tiltOff, tiltOn)
    targetAngle.current = desired // follow finger/ray
  }

  // Smoothly blend current → target every frame
  useFrame((_, dt) => {
    const hinge = hingeRef.current
    if (!hinge) return
    const k = 1 - Math.exp(-speed * dt)
    currentAngle.current = THREE.MathUtils.lerp(currentAngle.current, targetAngle.current, k)
    hinge.rotation.x = currentAngle.current
  })

  // Keep target in sync if controlled state changes from outside
  useEffect(() => {
    targetAngle.current = isOn ? tiltOn : tiltOff
  }, [isOn, tiltOn, tiltOff])

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <Suspense fallback={null}>
        {/* Base: face up */}
        <mesh
          ref={baseRef}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          geometry={baseGeo}
        >
          <meshStandardMaterial
            color={baseColor}
            metalness={0.1}
            roughness={0.8}
            transparent
            opacity={0.6}
            // side={THREE.DoubleSide} // uncomment if you need backface hits in XR
          />
        </mesh>

        {/* Hinge at stem base (on top of plate) */}
        <group ref={hingeRef} position={[0, 0, 0]}>
          {/* Stem lifted so its base sits at the hinge */}
          <mesh
            ref={stemRef}
            position={[0, stemHeight / 2, 0]}
            castShadow
            geometry={stemGeo}
          >
            <meshStandardMaterial color={stemColor} metalness={0.2} roughness={0.6} />
          </mesh>

          {/* Knob at top of stem */}
          <mesh
            ref={knobRef}
            position={[0, stemHeight + knobRadius, 0]}
            castShadow
            geometry={knobGeo}
            onPointerDown={onDown}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerOut={onUp}
            onPointerMove={onMove}
          >
            <meshStandardMaterial color={knobColor} metalness={0.1} roughness={0.4} />
          </mesh>
        </group>
      </Suspense>
    </group>
  )
}
