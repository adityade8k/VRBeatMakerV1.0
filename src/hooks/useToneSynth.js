// hooks/useToneSynth.js
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import * as Tone from 'tone'

const midiFromNote = {
  C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71,
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12)

export function useToneSynth({
  initAttack = 0.10,
  initDecay = 0.10,
  initSustain = 0.80,
  initRelease = 0.20,
  initMaster = 0.80,
  cleanupEps = 0.02,         // small tail after release before disposal
} = {}) {
  // Mutable synth params (controlled by UI or defaults)
  const [attack, setAttack]   = useState(initAttack)
  const [decay, setDecay]     = useState(initDecay)
  const [sustain, setSustain] = useState(initSustain)
  const [release, setRelease] = useState(initRelease)
  const [master, setMaster]   = useState(initMaster)

  // Master chain: Compressor -> Volume -> Destination
  const compRef   = useRef(null)
  const volRef    = useRef(null)

  // Per-note voice stacks: noteName -> [{ osc, env }]
  const voicesRef = useRef({
    C4: [], D4: [], E4: [], F4: [], G4: [], A4: [], B4: [],
  })

  // Build master chain once
  useEffect(() => {
    const comp = new Tone.Compressor({ threshold: -12, ratio: 3, attack: 0.003, release: 0.25 })
    const vol  = new Tone.Volume(Tone.gainToDb(master)).toDestination()
    comp.connect(vol)

    compRef.current = comp
    volRef.current  = vol
    return () => {
      try { comp.dispose() } catch {}
      try { vol.dispose() } catch {}
    }
  }, []) // eslint-disable-line

  // React to master volume changes
  useEffect(() => {
    if (!volRef.current) return
    volRef.current.volume.value = Tone.gainToDb(clamp(master, 0, 1))
  }, [master])

  const createVoice = useCallback((noteName) => {
    const m = midiFromNote[noteName]
    if (m == null) return null

    const env = new Tone.AmplitudeEnvelope({
      attack:  Math.max(0, attack),
      decay:   Math.max(0, decay),
      sustain: clamp(sustain, 0, 1),
      release: Math.max(0, release),
    })

    // osc -> env -> comp -> vol -> destination
    env.connect(compRef.current)

    const osc = new Tone.Oscillator({
      type: 'sine',
      frequency: midiToFreq(m),
    }).connect(env)

    const now = Tone.now()
    osc.start(now)
    env.triggerAttack(now)

    return { osc, env }
  }, [attack, decay, sustain, release])

  const noteOn = useCallback(async (noteName) => {
    await Tone.start().catch(() => {}) // unlock audio on first user gesture
    const v = createVoice(noteName)
    if (!v) return
    voicesRef.current[noteName].push(v)
  }, [createVoice])

  const noteOff = useCallback((noteName) => {
    const stack = voicesRef.current[noteName]
    if (!stack || stack.length === 0) return
    const v = stack.pop()
    const now = Tone.now()

    // Release, stop & cleanup after tail + buffer
    v.env.triggerRelease(now)
    const stopAt = now + Math.max(0, release) + Math.max(0, cleanupEps)
    v.osc.stop(stopAt)

    const ms = (Math.max(0, release) + Math.max(0, cleanupEps) + 0.01) * 1000
    setTimeout(() => {
      try { v.osc.dispose() } catch {}
      try { v.env.dispose() } catch {}
    }, ms)
  }, [release, cleanupEps])

  return {
    // Triggers
    noteOn, noteOff,

    // Params + setters (expose to UI if needed)
    attack, setAttack,
    decay, setDecay,
    sustain, setSustain,
    release, setRelease,
    master, setMaster,
  }
}
