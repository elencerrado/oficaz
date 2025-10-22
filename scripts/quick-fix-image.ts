// Quick fix: Upload an existing image to Object Storage with the missing filename
import fs from 'fs';
import path from 'path';

async function quickFix() {
  try {
    console.log('🔧 Quick fix: Creating missing image in Object Storage...');
    
    // Use an existing image as placeholder
    const sourceImage = 'uploads/email-1761031911633.jpg';
    const targetFilename = 'email-1761038373158.jpg';
    
    if (!fs.existsSync(sourceImage)) {
      console.error('❌ Source image not found:', sourceImage);
      process.exit(1);
    }
    
    // Read the source image
    const imageBuffer = fs.readFileSync(sourceImage);
    console.log('📁 Source image:', sourceImage, `(${(imageBuffer.length / 1024).toFixed(2)} KB)`);
    
    // Upload to Object Storage with the missing filename
    const { SimpleObjectStorageService } = await import('../server/objectStorageSimple.js');
    const objectStorage = new SimpleObjectStorageService();
    
    const objectPath = await objectStorage.uploadPublicImage(
      imageBuffer,
      'image/jpeg',
      targetFilename
    );
    
    console.log('✅ Image uploaded to Object Storage!');
    console.log('   Filename:', targetFilename);
    console.log('   Path:', objectPath);
    console.log('');
    console.log('🎉 DONE! The URL will now work:');
    console.log('   https://oficaz.es/uploads/' + targetFilename);
    console.log('   (served from Object Storage via fallback)');
    console.log('');
    console.log('💡 Next step: Replace with the actual image when you have it.');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

quickFix();
