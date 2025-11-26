import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimized connection pool with aggressive idle timeout to prevent stale connections
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,                      // Maximum number of connections in pool
  min: 0,                       // Don't keep minimum connections (prevents stale connection issues)
  idleTimeoutMillis: 10000,     // Close idle connections after 10s (prevent overnight stale connections)
  connectionTimeoutMillis: 5000, // Timeout if connection takes >5s
  maxUses: 1000,                // Recycle connections more frequently
});

// Handle pool errors gracefully to prevent crashes
pool.on('error', (err) => {
  console.error('🔄 Database pool error (will auto-reconnect):', err.message);
  // Don't crash - pool will create new connection on next query
});

export const db = drizzle({ client: pool, schema });
