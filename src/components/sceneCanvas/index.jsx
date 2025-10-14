// SceneCanvas.jsx
import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import PressablePlanesButton from '../button' // (if you still use it elsewhere)
import Roller from '../roller'
import Dial from '../dial'
import ToggleSwitch from '../switch'
import WaveTypeSelector from '../../packages/WaveTypeSelector'

export default function SceneCanvas({ store }) {
  // Example states (kept if you still need them elsewhere)
  const [cube1Blue, setCube1Blue] = useState(false) // long-press
  const [cube2Blue, setCube2Blue] = useState(false) // toggle

  const [rollerValue, setRollerValue] = useState(0) // -1..1
  const Z_MIN = -1.6, Z_MAX = -0.6
  const rollerCubeZ = useMemo(
    () => Z_MIN + ((rollerValue + 1) / 2) * (Z_MAX - Z_MIN),
    [rollerValue]
  )

  const [dialValue, setDialValue] = useState(0) // -1..1
  const X_MIN = -0.9, X_MAX = 0.9
  const rearCubeX = useMemo(
    () => X_MIN + ((dialValue + 1) / 2) * (X_MAX - X_MIN),
    [dialValue]
  )

  const [bgWhite, setBgWhite] = useState(false)

  // NEW: Track currently selected waveform
  const [waveform, setWaveform] = useState('sine')

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.2, 2.2], fov: 60 }}>
      <color attach="background" args={[bgWhite ? '#ffffff' : '#000000']} />

      <XR store={store}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.9} />

        {/* ─── Waveform Selector (sine active by default) ───────────────── */}
        <WaveTypeSelector
          position={[0, 1.0, -0.7]}   // tweak as desired
          spacing={0.18}
          size={[0.12, 0.12]}
          buttonScale={0.6}
          selected={waveform}
          onChange={(w) => setWaveform(w)}
        />

        {/* You now have `waveform` available to route into your synth hook, etc. */}
        {/* Example (pseudo): <SynthEngine waveform={waveform} /> */}

        {/* ... keep/position other controls as needed (Roller/Dial/ToggleSwitch) ... */}
      </XR>
    </Canvas>
  )
}
