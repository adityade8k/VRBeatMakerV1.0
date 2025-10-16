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
  activationThreshold = 0.9,

  position = [0, 1, -0.6],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],

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
  const [armed, setArmed] = useState(false)
  const [isOn, setIsOn] = useState(false)
  const committedPressRef = useRef(false)

  const geoBase = useMemo(() => new THREE.PlaneGeometry(size[0], size[1]), [size])
  const geoBtn  = useMemo(() => new THREE.PlaneGeometry(size[0] * buttonScale, size[1] * buttonScale), [size, buttonScale])

  const initialY = useRef(gap)
  const bottomY  = useRef(0.0005)

  const cBtnStart = useMemo(() => new THREE.Color(buttonColor), [buttonColor])
  const cBtnTarget = useMemo(() => new THREE.Color('#FFD400'), [])
  const cBaseLongPress = useMemo(() => new THREE.Color(baseColor), [baseColor])
  const cBaseOn  = useMemo(() => new THREE.Color('#2ecc71'), [])
  const cBaseOff = useMemo(() => new THREE.Color('#e74c3c'), [])

  const displayIsOn = controlledIsOn ?? isOn

  useEffect(() => {
    if (btnRef.current) btnRef.current.position.y = initialY.current
  }, [])

  useEffect(() => {
    const mat = baseMatRef.current
    if (!mat) return
    if (mode === 'toggle') mat.color.copy(displayIsOn ? cBaseOn : cBaseOff)
    else mat.color.copy(cBaseLongPress)
  }, [mode, displayIsOn, cBaseOn, cBaseOff, cBaseLongPress])

  useFrame((_, dt) => {
    const btn = btnRef.current
    const btnMat = btnMatRef.current
    if (!btn || !btnMat) return

    const from = btn.position.y
    const target = isPressed ? bottomY.current : initialY.current
    const k = 1 - Math.exp(-speed * dt)
    const next = THREE.MathUtils.lerp(from, target, k)
    btn.position.y = next

    const travel = Math.max(1e-6, initialY.current - bottomY.current)
    const t = THREE.MathUtils.clamp((initialY.current - next) / travel, 0, 1)
    btnMat.color.copy(cBtnStart).lerp(cBtnTarget, t)

    const nearBottom = Math.abs(next - bottomY.current) < 0.0008
    const activated = nearBottom || t >= activationThreshold

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
        if (controlledIsOn !== undefined) onToggle(next)
        else { setIsOn(next); onToggle(next) }
      }
    }
    committedPressRef.current = false
  }

  const labelFontW = useMemo(() => (size[0] * buttonScale) * labelScale, [size, buttonScale, labelScale])
  const maxChars = Math.max(1, Math.floor((size[0] * buttonScale * 0.9) / labelFontW))

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
            color={mode === 'toggle' ? (displayIsOn ? cBaseOn : cBaseOff) : cBaseLongPress}
            metalness={0.1}
            roughness={0.8}
            transparent
            opacity={0.6}
          />
        </mesh>

        {/* Button plate */}
        <mesh ref={btnRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, initialY.current, 0]} castShadow>
          <primitive object={geoBtn} attach="geometry" />
          <meshStandardMaterial ref={btnMatRef} metalness={0.2} roughness={0.4} color={cBtnStart} />

          {/* Label (bitmap) — sits just above the button plane; no extra rotation needed */}
          {showLabel && label && (
            <group position={[0, 0, labelYOffset]}>
              <BitmapText
                text={label}
                // leave at (0,0,0) — we center via align
                position={[0, 0, 0.001]}
                rotation={[Math.PI, 0, 0]}
                scale={[labelFontW, labelFontW, labelFontW]}
                color={labelColor}
                align="center"
                anchorY="middle"
                maxWidth={Math.max(1, Math.floor((size[0] * buttonScale * 0.9) / labelFontW))}
              />
            </group>
          )}
        </mesh>
      </Suspense>
    </group>
  )
}
