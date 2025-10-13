import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import GLTFModels from './GLTFModels.jsx'

export default function SceneCanvas({ store, paths, red, onToggleRed }) {
  return (
    <Canvas>
      <XR store={store}>
        <mesh
          pointerEventsType={{ deny: 'grab' }}
          onClick={onToggleRed}
          position={[0, 1, -2]}
        >
          <boxGeometry />
          <meshBasicMaterial color={red ? 'red' : 'blue'} />
        </mesh>

        <GLTFModels paths={paths} />

        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.8} />
      </XR>
    </Canvas>
  )
}
