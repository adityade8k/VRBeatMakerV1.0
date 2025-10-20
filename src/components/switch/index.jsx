// switch/ToggleSwitch.jsx
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useDisposable } from '../../hooks/useDisposable'

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
  tiltOn  = +0.6,
  tiltOff = -0.6,
  sensitivity = 30,
  speed = 20,

  // Interaction (defaults changed here)
  mode = 'both',               // default is BOTH
  clickTargets = 'both',       // default click on base + knob

  // State
  isOn: controlledOn,
  defaultOn = false,
  onToggle = () => {},
}) {
  const groupRef  = useRef()
  const baseRef   = useRef()
  const stemRef   = useRef()
  const knobRef   = useRef()
  const hingeRef  = useRef()

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

  useEffect(() => {
    return () => {
      if (baseRef.current) baseRef.current.geometry = null
      if (stemRef.current) stemRef.current.geometry = null
      if (knobRef.current) knobRef.current.geometry = null
    }
  }, [])

  const [internalOn, setInternalOn] = useState(defaultOn)
  const isOn = controlledOn ?? internalOn

  const targetAngle = useRef(isOn ? tiltOn : tiltOff)
  const currentAngle = useRef(targetAngle.current)

  const dragging = useRef(false)
  const startAngle = useRef(0)
  const startLocalZ = useRef(0)

  const pointerDownPos = useRef(new THREE.Vector2())
  const wasDrag        = useRef(false)
  const DRAG_PIXEL_THRESH = 3

  const tmp = useMemo(() => new THREE.Vector3(), [])

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
  const midAngle = useMemo(() => 0.5 * (tiltOn + tiltOff), [tiltOn, tiltOff])

  const setOn = (next) => {
    if (controlledOn === undefined) setInternalOn(next)
    onToggle(next)
  }

  const toLocalZ = (worldPoint) => {
    tmp.copy(worldPoint)
    groupRef.current?.worldToLocal(tmp)
    return tmp.z
  }

  // Drag handlers (always enabled because mode defaults to both)
  const allowDrag = mode === 'drag' || mode === 'both'
  const onDown = (e) => {
    if (!allowDrag) return
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    dragging.current = true
    wasDrag.current = false
    startAngle.current = currentAngle.current
    startLocalZ.current = toLocalZ(e.point)
    pointerDownPos.current.set(e.clientX ?? 0, e.clientY ?? 0)
  }
  const onMove = (e) => {
    if (!allowDrag || !dragging.current) return
    e.stopPropagation()
    const z = toLocalZ(e.point)
    const dz = z - startLocalZ.current
    const desired = clamp(startAngle.current + dz * sensitivity, tiltOff, tiltOn)
    targetAngle.current = desired

    const cx = e.clientX ?? 0, cy = e.clientY ?? 0
    const dx = cx - pointerDownPos.current.x
    const dy = cy - pointerDownPos.current.y
    if (!wasDrag.current && (dx*dx + dy*dy) > (DRAG_PIXEL_THRESH * DRAG_PIXEL_THRESH)) {
      wasDrag.current = true
    }
  }
  const onUp = (e) => {
    if (!allowDrag) return
    e.stopPropagation()
    e.target.releasePointerCapture?.(e.pointerId)
    dragging.current = false
    const snapOn = currentAngle.current >= midAngle
    targetAngle.current = snapOn ? tiltOn : tiltOff
    if (snapOn !== isOn) setOn(snapOn)
  }

  // Click handlers (also enabled by default)
  const allowClick = mode === 'click' || mode === 'both'
  const handleClickToggle = (e) => {
    if (!allowClick) return
    if (allowDrag && wasDrag.current) return
    e.stopPropagation()
    const next = !isOn
    setOn(next)
    targetAngle.current = next ? tiltOn : tiltOff
  }

  useFrame((_, dt) => {
    const hinge = hingeRef.current
    if (!hinge) return
    const k = 1 - Math.exp(-speed * dt)
    currentAngle.current = THREE.MathUtils.lerp(currentAngle.current, targetAngle.current, k)
    hinge.rotation.x = currentAngle.current
  })

  useEffect(() => {
    targetAngle.current = isOn ? tiltOn : tiltOff
  }, [isOn, tiltOn, tiltOff])

  const clickBase = allowClick && (clickTargets === 'base' || clickTargets === 'both')
  const clickKnob = allowClick && (clickTargets === 'knob' || clickTargets === 'both')

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <Suspense fallback={null}>
        {/* Base */}
        <mesh
          ref={baseRef}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          geometry={baseGeo}
          onClick={clickBase ? handleClickToggle : undefined}
        >
          <meshStandardMaterial
            color={baseColor}
            metalness={0.1}
            roughness={0.8}
            transparent
            opacity={0.6}
          />
        </mesh>

        {/* Hinge + moving parts */}
        <group ref={hingeRef} position={[0, 0, 0]}>
          <mesh
            ref={stemRef}
            position={[0, stemHeight / 2, 0]}
            castShadow
            geometry={stemGeo}
          >
            <meshStandardMaterial color={stemColor} metalness={0.2} roughness={0.6} />
          </mesh>

          <mesh
            ref={knobRef}
            position={[0, stemHeight + knobRadius, 0]}
            castShadow
            geometry={knobGeo}
            onPointerDown={allowDrag ? onDown : undefined}
            onPointerUp={allowDrag ? onUp : undefined}
            onPointerCancel={allowDrag ? onUp : undefined}
            onPointerOut={allowDrag ? onUp : undefined}
            onPointerMove={allowDrag ? onMove : undefined}
            onClick={clickKnob ? handleClickToggle : undefined}
          >
            <meshStandardMaterial color={knobColor} metalness={0.1} roughness={0.4} />
          </mesh>
        </group>
      </Suspense>
    </group>
  )
}
