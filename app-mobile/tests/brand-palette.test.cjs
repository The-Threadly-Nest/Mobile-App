const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const palette = new Set(['#F96951', '#453332', '#2B2B2B', '#4A403B', '#FFFFFF', '#F9E8D3']);
const rgbPalette = new Set(['249,105,81', '69,51,50', '43,43,43', '255,255,255', '249,232,211']);

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.[jt]sx?$/.test(file) ? [file] : [];
  });
}

test('mobile interface colors use the brand palette, including the approved cream', () => {
  const violations = [];
  for (const file of [...sourceFiles(path.join(root, 'app')), ...sourceFiles(path.join(root, 'src'))]) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
        || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        // Drawing pigments are user content, not interface branding.
        let drawingPigment = false;
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (ts.isVariableDeclaration(parent) && parent.name.getText(source) === 'COLORS') drawingPigment = true;
        }
        if (!drawingPigment) {
          const raw = node.getText(source);
          for (const [hex] of raw.matchAll(/(?<!&)#[0-9a-fA-F]{3,8}\b/g)) {
            if (!palette.has(hex.toUpperCase())) violations.push(`${path.relative(root, file)}: ${hex}`);
          }
          for (const rgb of raw.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
            if (!rgbPalette.has(rgb.slice(1).join(','))) violations.push(`${path.relative(root, file)}: ${rgb[0]}`);
          }
          assert.doesNotMatch(raw, /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|emerald|gray|slate|purple)-\d+/);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.deepEqual(violations, []);
});

test('theme aliases use brand colors and filled status badges retain white labels', () => {
  const theme = require('../tailwind.config.js').theme.extend;
  assert.equal(theme.colors.tomato, '#F96951');
  assert.equal(theme.colors.mocha, '#453332');
  assert.equal(theme.colors.cream, '#F9E8D3');
  assert.equal(theme.textColor.black, '#4A403B');
  assert.equal(theme.textColor.charcoal, '#4A403B');
  assert.equal(theme.colors.charcoal, '#2B2B2B'); // Dark backgrounds stay unchanged.
  for (const value of Object.values(theme.colors)) assert.ok(palette.has(value));
  const badge = fs.readFileSync(path.join(root, 'src/shared/components/StatusBadge.tsx'), 'utf8');
  for (const status of ['in_production', 'ready', 'delivered']) {
    assert.match(badge, new RegExp(`${status}: \\{[^\\n]+bg: "bg-oxblood", text: "text-white"`));
  }
});

test('fashion-house screen is cream while its cards stay white', () => {
  const screen = fs.readFileSync(path.join(root, 'app/(customer)/fashion-house/[fashionHouseId].tsx'), 'utf8');
  assert.match(screen, /statsCard:\s*\{[^}]*backgroundColor: "#FFFFFF"/);
  assert.match(screen, /seeAllBtn:\s*\{[^}]*backgroundColor: "#FFFFFF"/);
  assert.match(screen, /container:\s*\{[^}]*backgroundColor: "#F9E8D3"/);
  assert.match(screen, /sheetCard:\s*\{[^}]*backgroundColor: "#F9E8D3"/);
});

test('customer, admin, staff and navigation surfaces consistently use cream', () => {
  for (const [file, name] of [
    ['app/(customer)/(tabs)/browse.tsx', 'safeArea'],
    ['app/(admin)/orders.tsx', 'safe'],
    ['app/(staff)/dashboard.tsx', 'container'],
    ['src/shared/components/DiscoveryPage.tsx', 'screen'],
  ]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, new RegExp(`${name}: \\{[^}]*backgroundColor: "#F9E8D3"`));
  }
  const profile = fs.readFileSync(path.join(root, 'src/shared/components/ProfileDesign.tsx'), 'utf8');
  assert.match(profile, /key=\{index\} style=\{\{ backgroundColor: "#FFFFFF"/);
  assert.match(profile, /header:\s*\{[^}]*backgroundColor: "#F9E8D3"/);
  for (const file of ['app/_layout.tsx', 'app/(auth)/_layout.tsx', 'app/(customer)/_layout.tsx']) {
    assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /contentStyle: \{ backgroundColor: "#F9E8D3"/);
  }
});

test('icon backplates use cream without changing white card surfaces or white button glyphs', () => {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const profile = read('app/(customer)/(tabs)/profile.tsx');
  assert.match(profile, /w-12 h-12 bg-cream rounded-full/);
  assert.doesNotMatch(profile, /w-12 h-12 bg-white rounded-full/);
  const admin = read('app/(admin)/settings.tsx');
  assert.match(admin, /iconCircle:\s*\{[^}]*backgroundColor: "#F9E8D3"/);
  const measurements = read('src/shared/components/CustomerMeasurementsModal.tsx');
  assert.match(measurements, /headingIcon:\s*\{[^}]*backgroundColor: "#F9E8D3"/);
  assert.match(measurements, /card:\s*\{[^}]*backgroundColor: "#FFFFFF"/);
  assert.match(read('src/shared/components/Button.tsx'), /primary: \{ container: "bg-tomato", text: "text-white"/);
});
