// src/hooks/useTonePad.js
import { useEffect, useMemo, useRef, useCallback } from 'react'
import * as Tone from 'tone'

// midi helpers
const noteToMidi = (name) => {
  // e.g., "C4" -> 60
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
  const startedRef = useRef(false)
  const freeverbRef = useRef(null)
  const compRef = useRef(null)
  const masterVolRef = useRef(null)
  const limiterRef = useRef(null)

  // Build/refresh the shared FX chain
  useEffect(() => {
    if (!freeverbRef.current) {
      const freeverb = new Tone.Freeverb({
        roomSize: reverbRoomSize,
        dampening: 3000,
        wet: reverbMix,
      })
      const comp = new Tone.Compressor({
        threshold: -12,
        ratio: 3,
        attack: 0.003,
        release: 0.25,
      })
      const vol = new Tone.Volume(Tone.gainToDb(masterGain))
      const limiter = new Tone.Limiter(-1)

      freeverb.connect(comp)
      comp.connect(vol)
      vol.connect(limiter)
      limiter.toDestination()

      freeverbRef.current = freeverb
      compRef.current = comp
      masterVolRef.current = vol
      limiterRef.current = limiter
    }
    return () => {
      // keep FX persistent for app lifetime (no automatic dispose)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // live-update FX params
  useEffect(() => {
    if (freeverbRef.current) freeverbRef.current.wet.value = Math.max(0, Math.min(1, reverbMix))
  }, [reverbMix])
  useEffect(() => {
  const f = freeverbRef.current
  if (f?.roomSize) {
    const v = Math.max(0.01, Math.min(1, reverbRoomSize))
    // Tone.Signal (NormalRange) -> set the value
    f.roomSize.value = v
  }
}, [reverbRoomSize])
  useEffect(() => {
    if (masterVolRef.current) masterVolRef.current.volume.value = Tone.gainToDb(Math.max(0, Math.min(1, masterGain)))
  }, [masterGain])

  const ensureAudio = useCallback(async () => {
    if (!startedRef.current) {
      startedRef.current = true
      try { await Tone.start() } catch {}
    }
  }, [])

  // Create one ephemeral voice and schedule its full life
  const playMidi = useCallback(async (midi, durationSec) => {
    if (midi == null) return
    await ensureAudio()

    const freq = 440 * Math.pow(2, (midi - 69) / 12)
    const env = new Tone.AmplitudeEnvelope({
      attack: Math.max(0.001, attack),
      decay: Math.max(0.01, decay),
      sustain: Math.max(0, Math.min(1, sustain)),
      release: Math.max(0.02, release),
      attackCurve: 'sine',
      releaseCurve: 'exponential',
    })

    // osc -> env -> freeverb (-> comp -> vol -> limiter -> dest)
    env.connect(freeverbRef.current)
    const osc = new Tone.Oscillator({ type: waveform, frequency: freq, volume: -9 }).connect(env)

    const now = Tone.now()
    const dur = Math.max(0.01, durationSec ?? 0.5)

    osc.start(now)
    // one-shot: attack then we trigger release at now + dur
    env.triggerAttack(now)
    env.triggerRelease(now + dur)
    // stop osc slightly after release tail + cleanup
    const stopAt = now + dur + env.release + Math.max(0, cleanupEps)
    osc.stop(stopAt)

    // dispose safely after tail
    const ms = (dur + env.release + Math.max(0, cleanupEps) + 0.02) * 1000
    setTimeout(() => {
      try { osc.dispose() } catch {}
      try { env.dispose() } catch {}
    }, ms)
  }, [ensureAudio, waveform, attack, decay, sustain, release, cleanupEps])

  const triggerNote = useCallback((noteOrMidi, durationSec) => {
    const m = typeof noteOrMidi === 'string' ? noteToMidi(noteOrMidi) : noteOrMidi
    playMidi(m, durationSec)
  }, [playMidi])

  return useMemo(() => ({ triggerNote }), [triggerNote])
}
