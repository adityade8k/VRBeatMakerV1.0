import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import BitmapText from '../bitmapText'

export default function PressablePlanesButton({
  // Variant & callbacks
  mode = 'long-press',                     // 'long-press' | 'toggle'
  onPressed = () => {},
  onPressDown = () => {},
  onPressUp = () => {},
  onToggle = () => {},

  controlledIsOn = undefined,

  requireBottomForToggle = true,
  activationThreshold = 0.9,               // % travel needed to "commit" a press

  // Transform
  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],

  // Visuals
  size = [0.1, 0.1],
  buttonScale = 0.6,
  gap = 0.01,
  speed = 12,
  baseColor = '#6987f5',
  buttonColor = '#0370ff',

  // Label
  showLabel = false,
  label = '',
  labelColor = '#ffffff',
  labelScale = 0.35,      // relative to button width
  labelYOffset = 0.0015,
}) {
  const baseRef = useRef()
  const btnRef = useRef()
  const baseMatRef = useRef()
  const btnMatRef = useRef()

  const [isPressed, setIsPressed] = useState(false)
  const [armed, setArmed] = useState(false)           // true once activation threshold hit (per press)
  const [isOn, setIsOn] = useState(false)             // uncontrolled toggle state
  const committedPressRef = useRef(false)             // set true once this press reached the bottom/threshold

  // Travel positions
  const initialY = useRef(gap)
  const bottomY  = useRef(0.0005)

  // Colors (memoized)
  const cBtnStart = useMemo(() => new THREE.Color(buttonColor), [buttonColor])
  const cBtnTarget = useMemo(() => new THREE.Color('#FFD400'), [])
  const cBaseLongPress = useMemo(() => new THREE.Color(baseColor), [baseColor])
  const cBaseOn  = useMemo(() => new THREE.Color('#2ecc71'), [])
  const cBaseOff = useMemo(() => new THREE.Color('#e74c3c'), [])

  const displayIsOn = controlledIsOn ?? isOn

  // Initialize button starting position
  useEffect(() => {
    if (btnRef.current) btnRef.current.position.y = initialY.current
  }, [])

  // Base color reflects mode and toggle state
  useEffect(() => {
    const mat = baseMatRef.current
    if (!mat) return
    if (mode === 'toggle') mat.color.copy(displayIsOn ? cBaseOn : cBaseOff)
    else mat.color.copy(cBaseLongPress)
  }, [mode, displayIsOn, cBaseOn, cBaseOff, cBaseLongPress])

  // Animate press up/down + color blend
  useFrame((_, dt) => {
    const btn = btnRef.current
    const btnMat = btnMatRef.current
    if (!btn || !btnMat) return

    const from = btn.position.y
    const target = isPressed ? bottomY.current : initialY.current
    const k = 1 - Math.exp(-speed * dt)
    const next = THREE.MathUtils.lerp(from, target, k)
    btn.position.y = next

    // Lerp button color by travel %
    const travel = Math.max(1e-6, initialY.current - bottomY.current)
    const t = THREE.MathUtils.clamp((initialY.current - next) / travel, 0, 1)
    btnMat.color.copy(cBtnStart).lerp(cBtnTarget, t)

    // Activate once sufficiently near bottom (or threshold % of travel)
    const nearBottom = Math.abs(next - bottomY.current) < 0.0008
    const activated = nearBottom || t >= activationThreshold

    if (isPressed && activated && !armed) {
      setArmed(true)
      committedPressRef.current = true
      onPressed()
    }
    if (!isPressed && armed) setArmed(false)
  })

  // ——— Pointer handlers (attached ONLY to the small button plate) ———
  const handlePointerDown = (e) => {
    e.stopPropagation()
    // Only react to primary pointer
    if ('buttons' in e && e.buttons !== 1) return
    e.target.setPointerCapture?.(e.pointerId)
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
        const next = !(controlledIsOn ?? isOn)
        if (controlledIsOn !== undefined) onToggle(next)        // controlled
        else { setIsOn(next); onToggle(next) }                  // uncontrolled
      }
    }
    committedPressRef.current = false
  }

  // Prevent accidental toggles when just “near” the control:
  // We do NOT attach handlers on the outer group or the base plate.
  const handlePointerCancel = (e) => {
    e.stopPropagation()
    try { e.target.releasePointerCapture?.(e.pointerId) } catch {}
    setIsPressed(false)
    committedPressRef.current = false
    if (mode === 'long-press') onPressUp()
  }

  // Geometry args (declarative → R3F owns and disposes)
  const basePlaneArgs = useMemo(() => [size[0], size[1]], [size])
  const btnPlaneArgs  = useMemo(() => [size[0] * buttonScale, size[1] * buttonScale], [size, buttonScale])

  // Label sizing
  const labelFontW = useMemo(() => (size[0] * buttonScale) * labelScale, [size, buttonScale, labelScale])

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Suspense fallback={null}>
        {/* Base plate (no pointer handlers here to avoid near-trigger) */}
        <mesh ref={baseRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={basePlaneArgs} />
          <meshStandardMaterial
            ref={baseMatRef}
            color={mode === 'toggle' ? (displayIsOn ? cBaseOn : cBaseOff) : cBaseLongPress}
            metalness={0.1}
            roughness={0.8}
            transparent
            opacity={0.6}
          />
        </mesh>

        {/* Button plate (all pointer handlers here) */}
        <mesh
          ref={btnRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, initialY.current, 0]}
          castShadow
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerOut={handlePointerCancel}
          onPointerCancel={handlePointerCancel}
        >
          <planeGeometry args={btnPlaneArgs} />
          <meshStandardMaterial ref={btnMatRef} metalness={0.2} roughness={0.4} color={cBtnStart} />

          {/* Label (bitmap) */}
          {showLabel && label && (
            <group position={[0, 0, labelYOffset]}>
              <BitmapText
                text={label}
                position={[0, 0, 0.001]}
                rotation={[Math.PI, 0, 0]}
                scale={[labelFontW, labelFontW, labelFontW]}
                color={labelColor}
                align="center"
                anchorY="middle"
                maxWidth={size[0] * buttonScale * 0.9}
              />
            </group>
          )}
        </mesh>
      </Suspense>
    </group>
  )
}
