const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
test('loading gear has a circular contour and centered inner gear', () => {
  const source = fs.readFileSync(path.join(root, 'app/(auth)/loading.tsx'), 'utf8');
  assert.doesNotMatch(source, /M0 0 L80 0 L80 80 L0 80/);
  assert.match(source, /Math\.cos\(angle\) \* radius/);
  assert.match(source, /Math\.sin\(angle\) \* radius/);
  assert.match(source, /left: 10/);
});
test('video is covered with matching branding until its actual first frame renders', () => {
  const source = fs.readFileSync(path.join(root, 'app/index.tsx'), 'utf8');
  assert.match(source, /onFirstFrameRender=\{\(\) => setVideoReady\(true\)\}/);
  assert.match(source, /!videoReady \? <View style=\{styles\.videoLoadingCover\}/);
  assert.match(source, /videoLoadingCover: \{[^}]*backgroundColor: "#F96951"/);
});
