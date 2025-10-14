// components/Piano.jsx
import React, { useMemo } from 'react'
import PressablePlanesButton from '../button'
import { useToneSynth } from '../../hooks/useToneSynth'

/**
 * A 7-key piano (C4..B4) using your PressablePlanesButton in long-press mode.
 * - Press & hold: envelope attack -> sustain while held
 * - Release: envelope release -> cleanup after small buffer
 * - Each press creates a fresh sine oscillator + its own ADSR instance
 * - Master chain: Compressor -> Volume -> Destination (same as your example)
 */
function Piano({
  origin = [0, 0.9, -0.35],
  keySpacing = 0.11,
  size = [0.1, 0.1],
  buttonScale = 0.65,
  gap = 0.006,
  speed = 12,
}) {
  const {
    noteOn, noteOff,
    attack, decay, sustain, release, master,
    setAttack, setDecay, setSustain, setRelease, setMaster,
  } = useToneSynth({
    initAttack: 0.10,
    initDecay: 0.10,
    initSustain: 0.80,
    initRelease: 0.20,
    initMaster: 0.80,
    cleanupEps: 0.02,
  })

  const keys = useMemo(() => ([
    { label: 'C4', x: -3 },
    { label: 'D4', x: -2 },
    { label: 'E4', x: -1 },
    { label: 'F4', x:  0 },
    { label: 'G4', x:  1 },
    { label: 'A4', x:  2 },
    { label: 'B4', x:  3 },
  ]), [])

  return (
    <group>
      {/* Controls (optional) — remove if you don’t want in-scene UI.
          You can drive these from your app-level UI instead. */}
      {/* Example:
      <Html position={[origin[0], origin[1]+0.4, origin[2]]}>
        <div className="panel">
          <label>Attack <input type="range" min="0" max="2" step="0.01" value={attack}
            onChange={(e)=>setAttack(parseFloat(e.target.value))}/></label>
          <label>Decay <input type="range" min="0" max="2" step="0.01" value={decay}
            onChange={(e)=>setDecay(parseFloat(e.target.value))}/></label>
          <label>Sustain <input type="range" min="0" max="1" step="0.01" value={sustain}
            onChange={(e)=>setSustain(parseFloat(e.target.value))}/></label>
          <label>Release <input type="range" min="0" max="3" step="0.01" value={release}
            onChange={(e)=>setRelease(parseFloat(e.target.value))}/></label>
          <label>Master <input type="range" min="0" max="1" step="0.01" value={master}
            onChange={(e)=>setMaster(parseFloat(e.target.value))}/></label>
        </div>
      </Html>
      */}

      {/* Keys */}
      {keys.map(({ label, x }) => (
        <PressablePlanesButton
          key={label}
          mode="long-press"
          position={[
            origin[0] + x * keySpacing,
            origin[1],
            origin[2],
          ]}
          rotation={[0, 0, 0]}
          size={size}
          buttonScale={buttonScale}
          gap={gap}
          speed={speed}
          baseColor="#6987f5"
          buttonColor="#0370ff"
          onPressDown={() => noteOn(label)}
          onPressUp={() => noteOff(label)}
          onPressed={() => { /* optional: visual pulse or metering */ }}
        />
      ))}
    </group>
  )
}


export default Piano