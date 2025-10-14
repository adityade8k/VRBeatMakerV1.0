// SceneCanvas.jsx
import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import PressablePlanesButton from '../button'
import Roller from '../roller'
import Dial from '../dial'
import ToggleSwitch from '../switch'
import Piano from '../piano'

export default function SceneCanvas({ store }) {
  // Cube color states
  const [cube1Blue, setCube1Blue] = useState(false) // long-press
  const [cube2Blue, setCube2Blue] = useState(false) // toggle

  // Roller → Z of center cube
  const [rollerValue, setRollerValue] = useState(0) // -1..1
  const Z_MIN = -1.6, Z_MAX = -0.6
  const rollerCubeZ = useMemo(
    () => Z_MIN + ((rollerValue + 1) / 2) * (Z_MAX - Z_MIN),
    [rollerValue]
  )

  // Dial → X of rear cube
  const [dialValue, setDialValue] = useState(0) // -1..1
  const X_MIN = -0.9, X_MAX = 0.9
  const rearCubeX = useMemo(
    () => X_MIN + ((dialValue + 1) / 2) * (X_MAX - X_MIN),
    [dialValue]
  )

  // Toggle switch → background color
  const [bgWhite, setBgWhite] = useState(false)

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.2, 2.2], fov: 60 }}>
      {/* Background color controlled by the toggle switch */}
      <color attach="background" args={[bgWhite ? '#ffffff' : '#000000']} />

      <XR store={store}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.9} />

        <Piano
          origin={[0, 1, -0.35]}
          keySpacing={0.22}
          size={[0.16, 0.16]}
          buttonScale={0.65}
          gap={0.012}
          speed={12}
        />

        
      </XR>
    </Canvas>
  )
}
