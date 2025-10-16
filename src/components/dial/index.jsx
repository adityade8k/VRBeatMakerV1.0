// src/components/dial.jsx
import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Dial (controlled) — normalized value [0..1]
 * Props:
 * - position, rotation, scale
 * - size=[w,h]
 * - baseColor, dialColor
 * - dialThickness=0.02, dialSegments=16
 * - minAngle=-0.75π, maxAngle=+0.75π
 * - value (0..1), onChange(newValue)
 * - sensitivity=0.5 (drag feel), friction=0.15 (lerp smoothing)
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

  sensitivity=0.5,
  friction=0.15,
}) {
  const groupRef = useRef()
  const knobRef  = useRef()
  const baseRef  = useRef()
  const pressedRef = useRef(false)
  const startYRef  = useRef(0)
  const startValRef= useRef(value)
  const tmpV3Ref   = useRef(new THREE.Vector3())

  // internal smoothed value just for visuals
  const [visual, setVisual] = useState(value)

  // clamp helpers
  const clamp01 = useCallback((v)=>Math.max(0, Math.min(1, v)), [])
  const toAngle = useCallback((t)=> minAngle + (maxAngle-minAngle)*clamp01(t), [minAngle,maxAngle,clamp01])
  const fromAngle = useCallback((a)=> clamp01((a - minAngle) / (maxAngle - minAngle)), [minAngle,maxAngle,clamp01])

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

  // pointer mapping: vertical drag -> value delta
  const onPointerDown = useCallback((e)=>{
    e.stopPropagation()
    pressedRef.current = true
    startYRef.current = e.clientY ?? e.pointer.y ?? 0
    startValRef.current = value
    e.target.setPointerCapture?.(e.pointerId)
  }, [value])

  const onPointerMove = useCallback((e)=>{
    if (!pressedRef.current) return
    const y = e.clientY ?? e.pointer?.y ?? 0
    const dy = (startYRef.current - y) / 200 // pixels to normalized
    const next = clamp01(startValRef.current + dy * sensitivity)
    if (next !== value) onChange(next)
  }, [onChange, sensitivity, value, clamp01])

  const onPointerUp = useCallback((e)=>{
    if (!pressedRef.current) return
    pressedRef.current = false
    e.target.releasePointerCapture?.(e.pointerId)
  }, [])

  // memo geometry args so R3F creates/owns/disposes safely
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
        {/* small indicator tick */}
        <mesh position={[0, dialThickness*0.55, size[0]*0.35]} rotation={[0,0,0]} scale={[0.02,0.02,0.02]}>
          <boxGeometry args={[1,1,1]} />
          <meshBasicMaterial color="white" />
        </mesh>
      </group>

      {/* Interaction catcher */}
      <mesh
        position={[0, dialThickness*0.6, 0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <cylinderGeometry args={[size[0]*0.5, size[0]*0.5, dialThickness*2, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  )
}
