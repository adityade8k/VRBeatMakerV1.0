// SceneCanvas.jsx
import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import PressablePlanesButton from '../button'
import Roller from '../roller'
import Dial from '../dial'
import ToggleSwitch from '../switch'

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

        {/* FRONT CUBES */}
        <mesh position={[-0.7, 1, -1]} castShadow receiveShadow>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color={cube1Blue ? '#1e90ff' : '#e74c3c'} metalness={0.2} roughness={0.6} />
        </mesh>

        <mesh position={[0.7, 1, -1]} castShadow receiveShadow>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color={cube2Blue ? '#1e90ff' : '#e74c3c'} metalness={0.2} roughness={0.6} />
        </mesh>

        {/* MIDDLE CUBE (roller controls Z) */}
        <mesh position={[0, 1, rollerCubeZ]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.22, 0.22]} />
          <meshStandardMaterial color={'#f59e0b'} metalness={0.2} roughness={0.6} />
        </mesh>

        {/* REAR CUBE (dial controls X) */}
        <mesh position={[rearCubeX, 1, -2.0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.22, 0.22]} />
          <meshStandardMaterial color={'#10b981'} metalness={0.25} roughness={0.55} />
        </mesh>

        {/* CONTROLS */}
        <PressablePlanesButton
          mode="long-press"
          position={[-0.35, 0.95, -0.45]}
          rotation={[0, 0, 0]}
          gap={0.012}
          baseColor="#6987f5"
          onPressDown={() => setCube1Blue(true)}
          onPressUp={() => setCube1Blue(false)}
          onPressed={() => console.log('Long-press bottom reached')}
        />

        <PressablePlanesButton
          mode="toggle"
          position={[0.35, 0.95, -0.45]}
          rotation={[0, 0, 0]}
          gap={0.012}
          onToggle={(isOn) => setCube2Blue(isOn)}
          onPressed={() => console.log('Toggle bottom reached')}
        />

        <Roller
          position={[-0.25, 0.85, -0.35]}
          minValue={-1}
          maxValue={1}
          onValueChange={(v) => setRollerValue(v)}
        />

        <Dial
          position={[0, 0.85, -0.35]}
          initialAngle={0}
          minValue={-1}
          maxValue={1}
          onValueChange={(v) => setDialValue(v)}
        />

        {/* Toggle switch → background (black/white) */}
        <ToggleSwitch
          position={[0.25, 0.85, -0.35]}
          onToggle={(on) => setBgWhite(on)}
        />
      </XR>
    </Canvas>
  )
}
