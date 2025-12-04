import WaveTypeSelector from '../WaveTypeSelector'
import ADSRController from '../ADSRController'
import TonePad from '../TonePad'
import PlayBackRecorder from '../PlayBackRecorder'

export default function ConsolePanel({
  position = [0, 0.9, -0.35],
  rotation = [0, 0, 0],
  scale = 0.5,
  synth,
  onWaveChange,
  onADSRChange,
  onSynthPatch,
  recorder,
}) {
  const {
    sequence, setSequence,
    selectedTrack, setSelectedTrack,
    selectedSlots, setSelectedSlots,
    recording, setRecording,
    playing, setPlaying,
    mutes, setMutes,
    recDuration, setRecDuration,
    onRecordedNote, // you provide this from parent to capture TonePad notes when recording
  } = recorder

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      <WaveTypeSelector
        position={[-0.05, 0, 0.008]}
        spacing={0.1}
        size={[0.075, 0.075]}
        buttonScale={0.6}
        selected={synth.waveform}
        onChange={onWaveChange}
      />

      <ADSRController
        position={[0.17, 0.0, 0]}
        gridSpacingX={0.12}
        gridSpacingZ={0.12}
        size={[0.1, 0.1]}
        attack={synth.attack}
        decay={synth.decay}
        sustain={synth.sustain}
        release={synth.release}
        duration={synth.duration}
        waveform={synth.waveform}
        reverbMix={synth.reverbMix}
        reverbRoomSize={synth.reverbRoomSize}
        onChange={onADSRChange}
        onLoadInstrument={(settings) => {
          onWaveChange(settings.waveform)
          onSynthPatch({
            attack: settings.attack,
            decay: settings.decay,
            sustain: settings.sustain,
            release: settings.release,
            duration: settings.duration,
            reverbMix: settings.reverbMix,
            reverbRoomSize: settings.reverbRoomSize,
          })
        }}
        showInfoPanel
        infoPanelOffset={[0.061, 0, -0.3]}
        infoPanelSize={[0.34, 0.2]}
        showInstrumentsPanel
        instrumentsPanelOffset={[0.32, 0, -0.35]}
      />

      {/* Playback + Visualizer live inside this module now */}
      <PlayBackRecorder
        position={[1.045, 0.0, -0.2]}
        synth={synth}
        sequence={sequence} setSequence={setSequence}
        selectedTrack={selectedTrack} setSelectedTrack={setSelectedTrack}
        selectedSlots={selectedSlots} setSelectedSlots={setSelectedSlots}
        recording={recording} setRecording={setRecording}
        playing={playing} setPlaying={setPlaying}
        mutes={mutes} setMutes={setMutes}
        recDuration={recDuration} setRecDuration={setRecDuration}
      />

      {/* TonePad (records into current slot when recording is ON) */}
      <TonePad
        position={[0.85, 0, -0.075]}
        synth={synth}
        onChange={onSynthPatch}
        onNote={(midi) => onRecordedNote?.(midi)}
      />
    </group>
  )
}
