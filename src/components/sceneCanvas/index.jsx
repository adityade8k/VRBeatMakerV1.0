// SceneCanvas.jsx
import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import WaveTypeSelector from '../../packages/WaveTypeSelector'
import ADSRController from '../../packages/ADSRController.jsx'

export default function SceneCanvas({ store }) {
  // One consolidated state object for all synth params
  const [synth, setSynth] = useState({
    waveform: 'sine',
    attack: 0.02,
    decay: 0.12,
    sustain: 0.8,   // 0..1
    release: 0.2,
    duration: 0.5,  // seconds
  })

  // Updaters
  const setWaveform = (wave) => setSynth((s) => ({ ...s, waveform: wave }))
  const patchSynth  = (patch) => setSynth((s) => ({ ...s, ...patch }))

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.2, 2.2], fov: 60 }}>
      <color attach="background" args={['#ffffff']} />

      <XR store={store}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.9} />

        {/* Waveform Selector */}
        <WaveTypeSelector
          position={[0.2, 0.9, -0.35]}
          spacing={0.07}
          size={[0.055, 0.055]}
          buttonScale={0.6}
          selected={synth.waveform}
          onChange={setWaveform}
        />

        {/* ADSR + Duration Controller */}
        <ADSRController
          position={[-0.2, 0.9, -0.35]}
          gridSpacingX={0.16}         // NOTE: prop is gridSpacingX in the controller
          gridSpacingZ={0.12}
          size={[0.085, 0.085]}
          attack={synth.attack}
          decay={synth.decay}
          sustain={synth.sustain}
          release={synth.release}
          duration={synth.duration}
          onChange={patchSynth}       // receives {attack, decay, sustain, release, duration}
        />
      </XR>
    </Canvas>
  )
}
