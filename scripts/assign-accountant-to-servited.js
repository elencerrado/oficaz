import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sql = neon(process.env.DATABASE_URL);

async function assignAccountantToServited() {
  try {
    console.log('🔗 Asignando gestor a Servited...');
    
    // Get Servited company ID
    const [servited] = await sql`
      SELECT id FROM companies WHERE LOWER(name) = 'servited'
    `;
    
    if (!servited) {
      console.error('❌ Empresa Servited no encontrada');
      return;
    }
    
    console.log('✅ Servited encontrada, ID:', servited.id);
    
    // Get accountant user ID
    const [accountant] = await sql`
      SELECT id FROM users WHERE company_email = 'gestor@oficaz.es'
    `;
    
    if (!accountant) {
      console.error('❌ Usuario gestor no encontrado');
      return;
    }
    
    console.log('✅ Gestor encontrado, ID:', accountant.id);
    
    // Check if already assigned
    const [existing] = await sql`
      SELECT id FROM company_accountants 
      WHERE company_id = ${servited.id} AND accountant_user_id = ${accountant.id}
    `;
    
    if (existing) {
      console.log('⚠️  Ya está asignado');
      return;
    }
    
    // Create assignment
    await sql`
      INSERT INTO company_accountants (company_id, accountant_user_id, created_by)
      VALUES (${servited.id}, ${accountant.id}, ${accountant.id})
    `;
    
    console.log('✅ Gestor asignado a Servited exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

assignAccountantToServited()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
