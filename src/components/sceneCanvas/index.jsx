import { useState, useCallback, useMemo, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import ConsolePanel from '../../packages/ConsolePanel'
import BitmapTextProvider from '../bitmapText/BitmapTextProvider.jsx' // case sensitive

const makeEmptySeq = () => Array.from({ length: 5 }, () => Array.from({ length: 16 }, () => []))

export default function SceneCanvas({ store }) {
  // ───────── Synth ─────────
  const [synth, setSynth] = useState({
    waveform: 'sine',
    attack: 0.02, decay: 0.12, sustain: 0.8, release: 0.2,
    duration: 0.5,
    reverbMix: 0.25, reverbRoomSize: 0.30,
    octave: 0,
    cleanupEps: 0.03,
  })
  const setWaveform = useCallback((wave) => setSynth(s => ({ ...s, waveform: wave })), [])
  const handleADSRChange = useCallback((patch) => setSynth(s => ({ ...s, ...patch })), [])
  const handleSynthPatch = useCallback((patch) => setSynth(s => ({ ...s, ...patch })), [])
  const synthParams = useMemo(() => ({ ...synth }), [synth])

  // ───────── Recorder / Transport ─────────
  const [sequence, setSequence] = useState(makeEmptySeq)
  const [selectedTrack, setSelectedTrack] = useState(0)
  const [selectedSlots, setSelectedSlots] = useState([0])
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [mutes, setMutes] = useState(Array(5).fill(false))
  const [recDuration, setRecDuration] = useState(0.5) // seconds

  useEffect(() => {
    setSequence(prev => (Array.isArray(prev) && prev.length === 5 ? prev : makeEmptySeq()))
  }, [])

  // capture notes from TonePad while recording
  const onRecordedNote = useCallback((midi) => {
    if (!recording) return
    setSequence(prev => {
      const next = prev.map(tr => tr.map(sl => [...sl]))
      const t = Math.max(0, Math.min(4, selectedTrack))
      const s = Math.max(0, Math.min(15, selectedSlots[0] ?? 0))
      next[t][s] = [...(next[t][s] ?? []), {
        midi,
        duration: synth.duration ?? 0.5,
        synth: {
          waveform: synth.waveform,
          attack: synth.attack, decay: synth.decay, sustain: synth.sustain, release: synth.release,
          reverbMix: synth.reverbMix, reverbRoomSize: synth.reverbRoomSize,
          cleanupEps: synth.cleanupEps ?? 0.03
        }
      }]
      return next
    })
    setSelectedSlots(([s0 = 0]) => [(s0 + 1) % 16])
  }, [recording, selectedTrack, selectedSlots, synth])

  const recorder = useMemo(() => ({
    sequence, setSequence,
    selectedTrack, setSelectedTrack,
    selectedSlots, setSelectedSlots,
    recording, setRecording,
    playing, setPlaying,
    mutes, setMutes,
    recDuration, setRecDuration,        // ← pass through
    onRecordedNote,
  }), [
    sequence, selectedTrack, selectedSlots, recording, playing, mutes, recDuration,
    setSequence, setSelectedTrack, setSelectedSlots, setRecording, setPlaying, setMutes, setRecDuration,
    onRecordedNote
  ])

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.2, 2.2], fov: 60 }}>
       <BitmapTextProvider useMipmaps={false} toneMapped={false}>
      <color attach="background" args={['#ffffff']} />
      <XR store={store}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 1]} intensity={0.9} />
        <ConsolePanel
          rotation={[0, 0, 0]}
          // position={[-0.8, 0.85, -0.35]}
          position={[-0.55, 0.6, 1.6]}
          scale={0.8}
          synth={synthParams}
          onWaveChange={setWaveform}
          onADSRChange={handleADSRChange}
          onSynthPatch={handleSynthPatch}
          recorder={recorder}
        />
      </XR>
      </BitmapTextProvider>
    </Canvas>
  )
}
