// SceneCanvas.jsx
import { useState, useCallback, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import { Html } from '@react-three/drei'
import WaveTypeSelector from '../../packages/WaveTypeSelector'
import ADSRController from '../../packages/ADSRController.jsx'

export default function SceneCanvas({ store }) {
  const [synth, setSynth] = useState({
    waveform: 'sine',
    attack: 0.02,
    decay: 0.12,
    sustain: 0.8,   // 0..1
    release: 0.2,
    duration: 0.5,  // seconds
  })

  const setWaveform = useCallback(
    (wave) => setSynth((s) => ({ ...s, waveform: wave })),
    []
  )

  const handleADSRChange = useCallback(
    (patch) => setSynth((s) => ({ ...s, ...patch })),
    []
  )

  const synthParams = useMemo(() => ({
    type: synth.waveform,
    attack: synth.attack,
    decay: synth.decay,
    sustain: synth.sustain,
    release: synth.release,
    duration: synth.duration,
  }), [synth])

  const fmtSec = (s) => `${Number.isFinite(s) ? s.toFixed(2) : '0.00'}s`
  const fmtPct = (p) => `${Number.isFinite(p) ? Math.round(p * 100) : 0}%`

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

        {/* ADSR + Duration Controller (labels removed) */}
        <ADSRController
          position={[-0.2, 0.9, -0.35]}
          gridSpacingX={0.16}
          gridSpacingZ={0.12}
          size={[0.085, 0.085]}
          attack={synth.attack}
          decay={synth.decay}
          sustain={synth.sustain}
          release={synth.release}
          duration={synth.duration}
          onChange={handleADSRChange}
        />

        {/* Live values panel (DOM overlay inside canvas) */}
        <Html
          fullscreen
          style={{ pointerEvents: 'none' }} // keep scene interactive
        >
          <div style={{
            position: 'absolute',
            top: 16,
            left: 16,
            pointerEvents: 'auto',
            background: 'rgba(15, 23, 42, 0.75)',
            color: '#e5e7eb',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: '10px 12px',
            minWidth: 220,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            backdropFilter: 'blur(6px)'
          }}>
            <div style={{ fontWeight: 700, letterSpacing: 0.4, marginBottom: 6 }}>
              Synth Params
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', rowGap: 4, columnGap: 8, fontSize: 13, lineHeight: 1.3 }}>
              <span>Waveform</span><span style={{ fontWeight: 600 }}>{synth.waveform}</span>
              <span>Attack</span>  <span style={{ fontWeight: 600 }}>{fmtSec(synth.attack)}</span>
              <span>Decay</span>   <span style={{ fontWeight: 600 }}>{fmtSec(synth.decay)}</span>
              <span>Sustain</span> <span style={{ fontWeight: 600 }}>{fmtPct(synth.sustain)}</span>
              <span>Release</span> <span style={{ fontWeight: 600 }}>{fmtSec(synth.release)}</span>
              <span>Duration</span><span style={{ fontWeight: 600 }}>{fmtSec(synth.duration)}</span>
            </div>
          </div>
        </Html>
      </XR>
    </Canvas>
  )
}
