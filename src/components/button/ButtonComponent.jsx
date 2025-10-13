import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

export default function ButtonComponent({ onPress = () => {}, travel = 0.012, speed = 10 }) {
  const { scene } = useGLTF('/models/button.glb')

  // Clone so we can safely mutate child transforms without touching the cache
  const cloned = useMemo(() => scene.clone(true), [scene])
  const rootRef = useRef()
  const [isPressed, setIsPressed] = useState(false)

  // Locate the movable child ("buuton") and remember its initial local Y
  const buuton = useMemo(() => cloned.getObjectByName('buuton') || null, [cloned])
  const initialYRef = useRef(0)

  useEffect(() => {
    if (!buuton) {
      console.warn('ButtonComponent: child named "buuton" not found in /models/button.glb')
      return
    }
    buuton.matrixAutoUpdate = true
    // Store initial local Y so we can animate relative to it
    initialYRef.current = buuton.position.y
  }, [buuton])

  // Smoothly animate toward target Y each frame
  useFrame((_, dt) => {
    if (!buuton) return
    const from = buuton.position.y
    const target = isPressed
      ? initialYRef.current - Math.abs(travel) // press = move down along +parentY
      : initialYRef.current // release = return to rest

    // Exponential approach (frame-rate independent)
    const k = 1 - Math.exp(-speed * dt)
    buuton.position.y = THREE.MathUtils.lerp(from, target, k)
    buuton.updateMatrix()
  })

  const handlePointerDown = (e) => {
    e.stopPropagation()
    if (!buuton) return
    setIsPressed(true)
    onPress?.() // trigger your callback when it bottoms out (press start)
  }

  const handlePointerUp = (e) => {
    e.stopPropagation()
    setIsPressed(false)
  }

  const handlePointerOut = () => {
    // If the pointer leaves while pressed, pop back up
    setIsPressed(false)
  }

  return (
    <group
      ref={rootRef}
      // Let the wrapper receive raycaster hits and control the press lifecycle
      pointerEventsType={{ deny: 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerOut={handlePointerOut}
      onLostPointerCapture={handlePointerUp}
      position={[0, 1, -1]}
    >
      <Suspense fallback={null}>
        <group scale={[0.035, 0.035, 0.035]}>
          <primitive object={cloned} />
        </group>
      </Suspense>
    </group>
  )
}
