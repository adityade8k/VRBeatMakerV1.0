import { useMemo } from 'react'
import Roller from '../../components/roller'
import Dial from "../../components/dial"
import BitmapText from '../../components/bitmapText'
import InstrumentsPanel from '../InstrumentsPanel'

export default function ADSRController({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],

  gridSpacingX = 0.16,
  gridSpacingZ = 0.12,

  size = [0.085, 0.085],
  waveBaseColor = '#324966',
  rollerColor = '#fc45c8',
  dialBaseColor = '#324966',
  dialColor = '#f08c00',

  attack = 0.02,
  decay = 0.12,
  sustain = 0.8,
  release = 0.2,
  duration = 0.5,
  waveform = 'sine',
  reverbMix = 0.25,
  reverbRoomSize = 0.30,

  A_RANGE = [0.005, 2.0],
  D_RANGE = [0.01, 2.0],
  S_RANGE = [0.0, 1.0],
  R_RANGE = [0.01, 3.0],
  DUR_RANGE = [0.05, 4.0],

  onChange = () => {},
  onLoadInstrument = () => {},

  showInfoPanel = true,
  infoPanelOffset,
  infoPanelSize = [0.34, 0.2],
  infoPanelBg = '#0f172a',
  infoText = '#000000',
  infoFontSize = 0.025,

  showInstrumentsPanel = true,
  instrumentsPanelOffset,
}) {
  const A_pos = [-gridSpacingX * 0.5, 0, -gridSpacingZ]
  const D_pos = [ gridSpacingX * 0.5, 0, -gridSpacingZ]
  const S_pos = [-gridSpacingX * 0.5, 0, 0]
  const R_pos = [ gridSpacingX * 0.5, 0, 0]
  const DialPos = [ gridSpacingX * 1.4, 0, -gridSpacingZ * 0.5]

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
      <Roller position={A_pos} size={size} baseColor={waveBaseColor} diskColor={rollerColor}
              range={A_RANGE} step={0.01} stepAngle={Math.PI/18}
              value={attack} onChange={(v) => onChange({ attack: +v.toFixed(3) })} />
      <Roller position={D_pos} size={size} baseColor={waveBaseColor} diskColor={rollerColor}
              range={D_RANGE} step={0.01} stepAngle={Math.PI/18}
              value={decay} onChange={(v) => onChange({ decay: +v.toFixed(3) })} />
      <Roller position={S_pos} size={size} baseColor={waveBaseColor} diskColor={rollerColor}
              range={S_RANGE} step={0.05} stepAngle={Math.PI/18}
              value={sustain} onChange={(v) => onChange({ sustain: +v.toFixed(3) })} />
      <Roller position={R_pos} size={size} baseColor={waveBaseColor} diskColor={rollerColor}
              range={R_RANGE} step={0.02} stepAngle={Math.PI/18}
              value={release} onChange={(v) => onChange({ release: +v.toFixed(3) })} />
      <Dial position={DialPos} size={size} baseColor={dialBaseColor} dialColor={dialColor}
            range={DUR_RANGE} step={0.05} stepAngle={Math.PI/18}
            value={duration} onChange={(v) => onChange({ duration: +v.toFixed(2) })} />

      {showInfoPanel && (
        <group position={panelOffset} rotation={[-Math.PI/2,0,0]}>
          {/* <mesh renderOrder={0}>
            <planeGeometry args={[panelW, panelH]} />
            <meshBasicMaterial color={infoPanelBg} transparent opacity={0.65} depthWrite={false} />
          </mesh> */}

          {infoLines.map((t, i) => (
            <BitmapText
              key={i}
              text={t}
              position={[-panelW * 0.45, (panelH * 0.32) - i * lineH, 0.01]}
              rotation={[Math.PI, 0, 0]}
              scale={[infoFontSize, infoFontSize, infoFontSize]}
              color={infoText}
              align="left"
              anchorY="top"
              maxWidth={panelW * 0.96 / infoFontSize}
              lineHeight={1.1}
            />
          ))}
        </group>
      )}

      {showInstrumentsPanel && (
        <InstrumentsPanel
          position={instrumentsPanelOffset ?? [gridSpacingX * 2.2, 0, -gridSpacingZ * 1.5]}
          currentSettings={{
            waveform,
            attack,
            decay,
            sustain,
            release,
            duration,
            reverbMix,
            reverbRoomSize,
          }}
          onLoadInstrument={onLoadInstrument}
        />
      )}
    </group>
  )
}
