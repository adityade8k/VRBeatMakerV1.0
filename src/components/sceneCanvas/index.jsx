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
  
  const [waveform, setWaveform] = useState('sine')

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.2, 2.2], fov: 60 }}>
      <color attach="background" args={['#ffffff']} />
      <XR store={store}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.9} />

        {/* ─── Waveform Selector (sine active by default) ───────────────── */}
        <WaveTypeSelector
          position={[0, 0.85, -0.35]}   // tweak as desired
          spacing={0.05}
          size={[0.05, 0.05]}
          buttonScale={0.6}
          selected={waveform}
          onChange={(w) => setWaveform(w)}
        />
      </XR>
    </Canvas>
  )
}
