require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    const result = await pool.query(`
      SELECT 
        role,
        COUNT(*) as count
      FROM users
      WHERE company_id = 1 AND is_active = true
      GROUP BY role
      ORDER BY role
    `);
    
    console.log('Active users in Company 1:');
    let total = 0;
    result.rows.forEach(row => {
      console.log(`  ${row.role}: ${row.count}`);
      total += parseInt(row.count);
    });
    
    console.log(`\nTotal active users: ${total}`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
