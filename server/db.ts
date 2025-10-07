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

// Optimized connection pool for high concurrency (1000+ simultaneous clock-ins)
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,                      // Maximum number of connections in pool
  min: 2,                       // Minimum number of connections to keep open
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 3000, // Timeout if connection takes >3s
  maxUses: 7500,                // Recycle connections after 7500 uses
});

export const db = drizzle({ client: pool, schema });
