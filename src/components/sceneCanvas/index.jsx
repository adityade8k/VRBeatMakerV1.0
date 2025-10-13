// SceneCanvas.jsx
import { useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import PressablePlanesButton from '../button'
import Roller from '../roller'

export default function SceneCanvas({ store }) {
  // Cube colors (both start red)
  const [cube1Blue, setCube1Blue] = useState(false) // controlled by long-press
  const [cube2Blue, setCube2Blue] = useState(false) // controlled by toggle

  // Roller-controlled Z
  const [rollerValue, setRollerValue] = useState(0) // -1..1
  const Z_MIN = -1.6
  const Z_MAX = -0.6
  const rollerCubeZ = useMemo(
    () => Z_MIN + ((rollerValue + 1) / 2) * (Z_MAX - Z_MIN),
    [rollerValue]
  )

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.2, 2.2], fov: 60 }}>
      <XR store={store}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.9} />

        {/* CUBES */}
        {/* Left cube: turns blue while long-press button is held, red when released */}
        <mesh position={[-0.7, 1, -1]} castShadow receiveShadow>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color={cube1Blue ? '#1e90ff' : '#e74c3c'} metalness={0.2} roughness={0.6} />
        </mesh>

        {/* Right cube: toggles blue/red via the toggle button */}
        <mesh position={[0.7, 1, -1]} castShadow receiveShadow>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color={cube2Blue ? '#1e90ff' : '#e74c3c'} metalness={0.2} roughness={0.6} />
        </mesh>

        {/* Center cube: Z controlled by the roller */}
        <mesh position={[0, 1, rollerCubeZ]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.22, 0.22]} />
          <meshStandardMaterial color={'#f59e0b'} metalness={0.2} roughness={0.6} />
        </mesh>

        {/* BUTTONS */}
        {/* Long-press button controlling left cube */}
        <PressablePlanesButton
          mode="long-press"
          position={[-0.3, 0.9, -0.45]}
          rotation={[0, 0, 0]}
          gap={0.012}
          baseColor="#6987f5"
          onPressDown={() => setCube1Blue(true)}
          onPressUp={() => setCube1Blue(false)}
          onPressed={() => console.log('Long-press bottom reached')}
        />

        {/* Toggle button controlling right cube */}
        <PressablePlanesButton
          mode="toggle"
          position={[0.3, 0.9, -0.45]}
          rotation={[0, 0, 0]}
          gap={0.012}
          onToggle={(isOn) => setCube2Blue(isOn)}
          onPressed={() => console.log('Toggle bottom reached')}
        />

        {/* ROLLER (controls center cube Z) */}
        <Roller
          position={[0, 0.85, -0.35]}
          size={[0.18, 0.12]}
          diskThickness={0.04}
          friction={0.9}
          sensitivity={1.2}
          minValue={-1}
          maxValue={1}
          onValueChange={(v) => setRollerValue(v)}
        />
      </XR>
    </Canvas>
  )
}
