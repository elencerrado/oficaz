'use strict';
const sharp = require('sharp');
const path = require('path');

// Adaptive icon foreground: 108dp canvas per density
const foregroundSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
// Legacy launcher icon sizes
const legacySizes     = { mdpi: 48,  hdpi: 72,  xhdpi: 96,  xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND_SCALE = 0.48;
const LEGACY_SCALE = 0.55;

const base = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const sourceIcon = path.join(__dirname, '..', 'client', 'public', 'favicon.png');

async function generateFromSource(sz, outPath, scale) {
  const innerSize = Math.max(1, Math.round(sz * scale));
  const padBefore = Math.floor((sz - innerSize) / 2);
  const padAfter = sz - innerSize - padBefore;

  await sharp(sourceIcon)
    .resize(innerSize, innerSize, { fit: 'contain' })
    .extend({
      top: padBefore,
      bottom: padAfter,
      left: padBefore,
      right: padAfter,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outPath);
}

async function run() {
  let count = 0;
  for (const [density, sz] of Object.entries(foregroundSizes)) {
    const dir = path.join(base, `mipmap-${density}`);
    await generateFromSource(sz, path.join(dir, 'ic_launcher_foreground.png'), FOREGROUND_SCALE);
    count++;
  }
  for (const [density, sz] of Object.entries(legacySizes)) {
    const dir = path.join(base, `mipmap-${density}`);
    await generateFromSource(sz, path.join(dir, 'ic_launcher.png'), LEGACY_SCALE);
    await generateFromSource(sz, path.join(dir, 'ic_launcher_round.png'), LEGACY_SCALE);
    count += 2;
  }
  console.log(`✅ Generated ${count} Android icon files`);
}

run().catch(e => { console.error(e); process.exit(1); });
