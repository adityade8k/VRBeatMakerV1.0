// packages/ADSRController.jsx
import { useMemo, useCallback } from 'react'
import { Text } from '@react-three/drei'         // ⬅️ NEW
import Roller from '../../components/roller'     // adjust import paths if different
import Dial from "../../components/dial"         // adjust import paths if different

/**
 * ADSRController
 * - 4 Rollers: Attack, Decay, Sustain, Release (normalized 0..1 with per-param ranges)
 * - 1 Dial   : Duration (normalized 0..1 with its own range)
 *
 * Props:
 *   position=[0,0,0], rotation, scale
 *   gridSpacingX=0.16, gridSpacingZ=0.12, size=[0.085,0.085]
 *   attack, decay, sustain, release, duration  (controlled values)
 *   A_RANGE=[0.005, 2.0], D_RANGE=[0.01, 2.0], S_RANGE=[0,1], R_RANGE=[0.01, 3.0], DUR_RANGE=[0.05, 4.0]
 *   colors & styling for rollers and dial
 *   onChange: (patch) => void   // patch like { attack: 0.2 } in real units
 *
 *   // NEW (Info Panel)
 *   showInfoPanel=true
 *   infoPanelOffset=[gridSpacingX*1.4, 0.18, 0]
 *   infoPanelSize=[0.62, 0.2]
 *   infoPanelBg="#0f172a", infoPanelBorder="#94a3b8", infoText="#cbd5e1"
 *   infoFontSize=0.045
 */
