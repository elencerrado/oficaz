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
        AND indexname IN ('business_contacts_company_created_at_idx', 'projects_company_created_at_idx')
      ORDER BY indexname
    `);

    console.log('INDEXES_FOUND:', JSON.stringify(rows, null, 2));

    const names = rows.map((row) => row.indexname);
    const hasContacts = names.includes('business_contacts_company_created_at_idx');
    const hasProjects = names.includes('projects_company_created_at_idx');

    if (hasContacts && hasProjects) {
      console.log('VERIFY_0063_OK');
      return;
    }

    console.error('VERIFY_0063_MISSING_INDEXES');
    process.exit(1);
  } catch (error) {
    console.error('VERIFY_0063_FAILED:', error);
    process.exit(1);
  }
}

verifyMigration();
