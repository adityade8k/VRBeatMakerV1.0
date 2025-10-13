// button/PressablePlanesButton.jsx
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function PressablePlanesButton({
  // Variant & callbacks
  mode = 'long-press',                     // 'long-press' | 'toggle'
  onPressed = () => {},                    // fires once when the plate reaches the base (bottom)
  onPressDown = () => {},                  // long-press only
  onPressUp = () => {},                    // long-press only
  onToggle = () => {},                     // toggle only (onToggle(isOn))

  // Outer transform
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],

  // Button styling/feel
  size = [0.1, 0.1],            // base plate size (width, height) in world units
  buttonScale = 0.6,            // smaller plate size relative to base
  gap = 0.01,                   // initial gap above base (local +Y)
  speed = 12,                   // snappiness
  baseColor = '#6987f5',        // used in long-press mode only
  buttonColor = '#0370ff',    // starting color for button plate; lerps to yellow as it goes down
}) {
  const baseRef = useRef()
  const btnRef = useRef()
  const baseMatRef = useRef()
  const btnMatRef = useRef()

  const [isPressed, setIsPressed] = useState(false)
  const [armed, setArmed] = useState(false)       // for onPressed once-per-bottom
  const [isOn, setIsOn] = useState(false)         // for toggle mode

  // Geometries
  const geoBase = useMemo(() => new THREE.PlaneGeometry(size[0], size[1]), [size])
  const geoBtn  = useMemo(() => new THREE.PlaneGeometry(size[0] * buttonScale, size[1] * buttonScale), [size, buttonScale])

  // Positions along local +Y (pressed goes toward bottomY)
  const initialY = useRef(gap)
  const bottomY  = useRef(0.0005)

  // Colors
  const cBtnStart = useMemo(() => new THREE.Color(buttonColor), [buttonColor])
  const cBtnTarget = useMemo(() => new THREE.Color('#FFD400'), [])   // yellow target when fully pressed
  const cBaseLongPress = useMemo(() => new THREE.Color(baseColor), [baseColor])
  const cBaseOn  = useMemo(() => new THREE.Color('#2ecc71'), [])     // green
  const cBaseOff = useMemo(() => new THREE.Color('#e74c3c'), [])     // red

  // Initialize button height
  useEffect(() => {
    if (btnRef.current) btnRef.current.position.y = initialY.current
  }, [])

  // Update base plate color when toggle state changes
  useEffect(() => {
    const mat = baseMatRef.current
    if (!mat) return
    if (mode === 'toggle') {
      mat.color.copy(isOn ? cBaseOn : cBaseOff)
    } else {
      mat.color.copy(cBaseLongPress)
    }
  }, [mode, isOn, cBaseOn, cBaseOff, cBaseLongPress])

  useFrame((_, dt) => {
    const btn = btnRef.current
    const btnMat = btnMatRef.current
    if (!btn || !btnMat) return

    // Spring-ish lerp for position
    const from = btn.position.y
    const target = isPressed ? bottomY.current : initialY.current
    const k = 1 - Math.exp(-speed * dt)
    const next = THREE.MathUtils.lerp(from, target, k)
    btn.position.y = next

    // Normalized press progress (0 at top, 1 at bottom)
    const travel = Math.max(1e-6, initialY.current - bottomY.current)
    const t = THREE.MathUtils.clamp((initialY.current - next) / travel, 0, 1)

    // Lerp the button plate color toward yellow as it goes down
    btnMat.color.copy(cBtnStart).lerp(cBtnTarget, t)

    // Fire onPressed exactly once when reaching bottom during a press
    const nearBottom = Math.abs(next - bottomY.current) < 0.0008
    if (isPressed && nearBottom && !armed) {
      setArmed(true)
      onPressed()
    }
    if (!isPressed && armed) setArmed(false)
  })

  const handlePointerDown = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    setIsPressed(true)
    if (mode === 'long-press') onPressDown()
  }

  const handlePointerUp = (e) => {
    e.stopPropagation()
    e.target.releasePointerCapture?.(e.pointerId)
    setIsPressed(false)

    if (mode === 'long-press') {
      onPressUp()
    } else if (mode === 'toggle') {
      setIsOn((prev) => {
        const next = !prev
        onToggle(next)
        return next
      })
    }
  }

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerOut={() => setIsPressed(false)}
      onPointerCancel={handlePointerUp}
    >
      <Suspense fallback={null}>
        {/* Base plate: rotate -90° around X so it faces up (+Y normal) */}
        <mesh ref={baseRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <primitive object={geoBase} attach="geometry" />
          <meshStandardMaterial
            ref={baseMatRef}
            color={mode === 'toggle' ? (isOn ? cBaseOn : cBaseOff) : cBaseLongPress}
            metalness={0.1}
            roughness={0.8}
          />
        </mesh>

        {/* Button plate: sits slightly above base along local +Y, lerps color to yellow as pressed */}
        <mesh ref={btnRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, initialY.current, 0]} castShadow>
          <primitive object={geoBtn} attach="geometry" />
          <meshStandardMaterial
            ref={btnMatRef}
            color={cBtnStart}
            metalness={0.2}
            roughness={0.4}
            transparent
            opacity={0.6}
          />
        </mesh>
      </Suspense>
    </group>
  )
}
