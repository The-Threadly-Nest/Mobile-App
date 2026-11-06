const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../lib/submission-lock.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { createSubmissionLock } = compiled.exports;

test('rapid clicks and two copies of the landing form share one pending submission', () => {
  const lock = createSubmissionLock();
  assert.equal(lock.start(), true);
  for (let click = 0; click < 10; click++) assert.equal(lock.start(), false);
});
test('a failed request or invalid city allows a corrected retry', () => {
  const lock = createSubmissionLock();
  lock.start(); lock.retry();
  assert.equal(lock.start(), true);
});
test('a successful signup cannot be submitted again when the popup reopens', () => {
  const lock = createSubmissionLock();
  lock.start(); lock.complete(); lock.retry();
  assert.equal(lock.start(), false);
});
