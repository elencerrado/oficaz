import 'dotenv/config';
import fs from 'fs';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const text = fs.readFileSync('./migrations/0067_add_referral_system.sql', 'utf8');
const statements = text.split(';').map((s) => s.trim()).filter(Boolean);
console.log('Statements:', statements.length);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  try {
    await sql(stmt);
    console.log('OK', i + 1);
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('exists')) {
      console.log('SKIP', i + 1, msg);
    } else {
      console.error('ERR', i + 1, msg);
      throw e;
    }
  }
}

console.log('Migration 0067 applied');
