#!/usr/bin/env node
/**
 * Fix subscription seat counts to match actual user counts
 * The extra_* fields should only count EXTRA users beyond the first admin
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    console.log('🔧 Fixing subscription seat counts for company 1...');
    
    // For company 1 (Servited):
    // Actual: 1 admin, 0 managers, 3 employees
    // Should store: extra_admins=0, extra_managers=0, extra_employees=3
    
    await pool.query(`
      UPDATE subscriptions 
      SET extra_admins = 0, extra_managers = 0, extra_employees = 3
      WHERE company_id = 1
    `);
    
    console.log('✅ Fixed company 1 seat counts');
    console.log('   - extra_admins: 1 → 0 (only the creator admin, no extras)');
    console.log('   - extra_managers: 1 → 0 (no managers)');
    console.log('   - extra_employees: 50 → 3 (actual count)');
    
    // Recalculate monthly price
    const monthlyPrice = (0 + 1) * 6 + 0 * 4 + 3 * 2;
    console.log(`\n   Recalculated monthly price: €${monthlyPrice}.00`);
    
    await pool.query(
      'UPDATE subscriptions SET monthly_price = $1 WHERE company_id = 1',
      [monthlyPrice.toFixed(2)]
    );
    
    console.log('✅ Updated monthly_price in DB');
    
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
