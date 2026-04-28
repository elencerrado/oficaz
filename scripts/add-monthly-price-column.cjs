#!/usr/bin/env node
/**
 * Migration script to add monthly_price column to subscriptions table
 * This is run before starting the server to ensure DB schema is correct
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

async function runMigration() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    console.log('🔄 Executing migration: Add monthly_price column...');
    
    // Add column if it doesn't exist
    await pool.query(`
      ALTER TABLE subscriptions
      ADD COLUMN IF NOT EXISTS monthly_price DECIMAL(10, 2) DEFAULT 0.00;
    `);
    
    console.log('✅ Column added successfully');
    
    // Create index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_monthly_price 
      ON subscriptions(monthly_price);
    `);
    
    console.log('✅ Index created successfully');
    console.log('✅ Migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
