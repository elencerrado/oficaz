import { sql } from "drizzle-orm";

/**
 * MIGRATION: Add subscription_processing_flags table
 * 
 * Tracks subscription creation in-flight to prevent race conditions
 * between trial-status endpoint and auto-trial-process scheduler
 */

export async function up(db: any) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS subscription_processing_flags (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
      processing_stage VARCHAR(50) NOT NULL,
      stripe_customer_id TEXT,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_company_flags FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    )
  `);

  // Create index for faster lookups
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_subscription_flags_company_id 
    ON subscription_processing_flags(company_id)
  `);

  // Create index for expired flag cleanup
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_subscription_flags_expires_at 
    ON subscription_processing_flags(expires_at)
  `);

  console.log("✅ Created subscription_processing_flags table");
}

export async function down(db: any) {
  await db.execute(sql`DROP TABLE IF EXISTS subscription_processing_flags`);
  console.log("✅ Dropped subscription_processing_flags table");
}
