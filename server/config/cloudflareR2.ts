// Cloudflare R2 Storage Configuration
// Compatible with AWS S3 SDK
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

// Validate R2 configuration
function validateR2Config() {
  const required = {
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  };

  const missing = Object.entries(required)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing R2 configuration: ${missing.join(", ")}. Please add these secrets in Replit.`
    );
  }

  return required as Record<string, string>;
}

// Initialize R2 client (S3-compatible)
export function createR2Client(): S3Client | null {
  console.log("🔍 Checking R2 configuration...");
  try {
    const config = validateR2Config();
    console.log("🔍 R2 config validated - Account ID exists:", !!config.R2_ACCOUNT_ID);

    const r2Client = new S3Client({
      region: "auto", // R2 uses "auto" for region
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.R2_ACCESS_KEY_ID,
        secretAccessKey: config.R2_SECRET_ACCESS_KEY,
      },
    });

    console.log("✅ Cloudflare R2 configured successfully");
    return r2Client;
  } catch (error) {
    console.warn("⚠️ R2 not configured, using fallback storage:", (error as Error).message);
    return null;
  }
}

// Get R2 bucket name
export function getR2BucketName(): string {
  return process.env.R2_BUCKET_NAME || "";
}

// Get R2 public URL for an object
export function getR2PublicUrl(objectKey: string): string {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME;
  
  // R2 custom domain or default R2.dev URL
  // You can configure a custom domain in Cloudflare dashboard
  return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${objectKey}`;
}

export { Upload };
