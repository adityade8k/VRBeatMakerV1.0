// src/components/SequenceVisualizer.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'

/** MIDI → note name, e.g. 60 → "C4" */
function midiToName(m) {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
  const pitch = names[m % 12]
  const oct = Math.floor(m / 12) - 1
  return `${pitch}${oct}`
}

/** Collect human-readable label for a slot's events */
function slotLabel(slot = []) {
  if (!slot || slot.length === 0) return ''
  // unique by midi (preserve order)
  const seen = new Set()
  const names = []
  for (const ev of slot) {
    if (!seen.has(ev.midi)) {
      seen.add(ev.midi)
      names.push(midiToName(ev.midi))
    }
  }
  if (names.length <= 2) return names.join('·')
  return `${names[0]}·${names[1]} +${names.length - 2}`
}

/**
 * SequenceVisualizer
 * Props:
 *  - sequence: Array<5 x 16 x Event[]>
 *  - selectedTrack: number
 *  - selectedSlots: number[]       // highlight these in the selected track
 *  - recording: boolean            // (not used visually, but available if you want to pulse)
 *  - playing: boolean              // when true, green playhead sweeps
 *  - mutes: boolean[5]             // dim muted rows
 *  - stepSeconds: number           // speed of playhead (default 0.5s/step)
 *  - position, rotation, scale     // R3F transforms
 *  - cellSize: [w,h,d]             // cube size
 *  - gap: number                   // spacing between cubes
 */
export default function SequenceVisualizer({
  sequence = [],
  selectedTrack = 0,
  selectedSlots = [0],
  recording = false,
  playing = false,
  mutes = Array(5).fill(false),

  stepSeconds = 0.5,

  position = [0.4, 0.85, -0.25],
  rotation = [-Math.PI / 2, 0, 0],
  scale = 0.9,

  cellSize = [0.08, 0.04, 0.08],
  gap = 0.02,
}) {
  const rows = 5
  const cols = 16

  // Playhead (column index)
  const [playhead, setPlayhead] = useState(0)
  const acc = useRef(0)

  // Start playhead from current selected slot when playback starts
  useEffect(() => {
    if (playing) {
      const startCol = Number.isFinite(selectedSlots?.[0]) ? selectedSlots[0] : 0
      setPlayhead(((startCol % cols) + cols) % cols)
      acc.current = 0
    }
  }, [playing, selectedSlots, cols])

  // Advance playhead while playing
  useFrame((_, dt) => {
    if (!playing) return
    acc.current += dt
    if (acc.current >= stepSeconds) {
      acc.current -= stepSeconds
      setPlayhead((c) => (c + 1) % cols)
    }
  })

  // Grid positions (center the grid)
  const [cw, ch, cd] = cellSize
  const strideX = cw + gap
  const strideZ = cd + gap
  const halfW = (cols - 1) * strideX * 0.5
  const halfH = (rows - 1) * strideZ * 0.5

  const labels = useMemo(() => {
    // Precompute labels for all cells
    const out = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => slotLabel(sequence?.[r]?.[c] || []))
    )
    return out
  }, [sequence])

  const getColor = (r, c, hasContent) => {
    // precedence: playing (green) > selected (blue) > content (purple-ish) > base
    const isMuted = !!mutes?.[r]
    const isPlayCol = playing && c === playhead
    const isSelectedCell =
      r === selectedTrack && (selectedSlots?.includes?.(c) || false)

    let color = hasContent ? '#a78bfa' /* violet-400 */ : '#cbd5e1' /* slate-300 */
    if (isSelectedCell) color = '#3b82f6' /* blue-500 */
    if (isPlayCol) color = '#22c55e' /* green-500 */

    const opacity = isMuted ? 0.35 : 0.95
    return { color, opacity }
  }

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {/* Title */}
      <Text
        position={[0, 0.06,  (halfH + 0.2)]}
        rotation={[Math.PI / 2, 0, 0]}
        fontSize={0.06}
        color="#0f172a"
        anchorX="center"
        anchorY="middle"
      >
        Sequence
      </Text>

      {/* Rows × Cols */}
      {Array.from({ length: rows }).map((_, r) => (
        <group key={`row-${r}`}>
          {/* Row label: Track index and mute state */}
          <Text
            position={[-(halfW + 0.25), 0.0, (r * strideZ) - halfH]}
            rotation={[Math.PI / 2, 0, 0]}
            fontSize={0.04}
            color={mutes?.[r] ? '#94a3b8' : (r === selectedTrack ? '#2563eb' : '#334155')}
            anchorX="right"
            anchorY="middle"
            maxWidth={0.3}
          >
            {`T${r + 1}${mutes?.[r] ? ' (M)' : ''}`}
          </Text>

          {Array.from({ length: cols }).map((__, c) => {
            const x = (c * strideX) - halfW
            const z = (r * strideZ) - halfH
            const hasContent = !!(sequence?.[r]?.[c]?.length)
            const { color, opacity } = getColor(r, c, hasContent)
            const isActive = playing && c === playhead
            const label = labels[r][c]

            return (
              <group key={`cell-${r}-${c}`} position={[x, 0, z]}>
                {/* Base cube */}
                <mesh>
                  <boxGeometry args={cellSize} />
                  <meshStandardMaterial color={color} transparent opacity={opacity} />
                </mesh>

                {/* Thin top cap to make the "top face" visually distinct */}
                <mesh position={[0, ch / 2 + 0.001, 0]}>
                  <boxGeometry args={[cw * 0.98, 0.0025, cd * 0.98]} />
                  <meshStandardMaterial
                    color={isActive ? '#16a34a' : color} // slightly darker green when active
                    transparent
                    opacity={Math.min(1, opacity + 0.05)}
                    roughness={0.6}
                    metalness={0.0}
                  />
                </mesh>

                {/* Note label */}
                {label && (
                  <Text
                    position={[0, -0.1, 0]}
                    rotation={[Math.PI / 2, 0, 0]}
                    fontSize={0.028}
                    color="#0f172a"
                    anchorX="center"
                    anchorY="middle"
                    maxWidth={cw * 1.2}
                  >
                    {label}
                  </Text>
                )}
              </group>
            )
          })}
        </group>
      ))}
    </group>
  )
}
