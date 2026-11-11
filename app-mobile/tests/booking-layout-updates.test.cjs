const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function load(file, imports) {
  const filename = path.join(root, file), mod = new Module(filename, module);
  mod.require = name => imports[name];
  mod._compile(ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  return mod.exports.default;
}
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const find = (tree, predicate) => {
  if (!tree || typeof tree !== 'object') return null;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
  return null;
};

test('house picker uses only admin specializations and allows one selection', () => {
  let selected = null;
  const Picker = load('src/shared/components/BookingSpecializationPicker.tsx', {
    react: { useState: () => [selected, value => { selected = value; }], useEffect() {} },
    'react/jsx-runtime': jsx,
    'react-native': { Pressable: 'Pressable', View: 'View', StyleSheet: { create: x => x } },
    'lucide-react-native': { Check: 'Check' }, './Typography': { Text: 'Text' },
  });
  const confirmed = [];
  const props = { categories: ['Bespoke Suits', 'Agbada & Native'], disabled: false, onConfirm: value => confirmed.push(value) };
  const item = (tree, name) => find(tree, node => node.type === 'Pressable' && node.props.accessibilityRole === 'radio' && find(node, n => n.type === 'Text' && n.props.children === name));
  let tree = Picker(props);
  assert.equal(item(tree, 'Evening dress'), null);
  item(tree, 'Bespoke Suits').props.onPress();
  tree = Picker(props); item(tree, 'Agbada & Native').props.onPress();
  tree = Picker(props);
  assert.equal(item(tree, 'Bespoke Suits').props.accessibilityState.selected, false);
  assert.equal(item(tree, 'Agbada & Native').props.accessibilityState.selected, true);
  const button = find(tree, node => node.type === 'Pressable' && node.props.children?.props?.children === 'Choose a date');
  assert.equal(button.props.style[0].backgroundColor, '#453332');
  button.props.onPress();
  assert.deepEqual(confirmed, ['Agbada & Native']);
});

test('chat uses upright, top-aligned content and does not jump while reading older messages', () => {
  const Chat = load('src/shared/components/BottomAnchoredChatScrollView.tsx', {
    react: { useRef: value => ({ current: value }) }, 'react/jsx-runtime': jsx,
    'react-native': { ScrollView: 'ScrollView', StyleSheet: { create: x => x } },
  });
  const tree = Chat({ children: 'Hello', contentContainerStyle: { paddingTop: 8 } });
  assert.equal(tree.props.contentContainerStyle.at(-1).justifyContent, 'flex-start');
  assert.equal(tree.props.style, undefined);
  let scrolled = 0; tree.props.ref.current = { scrollToEnd: () => scrolled++ };
  tree.props.onContentSizeChange(300, 150); assert.equal(scrolled, 1);
  tree.props.onScroll({ nativeEvent: { contentOffset: { y: 0 }, contentSize: { height: 1500 }, layoutMeasurement: { height: 600 } } });
  tree.props.onContentSizeChange(300, 1600); assert.equal(scrolled, 1);
});

test('purchase actions are inside the scroll view, immediately after colour options', () => {
  const source = read('app/(customer)/catalog/[id].tsx');
  const ast = ts.createSourceFile('catalog.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let checked = 0;
  function visit(node) {
    if (ts.isJsxText(node) && ['Add to cart', 'Buy now'].includes(node.text.trim())) {
      let parent = node.parent, inScroll = false;
      while (parent) { if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText(ast) === 'ScrollView') inScroll = true; parent = parent.parent; }
      assert.equal(inScroll, true); checked++;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.equal(checked, 2);
  const actions = source.slice(source.indexOf('  bottomBar:'));
  assert.match(actions.slice(0, actions.indexOf('},')), /marginTop: 12/);
  assert.doesNotMatch(actions.slice(0, actions.indexOf('},')), /position: "absolute"/);
  assert.match(source, /colors.length > 0 && <View style=\{\[styles.sectionBlock, \{ marginBottom: 0 \}\]\}/);
});

test('decorative dividers are hidden while borders, speech tails and tracking connectors remain', () => {
  assert.match(read('app/(customer)/messages/index.tsx'), /separator: \{ display: "none"/);
  assert.match(read('app/(auth)/login.tsx'), /dividerLine: \{ display: "none"/);
  assert.match(read('app/(customer)/orders/[orderId].tsx'), /connector:/);
  assert.match(read('app/(customer)/direct-chat/[fashionHouseId].tsx'), /borderTopWidth: 9/);
  assert.match(read('src/shared/components/FloatingCart.tsx'), /<ShoppingCart size=\{21\} color="#453332"/);
});

test('house and garment appointment entry points retain distinct flows', () => {
  const house = read('app/(customer)/fashion-house/[fashionHouseId].tsx');
  const product = read('app/(customer)/catalog/[id].tsx');
  const chat = read('app/(customer)/chat/[fashionHouseId].tsx');
  assert.match(house, /fashionHouseName: displayName, startNew: String\(Date.now\(\)\)/);
  assert.match(product, /catalogItemId: garmentData.id/);
  assert.match(chat, /!garmentName && startNew && !humanHandoffActive/);
  assert.match(chat, /garmentPicker: true/);
  assert.match(chat, /BookingSpecializationPicker categories=\{houseCategories\}/);
  assert.match(chat, /specialization: specialization \|\| selectedSpecialization/);
});
