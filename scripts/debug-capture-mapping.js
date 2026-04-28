require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const sql = `
    SELECT
      bc.id,
      bc.name,
      bc.role,
      bc.status_categories,
      lp.pipeline_stage,
      sc.id AS status_id,
      sc.name AS status_name,
      sc.stage_key
    FROM business_contacts bc
    LEFT JOIN crm_lead_profiles lp
      ON lp.company_id = bc.company_id
     AND lp.contact_id = bc.id
    LEFT JOIN LATERAL unnest(COALESCE(bc.status_categories, '{}')) AS sid(status_id)
      ON TRUE
    LEFT JOIN crm_status_categories sc
      ON sc.company_id = bc.company_id
     AND sc.id = sid.status_id
    WHERE bc.role = 'client'
    ORDER BY bc.id DESC
    LIMIT 200
  `;

  const res = await db.query(sql);

  const grouped = new Map();
  for (const row of res.rows) {
    if (!grouped.has(row.id)) {
      grouped.set(row.id, {
        id: row.id,
        name: row.name,
        role: row.role,
        status_categories: row.status_categories,
        pipeline_stage: row.pipeline_stage,
        tags: [],
      });
    }
    if (row.status_id) {
      grouped.get(row.id).tags.push({
        id: row.status_id,
        name: row.status_name,
        stage_key: row.stage_key,
      });
    }
  }

  console.log(JSON.stringify(Array.from(grouped.values()), null, 2));

  await db.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
