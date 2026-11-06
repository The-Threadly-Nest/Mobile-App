const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../lib/waitlist-receipt.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { parseWaitlistReceipt } = compiled.exports;

test('a completed signup can be restored after refresh with its real referral', () => {
  assert.deepEqual(parseWaitlistReceipt('{"version":1,"referralCode":"AB12CD34EF"}'), { version: 1, referralCode: 'AB12CD34EF' });
});
test('an already registered response persists without inventing a referral', () => {
  assert.deepEqual(parseWaitlistReceipt('{"version":1}'), { version: 1 });
});
test('invalid receipts are ignored and personal data is never restored', () => {
  for (const raw of [null, 'garbage', 'null', '{}', '{"version":2}', '{"version":1,"referralCode":"OWUJA"}', '{"version":1,"referralCode":42}']) assert.equal(parseWaitlistReceipt(raw), null);
  assert.deepEqual(parseWaitlistReceipt('{"version":1,"email":"private@example.invalid","unsubscribeToken":"private"}'), { version: 1 });
});
