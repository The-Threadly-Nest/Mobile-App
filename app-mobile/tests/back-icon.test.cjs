const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/components/BackArrowIcon.tsx');
const compiled = new Module(filename, module);
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
const originalRequire = compiled.require.bind(compiled);
function ChevronLeft() {}
compiled.require = id => id === 'lucide-react-native' ? { ChevronLeft } : originalRequire(id);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText, filename);

test('shared back icon uses the existing chevron and preserves screen colors and sizes', () => {
  const icon = compiled.exports.BackArrowIcon({ size: 18, color: '#FFFFFF' });
  assert.equal(icon.type, ChevronLeft);
  assert.equal(icon.props.size, 18);
  assert.equal(icon.props.color, '#FFFFFF');
  assert.equal(compiled.exports.BackArrowIcon({}).props.size, 20);
});
test('screens do not bypass the shared icon with old back-arrow glyphs', () => {
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (file.endsWith('.tsx')) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /<ArrowLeft\b|name=["']arrow-back["']|name=["']arrow-left["']/, file);
    }
  }
  walk(path.resolve(__dirname, '../app'));
});
