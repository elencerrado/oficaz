import pkg from 'pg';
const { Pool } = pkg;

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
      console.log('📧 Debes añadir un email para este usuario');
      console.log('\n💡 Solución: Edita el usuario en la aplicación y añade su email');
    } else {
      console.log(`\n✅ El usuario tiene email: ${user.email}`);
    }
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
} finally {
  await pool.end();
  process.exit(0);
}
