import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='companies' AND column_name IN ('referral_code','referred_by_company_id','referred_by_code') ORDER BY column_name`;
const rows2 = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='subscriptions' AND column_name IN ('referral_discount_percent','referral_discount_updated_at') ORDER BY column_name`;
console.log('companies:', rows.map(r => r.column_name).join(','));
console.log('subscriptions:', rows2.map(r => r.column_name).join(','));
