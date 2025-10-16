// src/packages/TonePad.jsx
import React, { useMemo, useCallback } from 'react'
import { Text } from '@react-three/drei'
import Dial from '../../components/dial'
import PressablePlanesButton from '../../components/button'
import { useTonePad } from '../../hooks/useTonePad'

function InfoPlate({
  position = [0, 0, 0],
  size = [0.16, 0.06],
  bg = '#0f172a',
  opacity = 0.8,
  text = '',
  textColor = '#cbd5e1',
  fontSize = 0.025,
}) {
  const [w, h] = size
  return (
    <group position={position} rotation={[-Math.PI / 2, 0, 0]} >
      <mesh renderOrder={0}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color={bg} transparent opacity={opacity} depthWrite={false} side={2} />
      </mesh>
      <Text renderOrder={2} depthTest={false} position={[0, 0, 0.001]} fontSize={fontSize} color={textColor}
        anchorX="center" anchorY="middle" maxWidth={w * 0.95} lineHeight={1.05}>
        {text}
      </Text>
    </group>
  )
}

export default function TonePad({
  position = [0.45, 0.9, -0.35],
  size = [0.085, 0.085],
  dialBaseColor = '#324966',
  dialColor = '#f08c00',
  padBaseColor = '#6987f5',
  padButtonColor = '#0370ff',
  leftOrigin = [-0.34, 0.00, 0.0],
  padOrigin = [0.08, -0.02, 0],
  reverbDialGapX = 0.13,
  dialRowGapY = 0.17,
  padCols = 4, padRows = 2,
  padGapX = 0.14, padGapY = 0.14,
  labelOffset = [0, 0, -0.08],
  labelSize = [0.1, 0.06],
  synth,        // parent synth state (current)
  onChange,     // { reverbMix, reverbRoomSize, octave } patcher
  onNote,       // (midi) => void  // NEW: notify recorder while recording
}) {
  const {
    waveform, attack, decay, sustain, release,
    duration, reverbMix = 0, reverbRoomSize = 0, octave = 0, cleanupEps = 0.03,
  } = synth

  const { triggerNote } = useTonePad({
    waveform, attack, decay, sustain, release,
    reverbMix, reverbRoomSize,
    masterGain: 0.7,
    cleanupEps,
  })

  const noteLayout = useMemo(() => {
    const baseOct = 4 + Math.round(octave)
    const baseMidiC = 12 * (baseOct + 1)
    const offsets = [0, 2, 4, 5, 7, 9, 11, 12]
    const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']
    return offsets.map((off, i) => {
      const midi = baseMidiC + off
      const nOct = Math.floor(midi / 12) - 1
      return { midi, label: `${names[i]}${nOct}` }
    })
  }, [octave])

  const clamp01 = (x) => Math.min(1, Math.max(0, x))
  const pct = (x) => `${Math.round(clamp01(x) * 100)}%`

  const onPadPress = useCallback((midi) => {
    triggerNote(midi, duration)
    onNote?.(midi) // notify recorder if recording is on
  }, [triggerNote, duration, onNote])

  // Dial positions (relative to leftOrigin)
  const mixPos = [leftOrigin[0] - reverbDialGapX * 0.5, leftOrigin[2], leftOrigin[1] + dialRowGapY * 0.5]
  const roomPos = [leftOrigin[0] + reverbDialGapX * 0.5, leftOrigin[2], leftOrigin[1] + dialRowGapY * 0.5]
  const octPos = [leftOrigin[0], leftOrigin[2], leftOrigin[1] - dialRowGapY * 0.5]

  const mixLabelPos = [mixPos[0] + labelOffset[0], mixPos[1] + labelOffset[1], mixPos[2] + labelOffset[2]]
  const roomLabelPos = [roomPos[0] + labelOffset[0], roomPos[1] + labelOffset[1], roomPos[2] + labelOffset[2]]
  const octLabelPos = [octPos[0] + labelOffset[0], octPos[1] + labelOffset[1], octPos[2] + labelOffset[2]]

  const pads = useMemo(() => {
    const items = []
    const startX = padOrigin[0] - ((padCols - 1) * padGapX) / 2
    const startY = padOrigin[1] + ((padRows - 1) * padGapY) / 2
    let k = 0
    for (let r = 0; r < padRows; r++) {
      for (let c = 0; c < padCols; c++) {
        items.push({ i: k++, pos: [startX + c * padGapX, padOrigin[2], startY - r * padGapY] })
      }
    }
    return items
  }, [padCols, padRows, padGapX, padGapY, padOrigin])

  return (
    <group position={position}>
      {/* Reverb mix */}
      <Dial
        position={mixPos}
        size={size}
        baseColor={dialBaseColor}
        dialColor={dialColor}
        range={[0, 1]}
        step={0.05}
        stepAngle={Math.PI / 18}
        value={reverbMix}
        onChange={(v) => onChange?.({ reverbMix: +v.toFixed(2) })}
      />
      <InfoPlate position={mixLabelPos} size={labelSize} text={`Mix: ${pct(reverbMix)}`} />

      {/* Reverb room size */}
      <Dial
        position={roomPos}
        size={size}
        baseColor={dialBaseColor}
        dialColor={dialColor}
        range={[0, 1]}
        step={0.05}
        stepAngle={Math.PI / 18}
        value={reverbRoomSize}
        onChange={(v) => onChange?.({ reverbRoomSize: +v.toFixed(2) })}
      />
      <InfoPlate position={roomLabelPos} size={labelSize} text={`Room: ${pct(reverbRoomSize)}`} />

      {/* Octave */}
      <Dial
        position={octPos}
        size={size}
        baseColor={dialBaseColor}
        dialColor={dialColor}
        range={[-2, 2]}
        step={1}
        stepAngle={Math.PI / 12}
        value={Math.round(octave)}
        onChange={(v) => onChange?.({ octave: Math.round(v) })}
      />
      <InfoPlate position={octLabelPos} size={labelSize} text={`Octave: ${Math.round(octave)}`} />

      {/* 2×4 tone pads */}
      <group>
        {pads.map(({ i, pos }) => {
          const { midi, label } = noteLayout[i] ?? noteLayout[noteLayout.length - 1]
          return (
            <PressablePlanesButton
              key={`tone-pad-${i}-${label}`}
              mode="long-press"
              position={pos}
              rotation={[0, 0, 0]}
              size={[0.1, 0.1]}
              buttonScale={0.62}
              gap={0.006}
              speed={40}
              baseColor={padBaseColor}
              buttonColor={padButtonColor}
              showLabel
              label={label}
              labelColor="#ffffff"
              onPressed={() => onPadPress(midi)}
              onPressDown={() => {}}
              onPressUp={() => {}}
            />
          )
        })}
      </group>
    </group>
  )
}
