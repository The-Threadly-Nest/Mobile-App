const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function harness(mode = async () => {}) {
  const filename = path.resolve(__dirname, '../src/shared/hooks/useVoicePlayback.ts');
  const mod = new Module(filename, module);
  const players = [], errors = [];
  let cleanup, playing;
  mod.require = id => ({
    react: { useRef: value => ({ current: value }), useState: () => [null, value => { playing = value; }], useCallback: fn => fn },
    'expo-router': { useFocusEffect: fn => { cleanup = fn(); } },
    './useAppAlert': { useAppAlert: () => ({ showAlert: (...args) => errors.push(args) }) },
    'expo-audio': {
      setAudioModeAsync: mode,
      createAudioPlayer: (url, options) => {
        const p = { url, options, played: 0, paused: 0, seeks: 0, removed: 0, unsubscribed: 0,
          pause() { this.paused++; }, play() { this.played++; }, remove() { this.removed++; },
          async seekTo(seconds) { assert.equal(seconds, 0); this.seeks++; }, setPlaybackRate(rate) { this.rate = rate; },
          addListener(event, listener) { assert.equal(event, 'playbackStatusUpdate'); this.listener = listener; return { remove: () => this.unsubscribed++ }; },
        }; players.push(p); return p;
      },
    },
  })[id];
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return { hook: mod.exports.useVoicePlayback(), players, errors, cleanup: () => cleanup(), playing: () => playing };
}

test('voice playback reuses buffered notes, resumes pause, rewinds after finish and stays at 1x', async () => {
  const h = harness();
  await h.hook.togglePlayAudio('https://example.invalid/one.m4a', 'one');
  assert.equal(h.playing(), 'one');
  await h.hook.togglePlayAudio('https://example.invalid/one.m4a', 'one');
  assert.equal(h.playing(), null);
  await h.hook.togglePlayAudio('https://example.invalid/one.m4a', 'one');
  assert.equal(h.players.length, 1);
  assert.equal(h.players[0].seeks, 0);
  h.players[0].listener({ didJustFinish: true });
  await h.hook.togglePlayAudio('https://example.invalid/one.m4a', 'one');
  assert.equal(h.players[0].seeks, 1);
  assert.equal(h.players[0].rate, 1);
  assert.equal(h.players[0].options.downloadFirst, false);
  h.hook.stopPlayback();
  assert.equal(h.playing(), null);
  h.cleanup();
  assert.equal(h.players[0].removed, 1);
  assert.equal(h.players[0].unsubscribed, 1);
  assert.deepEqual(h.errors, []);
});

test('player cache is bounded and leaving during setup never starts background playback', async () => {
  const h = harness();
  for (let i = 0; i < 5; i++) await h.hook.togglePlayAudio(`https://example.invalid/${i}.m4a`, String(i));
  assert.equal(h.players[0].removed, 1);
  h.cleanup();
  assert.ok(h.players.every(p => p.removed === 1));
  let release;
  const delayed = harness(() => new Promise(resolve => { release = resolve; }));
  const pending = delayed.hook.togglePlayAudio('https://example.invalid/one.m4a', 'one');
  delayed.cleanup(); release(); await pending;
  assert.equal(delayed.players.length, 0);
});

test('chat send handlers provide immediate feedback, reject duplicate sends and add no artificial delay', () => {
  for (const file of ['app/(admin)/messages.tsx', 'app/(admin)/chat.tsx', 'app/(staff)/chat.tsx', 'app/(customer)/direct-chat/[fashionHouseId].tsx']) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
    const start = source.indexOf('const stopAndSendRecording');
    const send = source.slice(start, source.indexOf('\n  const ', start + 10));
    assert.match(send, /if \(voiceSendLock.current\) return/);
    assert.ok(send.indexOf('setSending(true)') < send.indexOf('await audioRecorder.stop()'));
    assert.doesNotMatch(send, /setTimeout|audio\/m4a|uploaded.fileUrl \|\| uri/);
    assert.match(source, /useVoicePlayback\(\)/);
    assert.doesNotMatch(source, /function AnimatedWaveform|RecordingPresets.LOW_QUALITY/);
  }
});
