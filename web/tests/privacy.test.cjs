const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const filename = path.resolve(__dirname, '../app/privacy/page.tsx');
const compiled = new Module(filename, module);
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText, filename);
const markup = renderToStaticMarkup(React.createElement(compiled.exports.default));

test('privacy page renders the owner, contact, scope and actual service providers', () => {
  assert.match(compiled.exports.metadata.title, /Privacy Policy/);
  for (const text of ['Owuja', 'support@owuja.com', 'www.owuja.com', 'unreleased mobile app', 'Railway', 'Resend', 'PostgreSQL']) assert.ok(markup.includes(text), text);
  assert.match(markup, /href="https:\/\/ndpc.gov.ng\/"/);
  assert.doesNotMatch(markup, /<script|iubenda/i);
});

test('privacy page explains actual local storage, retention and unsubscribe limits', () => {
  for (const text of ['owuja.waitlist.receipt.v1', 'no automatic expiry', 'no automatic deletion deadline', 'does not automatically delete', 'referral code', 'deletion']) assert.ok(markup.includes(text), text);
});

test('signup links to the policy and requires an affirmative email opt-in', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../app/page.tsx'), 'utf8');
  assert.match(source, /href="\/privacy"/);
  const checkbox = source.match(/<input\s+name="consent"[\s\S]*?\/>/);
  assert.ok(checkbox);
  assert.match(checkbox[0], /required/);
  assert.doesNotMatch(checkbox[0], /defaultChecked|checked=/);
});
