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
    '../services/pageCache': {},
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
test('one dismissible offline popup leaves screen layout and safe areas unchanged', () => {
  const root = fs.readFileSync(path.resolve(__dirname, '../app/_layout.tsx'), 'utf8');
  const frame = fs.readFileSync(path.resolve(__dirname, '../src/shared/components/ConnectionFrame.tsx'), 'utf8');
  assert.equal((root.match(/<ConnectionFrame>/g) || []).length, 1);
  assert.match(frame, /offline && !dismissed \? <View accessibilityRole="alert"/);
  assert.match(frame, /Showing saved content/);
  assert.match(frame, /Dismiss offline notice/);
  assert.match(frame, /position: "absolute"/);
  assert.doesNotMatch(frame, /SafeAreaInsetsContext.Provider/);
  assert.match(frame, /AppState.addEventListener/);
  assert.doesNotMatch(frame, /clearCache|logout|router\.replace/);
});

test('cached catalog survives a cold start offline, preserves pagination and never crosses accounts', async () => {
  const originalFetch = global.fetch;
  let session = { token: 'customer-a', role: 'customer', email: 'a@example.invalid', logout: () => {} };
  const disk = new Map();
  let calls = 0;
  const imports = {
    '@/stores/useAuthStore': { useAuthStore: { getState: () => session } },
    '@/api/config': { API_BASE_URL: 'https://example.invalid' },
    '@/shared/utils/alertEmitter': { alertEmitter: { emit: () => assert.fail('Cache reads must not show a popup per section') } },
    '../services/connectionStatus': connection,
    '../services/pageCache': {
      createPageCacheOwner: (role, email) => `${role}:${email}`,
      readPageCache: async (owner, key) => disk.get(`${owner}:${key}`) || null,
      writePageCache: async (owner, key, value) => { disk.set(`${owner}:${key}`, value); },
    },
  };
  const endpoint = '/api/catalog/marketplace?page=1&limit=50';
  try {
    connection.updateConnectionStatus(true, true);
    global.fetch = async () => { calls++; return new Response(JSON.stringify([{ id: 'dress' }]), { headers: { 'X-Has-More': 'true', 'X-Next-Page': '2', 'X-Page': '1' } }); };
    const online = load('utils/apiClient.ts', imports);
    await online.apiFetchCollectionPage(endpoint);
    await online.apiFetchCollectionPage(endpoint);
    assert.equal(calls, 1, 'normal screen revisits reuse memory');
    connection.updateConnectionStatus(false, false);
    const restarted = load('utils/apiClient.ts', imports);
    const cached = await restarted.apiFetchCollectionPage(endpoint, { cache: 'reload' });
    assert.deepEqual(cached.items, [{ id: 'dress' }]);
    assert.equal(cached.nextPage, 2);
    assert.equal(calls, 1, 'even explicit refresh must reuse offline cache');
    await assert.rejects(restarted.apiFetch('/api/orders/catalog-checkout', { method: 'POST' }), e => e.details.code === 'NETWORK_DISCONNECTED');
    session = { ...session, token: 'customer-b', email: 'b@example.invalid' };
    await assert.rejects(restarted.apiFetch(endpoint), e => e.details.code === 'NETWORK_DISCONNECTED');
    assert.equal(calls, 1);
    session = { ...session, token: 'customer-a', email: 'a@example.invalid' };
    connection.updateConnectionStatus(true, true);
    global.fetch = async () => { calls++; return new Response(JSON.stringify({ error: 'Expired session' }), { status: 401 }); };
    await assert.rejects(restarted.apiFetch(endpoint, { cache: 'reload', silent: true }), e => e.details.status === 401);
  } finally { global.fetch = originalFetch; connection.updateConnectionStatus(true, true); }
});

test('dashboard leaves offline notices to the single global popup and does not force reads', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../app/(customer)/(tabs)/browse.tsx'), 'utf8');
  for (const state of ['notificationsError', 'housesError', 'error']) assert.ok(source.includes(`!offline && ${state}`));
  assert.doesNotMatch(source, /cache: "reload"/);
  assert.match(source, /getConnectionStatus\(\) !== "offline"\) invalidateReadCache/);
});
