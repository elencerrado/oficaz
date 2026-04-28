#!/usr/bin/env node
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id, c.name, 
        s.extra_admins, s.extra_managers, s.extra_employees,
        u.count_admins, u.count_managers, u.count_employees
      FROM subscriptions s
      JOIN companies c ON s.company_id = c.id
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*) FILTER (WHERE role = 'admin') as count_admins,
          COUNT(*) FILTER (WHERE role = 'manager') as count_managers,
          COUNT(*) FILTER (WHERE role = 'employee') as count_employees
        FROM users
        WHERE company_id = c.id AND is_active = true
      ) u ON true
      WHERE c.id = 1
    `);
    
    console.log('Company 1 Details:');
    console.log(JSON.stringify(result.rows[0], null, 2));
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
