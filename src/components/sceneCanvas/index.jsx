// SceneCanvas.jsx
import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import WaveTypeSelector from '../../packages/WaveTypeSelector'
import ADSRController from '../../packages/ADSRController.jsx'

export default function SceneCanvas({ store }) {
  const [waveform, setWaveform] = useState('sine')

  // NEW: ADSR + Note Duration state (seconds)
  const [adsr, setAdsr] = useState({
    attack: 0.02,
    decay: 0.12,
    sustain: 0.8,   // 0..1
    release: 0.2,
  })
  const [noteDuration, setNoteDuration] = useState(0.5)

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.2, 2.2], fov: 60 }}>
      <color attach="background" args={['#ffffff']} />

      <XR store={store}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.9} />

        {/* Waveform Selector */}
        <WaveTypeSelector
          position={[0, 0.92, -0.35]}
          spacing={0.07}
          size={[0.055, 0.055]}
          buttonScale={0.6}
          selected={waveform}
          onChange={(w) => setWaveform(w)}
        />

        {/* ADSR + Duration Controller */}
        <ADSRController
          position={[0, 0.78, -0.55]}
          spacingX={0.16}
          size={[0.085, 0.085]}
          attack={adsr.attack}
          decay={adsr.decay}
          sustain={adsr.sustain}
          release={adsr.release}
          duration={noteDuration}
          onChange={({ attack, decay, sustain, release, duration }) => {
            setAdsr({ attack, decay, sustain, release })
            setNoteDuration(duration)
          }}
        />
      </XR>
    </Canvas>
  )
}
