#!/usr/bin/env node
/**
 * Script to calculate and update monthly_price for all existing subscriptions
 * This ensures all subscriptions have the correct price stored in the DB
 */

const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

async function calculateAndUpdatePrices() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    console.log('🔄 Calculating monthly prices for all subscriptions...');
    
    // Get all subscriptions
    const subscriptionsResult = await pool.query(`SELECT id, company_id, extra_admins, extra_managers, extra_employees FROM subscriptions`);
    const subscriptions = subscriptionsResult.rows;
    
    console.log(`📋 Found ${subscriptions.length} subscriptions to process`);
    
    for (const sub of subscriptions) {
      // Get active addons for this company
      const addonsResult = await pool.query(`
        SELECT SUM(CAST(a.monthly_price AS DECIMAL(10,2))) as total_addons
        FROM company_addons ca
        JOIN addons a ON ca.addon_id = a.id
        WHERE ca.company_id = $1 
        AND (ca.status = 'active' OR ca.status = 'pending_cancel')
      `, [sub.company_id]);
      
      const addonsTotal = parseFloat(addonsResult.rows[0]?.total_addons || 0);
      
      // Calculate seat pricing
      // adminSeats = extraAdmins + 1 (creator), managerSeats = extraManagers, employeeSeats = extraEmployees
      const adminSeats = (sub.extra_admins || 0) + 1;
      const managerSeats = sub.extra_managers || 0;
      const employeeSeats = sub.extra_employees || 0;
      
      const seatsTotal = (adminSeats * 6) + (managerSeats * 4) + (employeeSeats * 2);
      const monthlyPrice = addonsTotal + seatsTotal;
      
      // Update the subscription
      await pool.query(
        'UPDATE subscriptions SET monthly_price = $1 WHERE id = $2',
        [monthlyPrice.toFixed(2), sub.id]
      );
      
      console.log(`  ✅ Company ${sub.company_id}: €${monthlyPrice.toFixed(2)} (addons: €${addonsTotal.toFixed(2)}, seats: €${seatsTotal.toFixed(2)})`);
    }
    
    console.log(`\n✅ All ${subscriptions.length} subscriptions updated successfully!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

calculateAndUpdatePrices();
