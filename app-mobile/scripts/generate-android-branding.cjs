// Exact asset resizing, not AI-generated artwork. Run from any working directory.
// Uses the existing Sharp installation in the server workspace; no new dependency.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const sharp = require(require.resolve('sharp', { paths: [root, path.resolve(root, '../server')] }));
const check = process.argv.includes('--check');
const res = path.join(root, 'android/app/src/main/res');
const background = '#F96951';
const splashBackground = '#F96951';
const densities = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]];

async function output(file, bytes) {
  if (check) {
    assert.ok((await fs.readFile(file)).equals(bytes), 'Outdated branding asset: ' + file);
  } else {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
  }
}

async function main() {
  const source = path.join(root, 'assets/icon.png');
  const metadata = await sharp(source).metadata();
  assert.equal(metadata.width, metadata.height, 'The source icon must be square');
  // 614/1024 = 59.96%, with precisely 205 transparent pixels on each side.
  const mark = await sharp(source).resize(614, 614, { fit: 'contain' }).png().toBuffer();
  const padded = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: mark, left: 205, top: 205 }]).png().toBuffer();
  await output(path.join(root, 'assets/adaptive-icon.png'), padded);
  // Android small notification icons must be white silhouettes on transparency.
  const rawMark = await sharp(path.join(root, 'assets/splash-icon-dark.png')).resize(72, 72, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < rawMark.length; i += 4) rawMark[i] = rawMark[i + 1] = rawMark[i + 2] = 255;
  const smallMark = await sharp(rawMark, { raw: { width: 72, height: 72, channels: 4 } }).png().toBuffer();
  const notification = await sharp({ create: { width: 96, height: 96, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: smallMark, left: 12, top: 12 }]).png().toBuffer();
  await output(path.join(root, 'assets/notification-icon.png'), notification);

  const config = JSON.parse(await fs.readFile(path.join(root, 'app.json'), 'utf8')).expo;
  assert.equal(config.name, 'Owuja');
  assert.equal(config.android.adaptiveIcon.foregroundImage, './assets/adaptive-icon.png');
  assert.equal(config.android.adaptiveIcon.backgroundColor, background);
  const notificationConfig = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-notifications')[1];
  assert.equal(notificationConfig.icon, './assets/notification-icon.png');
  assert.equal(notificationConfig.color, background);
  assert.equal(notificationConfig.defaultChannel, 'default');
  const splash = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')[1].android;
  assert.equal(splash.image, './assets/splash-icon-black.png');
  assert.equal(splash.backgroundColor, splashBackground);
  assert.equal(splash.imageWidth, 160);

  for (const [density, scale] of densities) {
    const dir = path.join(res, 'mipmap-' + density);
    // The adaptive foreground is always transparent and exactly 108dp.
    const foreground = await sharp(padded).resize(108 * scale, 108 * scale).webp({ lossless: true }).toBuffer();
    await output(path.join(dir, 'ic_launcher_foreground.webp'), foreground);
    // Legacy launchers get the same padded artwork on the brand background.
    const legacy = await sharp(padded).resize(48 * scale, 48 * scale).flatten({ background }).webp({ lossless: true }).toBuffer();
    await output(path.join(dir, 'ic_launcher.webp'), legacy);
    const size = 48 * scale;
    const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`);
    const round = await sharp(legacy).ensureAlpha().composite([{ input: circle, blend: 'dest-in' }]).webp({ lossless: true }).toBuffer();
    await output(path.join(dir, 'ic_launcher_round.webp'), round);
    const launch = await sharp(path.join(root, 'assets/splash-icon-black.png'))
      .resize(160 * scale, 160 * scale, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 64 * scale, bottom: 64 * scale, left: 64 * scale, right: 64 * scale, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    await output(path.join(res, 'drawable-' + density, 'splashscreen_logo.png'), launch);
    await output(path.join(res, 'drawable-' + density, 'notification_icon.png'), await sharp(notification).resize(24 * scale, 24 * scale).png().toBuffer());
    // Duplicate PNG/WebP basenames would make Android resource compilation fail.
    const files = await fs.readdir(dir);
    for (const basename of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground']) {
      assert.equal(files.filter(file => file === basename + '.png' || file === basename + '.webp').length, 1);
    }
    console.log(`${density}: launcher ${48 * scale}px, adaptive ${108 * scale}px, splash ${288 * scale}px ${check ? 'verified' : 'generated'}`);
  }
  for (const filename of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    const xml = await fs.readFile(path.join(res, 'mipmap-anydpi-v26', filename), 'utf8');
    assert.match(xml, /@color\/iconBackground/);
    assert.match(xml, /@mipmap\/ic_launcher_foreground/);
  }
  assert.match(await fs.readFile(path.join(res, 'values/strings.xml'), 'utf8'), /<string name="app_name">Owuja<\/string>/);
  const colors = await fs.readFile(path.join(res, 'values/colors.xml'), 'utf8');
  assert.ok(colors.includes(`<color name="iconBackground">${background}</color>`));
  assert.ok(colors.includes(`<color name="splashscreen_background">${splashBackground}</color>`));
  console.log('Branding configuration, adaptive XML, dimensions and exact asset contents verified.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
