const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("measurements await a successful save before opening assignment with the original order", () => {
  const source = read("app/(admin)/measurements/new.tsx");
  const save = source.slice(source.indexOf("const handleSave"), source.indexOf("return (", source.indexOf("const handleSave")));
  assert.match(save, /await apiFetch\("\/api\/measurements"/);
  assert.doesNotMatch(save, /\.catch\(\(\) => \{\}\)|setTimeout|router\.back/);
  assert.match(save, /router\.replace/);
  assert.match(save, /pathname: "\/\(admin\)\/escalations\/assign"/);
  assert.match(save, /orderId: params\.orderId/);
  assert.match(read("app/(admin)/dashboard.tsx"), /orderId: item\.orderId, customerName, serviceTitle: detail, fulfillmentType: "custom_fit", returnToAssign: "true"/);
});

test("profile camera and unread message badges use tomato with readable white glyphs", () => {
  assert.match(read("src/shared/components/ProfilePhoto.tsx"), /backgroundColor: "#F96951", borderRadius: 16/);
  for (const file of ["app/(admin)/messages.tsx", "app/(customer)/messages/index.tsx", "app/(customer)/(tabs)/profile.tsx"]) {
    assert.match(read(file), /backgroundColor: ["']#F96951["']/);
  }
  assert.match(read("app/(admin)/messages.tsx"), /<Camera size=\{20\} color="#F96951"/);
});
