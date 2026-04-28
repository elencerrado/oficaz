require('dotenv').config();
const { Client } = require('pg');

function calculateCurrentEntitlement(user, company) {
  if (!user.start_date) return 0;
  const startDate = new Date(user.start_date);
  if (isNaN(startDate.getTime())) return 0;

  const today = new Date();
  const [mmStr, ddStr] = (company.vacation_cutoff_day || '01-31').split('-');
  const mm = Math.max(1, Math.min(12, parseInt(mmStr || '1', 10))) - 1;
  const dd = Math.max(1, Math.min(31, parseInt(ddStr || '31', 10)));

  const cutoffThisYear = new Date(today.getFullYear(), mm, dd);
  const periodEnd = today <= cutoffThisYear
    ? cutoffThisYear
    : new Date(today.getFullYear() + 1, mm, dd);
  const periodStart = new Date(periodEnd);
  periodStart.setFullYear(periodEnd.getFullYear() - 1);
  periodStart.setDate(periodStart.getDate() + 1);

  const accrualStart = startDate > periodStart ? startDate : periodStart;
  const accrualEnd = today < periodEnd ? today : periodEnd;
  if (accrualStart > accrualEnd) return 0;

  const annualDays = company.absence_day_calculation_mode === 'working'
    ? Number(company.vacation_days_working)
    : Number(company.vacation_days_natural);

  const companyDaysPerMonth = Number.isFinite(annualDays) && annualDays > 0
    ? annualDays / 12
    : Number(company.vacation_days_per_month || 2.5);

  const userDaysPerMonth = user.vacation_days_per_month
    ? Number(user.vacation_days_per_month)
    : companyDaysPerMonth;

  const monthsWorked =
    (accrualEnd.getFullYear() - accrualStart.getFullYear()) * 12 +
    (accrualEnd.getMonth() - accrualStart.getMonth()) +
    (accrualEnd.getDate() >= accrualStart.getDate() ? 1 : 0);

  const cappedMonths = Math.max(0, Math.min(12, monthsWorked));
  const base = Math.round((cappedMonths * userDaysPerMonth) * 10) / 10;
  const adjustment = Number(user.vacation_days_adjustment || 0);

  return Math.max(0, base + adjustment);
}

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const company = (await db.query(`
    SELECT id, name, vacation_cutoff_day, vacation_days_per_month, vacation_days_natural, vacation_days_working, absence_day_calculation_mode
    FROM companies
    WHERE id = 61
  `)).rows[0];

  const users = (await db.query(`
    SELECT id, full_name, start_date, total_vacation_days, vacation_days_per_month, vacation_days_adjustment
    FROM users
    WHERE company_id = 61 AND role = 'employee'
    ORDER BY full_name
  `)).rows;

  const targetUsers = users.filter((u) =>
    /antonio jesús francisco franco/i.test(u.full_name) ||
    /antonio jesus francisco franco/i.test(u.full_name) ||
    /antonio garcia garcia/i.test(u.full_name)
  );

  const result = targetUsers.map((u) => ({
    id: u.id,
    fullName: u.full_name,
    startDate: u.start_date,
    storedTotal: u.total_vacation_days,
    calculatedNow: calculateCurrentEntitlement(u, company),
  }));

  console.log(JSON.stringify(result, null, 2));
  await db.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
