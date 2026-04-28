import { neon } from '@neondatabase/serverless';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const client = neon(connectionString);

async function checkTables() {
  try {
    console.log('🔍 Checking adverse weather tables...\n');
    
    // Check if adverse_weather_hours_pool exists
    const poolTableCheck = await client(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'adverse_weather_hours_pool'
      );
    `);
    console.log('✓ adverse_weather_hours_pool exists:', poolTableCheck[0].exists);
    
    // Check if adverse_weather_incidents exists
    const incidentsTableCheck = await client(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'adverse_weather_incidents'
      );
    `);
    console.log('✓ adverse_weather_incidents exists:', incidentsTableCheck[0].exists);
    
    // Check recovery_percentage column in absence_policies
    const columnCheck = await client(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'absence_policies' 
        AND column_name = 'recovery_percentage'
      );
    `);
    console.log('✓ recovery_percentage column exists:', columnCheck[0].exists);
    
    // Count records in adverse_weather_hours_pool
    const poolCount = await client('SELECT COUNT(*) as count FROM adverse_weather_hours_pool');
    console.log('\n📊 Records in adverse_weather_hours_pool:', poolCount[0].count);
    
    // Count records in adverse_weather_incidents
    const incidentsCount = await client('SELECT COUNT(*) as count FROM adverse_weather_incidents');
    console.log('📊 Records in adverse_weather_incidents:', incidentsCount[0].count);
    
    // Show sample data from pool if exists
    if (parseInt(poolCount[0].count) > 0) {
      console.log('\n📋 Sample data from adverse_weather_hours_pool:');
      const samplePool = await client('SELECT * FROM adverse_weather_hours_pool LIMIT 5');
      console.table(samplePool);
    }
    
    // Show sample data from incidents if exists
    if (parseInt(incidentsCount[0].count) > 0) {
      console.log('\n📋 Sample data from adverse_weather_incidents:');
      const sampleIncidents = await client('SELECT * FROM adverse_weather_incidents LIMIT 5');
      console.table(sampleIncidents);
    }
    
    console.log('\n✅ Check completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTables();
