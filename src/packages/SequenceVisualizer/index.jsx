import React, { useMemo, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import BitmapText from '../../components/bitmapText'

function midiToName(m) {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
  const pitch = names[m % 12]
  const oct = Math.floor(m / 12) - 1
  return `${pitch}${oct}`
}
function slotLabel(slot = []) {
  if (!slot || slot.length === 0) return ''
  const seen = new Set(), names = []
  for (const ev of slot) { if (!seen.has(ev.midi)) { seen.add(ev.midi); names.push(midiToName(ev.midi)) } }
  if (names.length <= 2) return names.join('·')
  return `${names[0]}·${names[1]} +${names.length - 2}`
}

export default function SequenceVisualizer({
  sequence = [],
  selectedTrack = 0,
  selectedSlots = [0],
  playing = false,
  mutes = Array(5).fill(false),
  stepSeconds = 0.5,
  playhead, // controlled
  position = [0.4, 0.85, -0.25],
  rotation = [-Math.PI / 2, 0, 0],
  scale = 0.9,
  cellSize = [0.08, 0.04, 0.08],
  gap = 0.02,
}) {
  const rows = 5, cols = 16

  const [ph, setPh] = useState(0)
  const acc = useRef(0)

  useEffect(() => {
    if (playing && playhead === undefined) {
      const startCol = Number.isFinite(selectedSlots?.[0]) ? selectedSlots[0] : 0
      setPh(((startCol % cols) + cols) % cols)
      acc.current = 0
    }
  }, [playing, selectedSlots, cols, playhead])

  useFrame((_, dt) => {
    if (!playing || playhead !== undefined) return
    acc.current += dt
    if (acc.current >= stepSeconds) {
      acc.current -= stepSeconds
      setPh((c) => (c + 1) % cols)
    }
  })

  const [cw, ch, cd] = cellSize
  const strideX = cw + gap, strideZ = cd + gap
  const halfW = (cols - 1) * strideX * 0.5
  const halfH = (rows - 1) * strideZ * 0.5

  const labels = useMemo(() => {
    return Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => slotLabel(sequence?.[r]?.[c] || []))
    )
  }, [sequence])

  const activeCol = playhead !== undefined ? playhead : ph

  const getColor = (r, c, hasContent) => {
    const isMuted = !!mutes?.[r]
    const isPlayCol = playing && c === activeCol
    const isSelectedCell = r === selectedTrack && (selectedSlots?.includes?.(c) || false)
    let color = hasContent ? '#a78bfa' : '#cbd5e1'
    if (isSelectedCell) color = '#3b82f6'
    if (isPlayCol) color = '#22c55e'
    const opacity = isMuted ? 0.35 : 0.95
    return { color, opacity }
  }

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {Array.from({ length: rows }).map((_, r) => (
        <group key={`row-${r}`}>
          {/* Row label */}
          <BitmapText
            text={`T${r + 1}${mutes?.[r] ? ' (M)' : ''}`}
            position={[-(halfW + 0.065), 0.0, (r * strideZ) - halfH]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[0.04, 0.04, 0.04]}
            color={mutes?.[r] ? '#94a3b8' : (r === selectedTrack ? '#2563eb' : '#334155')}
            align="right"
            anchorY="middle"
            maxWidth={0.3 / 0.04}
          />

          {Array.from({ length: cols }).map((__, c) => {
            const x = (c * strideX) - halfW
            const z = (r * strideZ) - halfH
            const hasContent = !!(sequence?.[r]?.[c]?.length)
            const { color, opacity } = getColor(r, c, hasContent)
            const isActive = playing && c === activeCol
            const label = labels[r][c]

            return (
              <group key={`cell-${r}-${c}`} position={[x, 0, z]}>
                <mesh>
                  <boxGeometry args={cellSize} />
                  <meshStandardMaterial color={color} transparent opacity={opacity} />
                </mesh>
                <mesh position={[0, ch / 2 + 0.001, 0]}>
                  <boxGeometry args={[cw * 0.98, 0.0025, cd * 0.98]} />
                  <meshStandardMaterial
                    color={isActive ? '#16a34a' : color}
                    transparent opacity={Math.min(1, opacity + 0.05)}
                    roughness={0.6} metalness={0.0}
                  />
                </mesh>

                {label && (
                  <BitmapText
                    text={label}
                    position={[0, -0.05, 0]}
                    rotation={[Math.PI / 2, 0, 0]}
                    scale={[0.028, 0.028, 0.028]}
                    color="#0f172a"
                    align="center"
                    anchorY="middle"
                    maxWidth={(cw * 1.2) / 0.028}
                  />
                )}
              </group>
            )
          })}
        </group>
      ))}
    </group>
  )
}
