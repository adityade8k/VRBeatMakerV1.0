// src/packages/PlayBackRecorder/index.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import Dial from '../../components/dial'
import ToggleSwitch from '../../components/switch'
import PressablePlanesButton from '../../components/button'
import { useTonePad } from '../../hooks/useTonePad'

function Plate({ position=[0,0,0], size=[0.16,0.06], text='', fontSize=0.022 }) {
  const [w,h] = size
  return (
    <group position={position} rotation={[-Math.PI/2,0,0]}>
      <mesh>
        <planeGeometry args={[w,h]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.8} />
      </mesh>
      <Text position={[0,0,0.001]} fontSize={fontSize} color="#cbd5e1" anchorX="center" anchorY="middle" maxWidth={w*0.95}>
        {text}
      </Text>
    </group>
  )
}

export default function PlayBackRecorder({
  position=[0.28, 0.9, -0.35],
  size=[0.09,0.09],
  dialBaseColor='#324966',
  dialColor='#f08c00',
  switchBaseColor='#6987f5',
  padBaseColor='#6987f5',
  padButtonColor='#0370ff',

  // synth preview params
  synth,

  // recorder state (from parent)
  sequence, setSequence,
  selectedTrack, setSelectedTrack,
  selectedSlots, setSelectedSlots,
  recording, setRecording,
  playing, setPlaying,
  mutes, setMutes,

  // NEW: transport duration lives in Canvas
  recDuration,          // seconds (0.1 .. 1.0 typical)
  setRecDuration,       // setter from Canvas
}) {
  // Main synth for live preview and event playback with captured params
  const { triggerNote, triggerNoteWith } = useTonePad({
    waveform: synth.waveform,
    attack: synth.attack, decay: synth.decay, sustain: synth.sustain, release: synth.release,
    reverbMix: synth.reverbMix, reverbRoomSize: synth.reverbRoomSize,
    cleanupEps: synth.cleanupEps ?? 0.03,
  })

  const clamp = (v,a,b)=>Math.min(b,Math.max(a,v))
  const uniqSorted = (arr)=>[...new Set(arr)].sort((a,b)=>a-b)

  const ensureSeq = useCallback((seq)=>{
    if (Array.isArray(seq) && seq.length===5 && seq.every(t=>Array.isArray(t) && t.length===16)) return seq
    return Array.from({length:5},()=>Array.from({length:16},()=>[]))
  },[])
  useEffect(()=>{
    if (!sequence || sequence.length!==5) setSequence(ensureSeq(sequence))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  // ───────────────────── DELETE ─────────────────────
  const deleteSelected = useCallback(()=>{
    if (playing) {                  // deletion only when not playing
      console.log('[recorder] ignore delete while playing')
      return
    }
    setSequence(prev=>{
      const base = ensureSeq(prev).map(track=>track.map(slot=>[...slot]))
      const t = clamp(selectedTrack,0,4)
      const targets = (selectedSlots.length?selectedSlots:[0])
      targets.forEach(s=>{ base[t][s]=[] })
      return base
    })
    console.log('[recorder] delete slots:', selectedSlots, 'on track', selectedTrack)
  },[ensureSeq, selectedTrack, selectedSlots, setSequence, playing])

  // ───────────────────── PLAYBACK CLOCK ────────────
  const stepRef = useRef(0)
  const timerRef = useRef(null)
  const stopClock = useCallback(()=>{
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current=null }
  },[])
  const startClock = useCallback(()=>{
    stopClock()
    const ms = Math.max(30, (recDuration ?? 0.5) * 1000)
    timerRef.current = setInterval(()=>{
      const s = stepRef.current
      for (let t=0;t<5;t++){
        if (mutes[t]) continue
        const events = (sequence?.[t]?.[s]) || []
        for (const ev of events) {
          // play with recorded synth params; fall back to current preview if absent
          const evDur = ev?.duration ?? (recDuration ?? 0.5)
          if (ev?.synth) {
            triggerNoteWith(ev.synth, ev.midi, evDur)
          } else {
            triggerNote(ev.midi, evDur)
          }
        }
      }
      stepRef.current = (s+1) % 16
    }, ms)
  },[mutes, sequence, stopClock, triggerNote, triggerNoteWith, recDuration])

  useEffect(()=>{
    if (playing) startClock()
    else stopClock()
    return stopClock
  },[playing, startClock, stopClock])

  // ───────────────────── Controls Layout ───────────
  const topRowZ = -0.32
  const rowGapZ = 0.12
  const firstRowZ = 0.0
  const leftX = -0.32

  const trackSwitches = new Array(5).fill(0).map((_, i) => ({
    i,
    pos: [leftX + i * 0.14, 0, topRowZ]
  }))

  const controlsRowZ = firstRowZ - rowGapZ
  const playPos    = [leftX, 0, controlsRowZ]
  const recPos     = [leftX + 0.14, 0, controlsRowZ]
  const delPos     = [leftX + 0.28, 0, controlsRowZ]
  const delMulPos  = [leftX + 0.42, 0, controlsRowZ]
  const slotDialPos  = [leftX + 0.58, 0, controlsRowZ]
  const trackDialPos = [leftX + 0.76, 0, controlsRowZ]
  const durDialPos   = [leftX + 0.76, 0, controlsRowZ + 0.2]
  const durLabelPos  = [durDialPos[0], durDialPos[1], durDialPos[2]-0.085]

  // ───────────────────── Delete Multiple: range via anchor ───────────
  const [delMulti, setDelMulti] = useState(false)
  const [anchorSlot, setAnchorSlot] = useState(selectedSlots[0] ?? 0)
  const [slotDialVal, setSlotDialVal] = useState(selectedSlots[0] ?? 0)

  useEffect(() => {
    if (!delMulti) {
      const base = selectedSlots[0] ?? 0
      setAnchorSlot(base)
      setSlotDialVal(base)
    }
  }, [delMulti, selectedSlots])

  useEffect(()=>{
    if (!delMulti && selectedSlots.length>1) {
      const keep = selectedSlots[0]
      setSelectedSlots([keep])
      console.log('[recorder] delMulti OFF → collapse to', keep)
    }
  },[delMulti, selectedSlots, setSelectedSlots])

  // ───────────────────── Dials ─────────────────────
  const onSlotDial = useCallback((v)=>{
    const idx = Math.round(clamp(v,0,15))
    setSlotDialVal(idx)

    if (delMulti) {
      const lo = Math.min(anchorSlot, idx)
      const hi = Math.max(anchorSlot, idx)
      const range = []
      for (let i=lo;i<=hi;i++) range.push(i)
      setSelectedSlots(range)
      console.log('[recorder] select range:', `[${lo}..${hi}]`, '(', range.length, 'slots )')
    } else {
      setSelectedSlots([idx])
      console.log('[recorder] select slot:', idx)
    }
  },[delMulti, anchorSlot, setSelectedSlots])

  const onTrackDial = useCallback((v)=>{
    const idx = Math.round(clamp(v,0,4))
    setSelectedTrack(idx)
  },[setSelectedTrack])

  const onDurDial = useCallback((v)=>{
    const sec = Math.round(clamp(v,0.1,1.0)*100)/100
    setRecDuration(sec)                // ← update Canvas state
    console.log('[recorder] transport step (recDuration):', sec, 's')
  },[setRecDuration])

  const prettySel = useMemo(()=>{
    const s = uniqSorted(selectedSlots)
    return s.length>3 ? `${s[0]}..${s[s.length-1]} (${s.length})` : s.join(',')
  },[selectedSlots])

  // ───────────────────── LOGGERS ───────────────────
  useEffect(()=>{ console.log('[recorder] recording:', recording) }, [recording])
  useEffect(()=>{ console.log('[recorder] playing  :', playing) }, [playing])
  useEffect(()=>{ console.log('[recorder] track    :', selectedTrack) }, [selectedTrack])
  useEffect(()=>{ console.log('[recorder] slots    :', selectedSlots) }, [selectedSlots])
  useEffect(()=>{ console.log('[recorder] mutes    :', mutes) }, [mutes])
  useEffect(()=>{ console.log('[recorder] delMulti :', delMulti) }, [delMulti])
  useEffect(()=>{ console.log('[recorder] recDuration :', recDuration) }, [recDuration])

  // ───────────────────── Render ────────────────────
  return (
    <group position={position}>
      {/* Top row: 5 track mute/unmute switches */}
      {trackSwitches.map(({ i, pos }) => (
        <group key={`trk-sw-${i}`} position={pos}>
          <ToggleSwitch
            position={[0,0,0]}
            size={size}
            baseColor={switchBaseColor}
            controlledIsOn={!mutes[i]}
            isOn={!mutes[i]}
            onToggle={(on)=>{
              const next=[...mutes]; next[i]=!on; setMutes(next)
              console.log(`[recorder] Track ${i+1} mute ->`, next[i] ? 'MUTED' : 'UNMUTED')
            }}
          />
          <Plate position={[0, 0, -0.08]} size={[0.16,0.06]} text={`Track ${i+1} ${mutes[i]?'(muted)':''}`} />
        </group>
      ))}

      {/* Row 2: transport + record + delete(s) */}
      <PressablePlanesButton
        mode="toggle"
        position={playPos}
        size={size}
        baseColor={padBaseColor}
        buttonColor={padButtonColor}
        showLabel
        label={playing ? 'Pause' : 'Play'}
        controlledIsOn={playing}
        onToggle={(on)=>{ 
          // Play works only when recording is OFF. If recording is ON and Play is pressed, turn recording OFF first.
          if (on && recording) {
            setRecording(false)
            console.log('[recorder] Play pressed: turning recording OFF')
          }
          const startFrom = (selectedSlots[0] ?? 0) % 16
          if (on) {
            // start playback from current selected slot
            stepRef.current = startFrom
          }
          setPlaying(on)
          console.log('[recorder] transport:', on ? `PLAY (from slot ${startFrom})` : 'PAUSE')
        }}
      />

      {/* RECORD — fully controlled */}
      <ToggleSwitch
        position={recPos}
        size={size}
        baseColor={switchBaseColor}
        controlledIsOn={recording}
        isOn={recording}
        onToggle={(on)=>{
          // If currently playing and recording is turned ON, pause playback.
          if (on && playing) {
            setPlaying(false)
            console.log('[recorder] Recording ON -> stopping playback')
          }
          setRecording(on)
          console.log('[recorder] recording ->', on ? 'ON' : 'OFF')
        }}
      />
      <Plate position={[recPos[0],recPos[1],recPos[2]-0.08]} size={[0.18,0.06]} text={recording ? 'Recording: ON' : 'Recording: OFF'} />

      {/* DELETE (long press) — only executes when not playing; if delMulti ON, turn it OFF after */}
      <PressablePlanesButton
        mode="long-press"
        position={delPos}
        size={size}
        baseColor={padBaseColor}
        buttonColor="#dc3545"
        showLabel
        label="Delete"
        onPressed={()=>{
          deleteSelected()
          if (delMulti) {
            setDelMulti(false)
            console.log('[recorder] Delete pressed → Delete Multiple toggled OFF')
          }
        }}
      />

      {/* Delete Multiple toggle */}
      <PressablePlanesButton
        mode="toggle"
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
          setAnchorSlot(base)
          setSlotDialVal(base)
          if (!on) setSelectedSlots((s) => [s[0] ?? 0])
          console.log('[recorder] delMulti ->', on ? `ON (anchor=${base})` : 'OFF')
        }}
      />

      {/* Dials */}
      <Dial
        position={slotDialPos}
        size={size}
        baseColor={dialBaseColor}
        dialColor={dialColor}
        range={[0,15]}
        step={1}
        stepAngle={Math.PI/12}
        value={slotDialVal}
        onChange={onSlotDial}
      />
      <Plate position={[slotDialPos[0],slotDialPos[1],slotDialPos[2]-0.08]} text={`Slot: ${prettySel || '0'}`} />

      <Dial
        position={trackDialPos}
        size={size}
        baseColor={dialBaseColor}
        dialColor={dialColor}
        range={[0,4]}
        step={1}
        stepAngle={Math.PI/12}
        value={selectedTrack}
        onChange={onTrackDial}
      />
      <Plate position={[trackDialPos[0],trackDialPos[1],trackDialPos[2]-0.08]} text={`Track: ${selectedTrack+1}`} />

      {/* Transport step (recDuration) — lives in Canvas */}
      <Dial
        position={durDialPos}
        size={size}
        baseColor={dialBaseColor}
        dialColor={dialColor}
        range={[0.1,1.0]}
        step={0.05}
        stepAngle={Math.PI/18}
        value={recDuration}
        onChange={onDurDial}
      />
      <Plate position={durLabelPos} text={`Step: ${Number(recDuration).toFixed(2)}s`} />
    </group>
  )
}
