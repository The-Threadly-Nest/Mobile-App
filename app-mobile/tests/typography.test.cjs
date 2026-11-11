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
    const explicitStyle = { color: '#FFFFFF' };
    assert.equal(Component({ style: explicitStyle }, {}).props.style[1], explicitStyle);
    for (const [weight, family] of [[undefined, 'Regular'], ['500', 'Medium'], ['600', 'SemiBold'], ['bold', 'Bold']]) {
      const ref = {};
      const element = Component({ style: { fontWeight: weight }, accessibilityLabel: 'Label' }, ref);
      assert.equal(element.props.style[0].fontFamily, `InstrumentSans-${family}`);
      assert.equal(element.props.style[0].color, '#4A403B');
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

test('customer orders use gentler title and item weights while keeping current tracking stage distinct', () => {
  const orders = fs.readFileSync(path.join(root, 'app/(customer)/(tabs)/orders.tsx'), 'utf8');
  const tracking = fs.readFileSync(path.join(root, 'app/(customer)/orders/[orderId].tsx'), 'utf8');
  assert.match(orders, /typeScale.pageTitle, fontFamily: "InstrumentSans-Medium", color: "#4A403B"/);
  assert.match(orders, /font-body-medium text-\[15px\] text-black/);
  assert.doesNotMatch(orders, /font-body-bold/);
  assert.match(orders, /borderRadius: 20,\s*padding: 12,\s*transform:/);
  assert.match(tracking, /garmentTitleText: \{ fontFamily: "InstrumentSans-Medium"/);
  assert.match(tracking, /stepLabelCurrent: \{ color: "#4A403B", fontFamily: "InstrumentSans-SemiBold"/);
});

test('video welcome text stays white over the video and tomato button', () => {
  const source = fs.readFileSync(path.join(root, 'app/index.tsx'), 'utf8');
  for (const name of ['brandTagline', 'getStartedText', 'loginText', 'loginBold', 'loadingName']) {
    assert.match(source, new RegExp(`${name}: \\{[^}]*color: "#FFFFFF"`));
  }
});

test('signup field labels blend into the cream page rather than showing white patches', () => {
  const source = fs.readFileSync(path.join(root, 'app/(auth)/signup.tsx'), 'utf8');
  assert.match(source, /labelWrapper:\s*\{[^}]*backgroundColor: "#F9E8D3"/);
  assert.match(source, /safeArea:\s*\{[^}]*backgroundColor: "#F9E8D3"/);
});
