import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const companies = await sql`
  SELECT
    c.id,
    c.name,
    c.company_alias,
    s.id AS subscription_id,
    s.extra_admins,
    s.extra_managers,
    s.extra_employees,
    s.monthly_price,
    s.stripe_subscription_id,
    s.updated_at,
    COUNT(CASE WHEN u.role = 'admin' AND COALESCE(u.is_active, true) = true THEN 1 END)::int AS active_admins,
    COUNT(CASE WHEN u.role = 'manager' AND COALESCE(u.is_active, true) = true THEN 1 END)::int AS active_managers,
    COUNT(CASE WHEN u.role = 'employee' AND COALESCE(u.is_active, true) = true THEN 1 END)::int AS active_employees
  FROM companies c
  LEFT JOIN subscriptions s ON s.company_id = c.id
  LEFT JOIN users u ON u.company_id = c.id
  WHERE LOWER(c.name) LIKE LOWER('%pinturas%')
     OR LOWER(c.company_alias) LIKE LOWER('%pinturasur%')
     OR LOWER(u.company_email) = LOWER('produccion@pinturasur.es')
     OR LOWER(u.personal_email) = LOWER('produccion@pinturasur.es')
  GROUP BY c.id, c.name, c.company_alias, s.id, s.extra_admins, s.extra_managers, s.extra_employees, s.monthly_price, s.stripe_subscription_id, s.updated_at
  ORDER BY c.id DESC
`;

let users = [];
if (companies[0]?.id) {
  users = await sql`
    SELECT id, full_name, role, is_active, company_email, personal_email, created_at
    FROM users
    WHERE company_id = ${companies[0].id}
    ORDER BY role, full_name
  `;
}

console.log(JSON.stringify({ companies, users }, null, 2));
