// controls/ADSRController.jsx
import React, { useMemo, useCallback } from 'react'
import { Text } from '@react-three/drei'
import Roller from '../../components/roller'
import Dial from '../../components/dial'

/**
 * ADSRController (2×2 grid + dial below)
 * - Rollers: Attack, Decay, Sustain, Release
 * - Dial: Duration
 * - Shows live values next to labels (A/D/R/Dur in seconds, S in %)
 * - Controlled: parent passes values; we call onChange with updated fields.
 */
export default function ADSRController({
  position = [0, 1, -0.9],

  // Grid spacing
  gridSpacingX = 0.16,
  gridSpacingZ = 0.12,

  // Control sizes/colors
  size = [0.09, 0.09],
  waveBaseColor = '#324966',
  rollerColor = '#fc45c8',
  dialBaseColor = '#324966',
  dialColor = '#f08c00',

  // Controlled values
  attack = 0.02,   // seconds
  decay = 0.12,    // seconds
  sustain = 0.8,   // 0..1
  release = 0.2,   // seconds
  duration = 0.5,  // seconds

  // Ranges
  A_RANGE = [0.005, 2.0],
  D_RANGE = [0.01,  2.0],
  S_RANGE = [0.0,   1.0],
  R_RANGE = [0.02,  3.0],
  DUR_RANGE = [0.05, 2.5],

  onChange = () => {},  // onChange({attack, decay, sustain, release, duration})
}) {
  const lerp = (a, b, t) => a + (b - a) * t
  const invLerp = (a, b, v) => (v - a) / (b - a)
  const clamp01 = (t) => Math.min(1, Math.max(0, t))
  const fmtSec = (s) => `${(s).toFixed(2)}s`
  const fmtPct = (p) => `${Math.round(p * 100)}%`

  // Normalized defaults from controlled values (so knobs reflect external state)
  const aNorm = useMemo(() => invLerp(A_RANGE[0], A_RANGE[1], attack), [attack, A_RANGE])
  const dNorm = useMemo(() => invLerp(D_RANGE[0], D_RANGE[1], decay),  [decay, D_RANGE])
  const sNorm = useMemo(() => invLerp(S_RANGE[0], S_RANGE[1], sustain),[sustain, S_RANGE])
  const rNorm = useMemo(() => invLerp(R_RANGE[0], R_RANGE[1], release),[release, R_RANGE])
  const durNorm = useMemo(() => invLerp(DUR_RANGE[0], DUR_RANGE[1], duration), [duration, DUR_RANGE])

  const emit = useCallback((patch) => {
    onChange({ attack, decay, sustain, release, duration, ...patch })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attack, decay, sustain, release, duration, onChange])

  // 2×2 grid layout
  const halfX = gridSpacingX * 0.5
  const topZ = 0
  const bottomZ = -gridSpacingZ

  const rollers = useMemo(() => ([
    { key: 'A', label: 'Attack',  x: -halfX, z: topZ,    range: A_RANGE, norm: aNorm, value: attack,  fmt: fmtSec },
    { key: 'D', label: 'Decay',   x:  halfX, z: topZ,    range: D_RANGE, norm: dNorm, value: decay,   fmt: fmtSec },
    { key: 'S', label: 'Sustain', x: -halfX, z: bottomZ, range: S_RANGE, norm: sNorm, value: sustain, fmt: fmtPct },
    { key: 'R', label: 'Release', x:  halfX, z: bottomZ, range: R_RANGE, norm: rNorm, value: release, fmt: fmtSec },
  ]), [halfX, topZ, bottomZ, A_RANGE, D_RANGE, S_RANGE, R_RANGE, aNorm, dNorm, sNorm, rNorm, attack, decay, sustain, release])

  // Dial centered below
  const dialZ = bottomZ + (gridSpacingZ * 0.9)

  return (
    <group position={position}>
      {/* ADSR Rollers (2×2), each with label + live value */}
      {rollers.map(({ key, label, x, z, range, value, fmt }) => (
        <group key={key} position={[x, 0, z]}>
          {/* Label line */}
          <Text
            position={[0, 0.065, 0]}
            fontSize={0.032}
            color="#000000"
            anchorX="center"
            anchorY="bottom"
          >
            {label}
          </Text>

          {/* Value line (smaller, just below the label) */}
          <Text
            position={[0, 0.045, 0]}
            fontSize={0.024}
            color="#000000"
            anchorX="center"
            anchorY="bottom"
          >
            {fmt(value)}
          </Text>

          <Roller
            position={[0, 0, 0]}
            size={size}
            baseColor={waveBaseColor}
            diskColor={rollerColor}
            minValue={0}
            maxValue={1}
            friction={0.1}
            sensitivity={0.1}
            onValueChange={(t) => {
              const v = lerp(range[0], range[1], clamp01(t))
              if (key === 'A') emit({ attack: v })
              if (key === 'D') emit({ decay: v })
              if (key === 'S') emit({ sustain: v })
              if (key === 'R') emit({ release: v })
            }}
          />
        </group>
      ))}

      {/* Duration Dial (below, centered) */}
      <group position={[0, 0, dialZ]}>
        <Text
          position={[0, 0.085, 0]}
          fontSize={0.032}
          color="#000000"
          anchorX="center"
          anchorY="bottom"
        >
          Duration
        </Text>

        {/* Duration value */}
        <Text
          position={[0, 0.065, 0]}
          fontSize={0.024}
          color="#000000"
          anchorX="center"
          anchorY="bottom"
        >
          {fmtSec(duration)}
        </Text>

        <Dial
          position={[0, 0, 0]}
          size={[size[0], size[1]]}
          baseColor={dialBaseColor}
          dialColor={dialColor}
          minAngle={-Math.PI * 0.66}
          maxAngle={ Math.PI * 0.66}
          initialAngle={0}
          minValue={0}
          maxValue={1}
          sensitivity={0.1}
          friction={0.1}
          onValueChange={(t) => {
            const v = lerp(DUR_RANGE[0], DUR_RANGE[1], clamp01(t))
            emit({ duration: v })
          }}
        />
      </group>
    </group>
  )
}
