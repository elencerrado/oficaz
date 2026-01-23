import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const result = await pool.query(
    'SELECT id, full_name, email, dni, company_id FROM users WHERE id = 418'
  );
  
  console.log('\n👤 Usuario Jose Garcia (ID 418):');
  console.table(result.rows);
  
  if (result.rows.length === 0) {
    console.log('❌ Usuario no encontrado');
  } else {
    const user = result.rows[0];
    if (!user.email) {
      console.log('\n⚠️  PROBLEMA: El usuario NO tiene email configurado');
      console.log('📧 Necesitas añadir un email para este usuario en la base de datos');
    }
  }
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  await pool.end();
}
