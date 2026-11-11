const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

test('voice notes use AAC/M4A with truthful MIME metadata', () => {
  for (const os of ['android', 'ios', 'web']) {
    const filename = path.join(root, 'src/shared/utils/voiceRecording.ts');
    const mod = new Module(filename, module);
    mod.require = id => id === 'react-native' ? { Platform: { OS: os } } : { RecordingPresets: { HIGH_QUALITY: { extension: '.m4a', android: { outputFormat: 'mpeg4', audioEncoder: 'aac' } } } };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
    const { VOICE_RECORDING_OPTIONS, voiceAttachment } = mod.exports;
    assert.equal(VOICE_RECORDING_OPTIONS.android.outputFormat, 'mpeg4');
    assert.equal(VOICE_RECORDING_OPTIONS.android.audioEncoder, 'aac');
    assert.equal(VOICE_RECORDING_OPTIONS.numberOfChannels, 1);
    assert.equal(VOICE_RECORDING_OPTIONS.sampleRate, 24000);
    assert.equal(VOICE_RECORDING_OPTIONS.bitRate, 32000);
    assert.equal(VOICE_RECORDING_OPTIONS.web.bitsPerSecond, 32000);
    assert.equal(VOICE_RECORDING_OPTIONS.isMeteringEnabled, true);
    const attachment = voiceAttachment();
    assert.equal(attachment.contentType, os === 'web' ? 'audio/webm' : 'audio/mp4');
    assert.ok(attachment.filename.endsWith(os === 'web' ? '.webm' : '.m4a'));
  }
});

test('microphone waveform follows bounded recording levels instead of random motion', () => {
  const filename = path.join(root, 'src/shared/utils/audioMetering.ts');
  const mod = new Module(filename, module);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  const { meterAmplitude, waveScale } = mod.exports;
  assert.equal(meterAmplitude(undefined), 0.08);
  assert.equal(meterAmplitude(NaN), 0.08);
  assert.equal(meterAmplitude(-100), 0.08);
  assert.equal(meterAmplitude(-30), 0.5);
  assert.equal(meterAmplitude(10), 1);
  const waveform = fs.readFileSync(path.join(root, 'src/shared/components/AudioWaveform.tsx'), 'utf8');
  assert.doesNotMatch(waveform, /Math\.random/);
  assert.match(waveform, /if \(!isAnimating\) return/);
  assert.match(waveform, /useNativeDriver: true/);
  assert.match(waveform, /scaleY: Animated.multiply\(wave, loudness\)/);
  assert.match(waveform, /animation.stop\(\)/);
  assert.notEqual(waveScale(0, 0), waveScale(0.25, 0));
  assert.ok(Math.abs(waveScale(0, 0) - waveScale(1, 0)) < 1e-10);
  for (const screen of ['app/(admin)/messages.tsx', 'app/(customer)/direct-chat/[fashionHouseId].tsx', 'app/(admin)/chat.tsx', 'app/(staff)/chat.tsx']) {
    const source = fs.readFileSync(path.join(root, screen), 'utf8');
    assert.match(source, /metering=\{recordingState\.metering\}/);
    assert.match(source, /useAudioRecorderState\(audioRecorder, 100\)/);
  }
});

test('recording screens enable recording mode before preparing and use the shared format', () => {
  for (const screen of ['app/(admin)/messages.tsx', 'app/(customer)/direct-chat/[fashionHouseId].tsx', 'app/(admin)/measurements/new.tsx', 'app/(admin)/chat.tsx', 'app/(staff)/chat.tsx']) {
    const source = fs.readFileSync(path.join(root, screen), 'utf8');
    assert.doesNotMatch(source, /RecordingPresets\.LOW_QUALITY/);
    assert.match(source, /useAudioRecorder\(VOICE_RECORDING_OPTIONS\)/);
    assert.match(source, /await setAudioModeAsync\(\{ allowsRecording: true, playsInSilentMode: true \}\);\s*await audioRecorder\.prepareToRecordAsync\(\);/);
    assert.match(source, /voiceAttachment\(/);
    assert.doesNotMatch(source, /uploaded\.fileUrl \|\| uri/);
  }
});
