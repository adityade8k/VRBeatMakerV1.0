// src/packages/ConsolePanel.jsx
import WaveTypeSelector from '../WaveTypeSelector'
import ADSRController from '../ADSRController'
import TonePad from '../TonePad'

export default function ConsolePanel({
  position = [0, 0.9, -0.35],
  rotation = [0, 0, 0],
  synth,
  onWaveChange,
  onADSRChange,
  onSynthPatch,        // NEW: pass-through setter for tonePad dial changes
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* Waveform Selector */}
      <WaveTypeSelector
        position={[-0.2, 0, 0.025]}
        spacing={0.07}
        size={[0.055, 0.055]}
        buttonScale={0.6}
        selected={synth.waveform}
        onChange={onWaveChange}
      />

      {/* ADSR Controller */}
      <ADSRController
        position={[-0.05, 0.0, 0]}
        gridSpacingX={0.12}
        gridSpacingZ={0.12}
        size={[0.1, 0.1]}
        attack={synth.attack}
        decay={synth.decay}
        sustain={synth.sustain}
        release={synth.release}
        duration={synth.duration}
        onChange={onADSRChange}
        showInfoPanel
        infoPanelOffset={[0.061, 0, -0.3]}
        infoPanelSize={[0.34, 0.2]}
      />

      {/* TonePad cluster (right) */}
      <TonePad
        position={[0.68, 0, 0]}
        synth={synth}
        onChange={onSynthPatch}
      />
    </group>
  )
}
