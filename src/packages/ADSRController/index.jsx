import { useMemo } from 'react'
import Roller from '../../components/roller'
import Dial from "../../components/dial"
import BitmapText from '../../components/bitmapText'

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

  A_RANGE = [0.01, 2.0],
  D_RANGE = [0.01, 2.0],
  S_RANGE = [0.0, 1.0],
  R_RANGE = [0.01, 2.0],
  DUR_RANGE = [0.03, 6.0],

  onChange = () => { },

  showInfoPanel = true,
  infoPanelOffset,
  infoPanelSize = [0.34, 0.2],
  infoPanelBg = '#0f172a',
  infoText = '#000000',
  infoFontSize = 0.025,
}) {
  const A_pos = [-gridSpacingX * 0.5, 0, -gridSpacingZ]
  const D_pos = [gridSpacingX * 0.5, 0, -gridSpacingZ]
  const S_pos = [-gridSpacingX * 0.5, 0, 0]
  const R_pos = [gridSpacingX * 0.5, 0, 0]
  const DialPos = [gridSpacingX * 1.4, 0, -gridSpacingZ * 0.5]

  const A_MIN = A_RANGE[0], A_MAX = A_RANGE[1]
  const D_MIN = D_RANGE[0], D_MAX = D_RANGE[1]
  const R_MIN = R_RANGE[0], R_MAX = R_RANGE[1]
  const DUR_MIN = Math.max(DUR_RANGE[0], A_MIN + D_MIN + R_MIN) // must be at least sum of mins
  const DUR_MAX = DUR_RANGE[1]

  const round2 = (x) => +x.toFixed(2)
  const round3 = (x) => +x.toFixed(3)
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

  // Fit ADR into a given duration by reducing R→D→A down to mins
  const fitADRIntoDuration = (a, d, r, dur) => {
    let A = clamp(a, A_MIN, A_MAX)
    let D = clamp(d, D_MIN, D_MAX)
    let R = clamp(r, R_MIN, R_MAX)
    const target = clamp(dur, DUR_MIN, DUR_MAX)

    let excess = (A + D + R) - target
    if (excess <= 0) return { A, D, R, target }

    // reduce R first
    const canR = R - R_MIN
    const dR = Math.min(canR, excess)
    R -= dR; excess -= dR
    if (excess <= 0) return { A, D, R, target }

    // then D
    const canD = D - D_MIN
    const dD = Math.min(canD, excess)
    D -= dD; excess -= dD
    if (excess <= 0) return { A, D, R, target }

    // then A
    const canA = A - A_MIN
    const dA = Math.min(canA, excess)
    A -= dA; excess -= dA
    // if still > 0, we cannot satisfy; bump duration to exactly A+D+R
    const finalTarget = excess > 0 ? clamp(A + D + R, DUR_MIN, DUR_MAX) : target
    return { A, D, R, target: finalTarget }
  }

  // Handlers that respect the budget at the moment of change
  const handleAttack = (next) => {
    const Araw = clamp(next, A_MIN, A_MAX)
    const maxA = Math.max(A_MIN, duration - (decay + release))
    const A = Math.min(Araw, maxA)
    onChange({ attack: round3(A) })
  }

  const handleDecay = (next) => {
    const Draw = clamp(next, D_MIN, D_MAX)
    const maxD = Math.max(D_MIN, duration - (attack + release))
    const D = Math.min(Draw, maxD)
    onChange({ decay: round3(D) })
  }

  const handleRelease = (next) => {
    const Rraw = clamp(next, R_MIN, R_MAX)
    const maxR = Math.max(R_MIN, duration - (attack + decay))
    const R = Math.min(Rraw, maxR)
    onChange({ release: round3(R) })
  }

  const handleDuration = (next) => {
    // Ensure duration can't go below the sum of mins
    const dur = clamp(next, DUR_MIN, DUR_MAX)
    const { A, D, R, target } = fitADRIntoDuration(attack, decay, release, dur)
    onChange({
      attack: round3(A),
      decay: round3(D),
      release: round3(R),
      duration: round2(target),
    })
  }


  const fmtSec = (s) => `${Number.isFinite(s) ? s.toFixed(2) : '0.00'}s`
  const fmtPct = (p) => `${Number.isFinite(p) ? Math.round(p * 100) : 0}%`

  const rows = useMemo(() => ([
    ['Attack', fmtSec(attack)],
    ['Decay', fmtSec(decay)],
    ['Sustain', fmtPct(sustain)],
    ['Release', fmtSec(release)],
    ['Duration', fmtSec(duration)],
  ]), [attack, decay, sustain, release, duration])


  const panelOffset = infoPanelOffset ?? [gridSpacingX * 0, 0, 0]
  const [panelW, panelH] = infoPanelSize
  const lineH = 0.05

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Roller position={A_pos} size={size} baseColor={waveBaseColor} diskColor={rollerColor}
        range={A_RANGE} step={0.01} stepAngle={Math.PI / 18}
        value={attack} onChange={handleAttack} />

      <Roller position={D_pos} size={size} baseColor={waveBaseColor} diskColor={rollerColor}
        range={D_RANGE} step={0.01} stepAngle={Math.PI / 18}
        value={decay} onChange={handleDecay} />

      <Roller position={S_pos} size={size} baseColor={waveBaseColor} diskColor={rollerColor}
        range={S_RANGE} step={0.05} stepAngle={Math.PI / 18}
        value={sustain} onChange={(v) => onChange({ sustain: +v.toFixed(3) })} />

      <Roller position={R_pos} size={size} baseColor={waveBaseColor} diskColor={rollerColor}
        range={R_RANGE} step={0.02} stepAngle={Math.PI / 18}
        value={release} onChange={handleRelease} />

      <Dial position={DialPos} size={size} baseColor={dialBaseColor} dialColor={dialColor}
        range={[DUR_MIN, DUR_MAX]} step={0.05} stepAngle={Math.PI / 18}
        value={duration} onChange={handleDuration} />

      {showInfoPanel && (
        <group position={panelOffset} rotation={[-Math.PI / 2, 0, 0]}>
          {/* Optional background
    <mesh renderOrder={0}>
      <planeGeometry args={[panelW, panelH]} />
      <meshBasicMaterial color={infoPanelBg} transparent opacity={0.65} depthWrite={false} />
    </mesh> */}

          {rows.map(([label, value], i) => {
            const y = (panelH * 0.6) - i * lineH
            return (
              <group key={label}>
                {/* Left column: label, left-aligned */}
                <BitmapText
                  text={label}
                  position={[-panelW * 0.46, y, 0.01]}
                  rotation={[Math.PI, 0, 0]}
                  scale={[infoFontSize, infoFontSize, infoFontSize]}
                  color={infoText}
                  align="left"
                  anchorY="top"
                  maxWidth={panelW * 0.46 / infoFontSize}
                  lineHeight={1.1}
                />
                {/* Right column: value, right-aligned */}
                <BitmapText
                  text={value}
                  position={[panelW * 0.58, y, 0.01]}
                  rotation={[Math.PI, 0, 0]}
                  scale={[infoFontSize, infoFontSize, infoFontSize]}
                  color={infoText}
                  align="right"
                  anchorY="top"
                  maxWidth={panelW * 0.46 / infoFontSize}
                  lineHeight={1.1}
                />
              </group>
            )
          })}
        </group>
      )}

    </group>
  )
}
