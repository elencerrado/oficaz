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
    console.log('📦 Running migration 0058 (incomplete_session_weekly_reminders)...\n');
    
    const migrationPath = path.join(process.cwd(), 'migrations/0058_create_incomplete_session_weekly_reminders.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (!statement.trim()) continue;
      try {
        console.log(`Executing: ${statement.substring(0, 80).trim()}...`);
        await client(statement);
        console.log('✓ Success');
      } catch (error) {
        console.error(`⚠️  Error: ${error.message}`);
        if (!statement.includes('IF NOT EXISTS') && !error.message.includes('already exists')) {
          throw error;
        }
      }
    }
    
    console.log('\n✅ Migration 0058 completed successfully!\n');
    console.log('📊 Summary:');
    console.log('   - incomplete_session_weekly_reminders table created');
    console.log('   - Indexes created for user_id, company_id, and sent_at columns');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
