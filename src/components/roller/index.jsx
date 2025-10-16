// src/components/roller.jsx
import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import * as THREE from 'three'

/**
 * Roller (stepped)
 * Props:
 * - position, rotation, scale
 * - size=[w,h]; baseColor, diskColor
 * - range=[min,max], step (value tick), stepAngle (visual)
 * - value (number), onChange(number)
 *
 * Behavior:
 * - Drag forward/back (local Z) to rotate the disk.
 * - Emits stepped values; only one change per step crossing.
 */
export default function Roller({
  position=[0,1,-0.6],
  rotation=[0,0,0],
  scale=[1,1,1],

  size=[0.1,0.1],
  baseColor='#324966',
  diskColor='#fc45c8',
  diskThickness=0.035,
  diskSegments=8,

  range=[0,1],
  step=0.05,
  stepAngle=Math.PI/4.5,   // ~10°

  value=0,
  onChange=()=>{},
}) {
  const groupRef = useRef()
  const diskRef  = useRef()
  const pressedRef = useRef(false)
  const startZRef  = useRef(0)
  const startValRef= useRef(value)
  const tmpV3Ref   = useRef(new THREE.Vector3())

  const clamp = useCallback((v, a, b)=>Math.max(a, Math.min(b, v)), [])
  const snap  = useCallback((v)=>{
    const t = Math.round((v - range[0]) / step) * step + range[0]
    const fixed = Number((Math.round(t/step)*step).toFixed(6))
    return clamp(fixed, range[0], range[1])
  }, [range, step, clamp])

  // visual angle smoothing
  const [angle, setAngle] = useState(0)
  const targetAngle = useMemo(()=>{
    const t = (value - range[0]) / (range[1] - range[0] || 1)
    const ticks = Math.round(t / (step / (range[1]-range[0] || 1)))
    return ticks * stepAngle
  }, [value, range, step, stepAngle])

  useEffect(()=>{
    let raf=0
    const tick=()=>{
      setAngle(a=>{
        const next = a + (targetAngle - a) * 0.2
        return Math.abs(next - targetAngle) < 1e-4 ? targetAngle : next
      })
      raf=requestAnimationFrame(tick)
    }
    raf=requestAnimationFrame(tick)
    return ()=>cancelAnimationFrame(raf)
  }, [targetAngle])

  useEffect(()=>{
    if (diskRef.current) {
      diskRef.current.rotation.x = angle
    }
  }, [angle])

  const onPointerDown = useCallback((e)=>{
    e.stopPropagation()
    pressedRef.current = true
    startZRef.current = e.clientY ?? e.pointer?.y ?? 0 // use vertical motion to avoid camera-parallax confusion
    startValRef.current = value
    e.target.setPointerCapture?.(e.pointerId)
  }, [value])

  const onPointerMove = useCallback((e)=>{
    if (!pressedRef.current) return
    const z = e.clientY ?? e.pointer?.y ?? 0
    const dz = (startZRef.current - z) / 220 // pixels → value
    const span = range[1]-range[0]
    const next = snap(startValRef.current + dz * span * 0.25) // feel factor
    if (next !== value) onChange(next)
  }, [onChange, snap, value, range])

  const onPointerUp = useCallback((e)=>{
    if (!pressedRef.current) return
    pressedRef.current = false
    e.target.releasePointerCapture?.(e.pointerId)
  }, [])

  const planeArgs = useMemo(()=>[size[0], size[1]], [size])
  const cylArgs   = useMemo(()=>[
    size[0]*0.35, size[0]*0.35, diskThickness, Math.max(8, diskSegments)
  ], [size, diskThickness, diskSegments])

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Base plate */}
      <mesh rotation={[-Math.PI/2,0,0]}>
        <planeGeometry args={planeArgs} />
        <meshBasicMaterial color={baseColor} />
      </mesh>

      {/* Disk that spins around X */}
      <mesh ref={diskRef} position={[0, diskThickness*0.5 + 0.001, 0]} rotation={[0,0,Math.PI/2]}>
        <cylinderGeometry args={cylArgs} />
        <meshStandardMaterial color={diskColor} metalness={0.1} roughness={0.5} />
      </mesh>

      {/* Interaction catcher */}
      <mesh
        position={[0, diskThickness*0.6, 0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <cylinderGeometry args={[size[0]*0.5, size[0]*0.5, diskThickness*2, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  )
}
