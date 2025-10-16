import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import Dial from '../../components/dial'
import ToggleSwitch from '../../components/switch'
import PressablePlanesButton from '../../components/button'
import { useTonePad } from '../../hooks/useTonePad'
import SequenceVisualizer from '../SequenceVisualizer'
import BitmapText from '../../components/bitmapText'

function Plate({ position = [0, 0, 0], size = [0.16, 0.06], text = '', fontSize = 0.022, color = "#000000" }) {
  const [w, h] = size
  return (
    <group position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <BitmapText
        text={text}
        position={[-w * 0.48, 0, 0.01]}
        rotation={[Math.PI, 0, 0]}
        scale={[fontSize, fontSize, fontSize]}
        color={color}
        align="left"
        anchorY="middle"
        maxWidth={(w * 0.95) / fontSize}
      />
    </group>
  )
}

export default function PlayBackRecorder({
  position = [0.28, 0.9, -0.35],
  size = [0.09, 0.09],
  dialBaseColor = '#324966',
  dialColor = '#f08c00',
  switchBaseColor = '#6987f5',
  padBaseColor = '#6987f5',
  padButtonColor = '#0370ff',

  synth,
  sequence, setSequence,
  selectedTrack, setSelectedTrack,
  selectedSlots, setSelectedSlots,
  recording, setRecording,
  playing, setPlaying,
  mutes, setMutes,
  recDuration, setRecDuration,
}) {
  const { triggerNote, triggerNoteWith } = useTonePad({
    waveform: synth.waveform,
    attack: synth.attack, decay: synth.decay, sustain: synth.sustain, release: synth.release,
    reverbMix: synth.reverbMix, reverbRoomSize: synth.reverbRoomSize,
    cleanupEps: synth.cleanupEps ?? 0.03,
  })

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
  const uniqSorted = (arr) => [...new Set(arr)].sort((a, b) => a - b)

  const ensureSeq = useCallback((seq) => {
    if (Array.isArray(seq) && seq.length === 5 && seq.every(t => Array.isArray(t) && t.length === 16)) return seq
    return Array.from({ length: 5 }, () => Array.from({ length: 16 }, () => []))
  }, [])
  useEffect(() => {
    if (!sequence || sequence.length !== 5) setSequence(ensureSeq(sequence))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const deleteSelected = useCallback(() => {
    if (playing) return
    setSequence(prev => {
      const base = ensureSeq(prev).map(track => track.map(slot => [...slot]))
      const t = clamp(selectedTrack, 0, 4)
      const targets = (selectedSlots.length ? selectedSlots : [0])
      targets.forEach(s => { base[t][s] = [] })
      return base
    })
  }, [ensureSeq, selectedTrack, selectedSlots, setSequence, playing])

  const seqRef = useRef(sequence)
  const mutesRef = useRef(mutes)
  const durRef = useRef(recDuration)

  useEffect(() => { seqRef.current = sequence }, [sequence])
  useEffect(() => { mutesRef.current = mutes }, [mutes])
  useEffect(() => { durRef.current = recDuration }, [recDuration])

  // Step/playhead refs
  const stepRef = useRef(0)
  const timerRef = useRef(null)
  const nextTickAtRef = useRef(0) // performance.now() timestamp for drift-correction

  const [playhead, setPlayhead] = useState(0)

  const stopClock = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }, [])

  const tickOnce = useCallback(() => {
    const s = stepRef.current
    setPlayhead(s)

    const seq = seqRef.current
    const mutes = mutesRef.current
    const stepSec = Math.max(0.03, durRef.current ?? 0.5)

    for (let t = 0; t < 5; t++) {
      if (mutes?.[t]) continue
      const events = (seq?.[t]?.[s]) || []
      for (const ev of events) {
        const midi = ev?.midi
        if (typeof midi !== 'number') continue
        const evDur = Number.isFinite(ev?.duration) ? ev.duration : stepSec
        if (ev?.synth) triggerNoteWith(ev.synth, midi, evDur)
        else triggerNote(midi, evDur)
      }
    }

    stepRef.current = (s + 1) % 16
  }, [triggerNote, triggerNoteWith])

  const scheduleNext = useCallback(() => {
    const stepMs = Math.max(30, (durRef.current ?? 0.5) * 1000)
    const now = performance.now()

    // First schedule sets baseline
    if (!nextTickAtRef.current) nextTickAtRef.current = now + stepMs
    else nextTickAtRef.current += stepMs

    const delay = Math.max(0, nextTickAtRef.current - now)
    timerRef.current = setTimeout(() => {
      tickOnce()
      scheduleNext()  // recurse for the next step
    }, delay)
  }, [tickOnce])

  const startClock = useCallback((startFrom) => {
    stopClock()
    // Align internal counters and fire FIRST tick immediately
    stepRef.current = startFrom % 16
    setPlayhead(stepRef.current)
    tickOnce()            // ← this is what was missing; prevents initial “silent” step
    nextTickAtRef.current = 0
    scheduleNext()
  }, [scheduleNext, stopClock, tickOnce])

  useEffect(() => {
    if (playing) startClock((selectedSlots[0] ?? 0) % 16)
    else stopClock()
    return stopClock
  }, [playing, selectedSlots, startClock, stopClock])

  const [delMulti, setDelMulti] = useState(false)
  const [anchorSlot, setAnchorSlot] = useState(selectedSlots[0] ?? 0)
  const [slotDialVal, setSlotDialVal] = useState(selectedSlots[0] ?? 0)

  useEffect(() => {
    if (!delMulti) {
      const base = selectedSlots[0] ?? 0
      setAnchorSlot(base); setSlotDialVal(base)
    }
  }, [delMulti, selectedSlots])

  useEffect(() => {
    if (!delMulti && selectedSlots.length > 1) setSelectedSlots([selectedSlots[0]])
  }, [delMulti, selectedSlots, setSelectedSlots])

  const onSlotDial = useCallback((v) => {
    const idx = Math.round(clamp(v, 0, 15))
    setSlotDialVal(idx)
    if (delMulti) {
      const lo = Math.min(anchorSlot, idx)
      const hi = Math.max(anchorSlot, idx)
      const range = []; for (let i = lo; i <= hi; i++) range.push(i)
      setSelectedSlots(range)
    } else {
      setSelectedSlots([idx])
    }
  }, [delMulti, anchorSlot, setSelectedSlots])

  const onTrackDial = useCallback((v) => setSelectedTrack(Math.round(clamp(v, 0, 4))), [setSelectedTrack])

  const onDurDial = useCallback((v) => {
    const sec = Math.round(clamp(v, 0.1, 1.0) * 100) / 100
    setRecDuration(sec)
  }, [setRecDuration])

  const prettySel = useMemo(() => {
    const s = uniqSorted(selectedSlots)
    return s.length > 3 ? `${s[0]}..${s[s.length - 1]} (${s.length})` : s.join(',')
  }, [selectedSlots])

  const topRowZ = -0.32
  const rowGapZ = 0.12
  const firstRowZ = 0.0
  const leftX = -0.32
  const trackSwitches = new Array(5).fill(0).map((_, i) => ({ i, pos: [leftX + i * 0.14, 0, topRowZ] }))
  const controlsRowZ = firstRowZ - rowGapZ
  const playPos = [leftX, 0, controlsRowZ]
  const recPos = [leftX + 0.14, 0, controlsRowZ]
  const delPos = [leftX + 0.28, 0, controlsRowZ]
  const delMulPos = [leftX + 0.42, 0, controlsRowZ]
  const slotDialPos = [leftX + 0.58, 0, controlsRowZ]
  const trackDialPos = [leftX + 0.76, 0, controlsRowZ]
  const durDialPos = [leftX + 0.76, 0, controlsRowZ + 0.2]
  const durLabelPos = [durDialPos[0], durDialPos[1], durDialPos[2] - 0.085]

  return (
    <group position={position}>
      {trackSwitches.map(({ i, pos }) => (
        <group key={`trk-sw-${i}`} position={pos}>
          <ToggleSwitch
            position={[0, 0, 0]}
            size={size}
            baseColor={switchBaseColor}
            controlledIsOn={!mutes[i]}
            isOn={!mutes[i]}
            onToggle={(on) => {
              const next = [...mutes]; next[i] = !on; setMutes(next)
            }}
          />
          <Plate position={[0, 0, -0.08]} size={[0.16, 0.06]} text={`Track ${i + 1} ${mutes[i] ? '(muted)' : ''}`} />
        </group>
      ))}

      <PressablePlanesButton
  mode="toggle"
  labelColor="#000000"
  position={playPos}
  size={size}
  baseColor={padBaseColor}
  buttonColor={padButtonColor}
  showLabel
  label={playing ? 'Pause' : 'Play'}
  controlledIsOn={playing}
  onToggle={(on)=>{ 
    if (on && recording) setRecording(false)
    setPlaying(on) // startClock uses selectedSlots in the effect above
  }}
/>


      <ToggleSwitch
        position={recPos}
        size={size}
        baseColor={switchBaseColor}
        controlledIsOn={recording}
        isOn={recording}
        onToggle={(on) => {
          if (on && playing) setPlaying(false)
          setRecording(on)
        }}
      />
      <Plate position={[recPos[0], recPos[1], recPos[2] - 0.08]} size={[0.18, 0.06]} text={recording ? 'Recording: ON' : 'Recording: OFF'} />

      <PressablePlanesButton
        mode="long-press"
        labelColor="#000000"
        position={delPos}
        size={size}
        baseColor={padBaseColor}
        buttonColor="#dc3545"
        showLabel
        label="Delete"
        onPressed={() => {
          deleteSelected()
          if (delMulti) setDelMulti(false)
        }}
      />

      <PressablePlanesButton
        mode="toggle"
        labelColor="#000000"
        position={delMulPos}
        size={size}
        baseColor={padBaseColor}
        buttonColor={delMulti ? '#ff3b30' : padButtonColor}
        controlledIsOn={delMulti}
        showLabel
        label={delMulti ? 'Delete Multiple: ON' : 'Delete Multiple: OFF'}
        onToggle={(on) => {
          setDelMulti(on)
          const base = selectedSlots[0] ?? 0
          setAnchorSlot(base); setSlotDialVal(base)
          if (!on) setSelectedSlots((s) => [s[0] ?? 0])
        }}
      />

      <Dial position={slotDialPos} size={size} baseColor={dialBaseColor} dialColor={dialColor}
        range={[0, 15]} step={1} stepAngle={Math.PI / 12} value={slotDialVal} onChange={onSlotDial} />
      <Plate position={[slotDialPos[0], slotDialPos[1], slotDialPos[2] - 0.08]} text={`Slot: ${prettySel || '0'}`} />

      <Dial position={trackDialPos} size={size} baseColor={dialBaseColor} dialColor={dialColor}
        range={[0, 4]} step={1} stepAngle={Math.PI / 12} value={selectedTrack} onChange={onTrackDial} />
      <Plate position={[trackDialPos[0], trackDialPos[1], trackDialPos[2] - 0.08]} text={`Track: ${selectedTrack + 1}`} />

      <Dial position={durDialPos} size={size} baseColor={dialBaseColor} dialColor={dialColor}
        range={[0.1, 1.0]} step={0.05} stepAngle={Math.PI / 18} value={recDuration} onChange={onDurDial} />
      <Plate position={durLabelPos} text={`Step: ${Number(recDuration).toFixed(2)}s`} />

      <SequenceVisualizer
        sequence={sequence}
        selectedTrack={selectedTrack}
        selectedSlots={selectedSlots}
        recording={recording}
        playing={playing}
        mutes={mutes}
        stepSeconds={recDuration}
        playhead={playhead}
        position={[-0.3, 0.25, -1.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={1.8}
      />
    </group>
  )
}
