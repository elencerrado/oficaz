import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = neon(connectionString);

function summarizePlan(label, explainJson) {
  const planRoot = explainJson?.[0]?.['QUERY PLAN']?.[0];
  if (!planRoot) {
    console.log(`\n${label}`);
    console.log('  Could not parse plan output');
    return;
  }

  const executionTime = planRoot['Execution Time'];
  const planningTime = planRoot['Planning Time'];
  const node = planRoot.Plan || {};

  const flattenNodes = (current) => {
    if (!current) return [];
    const children = Array.isArray(current.Plans) ? current.Plans : [];
    const nested = children.flatMap((child) => flattenNodes(child));
    return [current, ...nested];
  };

  const allNodes = flattenNodes(node);

  const nodeType = node['Node Type'] || 'Unknown';
  const relation = node['Relation Name'] || 'n/a';
  const indexName = node['Index Name'] || 'n/a';
  const actualRows = node['Actual Rows'];
  const actualLoops = node['Actual Loops'];

  const indexNodes = allNodes.filter((n) => {
    const t = String(n['Node Type'] || '');
    return t.includes('Index Scan') || t.includes('Index Only Scan') || t.includes('Bitmap Index Scan') || t.includes('Bitmap Heap Scan');
  });
  const usesIndex = indexNodes.length > 0;
  const indexNodeTypes = indexNodes.map((n) => n['Node Type']);
  const indexNames = indexNodes.map((n) => n['Index Name']).filter(Boolean);

  console.log(`\n${label}`);
  console.log(`  planningTimeMs: ${planningTime}`);
  console.log(`  executionTimeMs: ${executionTime}`);
  console.log(`  rootNode: ${nodeType}`);
  console.log(`  relation: ${relation}`);
  console.log(`  indexName: ${indexName}`);
  console.log(`  actualRows: ${actualRows}`);
  console.log(`  actualLoops: ${actualLoops}`);
  console.log(`  indexUsed: ${usesIndex}`);
  if (usesIndex) {
    console.log(`  indexNodeTypes: ${JSON.stringify(indexNodeTypes)}`);
    console.log(`  indexNames: ${JSON.stringify(indexNames)}`);
  }
}

async function run() {
  try {
    const companyRows = await client(`
      SELECT id, name
      FROM companies
      WHERE is_deleted = false
      ORDER BY id ASC
      LIMIT 1
    `);

    if (!companyRows.length) {
      console.error('No active companies found');
      process.exit(1);
    }

    const companyId = companyRows[0].id;
    const companyName = companyRows[0].name;

    console.log('CRM EXPLAIN ANALYZE DIAGNOSTIC');
    console.log('companyId:', companyId);
    console.log('companyName:', companyName);

    const contactsNoSearch = await client(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT *
      FROM business_contacts
      WHERE company_id = ${companyId}
        AND role = 'client'
      ORDER BY created_at DESC
      LIMIT 50 OFFSET 0
    `);

    summarizePlan('contacts: role + created_at desc', contactsNoSearch);

    const contactsSearch = await client(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT *
      FROM business_contacts
      WHERE company_id = ${companyId}
        AND role = 'client'
        AND name ILIKE '%a%'
      ORDER BY created_at DESC
      LIMIT 50 OFFSET 0
    `);

    summarizePlan('contacts: role + search + created_at desc', contactsSearch);

    const projectsNoSearch = await client(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT *
      FROM projects
      WHERE company_id = ${companyId}
      ORDER BY created_at DESC
      LIMIT 50 OFFSET 0
    `);

    summarizePlan('projects: created_at desc', projectsNoSearch);

    const projectsSearch = await client(`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT *
      FROM projects
      WHERE company_id = ${companyId}
        AND name ILIKE '%a%'
      ORDER BY created_at DESC
      LIMIT 50 OFFSET 0
    `);

    summarizePlan('projects: search + created_at desc', projectsSearch);

    console.log('\nEXPLAIN_DIAGNOSTIC_DONE');
  } catch (error) {
    console.error('EXPLAIN_DIAGNOSTIC_FAILED:', error);
    process.exit(1);
  }
}

run();
