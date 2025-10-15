// src/components/SceneCanvas.jsx
import { useState, useCallback, useMemo, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import ConsolePanel from '../../packages/ConsolePanel'
import SequenceVisualizer from '../../packages/SequenceVisualizer'

const makeEmptySeq = () => Array.from({ length: 5 }, () => Array.from({ length: 16 }, () => []))

export default function SceneCanvas({ store }) {
  // ───────────────────────────────── Synth state ─────────────────────────────
  const [synth, setSynth] = useState({
    waveform: 'sine',

    // ADSR
    attack: 0.02,
    decay: 0.12,
    sustain: 0.8,
    release: 0.2,

    // one-shot length that TonePad will use for preview playback
    duration: 0.5,          // seconds

    // FX + octave
    reverbMix: 0.25,        // 0..1
    reverbRoomSize: 0.30,   // 0..1
    octave: 0,              // -2..+2

    // click-safety tail
    cleanupEps: 0.03,
  })

  const setWaveform = useCallback((wave) => setSynth(s => ({ ...s, waveform: wave })), [])
  const handleADSRChange = useCallback((patch) => setSynth(s => ({ ...s, ...patch })), [])
  const handleSynthPatch = useCallback((patch) => setSynth(s => ({ ...s, ...patch })), [])

  const synthParams = useMemo(() => ({ ...synth }), [synth])

  // ─────────────────────────────── Recorder state ────────────────────────────
  const [sequence, setSequence] = useState(makeEmptySeq)
  const [selectedTrack, setSelectedTrack] = useState(0)    // 0..4
  const [selectedSlots, setSelectedSlots] = useState([0])  // [0..15] or ranges when delete-multi
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [mutes, setMutes] = useState(Array(5).fill(false)) // per-track muted?
  const [recDuration, setRecDuration] = useState(0.5)

  // ensure sequence is always the right shape
  useEffect(() => {
    setSequence(prev => (Array.isArray(prev) && prev.length === 5 ? prev : makeEmptySeq()))
  }, [])

  // When a TonePad pad is pressed, if recording is ON, capture to current slot & advance.
  const onRecordedNote = useCallback((midi) => {
    if (!recording) return

    setSequence(prev => {
      const next = prev.map(tr => tr.map(sl => [...sl]))
      const t = Math.max(0, Math.min(4, selectedTrack))
      const s = Math.max(0, Math.min(15, selectedSlots[0] ?? 0))

      // snapshot current synth config into the event
      const event = {
        midi,
        duration: synth.duration ?? 0.5,
        synth: {
          waveform: synth.waveform,
          attack: synth.attack, decay: synth.decay, sustain: synth.sustain, release: synth.release,
          reverbMix: synth.reverbMix, reverbRoomSize: synth.reverbRoomSize,
          cleanupEps: synth.cleanupEps ?? 0.03
        }
      }

      next[t][s] = [...(next[t][s] ?? []), event]
      return next
    })

    // advance selected slot to the next one
    setSelectedSlots(([s0 = 0]) => [(s0 + 1) % 16])
    // console log for traceability
    console.log('[recorder] recorded midi:', midi, 'track:', selectedTrack, 'slot(now -> next):', selectedSlots[0], '->', (selectedSlots[0] + 1) % 16)
  }, [recording, selectedTrack, selectedSlots, synth])

  const recorder = useMemo(() => ({
    sequence, setSequence,
    selectedTrack, setSelectedTrack,
    selectedSlots, setSelectedSlots,
    recording, setRecording,
    playing, setPlaying,
    mutes, setMutes,
    onRecordedNote,
  }), [
    sequence, selectedTrack, selectedSlots, recording, playing, mutes,
    setSequence, setSelectedTrack, setSelectedSlots, setRecording, setPlaying, setMutes,
    onRecordedNote
  ])

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.2, 2.2], fov: 60 }}>
      <color attach="background" args={['#ffffff']} />
      <XR store={store}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.9} />
        <ConsolePanel
          rotation={[0, 0, 0]}
          position={[-0.8, 0.85, -0.35]}
          scale={0.8}
          synth={synthParams}
          onWaveChange={setWaveform}
          onADSRChange={handleADSRChange}
          onSynthPatch={handleSynthPatch}
          recorder={recorder}
        />
        <SequenceVisualizer
          sequence={sequence}
          selectedTrack={selectedTrack}
          selectedSlots={selectedSlots}
          recording={recording}
          playing={playing}
          mutes={mutes}
          stepSeconds={recDuration} 
          position={[0, 1.1, -1.2]}  // ← sync the visual playhead speed
        />
      </XR>
    </Canvas>
  )
}
