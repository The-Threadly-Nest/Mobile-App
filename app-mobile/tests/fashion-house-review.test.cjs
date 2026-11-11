const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('setup uses four segments, a blank custom field, and no decorative selection checkmarks', () => {
  const source = read('app/(admin)/onboarding.tsx');
  assert.ok(source.includes('[1, 2, 3, 4].map'));
  assert.ok(!source.includes('"Other"'));
  assert.ok(!source.includes('e.g. Leatherwork'));
  assert.ok(!source.includes('801 234 5678'));
  assert.doesNotMatch(source, /selected && <Check/);
  assert.match(source, /minHeight: 52/);
});

test('custom specializations become selected chips and are included in the saved categories', () => {
  const source = read('app/(admin)/onboarding.tsx');
  assert.match(source, /accessibilityLabel="Custom specialization"/);
  assert.match(source, /placeholder="Ankara suit"/);
  assert.match(source, /selected \? styles.pillSelected : styles.pillUnselected/);
  assert.match(source, /onPress=\{addCustomCategory\}/);
  assert.match(source, /setSelectedCategories\(values => \[\.\.\.values, preset \|\| category\]\)/);
  assert.match(source, /SPECIALIZATION_CATEGORIES, \.\.\.selectedCategories/);
  assert.match(source, /categories: selectedCategories/);
  assert.match(source, /category\.length > 100/);
  assert.match(source, /value\.toLowerCase\(\) === category\.toLowerCase\(\)/);
  assert.match(source, /accessibilityLabel="Add category"/);
  assert.match(source, /<Plus size=\{22\} color="#453332"/);
  assert.doesNotMatch(source, />Add category<\/Text>/);
  assert.match(source, /pill:\s*\{[^}]*flexGrow: 0/);
  assert.match(source, /pill:\s*\{[^}]*borderRadius: 999/);
  assert.match(source, /step === 3 && \{ marginTop: 16 \}/);
});

test('item image crops are consistently portrait and selected sizes have no checkmark', () => {
  for (const file of ['new.tsx', '[id].tsx']) assert.ok(read(`app/(admin)/catalog/${file}`).includes('aspect: [3, 4]'));
  assert.doesNotMatch(read('src/shared/components/CatalogChoicePicker.tsx'), /<Check\b/);
  assert.match(read('src/shared/components/CatalogOfferingFields.tsx'), /choices=\{GARMENT_COLORS\} multiple allowCustom/);
});

test('fashion-house logo uploads use portrait crop during setup and profile updates', () => {
  for (const page of ['onboarding', 'profile-edit']) {
    const source = read(`app/(admin)/${page}.tsx`);
    assert.ok(source.includes('aspect: [3, 4]'));
    assert.ok(!source.includes('aspect: [1, 1]'));
  }
});

function customPicker(custom, selected = 'Black') {
  let cursor = 0;
  const states = [true, custom, ''];
  const changes = [];
  const errors = [];
  const react = {
    useState: () => { const i = cursor++; return [states[i], value => { if (i === 2) errors.push(value); }]; },
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  };
  const filename = path.join(root, 'src/shared/components/CatalogChoicePicker.tsx');
  const mod = new Module(filename, module);
  mod.require = id => id === 'react' ? react : id === 'react-native' ? {
    View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: 'Modal', KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'android' }, StyleSheet: { create: x => x },
  } : id.includes('Typography') ? { Text: 'Text', TextInput: 'TextInput' } : id.includes('catalogChoices') ? {
    selectedCatalogChoices: value => value.split(',').map(x => x.trim()).filter(Boolean),
    toggleCatalogChoice: () => {},
  } : id.includes('typeScale') ? { typeScale: { caption: {} } } : {};
  mod._compile(ts.transpileModule(read('src/shared/components/CatalogChoicePicker.tsx'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, filename);
  const tree = mod.exports.CatalogChoicePicker({ label: 'Colours', value: selected, choices: ['Black', 'Teal'], multiple: true, allowCustom: true, onChange: value => changes.push(value) });
  function find(node) {
    if (!node || typeof node !== 'object') return;
    if (node.props?.accessibilityLabel === 'Custom colour') return node;
    for (const child of [node.props?.children].flat(Infinity)) { const found = find(child); if (found) return found; }
  }
  find(tree).props.onSubmitEditing();
  return { changes, errors };
}

test('custom colours trim input, preserve selections and reuse matching preset names', () => {
  assert.deepEqual(customPicker('  teal ').changes, ['Black, Teal']);
  assert.deepEqual(customPicker('Peacock blue').changes, ['Black, Peacock blue']);
  assert.deepEqual(customPicker('black').changes, []);
});

test('custom colours reject empty, comma-separated and oversized input or more than 30 choices', () => {
  for (const value of ['', 'Blue, Green', 'x'.repeat(51)]) {
    const result = customPicker(value);
    assert.equal(result.changes.length, 0);
    assert.ok(result.errors[0]);
  }
  assert.equal(customPicker('Extra', Array.from({ length: 30 }, (_, i) => `Colour ${i}`).join(', ')).changes.length, 0);
});

test('requests start with all orders and filters can scroll instead of clipping', () => {
  const source = read('app/(admin)/escalations/index.tsx');
  assert.match(source, /useState<"all" \| "pending" \| "assigned" \| "declined">\("all"\)/);
  assert.match(source, /<ScrollView horizontal showsHorizontalScrollIndicator=\{false\}/);
  assert.match(source, /ListEmptyComponent=/);
});

test('staff headings, sketch surfaces and profile alignment match the review', () => {
  assert.match(read('app/(admin)/staff/invite.tsx'), /numberOfLines=\{1\} adjustsFontSizeToFit minimumFontScale=\{0.8\}/);
  assert.match(read('app/(admin)/moodboard.tsx'), /contentFit="contain"/);
  assert.match(read('app/(admin)/moodboard.tsx'), /sketchCard:\s*\{[^}]*backgroundColor: "#F9E8D3"/);
  assert.match(read('src/shared/components/FlowMessageCard.tsx'), /titleRow:\s*\{[^}]*flexWrap: "wrap"/);
  assert.match(read('app/(admin)/settings.tsx'), /balanceValue:\s*\{[^}]*fontSize: 26/);
  for (const file of ['new.tsx', '[id].tsx']) assert.ok(read(`app/(admin)/catalog/${file}`).includes('aspectRatio: 3 / 4'));
});
