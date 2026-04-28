'use strict';
const sharp = require('sharp');
const path = require('path');

// Adaptive icon foreground: 108dp canvas per density
const foregroundSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
// Legacy launcher icon sizes
const legacySizes     = { mdpi: 48,  hdpi: 72,  xhdpi: 96,  xxhdpi: 144, xxxhdpi: 192 };

const base = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Full‑bleed foreground: blue circle with white ring hole, no background (transparent)
// The adaptive icon framework adds background + mask, so we fill 100% of canvas.
function fgSvg(sz) {
  const r = sz / 2;
  const innerR = Math.round(sz * (20 / 120));
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}">` +
    `<circle cx="${r}" cy="${r}" r="${r}" fill="#007AFF"/>` +
    `<circle cx="${r}" cy="${r}" r="${innerR}" fill="white"/>` +
    `</svg>`
  );
}

// Legacy icon: same icon with 5% padding so it doesn't look clipped on old launchers
function legacySvg(sz) {
  const r = sz / 2;
  const logoR = Math.round(r * 0.92);
  const innerR = Math.round(sz * (20 / 120) * 0.92);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}">` +
    `<circle cx="${r}" cy="${r}" r="${logoR}" fill="#007AFF"/>` +
    `<circle cx="${r}" cy="${r}" r="${innerR}" fill="white"/>` +
    `</svg>`
  );
}

async function generate(svgBuf, sz, outPath) {
  await sharp(svgBuf).resize(sz, sz).png().toFile(outPath);
}

async function run() {
  let count = 0;
  for (const [density, sz] of Object.entries(foregroundSizes)) {
    const dir = path.join(base, `mipmap-${density}`);
    await generate(fgSvg(sz), sz, path.join(dir, 'ic_launcher_foreground.png'));
    count++;
  }
  for (const [density, sz] of Object.entries(legacySizes)) {
    const dir = path.join(base, `mipmap-${density}`);
    await generate(legacySvg(sz), sz, path.join(dir, 'ic_launcher.png'));
    await generate(legacySvg(sz), sz, path.join(dir, 'ic_launcher_round.png'));
    count += 2;
  }
  console.log(`✅ Generated ${count} Android icon files`);
}

run().catch(e => { console.error(e); process.exit(1); });
