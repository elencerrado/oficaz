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

async function runMigrations() {
  try {
    // Run migration 0056 first (creates adverse_weather_hours_pool)
    console.log('📦 Running migration 0056 (adverse_weather_hours_pool)...\n');
    const migration56Path = path.join(process.cwd(), 'migrations/0056_create_adverse_weather_hours_pool.sql');
    const migration56SQL = fs.readFileSync(migration56Path, 'utf-8');
    
    const statements56 = migration56SQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements56) {
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
    
    // Then run migration 0057 (adds recovery_percentage and adverse_weather_incidents)
    console.log('\n📦 Running migration 0057 (recovery_percentage + incidents table)...\n');
    const migration57Path = path.join(process.cwd(), 'migrations/0057_add_recovery_percentage_and_adverse_incidents.sql');
    const migration57SQL = fs.readFileSync(migration57Path, 'utf-8');
    
    const statements57 = migration57SQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements57) {
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
    
    console.log('\n✅ All migrations completed successfully!\n');
    console.log('📋 Summary:');
    console.log('   - adverse_weather_hours_pool table created (tracks accumulated hours)');
    console.log('   - adverse_weather_incidents table created (tracks weather events)');
    console.log('   - recovery_percentage column added to absence_policies');
    console.log('\n💡 Next: Register an adverse weather incident to populate the pool\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigrations();
