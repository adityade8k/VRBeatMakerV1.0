// button/PressablePlanesButton.jsx
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function PressablePlanesButton({
  onPressed = () => {},
  // Outer transform (you can override these)
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],         // Euler in radians for the whole group
  scale = [1, 1, 1],

  // Button styling/feel
  size = [0.2, 0.2],            // base plate size (width, height) in world units
  buttonScale = 0.7,            // smaller plate size relative to base
  gap = 0.01,                   // initial gap above base (local +Y)
  speed = 12,                   // snappiness
  baseColor = '#60636a',
  buttonColor = '#d9e3f0',
}) {
  const baseRef = useRef()
  const btnRef = useRef()
  const [isPressed, setIsPressed] = useState(false)
  const [armed, setArmed] = useState(false)

  // Geometries (XY by default; we rotate meshes so they face up)
  const geoBase = useMemo(() => new THREE.PlaneGeometry(size[0], size[1]), [size])
  const geoBtn  = useMemo(() => new THREE.PlaneGeometry(size[0] * buttonScale, size[1] * buttonScale), [size, buttonScale])

  // Local-space press axis = Y. initialY is “up,” bottomY is almost on the base.
  const initialY = useRef(gap)
  const bottomY  = useRef(0.0005)

  useEffect(() => {
    if (btnRef.current) {
      btnRef.current.position.y = initialY.current
    }
  }, [])

  useFrame((_, dt) => {
    const btn = btnRef.current
    if (!btn) return
    const from = btn.position.y
    const target = isPressed ? bottomY.current : initialY.current

    const k = 1 - Math.exp(-speed * dt)
    const next = THREE.MathUtils.lerp(from, target, k)
    btn.position.y = next

    const nearBottom = Math.abs(next - bottomY.current) < 0.0008
    if (isPressed && nearBottom && !armed) {
      setArmed(true)
      onPressed()
    }
    if (!isPressed && armed) setArmed(false)
  })

  const onDown = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    setIsPressed(true)
  }
  const onUp = (e) => {
    e.stopPropagation()
    e.target.releasePointerCapture?.(e.pointerId)
    setIsPressed(false)
  }

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      pointerEventsType={{ deny: 'grab' }}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerOut={() => setIsPressed(false)}
      onPointerCancel={onUp}
    >
      <Suspense fallback={null}>
        {/* Base plate: rotate -90° around X so it faces up (+Y normal) */}
        <mesh ref={baseRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <primitive object={geoBase} attach="geometry" />
          <meshStandardMaterial color={baseColor} metalness={0.1} roughness={0.8} />
        </mesh>

        {/* Button plate: same facing, sits slightly above base along local +Y */}
        <mesh ref={btnRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, initialY.current, 0]} castShadow>
          <primitive object={geoBtn} attach="geometry" />
          <meshStandardMaterial color={buttonColor} metalness={0.2} roughness={0.4} />
        </mesh>
      </Suspense>
    </group>
  )
}