export default function ADSRController({
  // Transform
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],

  // Grid layout
  gridSpacingX = 0.16,
  gridSpacingZ = 0.12,

  // Control size/colors (forwarded to Roller/Dial)
  size = [0.085, 0.085],

  waveBaseColor = '#324966',
  rollerColor = '#fc45c8',
  dialBaseColor = '#324966',
  dialColor = '#f08c00',

  // Controlled values (real units)
  attack = 0.02,
  decay = 0.12,
  sustain = 0.8,  // 0..1
  release = 0.2,
  duration = 0.5,

  // Ranges (real units)
  A_RANGE = [0.005, 2.0],
  D_RANGE = [0.01, 2.0],
  S_RANGE = [0.0, 1.0],
  R_RANGE = [0.01, 3.0],
  DUR_RANGE = [0.05, 4.0],

  // Behavior
  hardStops = true,
  friction = 0.8,
  sensitivity = 0.2,

  // Unified patch emitter
  onChange = () => { },

  // ───────── NEW: Info panel props ─────────
  showInfoPanel = true,
  infoPanelOffset, // default computed below
  infoPanelSize = [0.3, 0.3],
  infoPanelBg = '#0f172a',
  infoPanelBorder = '#94a3b8',
  infoText = '#cbd5e1',
  infoFontSize = 0.025,
}) {
  // Helpers
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
  const norm = useCallback((v, [lo, hi]) => {
    const span = Math.max(1e-9, hi - lo)
    return clamp((v - lo) / span, 0, 1)
  }, [])
  const denorm = useCallback((t, [lo, hi]) => {
    const tt = clamp(t, 0, 1)
    return lo + tt * (hi - lo)
  }, [])
  const round3 = (x) => Math.round(x * 1000) / 1000

  // Controlled normalized values for each control
  const nA = useMemo(() => norm(attack, A_RANGE), [attack, A_RANGE, norm])
  const nD = useMemo(() => norm(decay, D_RANGE), [decay, D_RANGE, norm])
  const nS = useMemo(() => norm(sustain, S_RANGE), [sustain, S_RANGE, norm])
  const nR = useMemo(() => norm(release, R_RANGE), [release, R_RANGE, norm])
  const nDur = useMemo(() => norm(duration, DUR_RANGE), [duration, DUR_RANGE, norm])

  // Emitters
  const onA = useCallback((t) => onChange({ attack: round3(denorm(t, A_RANGE)) }), [onChange, A_RANGE, denorm])
  const onD = useCallback((t) => onChange({ decay: round3(denorm(t, D_RANGE)) }), [onChange, D_RANGE, denorm])
  const onS = useCallback((t) => onChange({ sustain: round3(denorm(t, S_RANGE)) }), [onChange, S_RANGE, denorm])
  const onR = useCallback((t) => onChange({ release: round3(denorm(t, R_RANGE)) }), [onChange, R_RANGE, denorm])
  const onDu = useCallback((t) => onChange({ duration: round3(denorm(t, DUR_RANGE)) }), [onChange, DUR_RANGE, denorm])

  // Layout:
  //  A  D
  //  S  R     (dial centered to the right)
  const A_pos = [-gridSpacingX * 0.5, 0, 0]
  const D_pos = [gridSpacingX * 0.5, 0, 0]
  const S_pos = [-gridSpacingX * 0.5, 0, -gridSpacingZ]
  const R_pos = [gridSpacingX * 0.5, 0, -gridSpacingZ]
  const DialPos = [gridSpacingX * 1.4, 0, -gridSpacingZ * 0.5]

  // ───────── NEW: Info panel content/position ─────────
  const fmtSec = (s) => `${Number.isFinite(s) ? s.toFixed(2) : '0.00'}s`
  const fmtPct = (p) => `${Number.isFinite(p) ? Math.round(p * 100) : 0}%`

  const infoLines = useMemo(() => ([
    `Attack  ${fmtSec(attack)}   Decay  ${fmtSec(decay)}`,
    `Sustain ${fmtPct(sustain)}  Release ${fmtSec(release)}`,
    `Duration ${fmtSec(duration)}`,
  ]), [attack, decay, sustain, release, duration])

  const panelOffset = infoPanelOffset ?? [gridSpacingX * 1.4, 0.18, 0] // above the dial by default
  const [panelW, panelH] = infoPanelSize
  const lineH = 0.06

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Attack */}
      <Roller
        position={A_pos}
        size={size}
        baseColor={waveBaseColor}
        diskColor={rollerColor}
        minValue={A_RANGE[0]}
        maxValue={A_RANGE[1]}
        value={nA}
        hardStops={hardStops}
        friction={friction}
        sensitivity={sensitivity}
        onChange={onA}
      />

      {/* Decay */}
      <Roller
        position={D_pos}
        size={size}
        baseColor={waveBaseColor}
        diskColor={rollerColor}
        minValue={D_RANGE[0]}
        maxValue={D_RANGE[1]}
        value={nD}
        hardStops={hardStops}
        friction={friction}
        sensitivity={sensitivity}
        onChange={onD}
      />

      {/* Sustain */}
      <Roller
        position={S_pos}
        size={size}
        baseColor={waveBaseColor}
        diskColor={rollerColor}
        minValue={S_RANGE[0]}
        maxValue={S_RANGE[1]}
        value={nS}
        hardStops={hardStops}
        friction={friction}
        sensitivity={sensitivity}
        onChange={onS}
      />

      {/* Release */}
      <Roller
        position={R_pos}
        size={size}
        baseColor={waveBaseColor}
        diskColor={rollerColor}
        minValue={R_RANGE[0]}
        maxValue={R_RANGE[1]}
        value={nR}
        hardStops={hardStops}
        friction={friction}
        sensitivity={sensitivity}
        onChange={onR}
      />

      {/* Duration Dial */}
      <Dial
        position={DialPos}
        size={size}
        baseColor={dialBaseColor}
        dialColor={dialColor}
        minAngle={-Math.PI * 0.75}
        maxAngle={Math.PI * 0.75}
        minValue={DUR_RANGE[0]}
        maxValue={DUR_RANGE[1]}
        value={nDur}
        hardStops
        friction={0.5}
        sensitivity={0.5}
        onChange={onDu}
      />

      {showInfoPanel && (
        <group position={panelOffset} rotation={[-Math.PI / 2, 0, 0]}>
          {/* Background plane */}
          <mesh renderOrder={0}>
            <planeGeometry args={[panelW, panelH]} />
            <meshBasicMaterial
              color={infoPanelBg}
              transparent
              opacity={0.65}
              depthWrite={false}   // <— prevents the panel from writing to the depth buffer
            />
          </mesh>

          {/* Text lines */}
          {infoLines.map((t, i) => (
            <Text
              key={i}
              renderOrder={2}       // <— ensure it renders after the background
              depthTest={false}     // <— ignore depth for crisp edges
              position={[-panelW * 0.45, (panelH * 0.32) - i * lineH, 0.01]}  // <— more separation
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
