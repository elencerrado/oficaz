import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = neon(connectionString);

async function verifyMigration() {
  try {
    const rows = await client(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'business_contacts_company_role_created_at_idx'
      ORDER BY indexname
    `);

    console.log('INDEXES_FOUND:', JSON.stringify(rows, null, 2));

    const names = rows.map((row) => row.indexname);
    const hasIndex = names.includes('business_contacts_company_role_created_at_idx');

    if (hasIndex) {
      console.log('VERIFY_0064_OK');
      return;
    }

    console.error('VERIFY_0064_MISSING_INDEX');
    process.exit(1);
  } catch (error) {
    console.error('VERIFY_0064_FAILED:', error);
    process.exit(1);
  }
}

verifyMigration();
