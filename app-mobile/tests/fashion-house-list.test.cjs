const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
test('fashion houses animate using the real row without duplicating records', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../app/(customer)/(tabs)/browse.tsx'), 'utf8');
  assert.match(source, /\{fashionHouses\.map\(\(house\) =>/);
  assert.match(source, /key=\{house\.id\}/);
  assert.doesNotMatch(source, /\.\.\.fashionHouses/);
  assert.match(source, /motion\.content - motion\.viewport/);
  assert.match(source, /motion\.direction = -1/);
  assert.match(source, /motion\.direction = 1/);
  assert.match(source, /new Map\(res\.items\.map\(house => \[house\.id, house\]\)\)/);
});
