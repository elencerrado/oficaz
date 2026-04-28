import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';
import { sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
}

const { db } = await import('../server/db.js');

try {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      company_name VARCHAR(255),
      user_name VARCHAR(255) NOT NULL,
      user_email VARCHAR(255) NOT NULL,
      subject VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      source VARCHAR(50) NOT NULL DEFAULT 'app_feedback',
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
      resolved_at TIMESTAMP,
      resolved_by VARCHAR(255),
      resolution_comment TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT support_tickets_status_check CHECK (status IN ('open', 'resolved'))
    )
  `));
  console.log('✅ Tabla support_tickets creada');

  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS support_tickets_status_created_idx ON support_tickets (status, created_at DESC)`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS support_tickets_company_created_idx ON support_tickets (company_id, created_at DESC)`));
  console.log('✅ Índices creados');
  process.exit(0);
} catch (e: any) {
  console.error('❌ Error:', e.message);
  process.exit(1);
}
