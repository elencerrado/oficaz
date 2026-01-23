#!/usr/bin/env node

import { sql } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL not configured");
  process.exit(1);
}

const neonSql = neon(databaseUrl);
const db = drizzle(neonSql);

async function runMigration() {
  try {
    console.log("🚀 Creating document_signature_positions table...");

    // Create the table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS document_signature_positions (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        position_x DECIMAL(5, 2) NOT NULL DEFAULT 75,
        position_y DECIMAL(5, 2) NOT NULL DEFAULT 80,
        position_width DECIMAL(5, 2) NOT NULL DEFAULT 18,
        position_height DECIMAL(5, 2) NOT NULL DEFAULT 15,
        page_number INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(document_id)
      )
    `);

    console.log("✅ document_signature_positions table created successfully");

    // Create index
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS document_signature_positions_document_id_idx 
      ON document_signature_positions(document_id)
    `);

    console.log("✅ Index created successfully");
    console.log("✅ Migration completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

runMigration();
