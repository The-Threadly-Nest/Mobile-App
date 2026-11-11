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

test('garment picker loads the house custom catalog and replaces the single garment selection', async () => {
  const state = [], refs = [], effects = [], requests = [], confirmed = [];
  let cursor = 0, refCursor = 0;
  const Picker = load('src/shared/components/BookingGarmentPicker.tsx', {
    react: {
      useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
      useRef: initial => { const i = refCursor++; return refs[i] ||= { current: initial }; },
      useEffect: fn => effects.push(fn),
    },
    'react/jsx-runtime': jsx,
    'react-native': { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', View: 'View', StyleSheet: { create: x => x } },
    'lucide-react-native': { Check: 'Check' }, './Typography': { Text: 'Text' }, './CachedImage': 'Image',
    '../utils/apiClient': { apiFetchCollectionPage: async url => { requests.push(url); return { items: ['Dress', 'Suit', 'Kaftan'].map((name, i) => ({ id: String(i), name, fulfillmentType: 'custom_fit' })), nextPage: null }; } },
    '../utils/formatters': { formatCurrency: String },
  });
  const props = { fashionHouseId: 'house', disabled: false, onConfirm: items => confirmed.push(items) };
  const render = () => { cursor = 0; refCursor = 0; return Picker(props); };
  let tree = render(); effects[0](); await new Promise(resolve => setImmediate(resolve));
  assert.match(requests[0], /fashion-house\/house\?page=1&limit=50&fulfillmentType=custom_fit/);
  const item = (tree, name) => find(tree, node => node.type === 'Pressable' && node.props.accessibilityRole === 'radio' && find(node, n => n.type === 'Text' && n.props.children === name));
  tree = render(); item(tree, 'Dress').props.onPress();
  tree = render(); item(tree, 'Suit').props.onPress();
  tree = render(); assert.equal(item(tree, 'Dress').props.accessibilityState.selected, false);
  assert.equal(item(tree, 'Suit').props.accessibilityState.selected, true);
  assert.equal(item(tree, 'Kaftan').props.disabled, false);
  find(tree, node => node.type === 'Pressable' && node.props.children?.props?.children === 'Choose a date').props.onPress();
  assert.deepEqual(confirmed[0].map(item => item.name), ['Suit']);
  assert.equal(find(tree, node => node.type === 'Pressable' && node.props.children?.props?.children === 'Choose a date').props.style[0].backgroundColor, '#453332');
  item(tree, 'Dress').props.onPress(); tree = render();
  assert.equal(item(tree, 'Dress').props.accessibilityState.selected, true);
  assert.equal(item(tree, 'Suit').props.accessibilityState.selected, false);
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
  assert.match(chat, /garments\?\.length \? garments.map\(item => item.id\)/);
});
