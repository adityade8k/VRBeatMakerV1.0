// controls/ADSRController.jsx
import React, { useMemo, useCallback } from 'react'
import { Text } from '@react-three/drei'
import Roller from '../../components/roller'   // ensure this path points to the file that default-exports Roller
import Dial from '../../components/dial'       // ensure this path points to the file that default-exports Dial

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

  onChange = () => {},
}) {
  const clamp01 = (t) => (Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0)
  const lerp = (a, b, t) => a + (b - a) * clamp01(t)
  const invLerpSafe = (a, b, v) => {
    const denom = (b - a)
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-9) return 0 // avoid div-by-zero
    return clamp01((v - a) / denom)
  }
  const fmtSec = (s) => `${Number.isFinite(s) ? s.toFixed(2) : '0.00'}s`
  const fmtPct = (p) => `${Number.isFinite(p) ? Math.round(p * 100) : 0}%`

  // Validate ranges once (warn rather than crash)
  const ensureRange = (name, r) => {
    if (!r || !Number.isFinite(r[0]) || !Number.isFinite(r[1]) || r[0] === r[1]) {
      console.warn(`[ADSRController] Bad ${name} range:`, r, '→ using fallback [0,1]')
      return [0, 1]
    }
    return r
  }
  const A = ensureRange('A_RANGE', A_RANGE)
  const D = ensureRange('D_RANGE', D_RANGE)
  const S = ensureRange('S_RANGE', S_RANGE)
  const R = ensureRange('R_RANGE', R_RANGE)
  const DUR = ensureRange('DUR_RANGE', DUR_RANGE)

  // Normalized defaults from controlled values (so UI matches incoming state)
  // (We don’t strictly need these right now, but keeping them is fine and safe.)
  useMemo(() => {
    // compute once to surface potential NaNs in console without breaking
    invLerpSafe(A[0], A[1], attack)
    invLerpSafe(D[0], D[1], decay)
    invLerpSafe(S[0], S[1], sustain)
    invLerpSafe(R[0], R[1], release)
    invLerpSafe(DUR[0], DUR[1], duration)
  }, [A, D, S, R, DUR, attack, decay, sustain, release, duration])

  const emit = useCallback((patch) => {
    onChange({
      attack, decay, sustain, release, duration,
      ...patch,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attack, decay, sustain, release, duration, onChange])

  // 2×2 grid
  const halfX = Number.isFinite(gridSpacingX) ? gridSpacingX * 0.5 : 0.08
  const topZ = 0
  const bottomZ = Number.isFinite(gridSpacingZ) ? -gridSpacingZ : -0.12

  const rollers = useMemo(() => ([
    { key: 'A', label: 'Attack',  x: -halfX, z: topZ,    range: A,   value: attack,  fmt: fmtSec },
    { key: 'D', label: 'Decay',   x:  halfX, z: topZ,    range: D,   value: decay,   fmt: fmtSec },
    { key: 'S', label: 'Sustain', x: -halfX, z: bottomZ, range: S,   value: sustain, fmt: fmtPct },
    { key: 'R', label: 'Release', x:  halfX, z: bottomZ, range: R,   value: release, fmt: fmtSec },
  ]), [halfX, topZ, bottomZ, A, D, S, R, attack, decay, sustain, release])

  // Dial centered below (move *farther away* on -Z so it’s visually below the grid)
  const dialZ = bottomZ + (Math.abs(gridSpacingZ) * 3.9)

  return (
    <group position={position}>
      {/* ADSR Rollers */}
      {rollers.map(({ key, label, x, z, range, value, fmt }) => (
        <group key={key} position={[x, 0, z]}>
          <Text
            position={[0, 0.065, 0]}
            fontSize={0.032}
            color="#000000"
            anchorX="center"
            anchorY="bottom"
          >
            {label}
          </Text>

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
            sensitivity={0.5}
            onValueChange={(t) => {
              const v = lerp(range[0], range[1], t)
              if (key === 'A') emit({ attack: v })
              if (key === 'D') emit({ decay: v })
              if (key === 'S') emit({ sustain: v })
              if (key === 'R') emit({ release: v })
            }}
          />
        </group>
      ))}

      {/* Duration Dial */}
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
          sensitivity={0.5}
          friction={0.1}
          onValueChange={(t) => {
            const v = lerp(DUR[0], DUR[1], t)
            emit({ duration: v })
          }}
        />
      </group>
    </group>
  )
}
