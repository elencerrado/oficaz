// Upload the correct image to Object Storage with the exact filename
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function uploadCorrectImage() {
  try {
    console.log('🔧 Uploading correct image to Object Storage...');
    
    const sourceImage = 'attached_assets/oficaz promo_1761126358531.jpg';
    const targetFilename = 'email-1761038373158.jpg';
    
    if (!fs.existsSync(sourceImage)) {
      console.error('❌ Source image not found:', sourceImage);
      process.exit(1);
    }
    
    console.log('📁 Processing image:', sourceImage);
    
    // Process image with sharp (resize and optimize for email)
    const processedBuffer = await sharp(sourceImage)
      .resize(600, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ 
        quality: 85,
        mozjpeg: true
      })
      .toBuffer();
    
    console.log(`📏 Processed: ${(processedBuffer.length / 1024).toFixed(2)} KB`);
    
    // Upload to Object Storage with the exact filename needed
    const { SimpleObjectStorageService } = await import('../server/objectStorageSimple.js');
    const objectStorage = new SimpleObjectStorageService();
    
    const objectPath = await objectStorage.uploadPublicImage(
      processedBuffer,
      'image/jpeg',
      targetFilename
    );
    
    console.log('✅ Image uploaded to Object Storage!');
    console.log('   Original: oficaz promo_1761126358531.jpg');
    console.log('   Stored as:', targetFilename);
    console.log('   Path:', objectPath);
    console.log('');
    console.log('🎉 DONE! All sent emails will now show the correct image:');
    console.log('   https://oficaz.es/uploads/' + targetFilename);
    console.log('');
    console.log('✅ Campaign "Captación Clientes 01 - ENVIO 01" fixed!');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

uploadCorrectImage();
