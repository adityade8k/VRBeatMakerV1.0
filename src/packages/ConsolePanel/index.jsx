import WaveTypeSelector from '../WaveTypeSelector'
import ADSRController from '../ADSRController'

/**
 * ConsolePanel
 * - A single, reusable cluster that hosts both WaveTypeSelector and ADSRController.
 * - Provide `synth` and `onChange` from parent.
 */
export default function ConsolePanel({
  position = [0, 0.9, -0.35],
  synth,
  onWaveChange,
  onADSRChange,
}) {
  return (
    <group position={position}>
      
        {/* Waveform Selector (right side) */}
        <WaveTypeSelector
          position={[-0.22, 0.03, -0.03]}
          spacing={0.07}
          size={[0.055, 0.055]}
          buttonScale={0.6}
          selected={synth.waveform}
          onChange={onWaveChange}
        />

        {/* ADSR Controller (left side) with built-in info panel */}
        <ADSRController
          position={[-0.05, 0.0, 0]}
          gridSpacingX={0.16}
          gridSpacingZ={0.12}
          size={[0.1, 0.1]}
          attack={synth.attack}
          decay={synth.decay}
          sustain={synth.sustain}
          release={synth.release}
          duration={synth.duration}
          onChange={onADSRChange}
          showInfoPanel       // NEW: makes the controller render its own plane + text
          infoPanelOffset={[0.06, 0, -0.3]} // tweak vertical offset above controls
          infoPanelSize={[0.4, 0.2]}    // (width, height) of the plane
        />
    </group>
  )
}
