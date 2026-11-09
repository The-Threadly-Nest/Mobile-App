const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

test('post-login spinner awaits shared preload and ignores navigation after unmount', () => {
  const root = path.resolve(__dirname, '..');
  const loading = fs.readFileSync(path.join(root, 'app/(auth)/loading.tsx'), 'utf8');
  assert.match(loading, /await preloadStartupData\(\);/);
  assert.match(loading, /if \(!active \|\| useAuthStore\.getState\(\)\.token !== token\) return/);
  assert.ok(loading.indexOf('await preloadStartupData()') < loading.indexOf('router.replace("/(admin)/dashboard"'));
  assert.match(loading, /outerLoop\.stop\(\); innerLoop\.stop\(\)/);
  const personalize = fs.readFileSync(path.join(root, 'app/(auth)/personalize.tsx'), 'utf8');
  assert.doesNotMatch(personalize, /router\.replace\("\/\(customer\)\/browse"\)/);
  assert.match(personalize, /router\.replace\("\/\(auth\)\/loading"\)/);
});

test('saved sessions enter through gear loading; explicit logout returns to video welcome', () => {
  const root = path.resolve(__dirname, '..');
  const index = fs.readFileSync(path.join(root, 'app/index.tsx'), 'utf8');
  assert.match(index, /if \(token && role\) return <Redirect href="\/\(auth\)\/loading"/);
  assert.doesNotMatch(index, /router\.replace\("\/\((?:admin|staff|customer)\)\/(?:dashboard|browse)"/);
  for (const file of ['app/(customer)/(tabs)/profile.tsx', 'app/(admin)/settings.tsx', 'app/(staff)/profile.tsx']) {
    assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /logout\(\);\s*router\.replace\("\/"\)/);
  }
});

test('page data is reused, concurrent reads collapse, pagination survives and mutations invalidate it', async t => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  let token = 'account-a', calls = 0;
  const filename = path.resolve(__dirname, '../src/shared/utils/apiClient.ts');
  const mod = new Module(filename, module);
  const imports = {
    '@/stores/useAuthStore': { useAuthStore: { getState: () => ({ token, logout: () => {} }) } },
    '@/api/config': { API_BASE_URL: 'https://example.invalid' },
    '@/shared/utils/alertEmitter': { alertEmitter: { emit: () => {} } },
    '../services/connectionStatus': { getConnectionStatus: () => 'online', refreshConnectionStatus: () => {}, OFFLINE_MESSAGE: 'Offline' },
  };
  mod.require = id => imports[id];
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  global.fetch = async () => {
    calls++;
    return new Response(JSON.stringify([{ id: token }]), { status: 200, headers: { 'X-Page': '1', 'X-Has-More': 'true', 'X-Next-Page': '2' } });
  };
  const api = mod.exports;
  await Promise.all([api.apiFetch('/api/orders'), api.apiFetch('/api/orders')]);
  assert.equal(calls, 1);
  await api.apiFetch('/api/orders');
  assert.equal(calls, 1, 'switching screens must reuse loaded data');
  const page = await api.apiFetchCollectionPage('/api/orders');
  assert.equal(page.nextPage, 2);
  assert.equal(page.hasMore, true);
  assert.equal(calls, 1);
  await api.apiFetch('/api/orders/one/status', { method: 'PATCH', body: '{}' });
  await api.apiFetch('/api/orders');
  assert.equal(calls, 3);
  await api.apiFetch('/api/orders', { cache: 'reload' });
  assert.equal(calls, 4);
  token = 'account-b';
  assert.equal(api.getCachedResponse('/api/orders'), undefined, 'another account must never see cached account-a data');
  assert.deepEqual(await api.apiFetch('/api/orders'), [{ id: 'account-b' }]);
  await api.apiFetch('/api/chat/session/house');
  await api.apiFetch('/api/chat/session/house');
  await api.apiFetch('/api/catalog/item/house/slots');
  await api.apiFetch('/api/catalog/item/house/slots');
  assert.equal(calls, 9, 'chat and availability must always hit the server');
});
