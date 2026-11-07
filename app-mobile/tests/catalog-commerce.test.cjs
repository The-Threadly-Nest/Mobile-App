const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/utils/catalogCommerce.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { catalogOptions, catalogPrice, readyItemError } = compiled.exports;
test('catalog fields preserve real options and accept only safe whole-number prices', () => {
  assert.deepEqual(catalogOptions('M, L, M, , XL'), ['M', 'L', 'XL']);
  assert.equal(catalogPrice('₦15,000'), 15000);
  assert.equal(catalogPrice(''), null);
  for (const value of ['free', '-20', '1.5', '0', '2147483648']) assert.throws(() => catalogPrice(value));
});
test('custom clothes cannot enter cart; ready clothes require published options', () => {
  const item = { fulfillmentType: 'ready_to_wear', priceFrom: 15000, sizes: ['M'], colors: ['Black'] };
  assert.equal(readyItemError(item, 'M', 'Black'), null);
  assert.match(readyItemError(item, 'XL', 'Black'), /size/);
  assert.match(readyItemError(item, 'M', 'Blue'), /colour/);
  assert.match(readyItemError({ ...item, fulfillmentType: 'custom_fit' }, 'M', 'Black'), /measurement/);
  assert.match(readyItemError({ ...item, priceFrom: null }, 'M', 'Black'), /price/);
});
