import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import PressablePlanesButton from '../../components/button'
import BitmapText from '../../components/bitmapText'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export default function InstrumentsPanel({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],

  currentSettings,
  onLoadInstrument,

  panelWidth = 0.42,
  panelHeight = 0.35,
  buttonSize = [0.08, 0.08],
  itemHeight = 0.055,
  saveButtonColor = '#22c55e',
  deleteButtonColor = '#dc3545',
  loadButtonColor = '#3b82f6',
}) {
  const [instruments, setInstruments] = useState([])
  const [instrumentName, setInstrumentName] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [scrollOffset, setScrollOffset] = useState(0)

  const fetchInstruments = useCallback(async () => {
    const { data, error } = await supabase
      .from('instruments')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setInstruments(data)
    }
  }, [])

  useEffect(() => {
    fetchInstruments()
  }, [fetchInstruments])

  const saveInstrument = useCallback(async () => {
    if (!instrumentName.trim()) {
      alert('Please enter an instrument name')
      return
    }

    const { error } = await supabase
      .from('instruments')
      .insert([{
        name: instrumentName,
        waveform: currentSettings.waveform,
        attack: currentSettings.attack,
        decay: currentSettings.decay,
        sustain: currentSettings.sustain,
        release: currentSettings.release,
        duration: currentSettings.duration,
        reverb_mix: currentSettings.reverbMix,
        reverb_room_size: currentSettings.reverbRoomSize,
      }])

    if (!error) {
      setInstrumentName('')
      fetchInstruments()
    }
  }, [instrumentName, currentSettings, fetchInstruments])

  const deleteInstrument = useCallback(async (id) => {
    const { error } = await supabase
      .from('instruments')
      .delete()
      .eq('id', id)

    if (!error) {
      fetchInstruments()
      if (selectedId === id) setSelectedId(null)
    }
  }, [fetchInstruments, selectedId])

  const loadInstrument = useCallback((inst) => {
    onLoadInstrument({
      waveform: inst.waveform,
      attack: inst.attack,
      decay: inst.decay,
      sustain: inst.sustain,
      release: inst.release,
      duration: inst.duration,
      reverbMix: inst.reverb_mix,
      reverbRoomSize: inst.reverb_room_size,
    })
    setSelectedId(inst.id)
  }, [onLoadInstrument])

  const visibleItems = 5
  const maxScroll = Math.max(0, instruments.length - visibleItems)

  const visibleInstruments = useMemo(() => {
    const start = Math.floor(scrollOffset)
    return instruments.slice(start, start + visibleItems)
  }, [instruments, scrollOffset, visibleItems])

  const nameInputChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '
  const [nameInputIdx, setNameInputIdx] = useState(0)

  const cycleChar = useCallback(() => {
    const currentChar = instrumentName[nameInputIdx] || ' '
    const idx = nameInputChars.indexOf(currentChar.toUpperCase())
    const nextIdx = (idx + 1) % nameInputChars.length
    const nextChar = nameInputChars[nextIdx]

    const newName = instrumentName.split('')
    newName[nameInputIdx] = nextChar
    setInstrumentName(newName.join('').slice(0, 12))
  }, [instrumentName, nameInputIdx, nameInputChars])

  const advanceCursor = useCallback(() => {
    if (nameInputIdx < 11) {
      setNameInputIdx(i => i + 1)
    }
  }, [nameInputIdx])

  const backspace = useCallback(() => {
    if (instrumentName.length > 0) {
      setInstrumentName(instrumentName.slice(0, -1))
      setNameInputIdx(Math.max(0, nameInputIdx - 1))
    }
  }, [instrumentName, nameInputIdx])

  const clearName = useCallback(() => {
    setInstrumentName('')
    setNameInputIdx(0)
  }, [])

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[panelWidth, panelHeight]} />
        <meshStandardMaterial
          color="#1e293b"
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>

      <BitmapText
        text="INSTRUMENTS"
        position={[-panelWidth * 0.44, 0.002, -panelHeight * 0.42]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.028, 0.028, 0.028]}
        color="#f1f5f9"
        align="left"
        anchorY="top"
      />

      <BitmapText
        text={`Name: ${instrumentName || '_'}${nameInputIdx < instrumentName.length ? '' : '_'}`}
        position={[-panelWidth * 0.44, 0.002, -panelHeight * 0.32]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.022, 0.022, 0.022]}
        color="#cbd5e1"
        align="left"
        anchorY="top"
      />

      <PressablePlanesButton
        mode="long-press"
        position={[-panelWidth * 0.27, 0.003, -panelHeight * 0.18]}
        size={[0.06, 0.06]}
        buttonScale={0.55}
        baseColor={loadButtonColor}
        buttonColor={loadButtonColor}
        showLabel
        label="Char"
        labelColor="#ffffff"
        labelScale={0.28}
        onPressed={cycleChar}
      />

      <PressablePlanesButton
        mode="long-press"
        position={[-panelWidth * 0.15, 0.003, -panelHeight * 0.18]}
        size={[0.06, 0.06]}
        buttonScale={0.55}
        baseColor={loadButtonColor}
        buttonColor={loadButtonColor}
        showLabel
        label="Next"
        labelColor="#ffffff"
        labelScale={0.28}
        onPressed={advanceCursor}
      />

      <PressablePlanesButton
        mode="long-press"
        position={[-panelWidth * 0.03, 0.003, -panelHeight * 0.18]}
        size={[0.06, 0.06]}
        buttonScale={0.55}
        baseColor={deleteButtonColor}
        buttonColor={deleteButtonColor}
        showLabel
        label="Back"
        labelColor="#ffffff"
        labelScale={0.28}
        onPressed={backspace}
      />

      <PressablePlanesButton
        mode="long-press"
        position={[panelWidth * 0.09, 0.003, -panelHeight * 0.18]}
        size={[0.06, 0.06]}
        buttonScale={0.55}
        baseColor={deleteButtonColor}
        buttonColor={deleteButtonColor}
        showLabel
        label="Clear"
        labelColor="#ffffff"
        labelScale={0.28}
        onPressed={clearName}
      />

      <PressablePlanesButton
        mode="long-press"
        position={[panelWidth * 0.28, 0.003, -panelHeight * 0.18]}
        size={buttonSize}
        buttonScale={0.55}
        baseColor={saveButtonColor}
        buttonColor={saveButtonColor}
        showLabel
        label="Save"
        labelColor="#ffffff"
        labelScale={0.3}
        onPressed={saveInstrument}
      />

      {visibleInstruments.map((inst, idx) => {
        const y = -panelHeight * 0.02 + idx * itemHeight
        const isSelected = inst.id === selectedId

        return (
          <group key={inst.id}>
            <mesh position={[0, 0.002, y]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[panelWidth * 0.92, itemHeight * 0.85]} />
              <meshStandardMaterial
                color={isSelected ? '#3b82f6' : '#334155'}
                transparent
                opacity={0.6}
              />
            </mesh>

            <BitmapText
              text={inst.name}
              position={[-panelWidth * 0.42, 0.003, y]}
              rotation={[-Math.PI / 2, 0, 0]}
              scale={[0.02, 0.02, 0.02]}
              color="#f1f5f9"
              align="left"
              anchorY="middle"
            />

            <BitmapText
              text={`${inst.waveform} A:${inst.attack.toFixed(2)}`}
              position={[-panelWidth * 0.05, 0.003, y]}
              rotation={[-Math.PI / 2, 0, 0]}
              scale={[0.016, 0.016, 0.016]}
              color="#94a3b8"
              align="left"
              anchorY="middle"
            />

            <PressablePlanesButton
              mode="long-press"
              position={[panelWidth * 0.26, 0.003, y]}
              size={[0.055, 0.055]}
              buttonScale={0.5}
              baseColor={loadButtonColor}
              buttonColor={loadButtonColor}
              showLabel
              label="Load"
              labelColor="#ffffff"
              labelScale={0.25}
              onPressed={() => loadInstrument(inst)}
            />

            <PressablePlanesButton
              mode="long-press"
              position={[panelWidth * 0.36, 0.003, y]}
              size={[0.055, 0.055]}
              buttonScale={0.5}
              baseColor={deleteButtonColor}
              buttonColor={deleteButtonColor}
              showLabel
              label="Del"
              labelColor="#ffffff"
              labelScale={0.25}
              onPressed={() => deleteInstrument(inst.id)}
            />
          </group>
        )
      })}

      {instruments.length > visibleItems && (
        <>
          <PressablePlanesButton
            mode="long-press"
            position={[panelWidth * 0.42, 0.003, -panelHeight * 0.05]}
            size={[0.05, 0.05]}
            buttonScale={0.5}
            baseColor="#475569"
            buttonColor="#64748b"
            showLabel
            label="▲"
            labelColor="#ffffff"
            labelScale={0.35}
            onPressed={() => setScrollOffset(Math.max(0, scrollOffset - 1))}
          />

          <PressablePlanesButton
            mode="long-press"
            position={[panelWidth * 0.42, 0.003, panelHeight * 0.25]}
            size={[0.05, 0.05]}
            buttonScale={0.5}
            baseColor="#475569"
            buttonColor="#64748b"
            showLabel
            label="▼"
            labelColor="#ffffff"
            labelScale={0.35}
            onPressed={() => setScrollOffset(Math.min(maxScroll, scrollOffset + 1))}
          />
        </>
      )}
    </group>
  )
}
