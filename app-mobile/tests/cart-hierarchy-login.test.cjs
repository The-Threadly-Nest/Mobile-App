const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(relative, imports = {}) {
  const filename = path.join(root, relative), mod = new Module(filename, module);
  mod.require = name => imports[name];
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports;
}

test('floating cart reflects quantities, opens cart, uses mocha badge and hides in checkout/chat/keyboard', () => {
  let items = [{ quantity: 2 }, { quantity: 1 }], segments = ['(customer)', '(tabs)', 'browse'], keyboard = false;
  const pushed = [], listeners = {};
  const component = load('src/shared/components/FloatingCart.tsx', {
    react: { useState: () => [keyboard, value => { keyboard = value; }], useEffect: fn => fn(), useSyncExternalStore: (_, get) => get() },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { Keyboard: { addListener: (event, fn) => { listeners[event] = fn; return { remove() {} }; } }, Pressable: 'Pressable', View: 'View', StyleSheet: { create: x => x } },
    'expo-router': { router: { push: url => pushed.push(url) }, useSegments: () => segments },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 20 }) },
    'lucide-react-native': { ShoppingCart: 'ShoppingCart' },
    '@/stores/useCartStore': { useCartStore: select => select({ items }) },
    './Typography': { Text: 'Text' },
    '../services/connectionStatus': { subscribeConnectionStatus() {}, getConnectionStatus: () => 'online' },
  }).default;
  const tree = component();
  assert.match(tree.props.accessibilityLabel, /3 items/);
  assert.equal(tree.props.children[1].props.style.backgroundColor, '#453332');
  tree.props.onPress(); assert.deepEqual(pushed, ['/(customer)/cart']);
  for (const route of ['cart', 'chat', 'direct-chat', 'confirmation']) { segments = ['(customer)', route]; assert.equal(component(), null); }
  segments = ['(customer)', '(tabs)', 'browse']; listeners.keyboardDidShow(); assert.equal(component(), null);
  keyboard = false; items = []; assert.equal(component(), null);
});

test('hierarchy tokens use one font family and never set text colors', () => {
  const { typeScale } = load('src/shared/utils/typeScale.ts');
  for (const style of Object.values(typeScale)) {
    assert.ok(style.fontFamily.startsWith('InstrumentSans-'));
    assert.equal('color' in style, false);
    assert.ok(style.lineHeight > style.fontSize);
  }
  assert.equal(typeScale.pageTitle.fontSize, 24);
  assert.ok(typeScale.productPrice.fontSize > typeScale.productName.fontSize);
});

test('welcome cannot redirect from behind login and auth handoff has no sliding transitions', () => {
  const index = fs.readFileSync(path.join(root, 'app/index.tsx'), 'utf8');
  assert.doesNotMatch(index, /@react-navigation\/native/);
  assert.match(index, /usePathname\(\) === "\/"/);
  assert.ok(index.indexOf('if (!ready || !focused) return null') < index.indexOf('if (token && role) return <Redirect'));
  const auth = fs.readFileSync(path.join(root, 'app/(auth)/_layout.tsx'), 'utf8');
  assert.match(auth, /animation: "none"/);
});

test('ready-to-wear tracking skips fitting stages and treats collection as a separate final step', () => {
  const { READY_CUSTOMER_STAGES, readyCustomerStage, isReadyToWear } = load('src/shared/utils/orderFulfillment.ts');
  assert.deepEqual(READY_CUSTOMER_STAGES.map(s => s.key), ['order_placed', 'in_production', 'ready_for_pickup', 'completed']);
  assert.equal(readyCustomerStage('in_production'), 1);
  assert.equal(readyCustomerStage('ready_for_pickup'), 2);
  assert.equal(readyCustomerStage('completed'), 3);
  assert.equal(isReadyToWear({ items: [{ selectedSize: 'M' }] }), true);
  assert.equal(isReadyToWear({ fulfillmentType: 'custom_fit' }), false);
});
