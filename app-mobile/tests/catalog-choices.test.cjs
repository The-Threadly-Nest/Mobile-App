const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/utils/catalogChoices.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { GARMENT_CATEGORIES, GARMENT_SIZES, GARMENT_COLORS, selectedCatalogChoices, toggleCatalogChoice } = compiled.exports;
test('catalog choices are unique bounded values compatible with server validation', () => {
  for (const choices of [GARMENT_CATEGORIES, GARMENT_SIZES, GARMENT_COLORS]) {
    assert.equal(new Set(choices).size, choices.length);
    assert.ok(choices.every(value => value.length > 0 && value.length <= 50 && !value.includes(',')));
  }
  assert.ok(GARMENT_SIZES.includes('M'));
  assert.ok(GARMENT_SIZES.includes('12'));
  assert.ok(GARMENT_SIZES.includes('40'));
});
test('multi-select adds/removes options without duplication or discarding older values', () => {
  assert.equal(toggleCatalogChoice('', 'M'), 'M');
  assert.equal(toggleCatalogChoice('M, L', 'M'), 'L');
  assert.equal(toggleCatalogChoice('Old size, M', 'L'), 'Old size, M, L');
  assert.deepEqual(selectedCatalogChoices(' M, M, L, '), ['M', 'L']);
});
test('both catalog screens share selection controls rather than free-text option fields', () => {
  const component = fs.readFileSync(path.resolve(__dirname, '../src/shared/components/CatalogOfferingFields.tsx'), 'utf8');
  assert.equal(component.includes('TextInput'), false);
  assert.equal((component.match(/<CatalogChoicePicker/g) || []).length, 3);
  for (const screen of ['new.tsx', '[id].tsx']) assert.match(fs.readFileSync(path.resolve(__dirname, '../app/(admin)/catalog', screen), 'utf8'), /<CatalogOfferingFields/);
});
