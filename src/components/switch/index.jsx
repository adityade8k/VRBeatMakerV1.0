// switch/ToggleSwitch.jsx
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Interactive } from '@react-three/xr'
import * as THREE from 'three'

/**
 * ToggleSwitch with proximity snapping.
 * - Works with mouse (pointer events) and WebXR controllers (Interactive).
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

  // Uncontrolled fallback
  const [internalOn, setInternalOn] = useState(defaultOn)
  const isOn = controlledOn ?? internalOn

  // Motion state
  const targetAngle = useRef(isOn ? tiltOn : tiltOff)
  const currentAngle = useRef(targetAngle.current)
  const dragging = useRef(false)
  const startAngle = useRef(0)
  const startLocalZ = useRef(0)
  const tmpV3Ref = useRef(new THREE.Vector3())

  // Debounce onToggle while snapping
  const lastEmittedOn = useRef(isOn)

  // Helpers
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
  const midAngle = useMemo(() => 0.5 * (tiltOn + tiltOff), [tiltOn, tiltOff])

  const setOn = (next) => {
    if (controlledOn === undefined) setInternalOn(next)
    if (lastEmittedOn.current !== next) {
      lastEmittedOn.current = next
      onToggle(next)
    }
  }

  // world → local Z in switch group space
  const toLocalZ = (worldPoint) => {
    const tmp = tmpV3Ref.current
    tmp.copy(worldPoint)
    groupRef.current?.worldToLocal(tmp)
    return tmp.z
  }

  // Normalize XR/Pointer event to a world point, when available
  const eventPoint = (e) =>
    (e?.nativeEvent?.point) ??
    (e?.point) ??
    (e?.intersection?.point) ??
    null

  // Pointer/XR events on the knob only (prevents near-miss triggers)
  const onDown = (e) => {
    e.stopPropagation?.()
    if ('buttons' in e && e.buttons !== 1) return
    e.target?.setPointerCapture?.(e.pointerId)
    dragging.current = true
    startAngle.current = currentAngle.current
    const p = eventPoint(e)
    if (p) startLocalZ.current = toLocalZ(p)
  }

  const onUp = (e) => {
    e.stopPropagation?.()
    e.target?.releasePointerCapture?.(e.pointerId)
    dragging.current = false

    // If we didn't already snap while dragging, snap now to closest state
    const snapOn = currentAngle.current >= midAngle
    targetAngle.current = snapOn ? tiltOn : tiltOff
    if (snapOn !== isOn) setOn(snapOn)
  }

  const onMove = (e) => {
    if (!dragging.current) return
    e.stopPropagation?.()
    const p = eventPoint(e)
    if (!p) return
    const z = toLocalZ(p)
    const dz = z - startLocalZ.current

    // Desired angle while dragging
    let desired = clamp(startAngle.current + dz * sensitivity, tiltOff, tiltOn)

    if (snapWhileDragging) {
      const distToOn  = Math.abs(desired - tiltOn)
      const distToOff = Math.abs(desired - tiltOff)

      if (distToOn <= snapThreshold) {
        desired = tiltOn
        targetAngle.current = desired
        if (!isOn) setOn(true)
        return
      }
      if (distToOff <= snapThreshold) {
        desired = tiltOff
        targetAngle.current = desired
        if (isOn) setOn(false)
        return
      }
    }

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

  // Declarative geometry args → R3F owns disposal
  const basePlaneArgs = useMemo(() => [size[0], size[1]], [size])
  const stemCylArgs   = useMemo(() => [stemRadius, stemRadius, stemHeight, 24], [stemRadius, stemHeight])
  const knobSphereArgs= useMemo(() => [knobRadius, 24, 16], [knobRadius])

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <Suspense fallback={null}>
        {/* Base: face up */}
        <mesh ref={baseRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={basePlaneArgs} />
          <meshStandardMaterial color={baseColor} metalness={0.1} roughness={0.8} transparent opacity={0.6} />
        </mesh>

        {/* Hinge at stem base (on top of plate) */}
        <group ref={hingeRef} position={[0, 0, 0]}>
          {/* Stem */}
          <mesh position={[0, stemHeight / 2, 0]} castShadow>
            <cylinderGeometry args={stemCylArgs} />
            <meshStandardMaterial color={stemColor} metalness={0.2} roughness={0.6} />
          </mesh>

          {/* Knob (desktop + XR) */}
          <Interactive
            onSelectStart={(e) => onDown(e.nativeEvent ?? e)}
            onSelectEnd={(e) => onUp(e.nativeEvent ?? e)}
            onMove={(e) => onMove(e.nativeEvent ?? e)}
          >
            <mesh
              position={[0, stemHeight + knobRadius, 0]}
              castShadow
              onPointerDown={onDown}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onPointerOut={onUp}
              onPointerMove={onMove}
            >
              <sphereGeometry args={knobSphereArgs} />
              <meshStandardMaterial color={knobColor} metalness={0.1} roughness={0.4} />
            </mesh>
          </Interactive>
        </group>
      </Suspense>
    </group>
  )
}
