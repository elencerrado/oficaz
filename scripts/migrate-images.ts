// One-time migration script to move email marketing images from filesystem to Object Storage
import fs from 'fs';
import path from 'path';
import { db } from '../server/db.js';
import { emailCampaigns } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function migrateImages() {
  try {
    console.log('📦 Starting migration of email marketing images to Object Storage...');
    
    const uploadDir = path.join(process.cwd(), 'uploads');
    const { SimpleObjectStorageService } = await import('../server/objectStorageSimple.js');
    const objectStorage = new SimpleObjectStorageService();
    
    // Get all campaigns
    const campaigns = await db.select().from(emailCampaigns);
    console.log(`📦 Found ${campaigns.length} campaigns to check`);
    
    let migratedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    for (const campaign of campaigns) {
      if (!campaign.htmlContent) continue;
      
      console.log(`\n📋 Checking campaign: "${campaign.name}" (ID: ${campaign.id})`);
      
      // Find all image URLs in the campaign HTML that point to /uploads/
      const uploadImageRegex = /https?:\/\/[^"'\s]+\/uploads\/([^"'\s]+\.(jpg|jpeg|png|gif|webp))/gi;
      const matches = [...campaign.htmlContent.matchAll(uploadImageRegex)];
      
      if (matches.length === 0) {
        console.log(`   ✓ No images to migrate in this campaign`);
        continue;
      }
      
      console.log(`   📦 Found ${matches.length} images to migrate`);
      
      let updatedHtml = campaign.htmlContent;
      
      for (const match of matches) {
        const fullUrl = match[0];
        const filename = match[1];
        const filePath = path.join(uploadDir, filename);
        
        try {
          // Check if file exists on filesystem
          if (!fs.existsSync(filePath)) {
            console.warn(`   ⚠️  File not found on filesystem: ${filename} (may already be in Object Storage)`);
            errors.push(`File not found: ${filename}`);
            errorCount++;
            continue;
          }
          
          // Read the file
          const fileBuffer = fs.readFileSync(filePath);
          
          // Upload to Object Storage
          const objectPath = await objectStorage.uploadPublicImage(
            fileBuffer,
            'image/jpeg', // All email images are JPEGs
            filename
          );
          
          // Generate new URL
          const domain = process.env.NODE_ENV === 'production'
            ? 'https://oficaz.es'
            : `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}`;
          const newUrl = `${domain}${objectPath}`;
          
          // Replace old URL with new URL in HTML
          updatedHtml = updatedHtml.replace(fullUrl, newUrl);
          
          console.log(`   ✅ Migrated: ${filename}`);
          console.log(`      Old: ${fullUrl}`);
          console.log(`      New: ${newUrl}`);
          migratedCount++;
          
        } catch (error: any) {
          console.error(`   ❌ Error migrating ${filename}:`, error.message);
          errors.push(`Error migrating ${filename}: ${error.message}`);
          errorCount++;
        }
      }
      
      // Update campaign if HTML changed
      if (updatedHtml !== campaign.htmlContent) {
        await db.update(emailCampaigns)
          .set({ htmlContent: updatedHtml })
          .where(eq(emailCampaigns.id, campaign.id));
        console.log(`   ✅ Updated campaign "${campaign.name}" with new image URLs`);
      }
    }
    
    console.log(`\n📦 ========================================`);
    console.log(`📦 Migration complete!`);
    console.log(`📦 Images migrated: ${migratedCount}`);
    console.log(`📦 Errors: ${errorCount}`);
    if (errors.length > 0) {
      console.log(`📦 Error details:`);
      errors.forEach(err => console.log(`   - ${err}`));
    }
    console.log(`📦 ========================================\n`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Fatal error during migration:', error);
    process.exit(1);
  }
}

migrateImages();
