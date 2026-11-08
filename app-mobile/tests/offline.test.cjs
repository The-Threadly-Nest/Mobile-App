const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative, imports = {}) {
  const filename = path.resolve(__dirname, '../src/shared', relative);
  const compiled = new Module(filename, module);
  compiled.require = id => { if (!(id in imports)) throw new Error('Unexpected test import: ' + id); return imports[id]; };
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return compiled.exports;
}
const connection = load('services/connectionStatus.ts');
test('offline detection distinguishes disconnected, unreachable and unknown states', () => {
  assert.equal(connection.deriveConnectionStatus(false, null), 'offline');
  assert.equal(connection.deriveConnectionStatus(true, false), 'offline');
  assert.equal(connection.deriveConnectionStatus(null, null), 'unknown');
  assert.equal(connection.deriveConnectionStatus(true, true), 'online');
  assert.equal(connection.deriveConnectionStatus(true, null, 'offline'), 'offline');
});
test('connection listeners update once per transition and stop after unsubscribing', () => {
  connection.updateConnectionStatus(true, true);
  let updates = 0;
  const unsubscribe = connection.subscribeConnectionStatus(() => updates++);
  connection.updateConnectionStatus(false, false);
  connection.updateConnectionStatus(false, false);
  assert.equal(updates, 1);
  connection.updateConnectionStatus(true, true);
  assert.equal(updates, 2);
  unsubscribe();
  connection.updateConnectionStatus(false, false);
  assert.equal(updates, 2);
});
test('offline requests fail immediately without sending, queueing or logging the user out', async () => {
  let fetches = 0, alerts = 0, logouts = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => { fetches++; throw new Error('Must not connect offline'); };
  const api = load('utils/apiClient.ts', {
    '@/stores/useAuthStore': { useAuthStore: { getState: () => ({ token: 'fixture', logout: () => logouts++ }) } },
    '@/api/config': { API_BASE_URL: 'https://example.invalid' },
    '@/shared/utils/alertEmitter': { alertEmitter: { emit: () => alerts++ } },
    '../services/connectionStatus': connection,
  });
  try {
    connection.updateConnectionStatus(false, false);
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
      await assert.rejects(() => api.apiFetch('/api/test', { method }), error => error.details.code === 'NETWORK_DISCONNECTED');
    }
    assert.equal(fetches, 0);
    assert.equal(alerts, 0);
    assert.equal(logouts, 0);
    connection.updateConnectionStatus(true, true);
    global.fetch = async () => { fetches++; return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
    assert.deepEqual(await api.apiFetch('/api/test'), { ok: true });
    assert.equal(fetches, 1, 'Coming online must not replay any offline mutations');
    global.fetch = async () => new Response(JSON.stringify({ error: 'Server maintenance' }), { status: 503 });
    await assert.rejects(() => api.apiFetch('/api/test', { method: 'POST', silent: true }), error => error.details.status === 503);
    assert.equal(connection.getConnectionStatus(), 'online', 'A server error is not proof of no internet');
  } finally { global.fetch = originalFetch; connection.updateConnectionStatus(true, true); }
});
test('one global banner leaves cached screens accessible and does not cover their controls', () => {
  const root = fs.readFileSync(path.resolve(__dirname, '../app/_layout.tsx'), 'utf8');
  const frame = fs.readFileSync(path.resolve(__dirname, '../src/shared/components/ConnectionFrame.tsx'), 'utf8');
  assert.equal((root.match(/<ConnectionFrame>/g) || []).length, 1);
  assert.match(frame, /offline \? <View accessibilityRole="alert"/);
  assert.match(frame, /Connect to send messages, book or place orders/);
  assert.match(frame, /AppState.addEventListener/);
  assert.doesNotMatch(frame, /clearCache|logout|router\.replace/);
});
