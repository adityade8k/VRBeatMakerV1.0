import { useEffect, useRef, useState, useCallback } from 'react'
import * as Tone from 'tone'

const midiFromNote = { C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71 }
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12)

export function useToneSynth({
  // Slightly slower defaults to avoid clicks/edge harshness
  initAttack = 0.02,
  initDecay = 0.12,
  initSustain = 0.85,
  initRelease = 0.25,
  initMaster = 0.75,
  cleanupEps = 0.03,

  // Tone shaping
  initCutoff = 8000,   // Hz, gentle low-pass to shave highs
  initResonance = 0.7, // Q
  initRevWet = 0.10,   // 0..1
  initRevDecay = 1.2,  // seconds

  // Softer compressor
  compThreshold = -18,
  compRatio = 2.5,
  compAttack = 0.01,
  compRelease = 0.25,
} = {}) {
  // Mutable params
  const [attack, setAttack]     = useState(initAttack)
  const [decay, setDecay]       = useState(initDecay)
  const [sustain, setSustain]   = useState(initSustain)
  const [release, setRelease]   = useState(initRelease)
  const [master, setMaster]     = useState(initMaster)

  const [cutoff, setCutoff]     = useState(initCutoff)
  const [resonance, setRes]     = useState(initResonance)
  const [revWet, setRevWet]     = useState(initRevWet)
  const [revDecay, setRevDecay] = useState(initRevDecay)

  // Master chain refs
  const compRef   = useRef(null)
  const volRef    = useRef(null)
  const lpRef     = useRef(null)   // low-pass between env and comp
  const revRef    = useRef(null)   // subtle reverb before comp (glue)

  // Per-note voice stacks
  const voicesRef = useRef({ C4: [], D4: [], E4: [], F4: [], G4: [], A4: [], B4: [] })

  // Build master chain once
  useEffect(() => {
    const lp  = new Tone.Filter({ type: 'lowpass', frequency: initCutoff, Q: initResonance })
    const rev = new Tone.Reverb({ decay: initRevDecay, wet: initRevWet })
    const comp = new Tone.Compressor({
      threshold: compThreshold, ratio: compRatio, attack: compAttack, release: compRelease
    })
    const vol  = new Tone.Volume(Tone.gainToDb(initMaster)).toDestination()

    // Order: (env connects here) -> LP -> Reverb -> Comp -> Vol -> Destination
    lp.chain(rev, comp, vol)

    lpRef.current   = lp
    revRef.current  = rev
    compRef.current = comp
    volRef.current  = vol

    return () => {
      try { lp.dispose() } catch {}
      try { rev.dispose() } catch {}
      try { comp.dispose() } catch {}
      try { vol.dispose() } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reactive params
  useEffect(() => {
    if (volRef.current) volRef.current.volume.value = Tone.gainToDb(clamp(master, 0, 1))
  }, [master])

  useEffect(() => {
    if (!lpRef.current) return
    lpRef.current.frequency.value = clamp(cutoff, 200, 20000)
    lpRef.current.Q.value = clamp(resonance, 0.2, 2.5)
  }, [cutoff, resonance])

  useEffect(() => {
    if (!revRef.current) return
    revRef.current.wet.value = clamp(revWet, 0, 1)
    // Tone.Reverb’s decay can be reassigned; constructing new can pop, so adjust gently
    try { revRef.current.decay = clamp(revDecay, 0.2, 6) } catch {}
  }, [revWet, revDecay])

  const createVoice = useCallback((noteName) => {
    const m = midiFromNote[noteName]
    if (m == null) return null

    const env = new Tone.AmplitudeEnvelope({
      attack:  Math.max(0.001, attack),     // never zero to avoid clicks
      decay:   Math.max(0.01, decay),
      sustain: clamp(sustain, 0, 1),
      release: Math.max(0.02, release),
      attackCurve: 'sine',                   // softer attack curve
      releaseCurve: 'exponential',           // natural tail
    })

    // Connect env -> low-pass (then reverb -> comp -> vol)
    env.connect(lpRef.current)

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
    await Tone.start().catch(() => {})
    const v = createVoice(noteName)
    if (!v) return
    voicesRef.current[noteName].push(v)
  }, [createVoice])

  const noteOff = useCallback((noteName) => {
    const stack = voicesRef.current[noteName]
    if (!stack || stack.length === 0) return
    const v = stack.pop()
    const now = Tone.now()

    v.env.triggerRelease(now)

    const stopAt = now + Math.max(0.02, release) + Math.max(0, cleanupEps)
    v.osc.stop(stopAt)

    const ms = (Math.max(0.02, release) + Math.max(0, cleanupEps) + 0.02) * 1000
    setTimeout(() => {
      try { v.osc.dispose() } catch {}
      try { v.env.dispose() } catch {}
    }, ms)
  }, [release, cleanupEps])

  return {
    // Triggers
    noteOn, noteOff,

    // ADSR + master
    attack, setAttack,
    decay, setDecay,
    sustain, setSustain,
    release, setRelease,
    master, setMaster,

    // Tone-shaping
    cutoff, setCutoff,
    resonance, setRes,
    revWet, setRevWet,
    revDecay, setRevDecay,
  }
}
