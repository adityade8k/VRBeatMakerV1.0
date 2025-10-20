import { useState, useCallback, useMemo, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR } from '@react-three/xr'
import ConsolePanel from '../../packages/ConsolePanel'
import BitmapTextProvider from '../bitmapText/bitmapTextProvider' // case sensitive

// ——— helpers to sanitize record events ———
const NOTE_INDEX = { C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11 }
function noteNameToMidi(name) {
  if (typeof name !== 'string') return null
  const m = name.trim().match(/^([A-G]#?|[A-G]b)(-?\d+)$/i)
  if (!m) return null
  const pitch = NOTE_INDEX[m[1].toUpperCase()]
  const oct = parseInt(m[2], 10)
  if (!Number.isFinite(pitch) || !Number.isFinite(oct)) return null
  return 12 * (oct + 1) + pitch
}
function freqToMidi(freq) {
  const f = Number(freq)
  if (!Number.isFinite(f) || f <= 0) return null
  return Math.round(69 + 12 * Math.log2(f / 440))
}
function finiteOr(val, fallback) {
  const n = Number(val)
  return Number.isFinite(n) ? n : fallback
}


// ─────────────────────────────────────────────────────────────
// Sequence shape: 5 tracks × 16 slots; each slot is [] or [ { midi, duration, synth:{...} } ]
const TRACKS = 5
const STEPS = 16
const makeEmptySeq = () =>
  Array.from({ length: TRACKS }, () => Array.from({ length: STEPS }, () => []))

// Compact waveform mapping (keeps URL short)
const WFS = ['sine', 'square', 'triangle', 'sawtooth']
const wfToIdx = (wf) => Math.max(0, WFS.indexOf(wf ?? 'sine'))
const idxToWf = (i) => WFS[Number.isFinite(i) ? Math.max(0, Math.min(3, i)) : 0]

// Base64 URL helpers
const toBase64Url = (str) =>
  btoa(unescape(encodeURIComponent(str)))
    .replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

const fromBase64Url = (b64u) => {
  const pad = b64u.length % 4 === 2 ? '==' : b64u.length % 4 === 3 ? '=' : ''
  const b64 = b64u.replaceAll('-', '+').replaceAll('_', '/') + pad
  return decodeURIComponent(escape(atob(b64)))
}

// ─────────────────────────────────────────────────────────────
// Serializer: sequence -> compact JSON -> base64url
// Schema per note (array form to reduce size):
//   [midi, dur, wfIdx, a, d, s, r, rMix, rRoom, eps]
function serializeSequence(seq) {
  const compact = seq.map(track =>
    track.map(slot => {
      if (!slot || !slot.length) return 0
      const n = slot[0]
      const s = n.synth || {}
      return [
        n.midi ?? 60,
        +(n.duration ?? 0.25).toFixed(4),
        wfToIdx(s.waveform),
        +(s.attack ?? 0.02).toFixed(4),
        +(s.decay ?? 0.12).toFixed(4),
        +(s.sustain ?? 0.8).toFixed(4),
        +(s.release ?? 0.2).toFixed(4),
        +(s.reverbMix ?? 0.25).toFixed(4),
        +(s.reverbRoomSize ?? 0.3).toFixed(4),
        +(s.cleanupEps ?? 0.03).toFixed(4)
      ]
    })
  )
  return toBase64Url(JSON.stringify(compact))
}

// Deserializer: base64url -> compact JSON -> sequence
function deserializeSequence(b64u) {
  let parsed
  try {
    parsed = JSON.parse(fromBase64Url(b64u))
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length !== TRACKS) return null

  const seq = makeEmptySeq()
  for (let t = 0; t < TRACKS; t++) {
    const track = parsed[t]
    if (!Array.isArray(track) || track.length !== STEPS) return null
    for (let s = 0; s < STEPS; s++) {
      const cell = track[s]
      if (cell === 0 || cell == null) { seq[t][s] = []; continue }
      const [midi, dur, wfI, a, d, sus, r, rMix, rRoom, eps] = cell
      seq[t][s] = [{
        midi: Number.isFinite(midi) ? midi : 60,
        duration: Number.isFinite(dur) ? dur : 0.25,
        synth: {
          waveform: idxToWf(wfI),
          attack: a ?? 0.02,
          decay: d ?? 0.12,
          sustain: sus ?? 0.8,
          release: r ?? 0.2,
          reverbMix: rMix ?? 0.25,
          reverbRoomSize: rRoom ?? 0.3,
          cleanupEps: eps ?? 0.03
        }
      }]
    }
  }
  return seq
}

// Builds a clean path like /<payload>
function buildPathFromSeq(seq) {
  const payload = serializeSequence(seq)
  return `/${payload}`
}

// Try parse path’s first non-empty segment as payload
function parsePathPayload(pathname) {
  const seg = pathname.split('/').filter(Boolean)[0]
  return seg || ''
}

export default function SceneCanvas({ store, onExposeSave }) {
  // ───────── Synth ─────────
  const [synth, setSynth] = useState({
    waveform: 'sine',
    attack: 0.02, decay: 0.12, sustain: 0.8, release: 0.02,
    duration: 0.13,
    reverbMix: 0.25, reverbRoomSize: 0.30,
    octave: 0,
    cleanupEps: 0.03,
  })
  const setWaveform     = useCallback((wave)  => setSynth(s => ({ ...s, waveform: wave })), [])
  const handleADSRChange= useCallback((patch) => setSynth(s => ({ ...s, ...patch })), [])
  const handleSynthPatch= useCallback((patch) => setSynth(s => ({ ...s, ...patch })), [])
  const synthParams     = useMemo(() => ({ ...synth }), [synth])

  // ───────── Recorder / Transport ─────────
  const [sequence, setSequence] = useState(makeEmptySeq)
  const [selectedTrack, setSelectedTrack] = useState(0)
  const [selectedSlots, setSelectedSlots] = useState([0])
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [mutes, setMutes] = useState(Array(TRACKS).fill(false))
  const [recDuration, setRecDuration] = useState(0.15) // seconds

  // Ensure shape
  useEffect(() => {
    setSequence(prev => (Array.isArray(prev) && prev.length === TRACKS ? prev : makeEmptySeq()))
  }, [])

  // ───── Load from URL once (if present)
  useEffect(() => {
    const seg = parsePathPayload(location.pathname)
    if (!seg) return
    const decoded = deserializeSequence(seg)
    if (decoded) {
      setSequence(decoded)
    }
  }, [])

  // capture notes recorded from TonePad
  const onRecordedNote = useCallback((evt = {}) => {
  if (!recording) return

  // Try to resolve a valid MIDI number from various shapes
  let midi =
    (Number.isFinite(evt.midi) && evt.midi) ??
    noteNameToMidi(evt.note ?? evt.name) ??
    freqToMidi(evt.freq ?? evt.frequency ?? evt.hz)

  // If still not resolvable, bail without writing garbage
  if (!Number.isFinite(midi)) return

  // Duration fallback order: explicit event -> recDuration knob -> synth default
  const dur = finiteOr(evt.duration, finiteOr(recDuration, synth.duration ?? 0.25))
  const safeDur = Math.max(0.01, dur) // keep > 0 to avoid Tone clicks

  setSequence(prev => {
    const next = prev.map(tr => tr.map(sl => Array.isArray(sl) ? [...sl] : []))
    const t = Math.max(0, Math.min(TRACKS - 1, selectedTrack))
    const s = Math.max(0, Math.min(STEPS - 1, (selectedSlots && selectedSlots[0]) ?? 0))

    next[t][s] = [{
      midi,
      duration: safeDur,
      synth: {
        waveform: synth.waveform,
        attack: synth.attack, decay: synth.decay, sustain: synth.sustain, release: synth.release,
        reverbMix: synth.reverbMix, reverbRoomSize: synth.reverbRoomSize,
        cleanupEps: synth.cleanupEps ?? 0.03
      }
    }]
    return next
  })

  // advance slot
  setSelectedSlots(([s0 = 0]) => [ (s0 + 1) % STEPS ])
}, [recording, selectedTrack, selectedSlots, synth, recDuration])


  // ───── Expose "save" to App (no refs)
  useEffect(() => {
    if (!onExposeSave) return
    const save = () => {
      const path = buildPathFromSeq(sequence)
      const href = `${location.origin}${path}`
      // push new path (keeps SPA state; Netlify should redirect to index.html for unknown paths)
      history.pushState(null, '', path)
      return href
    }
    onExposeSave(() => save)
    // optional cleanup
    return () => onExposeSave(null)
  }, [onExposeSave, sequence])

  const recorder = useMemo(() => ({
    sequence, setSequence,
    selectedTrack, setSelectedTrack,
    selectedSlots, setSelectedSlots,
    recording, setRecording,
    playing, setPlaying,
    mutes, setMutes,
    recDuration, setRecDuration,
    onRecordedNote,
  }), [
    sequence, selectedTrack, selectedSlots, recording, playing, mutes, recDuration,
    setSequence, setSelectedTrack, setSelectedSlots, setRecording, setPlaying, setMutes, setRecDuration,
    onRecordedNote
  ])

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 1.3,2.3], fov: 60, rotation: [-0.4, 0, 0] }}>
      <BitmapTextProvider useMipmaps={false} toneMapped={false}>
        <color attach="background" args={['#000000']} />
        <XR store={store}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[2, 3, 1]} intensity={0.9} />
          <ConsolePanel
            rotation={[0.4, 0, 0]}
            position={[-0.53, 0.7, 1.72]}
            scale={0.8}
            synth={synthParams}
            onWaveChange={setWaveform}
            onADSRChange={handleADSRChange}
            onSynthPatch={handleSynthPatch}
            recorder={recorder}
            // TonePad inside ConsolePanel should forward:
            //   armed={recording}
            //   onRecordEvent={onRecordedNote}
          />
        </XR>
      </BitmapTextProvider>
    </Canvas>
  )
}
