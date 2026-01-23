#!/usr/bin/env node

import { sql } from "drizzle-orm";
import { createClient } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL not configured");
  process.exit(1);
}

const client = createClient({ connectionString: databaseUrl });
const db = drizzle(client);

async function runMigration() {
  try {
    console.log("🚀 Creating project_users table...");

    // Create the table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_users (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, user_id)
      )
    `);

    console.log("✅ project_users table created successfully");

    // Create indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_project_users_project_id ON project_users(project_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_project_users_user_id ON project_users(user_id)`);

    console.log("✅ Indexes created successfully");
    console.log("✅ Migration completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

runMigration();
