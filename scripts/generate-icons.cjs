#!/usr/bin/env node
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const LOGO_PATH = path.join(__dirname, '../client/public/email-logo.png');
const ANDROID_RES_PATH = path.join(__dirname, '../android/app/src/main/res');

// Android icon sizes: (dpis: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
const SIZES = [
  { dpi: 'mdpi', size: 48 },
  { dpi: 'hdpi', size: 72 },
  { dpi: 'xhdpi', size: 96 },
  { dpi: 'xxhdpi', size: 144 },
  { dpi: 'xxxhdpi', size: 192 }
];

const ICON_SIZES = [
  { dpi: 'mdpi', size: 48 },
  { dpi: 'hdpi', size: 72 },
  { dpi: 'xhdpi', size: 96 },
  { dpi: 'xxhdpi', size: 144 },
  { dpi: 'xxxhdpi', size: 192 }
];

async function generateIcons() {
  try {
    console.log('🎨 Generando íconos de Android...');
    
    if (!fs.existsSync(LOGO_PATH)) {
      console.error(`❌ Logo no encontrado en: ${LOGO_PATH}`);
      process.exit(1);
    }

    // Generar ic_launcher (icon app)
    for (const { dpi, size } of SIZES) {
      const dir = path.join(ANDROID_RES_PATH, `mipmap-${dpi}`);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Crear versión con fondo blanco para ic_launcher
      await sharp(LOGO_PATH)
        .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toFile(path.join(dir, 'ic_launcher.png'));

      console.log(`✅ Creado ic_launcher.png (${dpi}: ${size}x${size})`);

      // Crear foreground sin fondo para ic_launcher_foreground
      await sharp(LOGO_PATH)
        .resize(Math.floor(size * 0.66), Math.floor(size * 0.66), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(path.join(dir, 'ic_launcher_foreground.png'));

      console.log(`✅ Creado ic_launcher_foreground.png (${dpi}: ${Math.floor(size * 0.66)}x${Math.floor(size * 0.66)})`);

      // Versión redonda (ic_launcher_round)
      const img = sharp(LOGO_PATH);
      await img
        .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .composite([
          {
            input: Buffer.from(`
              <svg width="${size}" height="${size}">
                <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
              </svg>`),
            blend: 'in'
          }
        ])
        .png()
        .toFile(path.join(dir, 'ic_launcher_round.png'));

      console.log(`✅ Creado ic_launcher_round.png (${dpi}: ${size}x${size})`);
    }

    // Copiar logo embebido a drawable como backup/fallback
    const drawableDir = path.join(ANDROID_RES_PATH, 'drawable');
    if (!fs.existsSync(drawableDir)) {
      fs.mkdirSync(drawableDir, { recursive: true });
    }

    // Crear versión pequeña del logo para usar en la app
    await sharp(LOGO_PATH)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(drawableDir, 'logo.png'));

    console.log('✅ Logo guardado en drawable/logo.png');

    console.log('\n✨ ¡Todos los íconos han sido generados correctamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error generando íconos:', error);
    process.exit(1);
  }
}

generateIcons();
