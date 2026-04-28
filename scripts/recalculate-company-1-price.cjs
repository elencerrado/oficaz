require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    // Get subscription data
    const subResult = await pool.query(
      'SELECT id, company_id, extra_admins, extra_managers, extra_employees FROM subscriptions WHERE company_id = 1'
    );
    
    if (subResult.rows.length === 0) {
      console.log('Company 1 subscription not found');
      process.exit(1);
    }

    const subscription = subResult.rows[0];
    console.log('Subscription data:', subscription);

    // Get active addons
    const addonsResult = await pool.query(`
      SELECT a.monthly_price
      FROM company_addons ca
      JOIN addons a ON ca.addon_id = a.id
      WHERE ca.company_id = 1 AND ca.status IN ('active', 'pending_cancel')
    `);

    const addonsTotal = addonsResult.rows.reduce((sum, addon) => sum + parseFloat(addon.monthly_price), 0);
    console.log(`Addons total: €${addonsTotal.toFixed(2)}`);

    // Calculate seat pricing
    const adminSeats = (subscription.extra_admins || 0) + 1;
    const managerSeats = subscription.extra_managers || 0;
    const employeeSeats = subscription.extra_employees || 0;

    const seatsTotal = (adminSeats * 6) + (managerSeats * 4) + (employeeSeats * 2);
    console.log(`Seats breakdown:`);
    console.log(`  - Admins: ${adminSeats} × €6 = €${(adminSeats * 6).toFixed(2)}`);
    console.log(`  - Managers: ${managerSeats} × €4 = €${(managerSeats * 4).toFixed(2)}`);
    console.log(`  - Employees: ${employeeSeats} × €2 = €${(employeeSeats * 2).toFixed(2)}`);
    console.log(`Seats total: €${seatsTotal.toFixed(2)}`);

    const totalPrice = addonsTotal + seatsTotal;
    console.log(`\nFINAL TOTAL PRICE: €${totalPrice.toFixed(2)}`);

    // Update DB
    await pool.query(
      'UPDATE subscriptions SET monthly_price = $1 WHERE company_id = $2',
      [parseFloat(totalPrice.toFixed(2)), 1]
    );

    console.log(`\n✅ Updated subscriptions table with monthly_price = €${totalPrice.toFixed(2)}`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
