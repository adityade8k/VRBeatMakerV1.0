// SceneCanvas.jsx
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import PressablePlanesButton from '../button'

export default function SceneCanvas({ store }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.2, 2.2], fov: 60 }}>
      <XR store={store}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.9} />

        <PressablePlanesButton
  position={[0.3, 1.05, -0.7]}
  rotation={[0, Math.PI / 8, 0]}   // rotate the entire button if you want
  scale={[1.2, 1, 1.2]}            // uniformly or non-uniformly scale the whole thing
  size={[0.22, 0.22]}
  buttonScale={0.65}
  gap={0.012}
  onPressed={() => console.log('Pressed!')}
/>
      </XR>
    </Canvas>
  )
}
