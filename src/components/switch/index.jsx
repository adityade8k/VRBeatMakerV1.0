// switch/ToggleSwitch.jsx
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * ToggleSwitch with proximity snapping.
 * - Snaps to ON/OFF when within `snapThreshold` radians of the target angle while dragging.
 * - Emits onToggle immediately when snapping occurs (debounced).
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
  tiltOn  =  +0.6,          // ~34°
  tiltOff =  -0.6,          // ~-34°
  sensitivity = 30,         // angle per unit Z (local) while dragging
  speed = 50,               // smoothing lerp speed (higher = snappier)

  // Proximity snapping
  snapThreshold = 0.10,      // radians (~5.7°)
  snapWhileDragging = true,  // snap as soon as you get close

  // State (controlled / uncontrolled)
  isOn: controlledOn,
  defaultOn = false,
  onToggle = () => {},
}) {
  const groupRef  = useRef()
  const baseRef   = useRef()
  const hingeRef  = useRef()  // pivot at the stem base (rotation happens here)

  // Geos
  const baseGeo = useMemo(() => new THREE.PlaneGeometry(size[0], size[1]), [size])
  const stemGeo = useMemo(() => new THREE.CylinderGeometry(stemRadius, stemRadius, stemHeight, 24), [stemRadius, stemHeight])
  const knobGeo = useMemo(() => new THREE.SphereGeometry(knobRadius, 24, 16), [knobRadius])

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

  // Debounce onToggle while snapping
  const lastEmittedOn = useRef(isOn)

  // Helpers
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
  const midAngle = useMemo(() => 0.5 * (tiltOn + tiltOff), [tiltOn, tiltOff])

  const setOn = (next) => {
    if (controlledOn === undefined) setInternalOn(next)
    // Only emit when the value actually changes
    if (lastEmittedOn.current !== next) {
      lastEmittedOn.current = next
      onToggle(next)
    }
  }

  // world → local Z in switch group space
  const toLocalZ = (worldPoint) => {
    tmp.copy(worldPoint)
    groupRef.current?.worldToLocal(tmp)
    return tmp.z
  }

  // Pointer events on the knob
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

    // If we didn't already snap while dragging, snap now to closest state
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
    let desired = clamp(startAngle.current + dz * sensitivity, tiltOff, tiltOn)

    if (snapWhileDragging) {
      const distToOn  = Math.abs(desired - tiltOn)
      const distToOff = Math.abs(desired - tiltOff)

      if (distToOn <= snapThreshold) {
        // Snap to ON immediately
        desired = tiltOn
        targetAngle.current = desired
        if (!isOn) setOn(true)
        return
      }
      if (distToOff <= snapThreshold) {
        // Snap to OFF immediately
        desired = tiltOff
        targetAngle.current = desired
        if (isOn) setOn(false)
        return
      }
    }

    // Otherwise follow finger/ray smoothly within bounds
    targetAngle.current = desired
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
    lastEmittedOn.current = isOn
  }, [isOn, tiltOn, tiltOff])

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <Suspense fallback={null}>
        {/* Base: face up */}
        <mesh ref={baseRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <primitive object={baseGeo} attach="geometry" />
          <meshStandardMaterial color={baseColor} metalness={0.1} roughness={0.8} transparent opacity={0.6} />
        </mesh>

        {/* Hinge at stem base (on top of plate) */}
        <group ref={hingeRef} position={[0, 0, 0]}>
          {/* Stem (centered, lifted so base sits at hinge) */}
          <mesh position={[0, stemHeight / 2, 0]} castShadow>
            <primitive object={stemGeo} attach="geometry" />
            <meshStandardMaterial color={stemColor} metalness={0.2} roughness={0.6} />
          </mesh>

          {/* Knob with pointer interaction */}
          <mesh
            position={[0, stemHeight + knobRadius, 0]}
            castShadow
            onPointerDown={onDown}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerOut={onUp}
            onPointerMove={onMove}
          >
            <primitive object={knobGeo} attach="geometry" />
            <meshStandardMaterial color={knobColor} metalness={0.1} roughness={0.4} />
          </mesh>
        </group>
      </Suspense>
    </group>
  )
}
