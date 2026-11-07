const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

class ApiError extends Error {
  constructor(status) { super('Request failed'); this.details = { status }; }
}
function fixture(initial = { savedCatalogIds: ['a'], savedItems: [{ id: 'a', name: 'A' }] }) {
  let state = initial;
  let failure;
  const writes = [];
  const filename = path.resolve(__dirname, '../src/shared/utils/catalogFavorites.ts');
  const compiled = new Module(filename, module);
  compiled.require = (id) => {
    assert.equal(id, './apiClient');
    return { ApiError, apiFetch: async (endpoint, options) => {
      assert.equal(endpoint, '/api/preferences');
      if (failure) throw failure;
      if (options.method === 'POST') {
        const body = JSON.parse(options.body); writes.push(body);
        state = { savedCatalogIds: body.savedCatalogIds, savedItems: body.savedCatalogIds.map(id => ({ id, name: id })) };
      }
      return state;
    } };
  };
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, filename);
  return { ...compiled.exports, writes, fail: error => { failure = error; }, replace: value => { state = value; } };
}

test('favorites loads actual saved records', async () => {
  const f = fixture();
  assert.equal((await f.loadCatalogFavorites()).savedItems[0].id, 'a');
});
test('saving and removing preserves other current server favorites', async () => {
  const f = fixture();
  await f.saveCatalogFavorite('b', true);
  assert.deepEqual(f.writes[0], { savedCatalogIds: ['a', 'b'] });
  await f.saveCatalogFavorite('b', true);
  assert.deepEqual(f.writes[1], { savedCatalogIds: ['a', 'b'] });
  f.replace({ savedCatalogIds: ['a', 'b', 'new-from-other-screen'], savedItems: [] });
  await f.saveCatalogFavorite('a', false);
  assert.deepEqual(f.writes[2], { savedCatalogIds: ['b', 'new-from-other-screen'] });
});
test('only missing preferences are treated as an empty list', async () => {
  const f = fixture(); f.fail(new ApiError(404));
  assert.deepEqual(await f.loadCatalogFavorites(), { savedCatalogIds: [], savedItems: [] });
  for (const status of [401, 403, 500]) {
    f.fail(new ApiError(status));
    await assert.rejects(f.saveCatalogFavorite('b', true));
  }
  assert.equal(f.writes.length, 0);
});
test('network and incompatible backend responses are not mistaken for empty favorites', async () => {
  const f = fixture({});
  await assert.rejects(f.saveCatalogFavorite('b', true), /saved items/);
  f.fail(new Error('Network unavailable'));
  await assert.rejects(f.loadCatalogFavorites(), /Network unavailable/);
  assert.equal(f.writes.length, 0);
});
