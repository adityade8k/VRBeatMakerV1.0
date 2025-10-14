// SceneCanvas.jsx
import { useState, useCallback, useMemo, useMemo as useM } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import { Text, Billboard } from '@react-three/drei'
import WaveTypeSelector from '../../packages/WaveTypeSelector'
import ADSRController from '../../packages/ADSRController.jsx'

function SynthValues3D({ synth, position = [0.55, 1.2, -0.55] }) {
  const fmtSec = (s) => `${Number.isFinite(s) ? s.toFixed(2) : '0.00'}s`
  const fmtPct = (p) => `${Number.isFinite(p) ? Math.round(p * 100) : 0}%`

  const lines = useM(() => ([
    `Waveform : ${synth.waveform}`,
    `Attack   : ${fmtSec(synth.attack)}`,
    `Decay    : ${fmtSec(synth.decay)}`,
    `Sustain  : ${fmtPct(synth.sustain)}`,
    `Release  : ${fmtSec(synth.release)}`,
    `Duration : ${fmtSec(synth.duration)}`
  ]), [synth])

  const width = 0.52
  const lineH = 0.06
  const padX = 0.06
  const padY = 0.08
  const height = padY * 2 + lines.length * lineH + 0.04

  return (
    <Billboard position={position} follow lockX={false} lockY={false} lockZ={false}>
      {/* Panel background */}
      <mesh position={[0, -height * 0.5 + 0.02, 0]}>
        <planeGeometry args={[width + padX * 2, height]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.65} />
      </mesh>

      {/* Title */}
      <Text
        position={[-(width * 0.5), 0, 0.001]}
        fontSize={0.05}
        color="#e5e7eb"
        anchorX="left"
        anchorY="top"
      >
        Synth Params
      </Text>

      {/* Values */}
      {lines.map((t, i) => (
        <Text
          key={i}
          position={[
            -(width * 0.5),
            -(i + 1) * lineH - 0.02,
            0.001
          ]}
          fontSize={0.045}
          color="#cbd5e1"
          anchorX="left"
          anchorY="top"
          maxWidth={width}
          lineHeight={1.1}
          font="https://fonts.gstatic.com/s/robotomono/v22/L0x7DF4xlVMF-BfR8bXMIjhGq3qSb9E.woff" // monospace feel (optional)
        >
          {t}
        </Text>
      ))}

      {/* Thin border */}
      <mesh position={[0, -height * 0.5 + 0.02, 0.002]}>
        <planeGeometry args={[width + padX * 2, height]} />
        <meshBasicMaterial
          color="#94a3b8"
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>
    </Billboard>
  )
}

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

        {/* 3D values panel (faces the camera, updates automatically) */}
        <SynthValues3D synth={synth} position={[0.6, 1.15, -0.6]} />
      </XR>
    </Canvas>
  )
}
