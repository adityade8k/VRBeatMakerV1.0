// src/hooks/useTonePad.js
import { useEffect, useMemo, useRef, useCallback } from 'react'
import * as Tone from 'tone'

// ───────────────────────────────── Helpers ────────────────────────────────
const noteToMidi = (name) => {
  const p = { C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 }
  const m = name.match(/^([A-G]#?|[A-G]b)(-?\d+)$/i)
  if (!m) return null
  const semis = p[m[1].toUpperCase()]
  const oct = parseInt(m[2], 10)
  return 12 * (oct + 1) + semis
}
const clamp01 = (v) => Math.max(0, Math.min(1, v))
const atLeast = (v, m) => (Number.isFinite(v) ? Math.max(m, v) : m)

// ───────────────────────────────── Hook ───────────────────────────────────
export function useTonePad({
  waveform = 'sine',
  attack = 0.02,
  decay = 0.12,
  sustain = 0.8,
  release = 0.25,

  reverbMix = 0.25,
  reverbRoomSize = 0.3,
  masterGain = 0.7,

  cleanupEps = 0.03,
} = {}) {
  const startedRef   = useRef(false)
  const freeverbRef  = useRef(null)
  const compRef      = useRef(null)
  const masterVolRef = useRef(null)
  const limiterRef   = useRef(null)

  // value = absolute stop time (Tone.now() seconds) after release+cleanup
  const busyUntilRef = useRef(new Map()) // midi -> number

  // Build the shared FX chain once
  useEffect(() => {
    if (!freeverbRef.current) {
      const freeverb = new Tone.Freeverb({
        roomSize: clamp01(reverbRoomSize),
        dampening: 3000,
        wet: clamp01(reverbMix),
      })
      const comp = new Tone.Compressor({ threshold: -12, ratio: 3, attack: 0.003, release: 0.25 })
      const vol = new Tone.Volume(Tone.gainToDb(clamp01(masterGain)))
      const limiter = new Tone.Limiter(-1)

      freeverb.connect(comp)
      comp.connect(vol)
      vol.connect(limiter)
      limiter.toDestination()

      freeverbRef.current  = freeverb
      compRef.current      = comp
      masterVolRef.current = vol
      limiterRef.current   = limiter
    }
  }, []) // keep chain for app lifetime

  // Live-update FX params for the "default" chain values
  useEffect(() => {
    const f = freeverbRef.current
    if (f) f.wet.value = clamp01(reverbMix)
  }, [reverbMix])
  useEffect(() => {
    const f = freeverbRef.current
    if (f?.roomSize) f.roomSize.value = clamp01(reverbRoomSize)
  }, [reverbRoomSize])
  useEffect(() => {
    const vol = masterVolRef.current
    if (vol) vol.volume.value = Tone.gainToDb(clamp01(masterGain))
  }, [masterGain])

  const ensureAudio = useCallback(async () => {
    if (!startedRef.current) {
      startedRef.current = true
      try { await Tone.start() } catch {}
    }
  }, [])

  // Lower-level voice spawner that accepts an explicit parameter set
  const playMidiWith = useCallback(async (params, midi, durationSec) => {
    if (midi == null) return false
    await ensureAudio()
    if (!freeverbRef.current) return false

    const now = Tone.now()
    const existingStop = busyUntilRef.current.get(midi) ?? -Infinity
    if (now < existingStop - 1e-4) return false

    const freq = 440 * Math.pow(2, (midi - 69) / 12)

    const env = new Tone.AmplitudeEnvelope({
      attack : atLeast(params.attack, 0.001),
      decay  : atLeast(params.decay , 0.01),
      sustain: clamp01(params.sustain),
      release: atLeast(params.release, 0.02),
      attackCurve: 'sine',
      releaseCurve: 'exponential',
    })
    const osc = new Tone.Oscillator({
      type: params.waveform,
      frequency: freq,
      volume: -9,
    })
    const voiceGain = new Tone.Gain(1)

    osc.connect(env)
    env.connect(voiceGain)

    // Use the shared Freeverb; set its wet/room only if overrides are present
    // (we do NOT mutate the shared instance permanently for per-voice overrides;
    // the "recorded" params are used for envelope+osc; FX character is close
    // enough via the global chain; if you want per-voice FX, add a per-voice Freeverb.)
    voiceGain.connect(freeverbRef.current)

    const dur    = atLeast(durationSec ?? 0.5, 0.01)
    const rel    = Number(env.release ?? 0.25)
    const tail   = Math.max(0, params.cleanupEps ?? cleanupEps)
    const stopAt = now + dur + rel + tail

    busyUntilRef.current.set(midi, stopAt)

    osc.start(now)
    env.triggerAttack(now)
    env.triggerRelease(now + dur)

    const vg = voiceGain.gain
    vg.cancelScheduledValues(now)
    vg.setValueAtTime(vg.value, now)
    const microRampEnd = stopAt + 0.012
    vg.linearRampToValueAtTime(0, microRampEnd)

    const oscStopTime = microRampEnd + 0.01
    osc.stop(oscStopTime)

    const cleanupDelayMs = (oscStopTime - now + 0.06) * 1000
    const tid = setTimeout(() => {
      try { osc.disconnect() } catch {}
      try { env.disconnect() } catch {}
      try { voiceGain.disconnect() } catch {}
      try { osc.dispose() } catch {}
      try { env.dispose() } catch {}
      try { voiceGain.dispose() } catch {}
      if ((busyUntilRef.current.get(midi) ?? -Infinity) <= stopAt + 1e-6) {
        busyUntilRef.current.delete(midi)
      }
    }, cleanupDelayMs)
    void tid

    return true
  }, [ensureAudio, cleanupEps])

  // Default-params wrapper
  const playMidi = useCallback((midi, durationSec) => {
    return playMidiWith(
      { waveform, attack, decay, sustain, release, cleanupEps },
      midi,
      durationSec
    )
  }, [playMidiWith, waveform, attack, decay, sustain, release, cleanupEps])

  const triggerNote = useCallback((noteOrMidi, durationSec) => {
    const m = typeof noteOrMidi === 'string' ? noteToMidi(noteOrMidi) : noteOrMidi
    return playMidi(m, durationSec)
  }, [playMidi])

  // NEW: trigger with explicit parameter overrides (used by recorder playback)
  const triggerNoteWith = useCallback((params, noteOrMidi, durationSec) => {
    const m = typeof noteOrMidi === 'string' ? noteToMidi(noteOrMidi) : noteOrMidi
    return playMidiWith(
      {
        waveform: params.waveform ?? waveform,
        attack: params.attack ?? attack,
        decay: params.decay ?? decay,
        sustain: params.sustain ?? sustain,
        release: params.release ?? release,
        cleanupEps: params.cleanupEps ?? cleanupEps,
      },
      m,
      durationSec
    )
  }, [playMidiWith, waveform, attack, decay, sustain, release, cleanupEps])

  return useMemo(() => ({ triggerNote, triggerNoteWith }), [triggerNote, triggerNoteWith])
}
