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

const result = await db.execute(sql.raw(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'support_tickets'
  ORDER BY ordinal_position
`));
console.log('Columns in support_tickets:', result.rows);
process.exit(0);
