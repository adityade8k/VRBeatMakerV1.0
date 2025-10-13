import { Suspense } from 'react'
import { useGLTF } from '@react-three/drei'

export default function ButtonComponent({ onPress = () => {} }) {
  const { scene } = useGLTF('/models/button.glb')

  return (
    <mesh pointerEventsType={{ deny: 'grab' }} onPointerDown={onPress} position={[0, 1, -0.6]}>
      <Suspense fallback={null}>
        <group scale={[0.035, 0.035, 0.035]}>
          <primitive object={scene} />
        </group>
      </Suspense>
    </mesh>
  )
}
