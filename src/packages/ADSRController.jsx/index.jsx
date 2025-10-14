// controls/ADSRController.jsx
import React, { useMemo } from 'react'
import Roller from '../../components/roller'
import Dial from '../../components/dial'

export default function ADSRController({
  position = [0, 1, -0.9],
  gridSpacingX = 0.16,
  gridSpacingZ = 0.12,
  size = [0.09, 0.09],
  waveBaseColor = '#324966',
  rollerColor = '#fc45c8',
  dialBaseColor = '#324966',
  dialColor = '#f08c00',

  // controlled values (parent must update these when onChange fires)
  attack = 0.02,
  decay = 0.12,
  sustain = 0.8,
  release = 0.2,
  duration = 0.5,

  // ranges
  A_RANGE = [0.005, 2.0],
  D_RANGE = [0.01,  2.0],
  S_RANGE = [0.0,   1.0],
  R_RANGE = [0.02,  3.0],
  DUR_RANGE = [0.05, 2.5],

  onChange = () => {},
}) {
  const clamp01 = (t) => (Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0)
  const to01    = (v, [a, b]) => clamp01((v - a) / Math.max(1e-6, b - a))
  const from01  = (t, [a, b]) => a + clamp01(t) * (b - a)

  const ensureRange = (r) => (!r || r[0] === r[1]) ? [0, 1] : r
  const [A, D, S, R, DUR] = useMemo(
    () => [ensureRange(A_RANGE), ensureRange(D_RANGE), ensureRange(S_RANGE), ensureRange(R_RANGE), ensureRange(DUR_RANGE)],
    [A_RANGE, D_RANGE, S_RANGE, R_RANGE, DUR_RANGE]
  )

  const halfX   = Number.isFinite(gridSpacingX) ? gridSpacingX * 0.5 : 0.08
  const topZ    = 0
  const bottomZ = Number.isFinite(gridSpacingZ) ? -gridSpacingZ : -0.12
  const dialZ   = bottomZ - (Math.abs(gridSpacingZ) * 0.9)

  // Pass controlled value (0..1) + emit real units via onChange
  const bindRoller = (range, keyName, currentValue) => ({
    minValue: 0,
    maxValue: 1,
    value: to01(currentValue, range),
    hardStops: true,
    friction: 0.9,
    sensitivity: 0.8,
    onChange: (t01) => onChange({ [keyName]: from01(t01, range) }),
  })

  const bindDial = (range, currentValue) => ({
    minAngle: -Math.PI * 0.66,
    maxAngle:  Math.PI * 0.66,
    minValue: 0,
    maxValue: 1,
    value: to01(currentValue, range),
    hardStops: true,
    friction: 0.92,
    sensitivity: 0.6,
    onChange: (t01) => onChange({ duration: from01(t01, range) }),
  })

  return (
    <group position={position}>
      {/* Attack */}
      <group position={[-halfX, 0, topZ]}>
        <Roller
          position={[0, 0, 0]}
          size={size}
          baseColor={waveBaseColor}
          diskColor={rollerColor}
          {...bindRoller(A, 'attack', attack)}
        />
      </group>

      {/* Decay */}
      <group position={[halfX, 0, topZ]}>
        <Roller
          position={[0, 0, 0]}
          size={size}
          baseColor={waveBaseColor}
          diskColor={rollerColor}
          {...bindRoller(D, 'decay', decay)}
        />
      </group>

      {/* Sustain */}
      <group position={[-halfX, 0, bottomZ]}>
        <Roller
          position={[0, 0, 0]}
          size={size}
          baseColor={waveBaseColor}
          diskColor={rollerColor}
          {...bindRoller(S, 'sustain', sustain)}
        />
      </group>

      {/* Release */}
      <group position={[halfX, 0, bottomZ]}>
        <Roller
          position={[0, 0, 0]}
          size={size}
          baseColor={waveBaseColor}
          diskColor={rollerColor}
          {...bindRoller(R, 'release', release)}
        />
      </group>

      {/* Duration dial */}
      <group position={[0, 0, dialZ]}>
        <Dial
          position={[0, 0, 0]}
          size={[size[0], size[1]]}
          baseColor={dialBaseColor}
          dialColor={dialColor}
          {...bindDial(DUR, duration)}
        />
      </group>
    </group>
  )
}
