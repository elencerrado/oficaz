require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    const result = await pool.query(`
      SELECT ca.id, ca.company_id, a.id as addon_id, a.name, a.monthly_price, ca.status 
      FROM company_addons ca
      JOIN addons a ON ca.addon_id = a.id
      WHERE ca.company_id = 1 AND ca.status = 'active'
      ORDER BY a.id
    `);
    
    console.log('Active addons for Company 1:');
    console.log(JSON.stringify(result.rows, null, 2));

    if (result.rows.length > 0) {
      const total = result.rows.reduce((sum, addon) => sum + (parseFloat(addon.monthly_price) || 0), 0);
      console.log(`\nTotal addons price: €${total.toFixed(2)}`);
    } else {
      console.log('No active addons for Company 1');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
