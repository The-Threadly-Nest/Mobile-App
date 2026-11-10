const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve(__dirname, "../src/shared/utils/catalogFilters.ts");
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { filterCatalogItems } = compiled.exports;
const items = [
  { id: "custom", fulfillmentType: "custom_fit", priceFrom: null, createdAt: "2026-01-01" },
  { id: "expensive", fulfillmentType: "ready_to_wear", priceFrom: 30000, createdAt: "2026-03-01" },
  { id: "cheap", fulfillmentType: "ready_to_wear", priceFrom: 10000, createdAt: "2026-02-01" },
];
test("ready-to-wear, custom-fit and All return the correct cards without changing input", () => {
  assert.deepEqual(filterCatalogItems(items, "ready_to_wear", "newest").map(x => x.id), ["expensive", "cheap"]);
  assert.deepEqual(filterCatalogItems(items, "custom_fit", "newest").map(x => x.id), ["custom"]);
  assert.equal(filterCatalogItems(items, "", "newest").length, 3);
  assert.deepEqual(items.map(x => x.id), ["custom", "expensive", "cheap"]);
});
test("price sorting handles dashboard and API price fields, keeping unpriced items last", () => {
  assert.deepEqual(filterCatalogItems(items, "", "price_asc").map(x => x.id), ["cheap", "expensive", "custom"]);
  assert.deepEqual(filterCatalogItems(items.map(({ priceFrom, ...item }) => ({ ...item, price: priceFrom })), "", "price_desc").map(x => x.id), ["expensive", "cheap", "custom"]);
});
test("Show results applies both draft selections; closing does not apply them", () => {
  const file = path.resolve(__dirname, "../src/shared/components/CatalogFilters.tsx");
  const components = new Module(file, module);
  let state = [], cursor = 0, effects = [];
  const changed = [];
  components.require = name => {
    if (name === "react") return { useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = value; }]; }, useEffect: fn => effects.push(fn) };
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === "react-native") return { Modal: "Modal", View: "View", Pressable: "Pressable", StyleSheet: { create: x => x } };
    if (name === "lucide-react-native") return { X: "X" };
    if (name === "./Typography") return { Text: "Text" };
    return require(name);
  };
  components._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  const props = { visible: true, type: "", sort: "newest", onTypeChange: v => changed.push(["type", v]), onSortChange: v => changed.push(["sort", v]), onClose: () => changed.push(["closed"]) };
  const render = () => { cursor = 0; effects = []; return components.exports.default(props); };
  const find = (tree, predicate) => { if (!tree || typeof tree !== "object") return null; if (predicate(tree)) return tree; for (const child of [tree.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; } return null; };
  let tree = render(); effects.forEach(fn => fn());
  find(tree, n => n.type === "Pressable" && n.props.children?.props?.children === "Ready to wear").props.onPress();
  tree = render();
  find(tree, n => n.type === "Pressable" && n.props.children?.props?.children === "Price: low to high").props.onPress();
  assert.deepEqual(changed, []);
  tree = render();
  find(tree, n => n.type === "Pressable" && n.props.children?.props?.children === "Show results").props.onPress();
  assert.deepEqual(changed, [["type", "ready_to_wear"], ["sort", "price_asc"], ["closed"]]);
});
