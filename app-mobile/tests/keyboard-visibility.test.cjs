const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/utils/keyboardVisibility.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { keyboardScrollAdjustment: adjust } = compiled.exports;

test('scrolls a covered input above the keyboard with a visible gap', () => {
  assert.equal(adjust(580, 56, 40, 760, 500, 24), 160);
});
test('does not move an input that is already fully visible', () => {
  assert.equal(adjust(200, 56, 40, 760, 500, 24), 0);
});
test('uses a smaller popup viewport rather than the entire screen', () => {
  assert.equal(adjust(480, 56, 180, 320, 600, 24), 60);
});
test('handles resized Android windows and space for the pinned save button', () => {
  assert.equal(adjust(370, 46, 40, 400, 500, 24), 0);
  assert.equal(adjust(370, 46, 40, 400, 500, 110), 86);
});
test('can reveal an input above the scrolled viewport', () => {
  assert.equal(adjust(20, 50, 80, 400, 500, 24), -84);
});
test('signup keeps its original spacing and all primary forms use keyboard-aware scrolling', () => {
  const root = path.resolve(__dirname, '../app');
  for (const file of ['(auth)/signup.tsx', '(auth)/login.tsx', '(auth)/forgot-password.tsx', '(auth)/reset-password.tsx', '(admin)/onboarding.tsx', '(admin)/profile-edit.tsx', '(customer)/(tabs)/profile.tsx']) {
    assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /<KeyboardAwareScrollView/, file);
  }
  assert.match(fs.readFileSync(path.join(root, '(auth)/signup.tsx'), 'utf8'), /paddingTop: 60/);
});
