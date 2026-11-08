const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../app/(customer)/fashion-house/[fashionHouseId].tsx'), 'utf8');
test('fashion-house appointment button opens the selected house booking assistant', () => {
  assert.match(source, />Book an appointment</);
  assert.match(source, /pathname: "\/\(customer\)\/chat\/\[fashionHouseId\]"/);
  assert.match(source, /fashionHouseId: targetId, fashionHouseName: displayName/);
  assert.doesNotMatch(source, />Browse styles</);
});
test('fashion-house display text uses black and primary button stays readable', () => {
  for (const name of ['displayName', 'statValue', 'statLabel', 'sectionTitle', 'aboutText', 'catalogTitle', 'catalogPrice', 'reviewName', 'reviewText']) {
    const block = source.match(new RegExp('  ' + name + ': \\{([\\s\\S]*?)\\n  \\},'));
    assert.ok(block, name);
    assert.match(block[1], /color: "#000000"/, name);
  }
  assert.match(source, /bookingBtnText: \{[\s\S]*?color: "#000000"/);
  assert.match(source, /bookingBtn: \{[\s\S]*?backgroundColor: "#F96951"/);
});
