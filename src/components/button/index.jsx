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

  // Toggle behavior guard
  requireBottomForToggle = true,           // only toggle if plate reached bottom during this press
  activationThreshold = 0.9,               // if you want to use a % travel instead of strict "nearBottom"

  // Outer transform
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],

  // Button styling/feel
  size = [0.1, 0.1],
  buttonScale = 0.6,
  gap = 0.01,
  speed = 12,
  baseColor = '#6987f5',
  buttonColor = '#0370ff',
}) {
  const baseRef = useRef()
  const btnRef = useRef()
  const baseMatRef = useRef()
  const btnMatRef = useRef()

  const [isPressed, setIsPressed] = useState(false)
  const [armed, setArmed] = useState(false)       // for onPressed once-per-bottom
  const [isOn, setIsOn] = useState(false)         // for toggle mode

  // New: track whether this press ever reached activation depth
  const committedPressRef = useRef(false)

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

  // Update base plate color when toggle state or mode changes
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

    // Determine activation (either strict near-bottom or threshold)
    const nearBottom = Math.abs(next - bottomY.current) < 0.0008
    const activated = nearBottom || t >= activationThreshold

    // Fire onPressed once at activation, and mark the press as "committed"
    if (isPressed && activated && !armed) {
      setArmed(true)
      committedPressRef.current = true
      onPressed()
    }
    if (!isPressed && armed) setArmed(false)
  })

  const handlePointerDown = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    // Reset commitment for a new press
    committedPressRef.current = false
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
      const canToggle = !requireBottomForToggle || committedPressRef.current
      if (canToggle) {
        setIsOn((prev) => {
          const next = !prev
          onToggle(next)
          return next
        })
      }
    }

    // Always reset after a completed press cycle
    committedPressRef.current = false
  }

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerOut={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <Suspense fallback={null}>
        {/* Base plate */}
        <mesh ref={baseRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <primitive object={geoBase} attach="geometry" />
          <meshStandardMaterial
            ref={baseMatRef}
            color={mode === 'toggle' ? (isOn ? cBaseOn : cBaseOff) : cBaseLongPress}
            metalness={0.1}
            roughness={0.8}
            transparent
            opacity={0.6}
          />
        </mesh>

        {/* Button plate */}
        <mesh ref={btnRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, initialY.current, 0]} castShadow>
          <primitive object={geoBtn} attach="geometry" />
          <meshStandardMaterial
            ref={btnMatRef}
            color={cBtnStart}
            metalness={0.2}
            roughness={0.4}
            
          />
        </mesh>
      </Suspense>
    </group>
  )
}
