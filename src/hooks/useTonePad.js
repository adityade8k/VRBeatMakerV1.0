import { useEffect, useMemo, useRef, useCallback } from 'react'
import * as Tone from 'tone'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
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
  cleanupEps = 0.03,    // extra seconds after release tail
} = {}) {
  const startedRef   = useRef(false)
  const freeverbRef  = useRef(null)
  const compRef      = useRef(null)
  const masterVolRef = useRef(null)
  const limiterRef   = useRef(null)

  // Track when a MIDI note is "busy" (so fast retriggers don't pop)
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
      const limiter = new Tone.Limiter(-1) // final safety

      // Freeverb as the first FX so it sees the raw voice envelope and can tail out
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

  // Live-update FX params
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

  // Create one ephemeral voice with click-safe teardown
  const playMidi = useCallback(async (midi, durationSec) => {
    if (midi == null) return false
    await ensureAudio()
    if (!freeverbRef.current) return false

    const now = Tone.now()
    const existingStop = busyUntilRef.current.get(midi) ?? -Infinity
    // Guard: if note is still ringing (incl. tail), ignore
    if (now < existingStop - 1e-4) return false

    const freq = 440 * Math.pow(2, (midi - 69) / 12)

    // Per-voice nodes (fresh every time)
    const env = new Tone.AmplitudeEnvelope({
      attack : atLeast(attack, 0.001),
      decay  : atLeast(decay , 0.01),
      sustain: clamp01(sustain),
      release: atLeast(release, 0.02),
      attackCurve: 'sine',
      releaseCurve: 'exponential',
    })
    const osc = new Tone.Oscillator({
      type: waveform,
      frequency: freq,
      volume: -9,
    })

    // Small per-voice bus so we can post-fade to absolute 0 (click killer)
    const voiceGain = new Tone.Gain(1)

    // Chain: osc -> env -> voiceGain -> Freeverb -> ...
    osc.connect(env)
    env.connect(voiceGain)
    voiceGain.connect(freeverbRef.current)

    const dur    = atLeast(durationSec ?? 0.5, 0.01)
    const rel    = Number(env.release ?? 0.25)
    const tail   = Math.max(0, cleanupEps)
    const stopAt = now + dur + rel + tail

    // Mark this MIDI note busy until its final stop time
    busyUntilRef.current.set(midi, stopAt)

    // Start + schedule envelope
    osc.start(now)
    env.triggerAttack(now)
    env.triggerRelease(now + dur)

    // ── Click-safe teardown sequence ──────────────────────────────────────────
    // 1) Post-envelope micro-ramp on the per-voice gain to guarantee ABSOLUTE zero
    const vg = voiceGain.gain
    vg.cancelScheduledValues(now)
    vg.setValueAtTime(vg.value, now)
    // Slightly past envelope/cleanup end, linearly ramp to 0 (10–20ms)
    const microRampEnd = stopAt + 0.012
    vg.linearRampToValueAtTime(0, microRampEnd)

    // 2) Stop oscillator a touch AFTER the micro-ramp has reached 0
    const oscStopTime = microRampEnd + 0.01
    osc.stop(oscStopTime)

    // 3) Delay cleanup so reverb/limiter never see a step change
    const cleanupDelayMs = (oscStopTime - now + 0.06) * 1000
    const tid = setTimeout(() => {
      try { osc.disconnect() } catch {}
      try { env.disconnect() } catch {}
      try { voiceGain.disconnect() } catch {}
      try { osc.dispose() } catch {}
      try { env.dispose() } catch {}
      try { voiceGain.dispose() } catch {}
      // Free busy flag (only if we're the latest stop)
      if ((busyUntilRef.current.get(midi) ?? -Infinity) <= stopAt + 1e-6) {
        busyUntilRef.current.delete(midi)
      }
    }, cleanupDelayMs)
    // ─────────────────────────────────────────────────────────────────────────

    return true
  }, [ensureAudio, waveform, attack, decay, sustain, release, cleanupEps])

  const triggerNote = useCallback((noteOrMidi, durationSec) => {
    const m = typeof noteOrMidi === 'string' ? noteToMidi(noteOrMidi) : noteOrMidi
    return playMidi(m, durationSec)
  }, [playMidi])

  return useMemo(() => ({ triggerNote }), [triggerNote])
}
