// src/components/SceneCanvas.jsx
import { Canvas } from '@react-three/fiber'
import { XR} from '@react-three/xr'
import XRPushButton from './XRPushButton.jsx'

export default function SceneCanvas({ store, paths, red, onToggleRed }) {
  return (
    <Canvas>
      <XR store={store}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 3, 2]} intensity={1} />


        {/* Drop-in XR Push Button */}
        <XRPushButton
          position={[0, 1, -0.6]}
          onPress={onToggleRed}
          url="/models/button.glb"
          topName="button"     // change if your node names differ
          baseName="BasePlate" // change if your node names differ
          pressSpeed={0.35}
          releaseSpeed={0.25}
          epsilon={0.0015}
        />

        {/* Some visual feedback to confirm it works */}
        <mesh position={[0.3, 1, -0.8]}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshStandardMaterial color={red ? 'red' : 'blue'} />
        </mesh>
      </XR>
    </Canvas>
  )
}
