const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/utils/messageThreads.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, filename);
const { unreadMessages, visibleMessageThreads } = compiled.exports;
const threads = [
  { fashionHouseId: 'first', unreadCount: 1 },
  { fashionHouseId: 'second', unreadCount: 2 },
  { fashionHouseId: 'read', unreadCount: 0 },
];

test('Messages badge counts actual unread messages and handles an empty inbox', () => {
  assert.equal(unreadMessages(threads), 3);
  assert.equal(unreadMessages([]), 0);
  assert.equal(unreadMessages([{ unreadCount: -2 }]), 0);
});
test('Messages shows every conversation; Notifications shows unread conversations only', () => {
  assert.deepEqual(visibleMessageThreads(threads, 'messages'), threads);
  assert.deepEqual(visibleMessageThreads(threads, 'notifications').map(thread => thread.fashionHouseId), ['first', 'second']);
  assert.deepEqual(visibleMessageThreads([{ fashionHouseId: 'read', unreadCount: 0 }], 'notifications'), []);
});
test('all Figma interface assets are local, nonempty and retain their natural geometry', () => {
  const screen = fs.readFileSync(path.resolve(__dirname, '../app/(customer)/messages/index.tsx'), 'utf8');
  const slots = [
    ['back.svg', 'back', 'backAsset'], ['unread.svg', 'badge', 'badgeAsset'],
    ['tab-line.svg', 'divider', 'tabDivider'], ['active-line.svg', 'active', 'activeLine'],
  ];
  for (const [file, slot, style] of slots) {
    const local = path.resolve(__dirname, '../assets/messages', file);
    assert.ok(fs.statSync(local).size > 0);
    const root = fs.readFileSync(local, 'utf8').match(/<svg\b[^>]*>/)[0];
    const width = root.match(/\bwidth="([\d.]+)"/)[1];
    const height = root.match(/\bheight="([\d.]+)"/)[1];
    const geometry = screen.match(new RegExp(`${style}: \\{([^}]+)\\}`))[1];
    assert.ok(geometry.includes(`width: ${width}`), `${file} width`);
    assert.ok(geometry.includes(`height: ${height}`), `${file} height`);
    assert.ok(screen.includes(`source={assets.${slot}}`), `${file} callsite`);
  }
  assert.doesNotMatch(screen, /figma\.com\/api\/mcp\/asset/);
  assert.match(screen, /\/api\/direct-messages\/my-threads/);
});
