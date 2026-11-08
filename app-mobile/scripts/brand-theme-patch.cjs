// Generates a reviewable apply_patch patch; does not write files itself.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const brown = new Set(['#453332', '#3b0508', '#3a2e1a', '#4a080c', '#8a7550', '#6b5e4c', '#1a150e', '#4a4235', '#7c2d32', '#1a1110', '#5c4033', '#8a6b3a', '#8a734e', '#b28847']);
const isBrown = value => brown.has(value.toLowerCase()) || /^rgba?\((?:74,8,12|69,51,50|58,46,26),/.test(value.replace(/\s/g, ''));
const buttonNames = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback']);
const changes = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!/\.tsx$/.test(file)) continue;
    const relative = path.relative(root, file).replace(/\\/g, '/');
    const group = process.argv.find(arg => arg.startsWith('--group='))?.slice(8);
    const fileGroup = relative.startsWith('src/') ? 'shared' : relative.match(/^app\/\((admin|auth|customer|staff)\)/)?.[1] || 'root';
    if (group && group !== fileGroup) continue;
    const chat = /\/(?:chat|direct-chat|messages)(?:\/|\.tsx$)/i.test(relative) || /\/components\/.*chat/i.test(relative);
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const buttonStyles = new Set(), textStyles = new Set(), edits = new Map();
    function edit(node, value) { edits.set(node.getStart(source) + ':' + node.end, { start: node.getStart(source), end: node.end, value }); }
    function visit(node, cb) { cb(node); ts.forEachChild(node, child => visit(child, cb)); }
    visit(source, node => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ['Text', 'TextInput'].includes(node.tagName.getText(source))) {
        for (const attr of node.attributes.properties) if (ts.isJsxAttribute(attr) && attr.name.getText(source) === 'style') visit(attr, child => {
          if (ts.isPropertyAccessExpression(child) && child.expression.getText(source) === 'styles') textStyles.add(child.name.text);
          if (!chat && ts.isPropertyAssignment(child) && child.name.getText(source) === 'color') visit(child.initializer, literal => { if (ts.isStringLiteral(literal) && isBrown(literal.text)) edit(literal, '"#000000"'); });
        });
      }
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && buttonNames.has(node.tagName.getText(source))) {
        for (const attr of node.attributes.properties) if (ts.isJsxAttribute(attr) && attr.name.getText(source) === 'style') {
          visit(attr, child => { if (ts.isPropertyAccessExpression(child) && child.expression.getText(source) === 'styles') buttonStyles.add(child.name.text); });
        }
      }
    });
    visit(source, node => {
      if (ts.isPropertyAssignment(node)) {
        const name = node.name.getText(source).replace(/['"]/g, '');
        const owner = node.parent;
        const textStyle = ts.isObjectLiteralExpression(owner) && (owner.properties.some(property => ts.isPropertyAssignment(property) && ['fontFamily', 'fontSize'].includes(property.name.getText(source))) || (ts.isPropertyAssignment(owner.parent) && textStyles.has(owner.parent.name.getText(source))));
        if (!chat && textStyle && name === 'color') visit(node.initializer, literal => { if (ts.isStringLiteral(literal) && isBrown(literal.text)) edit(literal, '"#000000"'); });
        if (ts.isObjectLiteralExpression(node.initializer) && buttonStyles.has(name)) {
          visit(node.initializer, child => {
            if (ts.isPropertyAssignment(child) && ['backgroundColor', 'borderColor'].includes(child.name.getText(source)) && ts.isStringLiteral(child.initializer) && (brown.has(child.initializer.text.toLowerCase()) || child.initializer.text.toLowerCase() === '#c4a763')) edit(child.initializer, '"#F96951"');
          });
        }
        if (!chat && ts.isObjectLiteralExpression(node.initializer) && /(?:button|btn|primary|submit|save|confirm|done|cta|book|send|action).*(?:text|label)$/i.test(name)) {
          for (const property of node.initializer.properties) if (ts.isPropertyAssignment(property) && property.name.getText(source) === 'color' && ts.isStringLiteral(property.initializer) && ['#ffffff', '#fff', '#fbf7ef'].includes(property.initializer.text.toLowerCase())) edit(property.initializer, '"#000000"');
        }
      }
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) {
        const button = buttonNames.has(node.tagName.getText(source));
        for (const attr of node.attributes.properties) {
          if (ts.isJsxAttribute(attr) && attr.name.getText(source) === 'className' && attr.initializer) {
            let value = attr.initializer.getText(source);
            if (!chat) value = value.replace(/text-(?:oxblood|ink|grey700|grey500|gold)\b/g, 'text-black').replace(/text-\[(#[0-9a-fA-F]+)\]/g, (match, hex) => brown.has(hex.toLowerCase()) ? 'text-black' : match);
            if (button) value = value.replace(/\b(bg|border)-oxblood\b|\b(bg|border)-gold\b/g, match => match.startsWith('bg-') ? 'bg-tomato' : 'border-tomato').replace(/(bg|border)-\[(#[0-9a-fA-F]+)\]/g, (match, kind, hex) => brown.has(hex.toLowerCase()) ? kind + '-tomato' : match);
            if (value !== attr.initializer.getText(source)) edit(attr.initializer, value);
          }
          if (button && ts.isJsxAttribute(attr) && attr.name.getText(source) === 'style') visit(attr, child => {
            if (ts.isPropertyAssignment(child) && ['backgroundColor', 'borderColor'].includes(child.name.getText(source))) visit(child.initializer, literal => {
              if (ts.isStringLiteral(literal) && brown.has(literal.text.toLowerCase())) edit(literal, '"#F96951"');
            });
          });
        }
      }
    });
    let updated = text;
    for (const edit of [...edits.values()].sort((a, b) => b.start - a.start)) updated = updated.slice(0, edit.start) + edit.value + updated.slice(edit.end);
    if (updated !== text) changes.push({ relative, text, updated, count: edits.size });
  }
}
walk(path.join(root, 'app')); walk(path.join(root, 'src/shared/components'));
if (process.argv.includes('--summary')) { console.log(JSON.stringify(changes.map(({relative, count}) => ({file: relative, edits: count})), null, 2)); process.exit(0); }
let patch = '*** Begin Patch\n';
for (const { relative, text, updated } of changes) {
  const before = text.split('\n'), after = updated.split('\n');
  if (before.length !== after.length) throw new Error('Unexpected line count change');
  const changed = before.map((line, i) => line !== after[i] ? i : -1).filter(i => i >= 0);
  const groups = [];
  for (const index of changed) { const last = groups[groups.length - 1]; if (last && index - last[last.length - 1] <= 5) last.push(index); else groups.push([index]); }
  patch += '*** Update File: app-mobile/' + relative + '\n';
  for (const group of groups) {
    patch += '@@\n';
    for (let i = Math.max(0, group[0] - 2); i <= Math.min(before.length - 1, group[group.length - 1] + 2); i++) patch += before[i] === after[i] ? ' ' + before[i] + '\n' : '-' + before[i] + '\n+' + after[i] + '\n';
  }
}
patch += '*** End Patch\n'; process.stdout.write(patch);
