import { useMemo, useCallback } from 'react'
import { Text } from '@react-three/drei'
import Roller from '../../components/roller'
import Dial from "../../components/dial"

export default function ADSRController({
  // Transform
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],

  // Grid layout
  gridSpacingX = 0.16,
  gridSpacingZ = 0.12,

  // Control sizes/colors
  size = [0.085, 0.085],
  waveBaseColor = '#324966',
  rollerColor = '#fc45c8',
  dialBaseColor = '#324966',
  dialColor = '#f08c00',

  // Controlled values (real units)
  attack = 0.02,
  decay = 0.12,
  sustain = 0.8,
  release = 0.2,
  duration = 0.5,

  // Ranges
  A_RANGE = [0.005, 2.0],
  D_RANGE = [0.01, 2.0],
  S_RANGE = [0.0, 1.0],
  R_RANGE = [0.01, 3.0],
  DUR_RANGE = [0.05, 4.0],

  // Feel
  hardStops = true,
  friction = 0.8,
  sensitivity = 0.2,

  // Patch emitter
  onChange = () => {},

  // Info panel
  showInfoPanel = true,
  infoPanelOffset,
  infoPanelSize = [0.34, 0.2],
  infoPanelBg = '#0f172a',
  infoPanelBorder = '#94a3b8',
  infoText = '#cbd5e1',
  infoFontSize = 0.025,
}) {
  // Layout
  const A_pos = [-gridSpacingX * 0.5, 0, 0]
  const D_pos = [gridSpacingX * 0.5, 0, 0]
  const S_pos = [-gridSpacingX * 0.5, 0, -gridSpacingZ]
  const R_pos = [gridSpacingX * 0.5, 0, -gridSpacingZ]
  const DialPos = [gridSpacingX * 1.4, 0, -gridSpacingZ * 0.5]

  const fmtSec = (s) => `${Number.isFinite(s) ? s.toFixed(2) : '0.00'}s`
  const fmtPct = (p) => `${Number.isFinite(p) ? Math.round(p * 100) : 0}%`

  const infoLines = useMemo(() => ([
    `Attack  ${fmtSec(attack)}   Decay  ${fmtSec(decay)}`,
    `Sustain ${fmtPct(sustain)}  Release ${fmtSec(release)}`,
    `Duration ${fmtSec(duration)}`,
  ]), [attack, decay, sustain, release, duration])

  const panelOffset = infoPanelOffset ?? [gridSpacingX * 1.4, 0.18, 0]
  const [panelW, panelH] = infoPanelSize
  const lineH = 0.06

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Roller
        position={A_pos}
        size={size}
        baseColor={waveBaseColor}
        diskColor={rollerColor}
        range={A_RANGE}
        step={0.01}
        stepAngle={Math.PI / 18}
        value={attack}
        onChange={(v) => onChange({ attack: +v.toFixed(3) })}
      />

      <Roller
        position={D_pos}
        size={size}
        baseColor={waveBaseColor}
        diskColor={rollerColor}
        range={D_RANGE}
        step={0.01}
        stepAngle={Math.PI / 18}
        value={decay}
        onChange={(v) => onChange({ decay: +v.toFixed(3) })}
      />

      <Roller
        position={S_pos}
        size={size}
        baseColor={waveBaseColor}
        diskColor={rollerColor}
        range={S_RANGE}
        step={0.05}
        stepAngle={Math.PI / 18}
        value={sustain}
        onChange={(v) => onChange({ sustain: +v.toFixed(3) })}
      />

      <Roller
        position={R_pos}
        size={size}
        baseColor={waveBaseColor}
        diskColor={rollerColor}
        range={R_RANGE}
        step={0.02}
        stepAngle={Math.PI / 18}
        value={release}
        onChange={(v) => onChange({ release: +v.toFixed(3) })}
      />

      <Dial
        position={DialPos}
        size={size}
        baseColor={dialBaseColor}
        dialColor={dialColor}
        range={DUR_RANGE}
        step={0.05}
        stepAngle={Math.PI / 18}
        value={duration}
        onChange={(v) => onChange({ duration: +v.toFixed(2) })}
      />

      {showInfoPanel && (
        <group position={panelOffset} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh renderOrder={0}>
            <planeGeometry args={[panelW, panelH]} />
            <meshBasicMaterial
              color={infoPanelBg}
              transparent
              opacity={0.65}
              depthWrite={false}
            />
          </mesh>

          {infoLines.map((t, i) => (
            <Text
              key={i}
              renderOrder={2}
              depthTest={false}
              position={[-panelW * 0.45, (panelH * 0.32) - i * lineH, 0.01]}
              fontSize={infoFontSize}
              color={infoText}
              anchorX="left"
              anchorY="top"
              maxWidth={panelW * 0.96}
              lineHeight={1.1}
            >
              {t}
            </Text>
          ))}
        </group>
      )}
    </group>
  )
}
