// components/SceneCanvas.jsx
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import ButtonComponent from '../button/index.jsx'

export default function SceneCanvas({ store, paths, red, onToggleRed }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.2, 2.2], fov: 60 }}>
      <XR store={store}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.8} />

        <ButtonComponent onPressed={() => console.log('Pressed!')} />
      </XR>
    </Canvas>
  )
}
