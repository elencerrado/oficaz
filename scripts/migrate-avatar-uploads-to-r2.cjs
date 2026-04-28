require('dotenv').config({ path: '.env' });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const REQUIRED_ENV = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'DATABASE_URL'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

function normalizeR2AccountId(rawAccountId, bucketName) {
  const raw = String(rawAccountId || '').trim();
  if (!raw) return raw;

  const withoutProtocol = raw
    .replace(/^https?:\/\//i, '')
    .replace(/\.r2\.cloudflarestorage\.com.*$/i, '');

  const hexMatch = withoutProtocol.match(/[a-f0-9]{32}/i);
  if (hexMatch && hexMatch[0]) return hexMatch[0];

  if (bucketName && withoutProtocol.startsWith(`${bucketName}.`)) {
    return withoutProtocol.slice(bucketName.length + 1);
  }

  return withoutProtocol;
}

const normalizedAccountId = normalizeR2AccountId(process.env.R2_ACCOUNT_ID, process.env.R2_BUCKET_NAME);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${normalizedAccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const bucket = process.env.R2_BUCKET_NAME;
const uploadsDir = path.join(process.cwd(), 'uploads');
const dryRun = process.argv.includes('--dry-run');

function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

async function headObject(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    const code = error?.name || error?.Code;
    if (code === 'NotFound' || code === 'NoSuchKey') return false;
    if (error?.$metadata?.httpStatusCode === 404) return false;
    throw error;
  }
}

(async () => {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  try {
    const { rows } = await pg.query(`
      select id, full_name, profile_picture
      from users
      where profile_picture is not null
        and profile_picture like '/uploads/%'
      order by id asc
    `);

    console.log(`Found ${rows.length} users with /uploads profile_picture`);

    let uploaded = 0;
    let updated = 0;
    let alreadyInR2 = 0;
    let missingLocalAndR2 = 0;
    let unchanged = 0;

    for (const row of rows) {
      const current = String(row.profile_picture || '');
      const fileName = path.basename(current);
      const r2Key = `profile-pictures/${fileName}`;
      const targetUrl = `/public-objects/${r2Key}`;

      if (current === targetUrl) {
        unchanged++;
        continue;
      }

      const existsInR2 = await headObject(r2Key);

      if (!existsInR2) {
        const localPath = path.join(uploadsDir, fileName);
        if (!fs.existsSync(localPath)) {
          console.warn(`SKIP user ${row.id} (${row.full_name}): missing local file and not found in R2 -> ${fileName}`);
          missingLocalAndR2++;
          continue;
        }

        if (!dryRun) {
          const buffer = fs.readFileSync(localPath);
          await r2.send(new PutObjectCommand({
            Bucket: bucket,
            Key: r2Key,
            Body: buffer,
            ContentType: getContentType(fileName),
            CacheControl: 'public, max-age=31536000',
          }));
        }
        uploaded++;
      } else {
        alreadyInR2++;
      }

      if (!dryRun) {
        await pg.query('update users set profile_picture = $1 where id = $2', [targetUrl, row.id]);
      }
      updated++;

      console.log(`OK user ${row.id} -> ${targetUrl}`);
    }

    console.log(JSON.stringify({
      dryRun,
      totalCandidates: rows.length,
      uploaded,
      alreadyInR2,
      updated,
      missingLocalAndR2,
      unchanged,
    }, null, 2));
  } finally {
    await pg.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
