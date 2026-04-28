require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    console.log('All subscriptions with calculated prices:\n');

    const subResult = await pool.query(`
      SELECT 
        c.id,
        c.name,
        s.extra_admins,
        s.extra_managers,
        s.extra_employees,
        s.monthly_price
      FROM subscriptions s
      JOIN companies c ON s.company_id = c.id
      WHERE c.id <= 5
      ORDER BY c.id
    `);

    for (const sub of subResult.rows) {
      // Get addons
      const addonsResult = await pool.query(`
        SELECT COALESCE(SUM(CAST(a.monthly_price AS DECIMAL)), 0) as total
        FROM company_addons ca
        JOIN addons a ON ca.addon_id = a.id
        WHERE ca.company_id = $1 AND ca.status IN ('active', 'pending_cancel')
      `, [sub.id]);

      const addonsTotal = parseFloat(addonsResult.rows[0].total);

      // Calculate seats
      const adminSeats = (sub.extra_admins || 0) + 1;
      const managerSeats = sub.extra_managers || 0;
      const employeeSeats = sub.extra_employees || 0;
      const seatsTotal = (adminSeats * 6) + (managerSeats * 4) + (employeeSeats * 2);

      const expectedTotal = addonsTotal + seatsTotal;
      const dbPrice = parseFloat(sub.monthly_price) || 0;
      const match = Math.abs(expectedTotal - dbPrice) < 0.01 ? '✅' : '❌';

      console.log(`${match} Company ${sub.id} (${sub.name})`);
      console.log(`   Addons: €${addonsTotal.toFixed(2)} | Seats: €${seatsTotal.toFixed(2)} (${adminSeats}a+${managerSeats}m+${employeeSeats}e)`);
      console.log(`   Expected: €${expectedTotal.toFixed(2)} | DB: €${dbPrice.toFixed(2)}`);
      console.log();
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
