// button/PressablePlanesButton.jsx
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function PressablePlanesButton({
  onPressed = () => {},
  position = [0, 1, -0.5],
  size = [0.2, 0.2],     // base plate size (width, height) in world units
  buttonScale = 0.7,     // smaller plane scale relative to base
  gap = 0.01,            // initial gap above base
  speed = 12,            // snappiness of animation
  baseColor = '#60636a',
  buttonColor = '#d9e3f0',
}) {
  const baseRef = useRef()
  const btnRef = useRef()
  const [isPressed, setIsPressed] = useState(false)
  const [armed, setArmed] = useState(false) // allow callback once per press

  // Precompute geometry to avoid re-alloc each render
  const geoBase = useMemo(() => new THREE.PlaneGeometry(size[0], size[1]), [size])
  const geoBtn  = useMemo(() => new THREE.PlaneGeometry(size[0] * buttonScale, size[1] * buttonScale), [size, buttonScale])

  // Initial & bottom Y positions (local to the group)
  const initialY = useRef(gap)
  const bottomY  = useRef(0.0005) // tiny epsilon to avoid z-fighting with base

  useEffect(() => {
    if (btnRef.current) {
      btnRef.current.position.y = initialY.current
    }
  }, [])

  // Animate button toward target each frame
  useFrame((_, dt) => {
    const btn = btnRef.current
    if (!btn) return
    const from = btn.position.y
    const target = isPressed ? bottomY.current : initialY.current

    // smooth exponential approach (frame-rate independent)
    const k = 1 - Math.exp(-speed * dt)
    const next = THREE.MathUtils.lerp(from, target, k)
    btn.position.y = next

    // fire once when we hit bottom during a press
    const nearBottom = Math.abs(next - bottomY.current) < 0.0008
    if (isPressed && nearBottom && !armed) {
      setArmed(true)
      onPressed()
    }
    // reset arming after release
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
      // unified pointer events in XR & desktop; deny grabs so pokes/clicks win
      pointerEventsType={{ deny: 'grab' }}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerOut={() => setIsPressed(false)}
      onPointerCancel={onUp}
    >
      <Suspense fallback={null}>
        {/* Base plate (XY plane, facing +Z). Keep at y≈0. */}
        <mesh ref={baseRef} rotation={[-Math.PI * 0, 0, 0]} receiveShadow>
          <primitive object={geoBase} attach="geometry" />
          <meshStandardMaterial color={baseColor} metalness={0.1} roughness={0.8} />
        </mesh>

        {/* Button plate slightly above base on +Y, same facing */}
        <mesh ref={btnRef} position={[0, initialY.current, 0]} castShadow>
          <primitive object={geoBtn} attach="geometry" />
          <meshStandardMaterial color={buttonColor} metalness={0.2} roughness={0.4} />
        </mesh>
      </Suspense>
    </group>
  )
}
