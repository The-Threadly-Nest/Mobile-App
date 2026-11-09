const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('utility text uses charcoal without overriding black backgrounds', () => {
  const config = require('../tailwind.config.js');
  assert.equal(config.theme.extend.textColor.black, '#2B2B2B');
  assert.equal(config.theme.extend.colors.charcoal, '#2B2B2B');
  assert.equal(config.theme.extend.colors.black, undefined);
  assert.equal(config.theme.extend.colors.tomato, '#F96951');
  assert.equal(config.theme.extend.colors.oxblood, '#453332');
});

test('shared filled and outlined buttons keep distinct readable labels', () => {
  const source = fs.readFileSync(path.join(root, 'src/shared/components/Button.tsx'), 'utf8');
  assert.match(source, /primary: \{ container: "bg-tomato", text: "text-white"/);
  assert.match(source, /secondary: \{ container: "bg-white border border-tomato", text: "text-black"/);
  const measurements = fs.readFileSync(path.join(root, 'src/shared/components/CustomerMeasurementsModal.tsx'), 'utf8');
  assert.match(measurements, /label: \{[^}]*color: "#2B2B2B"/);
  assert.match(measurements, /buttonText: \{[^}]*color: "#FFFFFF"/);
});
