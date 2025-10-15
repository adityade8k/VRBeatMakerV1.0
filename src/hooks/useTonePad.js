import { useEffect, useMemo, useRef, useCallback } from 'react'
import * as Tone from 'tone'

// midi helpers
const noteToMidi = (name) => {
  const p = { C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6, G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 }
  const m = name.match(/^([A-G]#?|[A-G]b)(-?\d+)$/i)
  if (!m) return null
  const semis = p[m[1].toUpperCase()]
  const oct = parseInt(m[2], 10)
  return 12 * (oct + 1) + semis
}

export function useTonePad({
  // synthesis
  waveform = 'sine',
  attack = 0.02,
  decay = 0.12,
  sustain = 0.8,
  release = 0.25,

  // fx
  reverbMix = 0.25,     // 0..1
  reverbRoomSize = 0.3, // 0..1  (Freeverb roomSize)
  masterGain = 0.7,     // 0..1

  // safety/cleanup
  cleanupEps = 0.03,    // seconds after release tail
} = {}) {
  const startedRef   = useRef(false)
  const freeverbRef  = useRef(null)
  const compRef      = useRef(null)
  const masterVolRef = useRef(null)
  const limiterRef   = useRef(null)

  // NEW: keep track of when a MIDI note is "busy"
  // value = absolute stop time (Tone.now() seconds) after release tail + cleanup
  const busyUntilRef = useRef(new Map()) // midi -> number

  // Build the shared FX chain once
  useEffect(() => {
    if (!freeverbRef.current) {
      const freeverb = new Tone.Freeverb({
        roomSize: reverbRoomSize,
        dampening: 3000,
        wet: reverbMix,
      })
      const comp = new Tone.Compressor({
        threshold: -12, ratio: 3, attack: 0.003, release: 0.25,
      })
      const vol = new Tone.Volume(Tone.gainToDb(masterGain))
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
    // keep FX for app lifetime
  }, []) // eslint-disable-line

  // live-update FX params
  useEffect(() => {
    const f = freeverbRef.current
    if (f) f.wet.value = Math.max(0, Math.min(1, reverbMix))
  }, [reverbMix])

  useEffect(() => {
    const f = freeverbRef.current
    if (f?.roomSize) {
      const v = Math.max(0.01, Math.min(1, reverbRoomSize))
      f.roomSize.value = v          // <- important: update the Signal's value
    }
  }, [reverbRoomSize])

  useEffect(() => {
    const vol = masterVolRef.current
    if (vol) vol.volume.value = Tone.gainToDb(Math.max(0, Math.min(1, masterGain)))
  }, [masterGain])

  const ensureAudio = useCallback(async () => {
    if (!startedRef.current) {
      startedRef.current = true
      try { await Tone.start() } catch {}
    }
  }, [])

  // Create one ephemeral voice, with busy-guard and thorough cleanup
  const playMidi = useCallback(async (midi, durationSec) => {
    if (midi == null) return false
    await ensureAudio()

    const now = Tone.now()
    const existingStop = busyUntilRef.current.get(midi) ?? -Infinity
    // GUARD: if this note is still ringing (including tail), ignore
    if (now < existingStop - 1e-4) return false

    const freq = 440 * Math.pow(2, (midi - 69) / 12)

    // Per-voice nodes (fresh every time)
    const env  = new Tone.AmplitudeEnvelope({
      attack: Math.max(0.001, attack),
      decay: Math.max(0.01, decay),
      sustain: Math.max(0, Math.min(1, sustain)),
      release: Math.max(0.02, release),
      attackCurve: 'sine',
      releaseCurve: 'exponential',
    })
    const osc  = new Tone.Oscillator({
      type: waveform,
      frequency: freq,
      volume: -9,
    })
    const voiceGain = new Tone.Gain(1) // small per-voice bus

    // chain: osc -> env -> voiceGain -> Freeverb -> ...
    osc.connect(env)
    env.connect(voiceGain)
    voiceGain.connect(freeverbRef.current)

    const dur    = Math.max(0.01, durationSec ?? 0.5)
    const rel    = env.release
    const stopAt = now + dur + rel + Math.max(0, cleanupEps)

    // Mark this MIDI note busy until its final stop time
    busyUntilRef.current.set(midi, stopAt)

    // schedule
    osc.start(now)
    env.triggerAttack(now)
    env.triggerRelease(now + dur)
    osc.stop(stopAt) // be sure osc stops after tail

    // Thorough cleanup in order (disconnect first, then dispose)
    const ms = (stopAt - now + 0.02) * 1000
    const tid = setTimeout(() => {
      try { osc.disconnect() } catch {}
      try { env.disconnect() } catch {}
      try { voiceGain.disconnect() } catch {}
      try { osc.dispose() } catch {}
      try { env.dispose() } catch {}
      try { voiceGain.dispose() } catch {}
      // free the busy flag (in case anything lingers)
      if (busyUntilRef.current.get(midi) <= stopAt + 1e-6) {
        busyUntilRef.current.delete(midi)
      }
    }, ms)

    // return true when the note was actually triggered
    return true
  }, [ensureAudio, waveform, attack, decay, sustain, release, cleanupEps])

  const triggerNote = useCallback((noteOrMidi, durationSec) => {
    const m = typeof noteOrMidi === 'string' ? noteToMidi(noteOrMidi) : noteOrMidi
    return playMidi(m, durationSec)
  }, [playMidi])

  return useMemo(() => ({ triggerNote }), [triggerNote])
}
