// src/components/roller.jsx
import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import { Interactive } from '@react-three/xr'
import * as THREE from 'three'

/**
 * Roller (stepped)
 * - Desktop: vertical pixel drag.
 * - XR: controller ray drag using intersection local-Z delta.
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

  // desktop drag (pixels)
  const startZPixelRef  = useRef(0)

  // XR drag (local-Z)
  const startLocalZRef  = useRef(0)
  const tmpV3Ref = useRef(new THREE.Vector3())

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

  // helpers
  const toLocalZ = useCallback((worldPoint)=>{
    const tmp = tmpV3Ref.current
    tmp.copy(worldPoint)
    groupRef.current?.worldToLocal(tmp)
    return tmp.z
  }, [])

  const eventPoint = (e) =>
    (e?.nativeEvent?.point) ??
    (e?.point) ??
    (e?.intersection?.point) ??
    null

  const startValRef= useRef(value)

  const beginDrag = useCallback((e)=>{
    pressedRef.current = true
    startValRef.current = value

    if ('clientY' in (e ?? {})) startZPixelRef.current = e.clientY ?? 0

    const p = eventPoint(e)
    if (p) startLocalZRef.current = toLocalZ(p)
  }, [value, toLocalZ])

  const dragMove = useCallback((e)=>{
    if (!pressedRef.current) return
    let next = startValRef.current

    const p = eventPoint(e)
    if (p) {
      // XR: use local-Z delta
      const z = toLocalZ(p)
      const dz = (startLocalZRef.current - z) // forward drag increases value
      const span = range[1]-range[0]
      next = snap(startValRef.current + dz * span * 0.6) // tune feel factor
    } else if ('clientY' in (e ?? {})) {
      // Desktop: vertical pixel delta
      const y = e.clientY ?? 0
      const dz = (startZPixelRef.current - y) / 220
      const span = range[1]-range[0]
      next = snap(startValRef.current + dz * span * 0.25)
    }

    if (next !== value) onChange(next)
  }, [onChange, snap, value, range, toLocalZ])

  const endDrag = useCallback((e)=>{
    pressedRef.current = false
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
      <mesh ref={diskRef} position={[0, diskThickness*0.5 + 0.001, 0]}>
        <cylinderGeometry args={cylArgs} />
        <meshStandardMaterial color={diskColor} metalness={0.1} roughness={0.5} />
      </mesh>

      {/* Interaction catcher (desktop + XR) */}
      <Interactive
        onSelectStart={(e)=>{ beginDrag(e.nativeEvent ?? e) }}
        onSelectEnd={(e)=>{ endDrag(e.nativeEvent ?? e) }}
        onMove={(e)=>{ dragMove(e.nativeEvent ?? e) }}
      >
        <mesh
          position={[0, diskThickness*0.6, 0]}
          onPointerDown={(e)=>{ e.stopPropagation(); beginDrag(e) }}
          onPointerMove={(e)=>{ e.stopPropagation(); dragMove(e) }}
          onPointerUp={(e)=>{ e.stopPropagation(); endDrag(e) }}
          onPointerCancel={(e)=>{ e.stopPropagation(); endDrag(e) }}
        >
          <cylinderGeometry args={[size[0]*0.5, size[0]*0.5, diskThickness*2, 8]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </Interactive>
    </group>
  )
}
