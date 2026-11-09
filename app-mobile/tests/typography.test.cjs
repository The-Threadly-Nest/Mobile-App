const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

test('shared typography defaults labels and inputs to Instrument Sans and forwards refs', () => {
  const filename = path.join(root, 'src/shared/components/Typography.tsx');
  const mod = new Module(filename, module);
  const react = { forwardRef: render => render, createElement: (type, props) => ({ type, props }) };
  mod.require = id => id === 'react' ? react : id === 'nativewind' ? { cssInterop: () => {} } : {
    Text: 'native-text', TextInput: 'native-input',
    StyleSheet: { flatten: style => style || {} },
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, filename);
  for (const Component of [mod.exports.Text, mod.exports.TextInput]) {
    for (const [weight, family] of [[undefined, 'Regular'], ['500', 'Medium'], ['600', 'SemiBold'], ['bold', 'Bold']]) {
      const ref = {};
      const element = Component({ style: { fontWeight: weight }, accessibilityLabel: 'Label' }, ref);
      assert.equal(element.props.style[0].fontFamily, `InstrumentSans-${family}`);
      assert.equal(element.props.ref, ref);
      assert.equal(element.props.accessibilityLabel, 'Label');
    }
  }
});

test('display utilities and loaded app fonts all use Instrument Sans', () => {
  const families = require('../tailwind.config.js').theme.extend.fontFamily;
  for (const names of Object.values(families)) assert.ok(names.every(name => name.startsWith('InstrumentSans-')));
  const layout = fs.readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8');
  assert.doesNotMatch(layout, /Hedvig|WorkSans/);
  for (const name of ['Regular', 'Medium', 'SemiBold', 'Bold']) assert.ok(layout.includes(`InstrumentSans-${name}`));
});
