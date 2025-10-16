// controls/WaveTypeSelector.jsx
import React, { useMemo } from 'react'
import PressablePlanesButton from '../../components/button'

const WAVES = ['sine', 'triangle', 'sawtooth', 'square']

export default function WaveTypeSelector({
  position = [0, 1, -0.5],
  spacing = 0.18,            // distance between buttons along -Z
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
          // Guard: only toggle when actually pressed to bottom once
          requireBottomForToggle={true}
          activationThreshold={0.95}
          // Controlled toggle state:
          controlledIsOn={isOn}
          onToggle={(next) => {
            // Only fire a change if the user is turning this one on.
            if (next) onChange(wave)
          }}
          // Colors tuned for selector look (optional overrides)
          baseColor="#324966"
          buttonColor="#2563eb"
        />
      ))}
    </group>
  )
}
