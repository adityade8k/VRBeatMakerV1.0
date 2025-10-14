// controls/ADSRController.jsx
import React from 'react'
import { Text } from '@react-three/drei'
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

  attack = 0.02,
  decay = 0.12,
  sustain = 0.8,
  release = 0.2,
  duration = 0.5,

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

  const fmtSec = (s) => `${Number.isFinite(s) ? s.toFixed(2) : '0.00'}s`
  const fmtPct = (p) => `${Number.isFinite(p) ? Math.round(p * 100) : 0}%`

  const ensureRange = (r) => (!r || r[0] === r[1]) ? [0,1] : r
  const A   = ensureRange(A_RANGE)
  const D   = ensureRange(D_RANGE)
  const S   = ensureRange(S_RANGE)
  const R   = ensureRange(R_RANGE)
  const DUR = ensureRange(DUR_RANGE)

  const halfX   = Number.isFinite(gridSpacingX) ? gridSpacingX * 0.5 : 0.08
  const topZ    = 0
  const bottomZ = Number.isFinite(gridSpacingZ) ? -gridSpacingZ : -0.12
  const dialZ   = bottomZ - (Math.abs(gridSpacingZ) * 0.9)

  // Helper: gracefully support controls that emit either onValueChange(t01) or onChange(t01)
  const bindRoller = (range, keyName) => ({
    minValue: 0,
    maxValue: 1,
    value: to01(
      keyName === 'attack' ? attack :
      keyName === 'decay' ? decay :
      keyName === 'sustain' ? sustain :
      keyName === 'release' ? release : 0,
      range
    ),
    hardStops: true,
    friction: 0.9,
    sensitivity: 0.8,
    onValueChange: (t01) => onChange({ [keyName]: from01(t01, range) }),
    onChange:      (t01) => onChange({ [keyName]: from01(t01, range) }),
  })

  const bindDial = (range) => ({
    minAngle: -Math.PI * 0.66,
    maxAngle:  Math.PI * 0.66,
    minValue: 0,
    maxValue: 1,
    value: to01(duration, range),
    hardStops: true,
    friction: 0.92,
    sensitivity: 0.6,
    onValueChange: (t01) => onChange({ duration: from01(t01, range) }),
    onChange:      (t01) => onChange({ duration: from01(t01, range) }),
  })

  return (
    <group position={position}>
      {/* Attack */}
      <group position={[-halfX, 0, topZ]}>
        <Text position={[0, 0.065, 0]} fontSize={0.032} color="#000000" anchorX="center" anchorY="bottom" text="Attack" />
        <Text position={[0, 0.045, 0]} fontSize={0.024} color="#000000" anchorX="center" anchorY="bottom" text={fmtSec(attack)} />
        <Roller position={[0, 0, 0]} size={size} baseColor={waveBaseColor} diskColor={rollerColor} {...bindRoller(A, 'attack')} />
      </group>

      {/* Decay */}
      <group position={[ halfX, 0, topZ]}>
        <Text position={[0, 0.065, 0]} fontSize={0.032} color="#000000" anchorX="center" anchorY="bottom" text="Decay" />
        <Text position={[0, 0.045, 0]} fontSize={0.024} color="#000000" anchorX="center" anchorY="bottom" text={fmtSec(decay)} />
        <Roller position={[0, 0, 0]} size={size} baseColor={waveBaseColor} diskColor={rollerColor} {...bindRoller(D, 'decay')} />
      </group>

      {/* Sustain */}
      <group position={[-halfX, 0, bottomZ]}>
        <Text position={[0, 0.065, 0]} fontSize={0.032} color="#000000" anchorX="center" anchorY="bottom" text="Sustain" />
        <Text position={[0, 0.045, 0]} fontSize={0.024} color="#000000" anchorX="center" anchorY="bottom" text={fmtPct(sustain)} />
        <Roller position={[0, 0, 0]} size={size} baseColor={waveBaseColor} diskColor={rollerColor} {...bindRoller(S, 'sustain')} />
      </group>

      {/* Release */}
      <group position={[ halfX, 0, bottomZ]}>
        <Text position={[0, 0.065, 0]} fontSize={0.032} color="#000000" anchorX="center" anchorY="bottom" text="Release" />
        <Text position={[0, 0.045, 0]} fontSize={0.024} color="#000000" anchorX="center" anchorY="bottom" text={fmtSec(release)} />
        <Roller position={[0, 0, 0]} size={size} baseColor={waveBaseColor} diskColor={rollerColor} {...bindRoller(R, 'release')} />
      </group>

      {/* Duration dial */}
      <group position={[0, 0, dialZ]}>
        <Text position={[0, 0.085, 0]} fontSize={0.032} color="#000000" anchorX="center" anchorY="bottom" text="Duration" />
        <Text position={[0, 0.065, 0]} fontSize={0.024} color="#000000" anchorX="center" anchorY="bottom" text={fmtSec(duration)} />
        <Dial position={[0, 0, 0]} size={[size[0], size[1]]} baseColor={dialBaseColor} dialColor={dialColor} {...bindDial(DUR)} />
      </group>
    </group>
  )
}
