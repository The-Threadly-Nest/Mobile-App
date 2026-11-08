const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/utils/notificationRecipient.ts');
const mod = new Module(filename, module);
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { notificationBelongsToAccount: belongs } = mod.exports;
test('notifications belong to the current account, never the sender or a logged-out device', () => {
  assert.equal(belongs({ recipientUserId: 'customer', senderId: 'admin' }, 'admin'), false);
  assert.equal(belongs({ recipientUserId: 'customer', senderId: 'admin' }, 'customer'), true);
  assert.equal(belongs({ recipientUserId: 'customer' }, null), false);
  assert.equal(belongs({ senderId: 'admin' }, 'admin'), false);
});
test('Android notifications use the dedicated transparent Owuja icon and tomato accent', () => {
  const config = require('../app.json').expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-notifications')[1];
  assert.equal(config.icon, './assets/notification-icon.png');
  assert.equal(config.color, '#F96951');
  assert.equal(config.defaultChannel, 'default');
  const icon = fs.readFileSync(path.resolve(__dirname, '../assets/notification-icon.png'));
  assert.equal(icon.readUInt32BE(16), 96);
  assert.equal(icon.readUInt32BE(20), 96);
});
