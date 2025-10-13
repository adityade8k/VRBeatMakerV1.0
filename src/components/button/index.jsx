// button/ButtonComponent.jsx
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

export default function ButtonComponent({
  onPressed = () => {},
  travel = 0.012,          // press depth in local units (pre-scale)
  speed = 10,              // snappiness
  scale = [0.035, 0.035, 0.035],
  position = [0, 1, -0.5],
}) {
  const { scene } = useGLTF('/models/button.glb')
  const cloned = useMemo(() => scene.clone(true), [scene])

  // Find child named "button" (tolerates earlier "buuton" typo).
  const moving = useMemo(
    () => cloned.getObjectByName('button') || cloned.getObjectByName('buuton') || null,
    [cloned]
  )

  const [isPressed, setIsPressed] = useState(false)
  const initialY = useRef(0)
  const fired = useRef(false)

  useEffect(() => {
    if (!moving) {
      console.warn('Button child "button"/"buuton" not found in button.glb')
      return
    }
    moving.matrixAutoUpdate = true
    initialY.current = moving.position.y
  }, [moving])

  useFrame((_, dt) => {
    if (!moving) return
    const from = moving.position.y
    const target = isPressed ? initialY.current - Math.abs(travel) : initialY.current
    const k = 1 - Math.exp(-speed * dt)
    const next = THREE.MathUtils.lerp(from, target, k)
    moving.position.y = next

    const nearBottom = Math.abs(next - (initialY.current - Math.abs(travel))) < 0.001
    if (isPressed && nearBottom && !fired.current) {
      fired.current = true
      onPressed()
    }
    if (!isPressed) fired.current = false
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
      pointerEventsType={{ deny: 'grab' }}  // keep grabs from stealing the event
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerOut={() => setIsPressed(false)}
      position={position}
    >
      <Suspense fallback={null}>
        <group scale={scale}>
          <primitive object={cloned} />
        </group>
      </Suspense>
    </group>
  )
}
