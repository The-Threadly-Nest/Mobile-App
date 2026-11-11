const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/utils/phoneCountries.ts');
const mod = new Module(filename, module);
mod.filename = filename;
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
const { COUNTRIES, DEFAULT_COUNTRY, nationalPhoneDigits, resolvePhoneCountry, searchCountries } = mod.exports;
test('phone picker includes all supported countries and territories with searchable calling codes', () => {
  const { getCountries } = require('libphonenumber-js');
  assert.equal(COUNTRIES.length, getCountries().length);
  assert.ok(COUNTRIES.length >= 240);
  assert.equal(new Set(COUNTRIES.map(c => c.isoCode)).size, COUNTRIES.length);
  for (const country of COUNTRIES) { assert.match(country.code, /^\+\d+$/); assert.ok(country.name.length > 2); }
  assert.ok(searchCountries('Brazil').some(c => c.isoCode === 'BR'));
  assert.ok(searchCountries('+81').some(c => c.isoCode === 'JP'));
  assert.ok(searchCountries('CA').some(c => c.isoCode === 'CA'));
  assert.equal(DEFAULT_COUNTRY.isoCode, 'NG');
});
test('phone parsing preserves explicit shared-code countries and significant national zeros', () => {
  const canada = COUNTRIES.find(c => c.isoCode === 'CA');
  const italy = COUNTRIES.find(c => c.isoCode === 'IT');
  assert.equal(resolvePhoneCountry('+1 4165551234').country.isoCode, 'CA');
  assert.equal(resolvePhoneCountry('+1 204', canada).country.isoCode, 'CA');
  assert.equal(resolvePhoneCountry('+12423270143').country.isoCode, 'BS');
  assert.equal(resolvePhoneCountry('+44 20 7946 0958').country.isoCode, 'GB');
  assert.equal(nationalPhoneDigits('08012345678', DEFAULT_COUNTRY), '8012345678');
  assert.equal(nationalPhoneDigits('0212345678', italy), '0212345678');
});
test('customer chat button carries the linked identity and can reopen a new first conversation', () => {
  const customers = fs.readFileSync(path.resolve(__dirname, '../app/(admin)/customers/index.tsx'), 'utf8');
  const messages = fs.readFileSync(path.resolve(__dirname, '../app/(admin)/messages.tsx'), 'utf8');
  assert.match(customers, /selectedCustomer\?\.userId \|\| selectedCustomer\?\.id/);
  assert.match(customers, /openChat: String\(Date.now\(\)\)/);
  assert.doesNotMatch(messages, /initialOpenedRef/);
  assert.match(messages, /void openThread\(\{ customerId: params.customerId/);
  assert.match(messages, /params.openChat/);
});
