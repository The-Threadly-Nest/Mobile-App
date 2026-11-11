const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

test("animated splash uses the supplied white icon unchanged", async () => {
  const source = fs.readFileSync(path.join(root, "../VISUAL IDENTITY ASSETS/LOGO/PNG/ICON WHITE.png"));
  const asset = fs.readFileSync(path.join(root, "assets/splash-icon-white.png"));
  assert.ok(source.equals(asset));
  const sharp = require(require.resolve("sharp", { paths: [root, path.resolve(root, "../server")] }));
  const metadata = await sharp(asset).metadata();
  assert.equal(metadata.width, 4389);
  assert.equal(metadata.height, 4389);
  assert.equal(metadata.hasAlpha, true);
  await sharp(asset).raw().toBuffer();
});

test("splash keeps white Instrument Sans beside the correctly proportioned white mark", () => {
  const source = fs.readFileSync(path.join(root, "src/shared/components/AnimatedBrandSplash.tsx"), "utf8");
  assert.match(source, /const MARK_HEIGHT = 48/);
  assert.match(source, /MARK_HEIGHT \* 3485 \/ 3976/);
  assert.match(source, /<Path d=\{d\} fill="#FFFDF9"/);
  assert.match(source, /source=\{require\("\.\.\/\.\.\/\.\.\/assets\/splash-icon-white.png"\)\}/);
  assert.match(source, /brand: \{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12/);
  assert.match(source, /name: \{ fontFamily: "InstrumentSans-Medium", fontSize: 40, lineHeight: MARK_HEIGHT, includeFontPadding: false, color: "#FFFDF9"/);
  assert.match(source, /backgroundColor: "#F96951"/);
  assert.match(source, /<StatusBar style="light"/);
});
