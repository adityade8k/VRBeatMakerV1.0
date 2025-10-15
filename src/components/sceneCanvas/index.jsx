// src/components/SceneCanvas.jsx
import { useState, useCallback, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import ConsolePanel from '../../packages/ConsolePanel'
import XRPadTransformControls from '../xr/XRPadTransformControls'

export default function SceneCanvas({ store }) {
  const panelRef = useRef()

  const [synth, setSynth] = useState({
    waveform: 'sine',
    attack: 0.02, decay: 0.12, sustain: 0.8, release: 0.2,
    duration: 0.5,
    reverbMix: 0.25, reverbRoomSize: 0.30, octave: 0,
    cleanupEps: 0.03,
  })

  const setWaveform = useCallback((wave) => setSynth((s) => ({ ...s, waveform: wave })), [])
  const handleADSRChange = useCallback((patch) => setSynth((s) => ({ ...s, ...patch })), [])
  const handleSynthPatch = useCallback((patch) => setSynth((s) => ({ ...s, ...patch })), [])
  const synthParams = useMemo(() => ({ ...synth }), [synth])

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.2, 2.2], fov: 60 }}>
      <color attach="background" args={['#ffffff']} />
      <XR store={store}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.9} />

        {/* Controller → ConsolePad mapping */}
        <XRPadTransformControls targetRef={panelRef}
          movePerSec={0.25} rotPerSec={Math.PI/6} scalePerSec={0.6}
          minScale={0.35} maxScale={2.0}
        />

        <ConsolePanel
          ref={panelRef}
          rotation={[0, 0, 0]}
          position={[-0.3, 0.95, 1.8]}
          scale={0.5}
          synth={synthParams}
          onWaveChange={setWaveform}
          onADSRChange={handleADSRChange}
          onSynthPatch={handleSynthPatch}
        />
      </XR>
    </Canvas>
  )
}
