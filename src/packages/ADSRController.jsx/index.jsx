// controls/ADSRController.jsx
import React, { useMemo, useCallback } from 'react'
import { Text } from '@react-three/drei'
import Roller from '../../components/roller'
import Dial from '../../components/dial'

/**
 * ADSRController
 * - 4 Rollers: Attack, Decay, Sustain, Release (all normalized 0..1 from Roller)
 * - 1 Dial: Note Duration (normalized 0..1, mapped to seconds)
 * - Controlled: parent passes values; we call onChange with updated fields.
 */
export default function ADSRController({
  position = [0, 1, -0.9],
  spacingX = 0.16,            // distance between ADSR rollers on X
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

  // Ranges (tweak to taste)
  A_RANGE = [0.005, 2.0],
  D_RANGE = [0.01,  2.0],
  S_RANGE = [0.0,   1.0],
  R_RANGE = [0.02,  3.0],
  DUR_RANGE = [0.05, 2.5],

  onChange = () => {},  // onChange({attack, decay, sustain, release, duration})
}) {
  const lerp = (a, b, t) => a + (b - a) * t
  const invLerp = (a, b, v) => (v - a) / (b - a)

  // Normalized defaults from controlled values (so knobs reflect current state)
  const aNorm = useMemo(() => invLerp(A_RANGE[0], A_RANGE[1], attack), [attack, A_RANGE])
  const dNorm = useMemo(() => invLerp(D_RANGE[0], D_RANGE[1], decay),  [decay, D_RANGE])
  const sNorm = useMemo(() => invLerp(S_RANGE[0], S_RANGE[1], sustain),[sustain, S_RANGE])
  const rNorm = useMemo(() => invLerp(R_RANGE[0], R_RANGE[1], release),[release, R_RANGE])
  const durNorm = useMemo(() => invLerp(DUR_RANGE[0], DUR_RANGE[1], duration), [duration, DUR_RANGE])

  // Emit helpers (update one field, keep others)
  const emit = useCallback((patch) => {
    onChange({
      attack, decay, sustain, release, duration,
      ...patch,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attack, decay, sustain, release, duration, onChange])

  // Layout
  const rollers = useMemo(() => ([
    { key: 'A', label: 'Attack',  x: -1.5 * spacingX, range: A_RANGE, norm: aNorm },
    { key: 'D', label: 'Decay',   x: -0.5 * spacingX, range: D_RANGE, norm: dNorm },
    { key: 'S', label: 'Sustain', x:  0.5 * spacingX, range: S_RANGE, norm: sNorm },
    { key: 'R', label: 'Release', x:  1.5 * spacingX, range: R_RANGE, norm: rNorm },
  ]), [spacingX, A_RANGE, D_RANGE, S_RANGE, R_RANGE, aNorm, dNorm, sNorm, rNorm])

  return (
    <group position={position}>
      {/* ADSR Rollers */}
      {rollers.map(({ key, label, x, range, norm }) => (
        <group key={key} position={[x, 0, 0]}>
          {/* Label above */}
          <Text
            position={[0, 0.06, 0]}
            fontSize={0.035}
            color="#ffffff"
            anchorX="center"
            anchorY="bottom"
          >
            {label}
          </Text>

          <Roller
            position={[0, 0, 0]}
            size={size}
            baseColor={waveBaseColor}
            diskColor={rollerColor}
            minValue={0}
            maxValue={1}
            friction={0.94}
            sensitivity={1.0}
            onValueChange={(t) => {
              const v = lerp(range[0], range[1], Math.min(1, Math.max(0, t)))
              if (key === 'A') emit({ attack: v })
              if (key === 'D') emit({ decay: v })
              if (key === 'S') emit({ sustain: v })
              if (key === 'R') emit({ release: v })
            }}
          />
        </group>
      ))}

      {/* Duration Dial (to the right, a bit forward so it doesn't overlap) */}
      <group position={[2.25 * spacingX, 0, -0.02]}>
        <Text
          position={[0, 0.08, 0]}
          fontSize={0.035}
          color="#ffffff"
          anchorX="center"
          anchorY="bottom"
        >
          Duration
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
          sensitivity={0.6}
          friction={0.92}
          onValueChange={(t) => {
            const v = lerp(DUR_RANGE[0], DUR_RANGE[1], Math.min(1, Math.max(0, t)))
            emit({ duration: v })
          }}
        />
      </group>
    </group>
  )
}
