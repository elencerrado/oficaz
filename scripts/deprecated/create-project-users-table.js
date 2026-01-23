import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  try {
    console.log('🚀 Creating project_users table...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS project_users (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, user_id)
      )
    `;
    
    console.log('✅ Table created');
    
    await sql`CREATE INDEX IF NOT EXISTS idx_project_users_project_id ON project_users(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_project_users_user_id ON project_users(user_id)`;
    
    console.log('✅ Indexes created');
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

migrate();
