import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = neon(connectionString);

async function runMigration() {
  try {
    console.log('📦 Running migration 0064 (contacts role pagination index)...\n');

    const migrationPath = path.join(process.cwd(), 'migrations/0064_add_contacts_role_pagination_index.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());

    for (const statement of statements) {
      if (!statement.trim()) continue;
      try {
        console.log(`Executing: ${statement.substring(0, 90).trim()}...`);
        await client(statement);
        console.log('✓ Success');
      } catch (error) {
        const message = error && error.message ? String(error.message) : String(error);
        console.error(`⚠️  Error: ${message}`);
        if (!statement.includes('IF NOT EXISTS') && !message.includes('already exists')) {
          throw error;
        }
      }
    }

    console.log('\n✅ Migration 0064 completed successfully!');
    console.log('📊 Summary:');
    console.log('   - business_contacts_company_role_created_at_idx ensured');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
