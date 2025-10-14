// components/Piano.jsx
import React, { useMemo, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import PressablePlanesButton from '../button'

/**
 * Standalone XR Piano (C4..B4) with a built-in Tone.js engine.
 * - Per-press voices (osc → lowpass → amp env → Freeverb → Comp → Master → Limiter → Destination)
 * - Gentle low-pass per voice to tame harshness when stacking notes
 * - Shared FX bus provides the "glue" (like your smoother DIV version)
 * - Safe headroom to avoid intermodulation harshness/clipping
 */
export default function Piano({
  origin = [0, 0.9, -0.35],
  keySpacing = 0.11,
  size = [0.1, 0.1],
  buttonScale = 0.65,
  gap = 0.006,
  speed = 50,
  baseColor = '#6987f5',
  buttonColor = '#0370ff',
}) {
  // --------------------------
  // Shared FX / Master chain
  // --------------------------
  const startedRef = useRef(false)
  const freeverbRef = useRef(null)
  const compRef = useRef(null)
  const masterVolRef = useRef(null)
  const limiterRef = useRef(null)

  // Active voices per note label
  const activeVoicesRef = useRef(new Map()) // label -> Array<Voice>

  // Envelope & tone defaults (mellow)
  const envDefaultsRef = useRef({
    attack: 0.02,
    decay: 0.12,
    sustain: 0.7,
    release: 0.25,
  })
  const masterGainRef = useRef(0.65) // 0..1

  useEffect(() => {
    // Create the shared FX bus once
    if (!freeverbRef.current) {
      const freeverb = new Tone.Freeverb({
        roomSize: 0.30,
        dampening: 3000,
        wet: 0.25,
      })
      const comp = new Tone.Compressor({
        threshold: -12,
        ratio: 3,
        attack: 0.003,
        release: 0.25,
      })
      const masterVol = new Tone.Volume(Tone.gainToDb(masterGainRef.current))
      const limiter = new Tone.Limiter(-1)

      // Route: Voices → Freeverb → Compressor → Master → Limiter → Destination
      freeverb.connect(comp)
      comp.connect(masterVol)
      masterVol.connect(limiter)
      limiter.toDestination()

      freeverbRef.current = freeverb
      compRef.current = comp
      masterVolRef.current = masterVol
      limiterRef.current = limiter
    }

    return () => {
      // Optional cleanup if you ever unmount the piano entirely
      // (Typically you keep it around for the app lifetime.)
      // Try/catch to protect if already disposed.
      try { freeverbRef.current?.disconnect(); } catch {}
      try { compRef.current?.disconnect(); } catch {}
      try { masterVolRef.current?.disconnect(); } catch {}
      try { limiterRef.current?.disconnect(); } catch {}
    }
  }, [])

  // --------------------------
  // Key layout (C4..B4)
  // --------------------------
  const keys = useMemo(() => ([
    { label: 'C4', midi: 60, x: -3 },
    { label: 'D4', midi: 62, x: -2 },
    { label: 'E4', midi: 64, x: -1 },
    { label: 'F4', midi: 65, x:  0 },
    { label: 'G4', midi: 67, x:  1 },
    { label: 'A4', midi: 69, x:  2 },
    { label: 'B4', midi: 71, x:  3 },
  ]), [])

  // --------------------------
  // Helpers
  // --------------------------
  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12)

  function ensureAudioStarted() {
    if (!startedRef.current) {
      startedRef.current = true
      // Kick Tone’s AudioContext on first interaction
      Tone.start().catch(() => {})
    }
  }

  function createVoice(midi) {
    const freq = midiToFreq(midi)
    const now = Tone.now()

    // Gentle LPF per voice; smooth highs when stacking notes
    const lpf = new Tone.Filter({
      type: 'lowpass',
      frequency: 9000, // Hz; lower for softer, higher for brighter
      Q: 0.2,
    })

    const env = new Tone.AmplitudeEnvelope(envDefaultsRef.current)

    // Softer timbre (sine). If you prefer triangle, keep LPF or lower cutoff.
    const osc = new Tone.Oscillator({
      type: 'sine',
      frequency: freq,
      volume: -9, // per-voice attenuation for mix headroom
    })

    // Route voice: osc → lpf → env → shared Freeverb
    osc.connect(lpf)
    lpf.connect(env)
    env.connect(freeverbRef.current)

    osc.start(now)
    env.triggerAttack(now)

    return { osc, env, lpf }
  }

  function noteOn(label, midi) {
    ensureAudioStarted()
    const map = activeVoicesRef.current
    if (!map.has(label)) map.set(label, [])
    const arr = map.get(label)
    const v = createVoice(midi)
    arr.push(v)
  }

  function noteOff(label) {
    const map = activeVoicesRef.current
    const arr = map.get(label)
    if (!arr || arr.length === 0) return
    const v = arr.pop()

    const now = Tone.now()
    v.env.triggerRelease(now)

    const stopAt = now + (v.env.release ?? envDefaultsRef.current.release) + 0.03
    v.osc.stop(stopAt)

    // Dispose after release tail
    const ms = ((v.env.release ?? envDefaultsRef.current.release) + 0.06) * 1000
    setTimeout(() => {
      try { v.osc.dispose() } catch {}
      try { v.env.dispose() } catch {}
      try { v.lpf.dispose() } catch {}
    }, ms)
  }

  // --------------------------
  // Render 7 XR keys
  // --------------------------
  return (
    <group>
      {keys.map(({ label, midi, x }) => (
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
          baseColor={baseColor}
          buttonColor={buttonColor}
          onPressDown={() => noteOn(label, midi)}
          onPressUp={() => noteOff(label)}
          onPressed={() => {}}
        />
      ))}
    </group>
  )
}
