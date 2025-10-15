import { useState, useCallback, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import ConsolePanel from '../../packages/ConsolePanel'

export default function SceneCanvas({ store }) {
  const [synth, setSynth] = useState({
    waveform: 'sine',
    attack: 0.02,
    decay: 0.12,
    sustain: 0.8,
    release: 0.2,
    duration: 0.5,
  })

  const setWaveform = useCallback(
    (wave) => setSynth((s) => ({ ...s, waveform: wave })),
    []
  )

  const handleADSRChange = useCallback(
    (patch) => setSynth((s) => ({ ...s, ...patch })),
    []
  )

  // If you need to pass a consolidated object elsewhere later
  const synthParams = useMemo(() => ({
    type: synth.waveform,
    attack: synth.attack,
    decay: synth.decay,
    sustain: synth.sustain,
    release: synth.release,
    duration: synth.duration,
  }), [synth])

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.2, 2.2], fov: 60 }}>
      <color attach="background" args={['#ffffff']} />

      <XR store={store}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.9} />

        {/* Single cluster */}
        <ConsolePanel
          // position={[0, 0.95, 1.5]}
          position = {[0, 0.85, -0.35]}
          synth={synth}
          onWaveChange={setWaveform}
          onADSRChange={handleADSRChange}
        />
      </XR>
    </Canvas>
  )
}
