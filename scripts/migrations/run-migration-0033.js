#!/usr/bin/env node
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🔄 Connecting to database...');
  const sql = neon(databaseUrl);

  try {
    console.log('📂 Reading migration file...');
    const migrationPath = path.join(__dirname, '..', '..', 'migrations', '0033_add_accountant_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🚀 Running migration 0033: Add Accountant/Advisory System...');
    
    // Remove comments and split by semicolon
    const statements = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`📝 Found ${statements.length} statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`  Executing statement ${i + 1}/${statements.length}...`);
        try {
          await sql(statement);
        } catch (err) {
          console.error(`  ❌ Failed at statement ${i + 1}:`, statement.substring(0, 100));
          throw err;
        }
      }
    }

    console.log('✅ Migration 0033 completed successfully!');
    console.log('');
    console.log('📋 Changes applied:');
    console.log('  ✓ Created company_accountants table');
    console.log('  ✓ Added accountant review fields to accounting_entries');
    console.log('  ✓ Added external accountant config to companies table');
    console.log('  ✓ Created indexes for performance');
    console.log('');
    console.log('🎯 Next steps:');
    console.log('  1. Update TypeScript types with: npm run db:push');
    console.log('  2. Create accountant users with role "accountant"');
    console.log('  3. Assign accountants to companies via company_accountants table');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
