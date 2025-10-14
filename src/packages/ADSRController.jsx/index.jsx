// controls/ADSRController.jsx
import React, { useMemo, useCallback, useRef } from 'react'
import { Text } from '@react-three/drei'
import Roller from '../../components/roller'
import Dial from '../../components/dial'

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
  attack = 0.02,
  decay = 0.12,
  sustain = 0.8,
  release = 0.2,
  duration = 0.5,

  // Ranges
  A_RANGE = [0.005, 2.0],
  D_RANGE = [0.01,  2.0],
  S_RANGE = [0.0,   1.0],
  R_RANGE = [0.02,  3.0],
  DUR_RANGE = [0.05, 2.5],

  onChange = () => {},
}) {
  const EPS = 1e-3

  const clamp01 = (t) => (Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0)
  const lerp    = (a, b, t) => a + (b - a) * clamp01(t)
  const to01    = (v, [a, b]) => (v - a) / Math.max(1e-6, b - a)
  const from01  = (t, [a, b]) => a + t * (b - a)

  const fmtSec = (s) => `${Number.isFinite(s) ? s.toFixed(2) : '0.00'}s`
  const fmtPct = (p) => `${Number.isFinite(p) ? Math.round(p * 100) : 0}%`

  const ensureRange = (name, r) => {
    if (!r || !Number.isFinite(r[0]) || !Number.isFinite(r[1]) || r[0] === r[1]) {
      console.warn(`[ADSRController] Bad ${name} range:`, r, '→ using fallback [0,1]')
      return [0, 1]
    }
    return r
  }
  const A   = ensureRange('A_RANGE', A_RANGE)
  const D   = ensureRange('D_RANGE', D_RANGE)
  const S   = ensureRange('S_RANGE', S_RANGE)
  const R   = ensureRange('R_RANGE', R_RANGE)
  const DUR = ensureRange('DUR_RANGE', DUR_RANGE)

  // last emitted snapshot to avoid spam
  const last = useRef({ attack, decay, sustain, release, duration })

  const emitIfChanged = useCallback((patch) => {
    const next = { attack, decay, sustain, release, duration, ...patch }
    const diff =
      Math.abs((next.attack   ?? 0) - (last.current.attack   ?? 0)) > EPS ||
      Math.abs((next.decay    ?? 0) - (last.current.decay    ?? 0)) > EPS ||
      Math.abs((next.sustain  ?? 0) - (last.current.sustain  ?? 0)) > EPS ||
      Math.abs((next.release  ?? 0) - (last.current.release  ?? 0)) > EPS ||
      Math.abs((next.duration ?? 0) - (last.current.duration ?? 0)) > EPS

    if (diff) {
      last.current = next
      onChange(next)
    }
  }, [attack, decay, sustain, release, duration, onChange])

  // layout
  const halfX   = Number.isFinite(gridSpacingX) ? gridSpacingX * 0.5 : 0.08
  const topZ    = 0
  const bottomZ = Number.isFinite(gridSpacingZ) ? -gridSpacingZ : -0.12

  const rollers = useMemo(() => ([
    { key: 'A', label: 'Attack',  x: -halfX, z: topZ,    range: A,   value: attack,  fmt: fmtSec },
    { key: 'D', label: 'Decay',   x:  halfX, z: topZ,    range: D,   value: decay,   fmt: fmtSec },
    { key: 'S', label: 'Sustain', x: -halfX, z: bottomZ, range: S,   value: sustain, fmt: fmtPct },
    { key: 'R', label: 'Release', x:  halfX, z: bottomZ, range: R,   value: release, fmt: fmtSec },
  ]), [halfX, topZ, bottomZ, A, D, S, R, attack, decay, sustain, release])

  // dial below (farther on -Z)
  const dialZ = bottomZ - (Math.abs(gridSpacingZ) * 0.9)

  return (
    <group position={position}>
      {/* ADSR grid */}
      {rollers.map(({ key, label, x, z, range, value, fmt }) => (
        <group key={key} position={[x, 0, z]}>
          <Text position={[0, 0.065, 0]} fontSize={0.032} color="#000000" anchorX="center" anchorY="bottom">
            {label}
          </Text>
          <Text position={[0, 0.045, 0]} fontSize={0.024} color="#000000" anchorX="center" anchorY="bottom">
            {fmt(value)}
          </Text>

          <Roller
            position={[0, 0, 0]}
            size={size}
            baseColor={waveBaseColor}
            diskColor={rollerColor}
            // fully controlled: we drive the normalized value and receive normalized back
            minValue={0}
            maxValue={1}
            value={to01(value, range)}
            hardStops
            friction={0.9}
            sensitivity={0.8}
            onValueChange={(t01) => {
              const v = from01(t01, range)
              if (key === 'A') emitIfChanged({ attack: v })
              if (key === 'D') emitIfChanged({ decay: v })
              if (key === 'S') emitIfChanged({ sustain: v })
              if (key === 'R') emitIfChanged({ release: v })
            }}
          />
        </group>
      ))}

      {/* Duration dial */}
      <group position={[0, 0, dialZ]}>
        <Text position={[0, 0.085, 0]} fontSize={0.032} color="#000000" anchorX="center" anchorY="bottom">
          Duration
        </Text>
        <Text position={[0, 0.065, 0]} fontSize={0.024} color="#000000" anchorX="center" anchorY="bottom">
          {fmtSec(duration)}
        </Text>

        <Dial
          position={[0, 0, 0]}
          size={[size[0], size[1]]}
          baseColor={dialBaseColor}
          dialColor={dialColor}
          minAngle={-Math.PI * 0.66}
          maxAngle={ Math.PI * 0.66}
          minValue={0}
          maxValue={1}
          // fully controlled:
          value={to01(duration, DUR)}
          hardStops
          friction={0.92}
          sensitivity={0.6}
          onValueChange={(t01) => {
            const v = from01(t01, DUR)
            emitIfChanged({ duration: v })
          }}
        />
      </group>
    </group>
  )
}
