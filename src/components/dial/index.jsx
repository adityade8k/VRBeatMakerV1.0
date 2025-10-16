// src/components/dial.jsx
import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import { Interactive } from '@react-three/xr'
import * as THREE from 'three'

/**
 * Dial (controlled) — normalized value [0..1]
 * - Desktop: pointer drag (vertical pixels).
 * - XR: controller ray drag using intersection local-Y delta.
 */
export default function Dial({
  position=[0,1,-0.6],
  rotation=[0,0,0],
  scale=[1,1,1],

  size=[0.1,0.1],
  baseColor='#6987f5',
  dialColor='#f08c00',
  dialThickness=0.02,
  dialSegments=16,

  minAngle=-Math.PI*0.75,
  maxAngle= Math.PI*0.75,

  value=0,                 // controlled 0..1
  onChange=()=>{},

  sensitivity=0.5,         // desktop (pixels → value)
  friction=0.15,           // visual lerp
}) {
  const groupRef = useRef()
  const knobRef  = useRef()
  const baseRef  = useRef()
  const pressedRef = useRef(false)

  // Desktop drag
  const startYRef   = useRef(0)

  // XR drag (use local Y from controller-ray intersection)
  const startLocalYRef = useRef(0)
  const tmpV3Ref   = useRef(new THREE.Vector3())

  // internal smoothed value just for visuals
  const [visual, setVisual] = useState(value)

  const clamp01  = useCallback((v)=>Math.max(0, Math.min(1, v)), [])
  const toAngle  = useCallback((t)=> minAngle + (maxAngle-minAngle)*clamp01(t), [minAngle,maxAngle,clamp01])

  // smooth visuals toward controlled value
  useEffect(()=>{
    let raf = 0
    const tick = () => {
      setVisual(v => {
        const next = v + (value - v) * friction
        return Math.abs(next - value) < 1e-4 ? value : next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, friction])

  // apply visual angle updates (no side-effects in render)
  useEffect(()=>{
    const knob = knobRef.current
    if (!knob) return
    knob.rotation.y = toAngle(visual)
  }, [visual, toAngle])

  // helpers
  const toLocalY = useCallback((worldPoint)=>{
    const tmp = tmpV3Ref.current
    tmp.copy(worldPoint)
    groupRef.current?.worldToLocal(tmp)
    return tmp.y
  }, [])

  const eventPoint = (e) =>
    (e?.nativeEvent?.point) ??
    (e?.point) ??
    (e?.intersection?.point) ??
    null

  // common handlers (desktop + XR)
  const startValRef = useRef(value)

  const beginDrag = useCallback((e)=>{
    pressedRef.current = true
    startValRef.current = value

    // desktop pointer (pixel y)
    if ('clientY' in (e ?? {})) startYRef.current = e.clientY ?? 0

    // XR (or pointer with raycast point)
    const p = eventPoint(e)
    if (p) startLocalYRef.current = toLocalY(p)
  }, [value, toLocalY])

  const dragMove = useCallback((e)=>{
    if (!pressedRef.current) return

    let next = startValRef.current

    // Prefer XR local-Y if we have a world intersection point
    const p = eventPoint(e)
    if (p) {
      const y = toLocalY(p)
      const dy = (y - startLocalYRef.current) // local-space meters
      // Map meters to value; tune factor for feel
      next = clamp01(startValRef.current + dy * 1.2)
    } else if ('clientY' in (e ?? {})) {
      // Desktop fallback: pixel delta
      const y = e.clientY ?? 0
      const dy = (startYRef.current - y) / 200
      next = clamp01(startValRef.current + dy * sensitivity)
    }

    if (next !== value) onChange(next)
  }, [onChange, sensitivity, value, clamp01, toLocalY])

  const endDrag = useCallback((e)=>{
    pressedRef.current = false
  }, [])

  // geometry (declarative → auto-dispose)
  const planeArgs = useMemo(()=>[size[0], size[1]], [size])
  const cylArgs   = useMemo(()=>[
    size[0]*0.4,            // radiusTop
    size[0]*0.4,            // radiusBottom
    dialThickness,          // height
    Math.max(8, dialSegments)
  ], [size, dialThickness, dialSegments])

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Base plate (lies on XZ) */}
      <mesh ref={baseRef} rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={planeArgs} />
        <meshBasicMaterial color={baseColor} />
      </mesh>

      {/* Knob (rotates around Y) */}
      <group ref={knobRef} position={[0, dialThickness*0.5 + 0.001, 0]}>
        <mesh>
          <cylinderGeometry args={cylArgs} />
          <meshStandardMaterial color={dialColor} metalness={0.1} roughness={0.6} />
        </mesh>
        <mesh position={[0, dialThickness*0.55, size[0]*0.35]} scale={[0.02,0.02,0.02]}>
          <boxGeometry args={[1,1,1]} />
          <meshBasicMaterial color="white" />
        </mesh>
      </group>

      {/* Interaction catcher (desktop + XR) */}
      <Interactive
        onSelectStart={(e)=>{ beginDrag(e.nativeEvent ?? e) }}
        onSelectEnd={(e)=>{ endDrag(e.nativeEvent ?? e) }}
        onMove={(e)=>{ dragMove(e.nativeEvent ?? e) }}
      >
        <mesh
          position={[0, dialThickness*0.6, 0]}
          onPointerDown={(e)=>{ e.stopPropagation(); beginDrag(e) }}
          onPointerMove={(e)=>{ e.stopPropagation(); dragMove(e) }}
          onPointerUp={(e)=>{ e.stopPropagation(); endDrag(e) }}
          onPointerCancel={(e)=>{ e.stopPropagation(); endDrag(e) }}
        >
          <cylinderGeometry args={[size[0]*0.5, size[0]*0.5, dialThickness*2, 8]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </Interactive>
    </group>
  )
}
