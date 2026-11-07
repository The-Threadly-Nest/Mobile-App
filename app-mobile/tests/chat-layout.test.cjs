const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.resolve(__dirname, '../app', file), 'utf8');
test('message and chat headers share the standard top spacing', () => {
  for (const file of ['(customer)/messages/index.tsx', '(customer)/direct-chat/[fashionHouseId].tsx', '(admin)/messages.tsx', '(admin)/chat.tsx', '(staff)/chat.tsx']) {
    const source = read(file);
    assert.match(source, /import \{ SCREEN_TOP_SPACING \}/, file);
    const header = source.slice(source.indexOf(file.includes('messages/index') ? '  header:' : '  headerBar:'));
    assert.match(header.slice(0, header.indexOf('},') + 2), /paddingTop: SCREEN_TOP_SPACING/, file);
  }
});
test('customer conversation has no profile hero or fabricated review information', () => {
  const source = read('(customer)/direct-chat/[fashionHouseId].tsx');
  assert.doesNotMatch(source, /heroProfileCard|154 Reviews|3 Years Experience|>Online<|#22C55E/);
  assert.match(source, /\{displayName\}/);
  assert.match(source, /renderTranscriptSection\(\)/);
});
