// components/dial.jsx
import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useDisposable } from '../../hooks/useDisposable' // adjust alias if needed

/**
 * Continuous, WRAPPING Dial (spin around Y)
 * - Drag in a circular motion; emits continuous values (no stepping).
 * - When wrap=true (default): crossing maxAngle jumps to minAngle, and vice-versa.
 * - Value ↔ angle mapping is linear within the sweep and wraps.
 */
export default function Dial({
  // Transform
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale    = [1, 1, 1],

  // Visuals
  size = [0.1, 0.1],
  baseColor = '#324966',
  dialColor = '#f08c00',
  dialThickness = 0.02,
  dialSegments  = 12,

  // Value space
  range = [0, 1],

  // Angular limits for the knob sweep
  minAngle = -Math.PI * 0.75,
  maxAngle =  Math.PI * 0.75,

  // Behavior
  wrap = true, // <-- NEW: wrap within [minAngle, maxAngle]

  // Controlled value (domain units)
  value = 0,

  onChange = () => {},
}) {
  const groupRef = useRef()
  const dialRef  = useRef()
  const tmpVec   = useRef(new THREE.Vector3())

  const [minV, maxV] = range
  const clampV = (x) => Math.min(maxV, Math.max(minV, x))

  const spanA = maxAngle - minAngle
  const spanV = maxV - minV
  const EPS = 1e-9

  // --- helpers: angle/value conversions & wrapping
  const wrapA = (a) => {
    if (!wrap) return Math.min(maxAngle, Math.max(minAngle, a))
    let n = a - minAngle
    n = ((n % spanA) + spanA) % spanA
    return minAngle + n
  }

  const v2a = (v) => {
    const t = (v - minV) / Math.max(EPS, spanV)
    // project inside sweep (t can be outside if caller misuses value; still wrap)
    return wrapA(minAngle + t * spanA)
  }

  const a2v = (a) => {
    const aa = wrapA(a)
    const t  = (aa - minAngle) / Math.max(EPS, spanA)
    // wrap value into [minV, maxV]
    const raw = minV + t * spanV
    if (!wrap) return clampV(raw)
    let nv = raw
    // (value already in range since t∈[0,1], but keep symmetry with wrapA)
    if (nv < minV) nv = maxV - ((minV - nv) % spanV)
    if (nv > maxV) nv = minV + ((nv - minV) % spanV)
    return nv
  }

  // Geometries (disposable)
  const baseGeo = useDisposable(
    () => new THREE.PlaneGeometry(size[0], size[1]),
    [size[0], size[1]]
  )
  const radius = useMemo(() => Math.min(size[0], size[1]) * 0.45, [size])
  const dialGeo = useDisposable(
    () => new THREE.CylinderGeometry(radius, radius, dialThickness, dialSegments),
    [radius, dialThickness, dialSegments]
  )

  // GC-friendly teardown
  useEffect(() => {
    return () => {
      if (dialRef.current) dialRef.current.geometry = null
    }
  }, [])

  // Keep visual in sync with controlled value
  useEffect(() => {
    if (!dialRef.current) return
    dialRef.current.rotation.y = v2a(value)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Interaction state
  const isActive     = useRef(false)
  const startAngle   = useRef(0) // dial angle at pointer down (wrapped)
  const startPointer = useRef(0) // pointer polar angle at pointer down

  // helper: local polar angle from world point (around Y)
  const localAngleFromWorldPoint = (worldPoint) => {
    const v = tmpVec.current.copy(worldPoint)
    groupRef.current?.worldToLocal(v)
    // atan2(x, z) so that rotation.y matches positive left→right spin
    return Math.atan2(v.x, v.z)
  }

  const shortestAngularDelta = (to, from) => {
    // wrap difference to [-π, π]
    let d = to - from
    d = Math.atan2(Math.sin(d), Math.cos(d))
    return d
  }

  const onDown = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    isActive.current = true
    // ensure we start from a wrapped angle for consistency
    const current = dialRef.current?.rotation.y ?? v2a(value)
    startAngle.current   = wrapA(current)
    startPointer.current = localAngleFromWorldPoint(e.point)
  }

  const onUpOrOut = (e) => {
    e.stopPropagation()
    e.target?.releasePointerCapture?.(e.pointerId)
    isActive.current = false
  }

  const onMove = (e) => {
    if (!isActive.current) return
    e.stopPropagation()

    const curPointer = localAngleFromWorldPoint(e.point)
    const dA = shortestAngularDelta(curPointer, startPointer.current)

    // WRAP instead of clamp
    const newAngle = wrapA(startAngle.current + dA)

    // Optimistic visual update
    if (dialRef.current) dialRef.current.rotation.y = newAngle

    // Emit continuous value (wrapped)
    const nextV = a2v(newAngle)
    if (nextV !== value) onChange(nextV)
  }

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={baseGeo}>
        <meshStandardMaterial
          color={baseColor}
          metalness={0.1}
          roughness={0.8}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* dial */}
      <mesh
        ref={dialRef}
        position={[0, dialThickness * 0.5 + 0.001, 0]}
        castShadow
        geometry={dialGeo}
        onPointerDown={onDown}
        onPointerUp={onUpOrOut}
        onPointerCancel={onUpOrOut}
        onPointerOut={onUpOrOut}
        onPointerMove={onMove}
      >
        <meshStandardMaterial color={dialColor} metalness={0.35} roughness={0.45} />
      </mesh>
    </group>
  )
}
