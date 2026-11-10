const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("dashboard filters its own catalog rather than navigating away", () => {
  const source = read("app/(customer)/(tabs)/browse.tsx");
  assert.match(source, /accessibilityLabel="Filter dashboard" onPress=\{\(\) => setFiltersVisible\(true\)\}/);
  assert.match(source, /<CatalogFilters visible=\{filtersVisible\}/);
  assert.match(source, /&fulfillmentType=\$\{fulfillmentFilter\}/);
  assert.match(source, /&sort=\$\{sort\}/);
  assert.match(source, /\}, \[fulfillmentFilter, sort\]\)/);
});

test("both discovery pages use the shared back chevron and dashboard image shapes", () => {
  const source = read("src/shared/components/DiscoveryPage.tsx");
  assert.match(source, /<BackArrowIcon size=\{24\} color="#3B0508"/);
  assert.match(source, /paddingTop: SCREEN_TOP_SPACING/);
  assert.match(source, /aspectRatio: 156 \/ 206, borderRadius: 14/);
  assert.match(source, /width: 64, height: 64, borderRadius: 32/);
  assert.match(source, /contentFit="cover"/);
  assert.match(source, /numColumns=\{houses \? 3 : 2\}/);
});
