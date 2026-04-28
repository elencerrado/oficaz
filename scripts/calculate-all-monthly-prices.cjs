require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    console.log('🧮 Calculating and updating monthly_price for ALL companies...\n');

    // Get all companies with subscriptions
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        s.extra_admins,
        s.extra_managers,
        s.extra_employees
      FROM subscriptions s
      JOIN companies c ON s.company_id = c.id
      ORDER BY c.id
    `);

    let successCount = 0;
    let errorCount = 0;

    for (const sub of result.rows) {
      try {
        // Get addons sum
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

        const totalPrice = addonsTotal + seatsTotal;

        // Update DB
        await pool.query(
          'UPDATE subscriptions SET monthly_price = $1 WHERE company_id = $2',
          [parseFloat(totalPrice.toFixed(2)), sub.id]
        );

        console.log(`✅ Company ${sub.id} (${sub.name}): €${totalPrice.toFixed(2)}`);
        console.log(`   └─ Addons: €${addonsTotal.toFixed(2)} + Seats: €${seatsTotal.toFixed(2)} (${adminSeats}a+${managerSeats}m+${employeeSeats}e)`);
        successCount++;
      } catch (error) {
        console.error(`❌ Company ${sub.id} (${sub.name}): ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n📊 Summary: ${successCount} updated, ${errorCount} errors`);

    await pool.end();
    process.exit(errorCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
