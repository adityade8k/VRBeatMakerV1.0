import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import ButtonComponent from './button/ButtonComponent.jsx'

export default function SceneCanvas({ store, paths, red, onToggleRed }) {
  return (
    <Canvas>
      <XR store={store}>

        <ButtonComponent/>

        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.8} />
      </XR>
    </Canvas>
  )
}
