// src/components/SceneCanvas.jsx
import { useState, useCallback, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import ConsolePanel from '../../packages/ConsolePanel'

export default function SceneCanvas({ store }) {
  const [synth, setSynth] = useState({
    waveform: 'sine',

    // ADSR
    attack: 0.02,
    decay: 0.12,
    sustain: 0.8,
    release: 0.2,

    // one-shot length for TonePad
    duration: 0.5,          // seconds

    // NEW: FX + octave
    reverbMix: 0.25,        // 0..1
    reverbRoomSize: 0.30,   // 0..1
    octave: 0,              // -2..+2

    // optional: adjust tail cleanup
    cleanupEps: 0.03,
  })

  const setWaveform = useCallback(
    (wave) => setSynth((s) => ({ ...s, waveform: wave })),
    []
  )

  const handleADSRChange = useCallback(
    (patch) => setSynth((s) => ({ ...s, ...patch })),
    []
  )

  // Generic patcher (used by TonePad dials)
  const handleSynthPatch = useCallback(
    (patch) => setSynth((s) => ({ ...s, ...patch })),
    []
  )

  const synthParams = useMemo(() => ({ ...synth }), [synth])

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.2, 2.2], fov: 60 }}>
      <color attach="background" args={['#ffffff']} />

      <XR store={store}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.9} />

        <ConsolePanel
          
          rotation={[0, 0, 0]}
          // position={[-0.6, 0.95, 1.5]}
          position = {[-0.6, 0.85, -0.35]}
          synth={synthParams}
          onWaveChange={setWaveform}
          onADSRChange={handleADSRChange}
          onSynthPatch={handleSynthPatch}
        />
      </XR>
    </Canvas>
  )
}

 