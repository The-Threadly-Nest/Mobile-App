const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { createHmac } = require('node:crypto');
const { NextRequest } = require('next/server');

// Compile in memory: no running backend, database, provider or email traffic.
const filename = path.resolve(__dirname, '../app/api/[...path]/route.ts');
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, filename);
const proxy = compiled.exports.POST;

test('Railway web proxy protections', async (t) => {
  const names = ['NODE_ENV', 'API_BASE_URL', 'WEB_PROXY_SECRET', 'TRUST_RAILWAY_PROXY', 'RAILWAY_ENVIRONMENT_ID'];
  const previous = Object.fromEntries(names.map(key => [key, process.env[key]]));
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    for (const key of names) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  });
  Object.assign(process.env, {
    NODE_ENV: 'production', API_BASE_URL: 'http://fixture.internal:4000', WEB_PROXY_SECRET: 'a'.repeat(64),
    TRUST_RAILWAY_PROXY: 'true', RAILWAY_ENVIRONMENT_ID: 'fixture-only'
  });
  let calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ error: 'Please wait.' }), { status: 429, headers: { 'Retry-After': '60', 'RateLimit-Limit': '10' } });
  };
  const request = (body = '{}', extraHeaders = {}, route = 'waitlist') => new NextRequest('https://example.invalid/api/' + route, {
    method: 'POST', body, headers: { 'Content-Type': 'application/json', 'X-Real-IP': '192.0.2.1', ...extraHeaders }
  });
  const send = (req, route = ['waitlist']) => proxy(req, { params: Promise.resolve({ path: route }) });

  await t.test('forwards retry headers and authenticated visitor identity, not spoofed identity', async () => {
    const response = await send(request('{}', { 'X-Forwarded-For': '203.0.113.99', 'X-Owuja-Client-IP': '203.0.113.99' }));
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '60');
    assert.equal(response.headers.get('ratelimit-limit'), '10');
    const headers = calls.at(-1).options.headers;
    assert.equal(headers.get('x-owuja-client-ip'), '192.0.2.1');
    assert.equal(headers.get('x-forwarded-for'), null);
    const timestamp = headers.get('x-owuja-proxy-time');
    assert.equal(headers.get('x-owuja-proxy-signature'), createHmac('sha256', process.env.WEB_PROXY_SECRET)
      .update(`${timestamp}\nPOST\n/api/waitlist\n192.0.2.1`).digest('hex'));
  });
  await t.test('separate visitors receive separately signed IP identities', async () => {
    await send(request('{}', { 'X-Real-IP': '192.0.2.2' }));
    assert.equal(calls.at(-1).options.headers.get('x-owuja-client-ip'), '192.0.2.2');
  });
  await t.test('rejects oversized bodies with and without content length before upstream fetch', async () => {
    for (const headers of [{}, { 'Content-Length': '20000' }]) {
      const count = calls.length;
      assert.equal((await send(request('x'.repeat(20000), headers))).status, 413);
      assert.equal(calls.length, count);
    }
  });
  await t.test('enforces cumulative size on a multi-chunk stream', async () => {
    const count = calls.length;
    const body = new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(10000));
      controller.enqueue(new Uint8Array(10000));
      controller.close();
    } });
    const req = new NextRequest('https://example.invalid/api/waitlist', {
      method: 'POST', body, duplex: 'half', headers: { 'X-Real-IP': '192.0.2.1' }
    });
    assert.equal((await send(req)).status, 413);
    assert.equal(calls.length, count);
  });
  await t.test('blocks unlisted API routes', async () => {
    assert.equal((await send(request('{}', {}, 'orders'), ['orders'])).status, 404);
  });
  await t.test('fails closed when Railway client identity or shared secret is missing', async () => {
    assert.equal((await send(request('{}', { 'X-Real-IP': '' }))).status, 503);
    const secret = process.env.WEB_PROXY_SECRET;
    delete process.env.WEB_PROXY_SECRET;
    assert.equal((await send(request())).status, 503);
    process.env.WEB_PROXY_SECRET = secret;
  });
  await t.test('masks upstream infrastructure details', async () => {
    global.fetch = async () => new Response('private database stack trace', { status: 500 });
    const response = await send(request());
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /database|stack trace/);
  });
});
