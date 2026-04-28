import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';

config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sqlText = fs.readFileSync('migrations/0059_create_crm_capture_tables.sql', 'utf8');
const client = neon(url);
const statements = sqlText
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  try {
    await client(statement);
    console.log('OK:', statement.slice(0, 80));
  } catch (error) {
    const msg = String(error?.message || error);
    if (
      msg.includes('already exists') ||
      msg.includes('duplicate key value') ||
      statement.includes('IF NOT EXISTS') ||
      statement.includes('ON CONFLICT')
    ) {
      console.log('SKIP:', statement.slice(0, 80));
    } else {
      console.error('FAIL:', msg);
      process.exit(1);
    }
  }
}

console.log('MIGRATION_0059_DONE');
