import React, { useMemo } from 'react'
import PressablePlanesButton from '../../components/button'

const WAVES = ['sine', 'triangle', 'sawtooth', 'square']

export default function WaveTypeSelector({
  position = [0, 1, -0.5],
  spacing = 0.18,
  size = [0.12, 0.12],
  buttonScale = 0.6,
  onChange = () => {},
  selected = 'sine',
}) {
  const items = useMemo(() => WAVES.map((w, i) => ({
    wave: w,
    pos: [position[0], position[1], position[2] - i * spacing],
    isOn: selected === w,
  })), [position, spacing, selected])

  return (
    <group>
      {items.map(({ wave, pos, isOn }) => (
        <PressablePlanesButton
          key={wave}
          mode="toggle"
          position={pos}
          size={size}
          buttonScale={buttonScale}
          showLabel
          label={wave}
          labelColor="#ffffff"
          requireBottomForToggle
          activationThreshold={0.95}
          controlledIsOn={isOn}
          onToggle={(next) => { if (next) onChange(wave) }}
          baseColor="#324966"
          buttonColor="#2563eb"
        />
      ))}
    </group>
  )
}
