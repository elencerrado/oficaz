import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sql = neon(process.env.DATABASE_URL);

async function createAccountantUser() {
  try {
    console.log('🔐 Creando usuario gestor...');
    
    const email = 'gestor@oficaz.es';
    const password = 'Gestor2026!Oficaz#Secure';
    const fullName = 'Gestor Externo';
    const dni = 'GESTOR001';
    
    // Generate password hash
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Check if user already exists
    const [existingUser] = await sql`
      SELECT id FROM users WHERE company_email = ${email} OR dni = ${dni}
    `;
    
    if (existingUser) {
      console.log('⚠️  El usuario ya existe. Actualizando...');
      await sql`
        UPDATE users 
        SET 
          password = ${passwordHash},
          full_name = ${fullName},
          role = 'accountant',
          company_id = 1,
          is_pending_activation = false,
          activated_at = NOW()
        WHERE id = ${existingUser.id}
      `;
      console.log('✅ Usuario actualizado exitosamente');
    } else {
      console.log('➕ Creando nuevo usuario...');
      await sql`
        INSERT INTO users (
          company_id, 
          full_name, 
          dni, 
          role, 
          company_email, 
          password,
          start_date,
          is_pending_activation,
          activated_at,
          is_active,
          status
        )
        VALUES (
          1,
          ${fullName}, 
          ${dni}, 
          'accountant', 
          ${email},
          ${passwordHash},
          NOW(),
          false,
          NOW(),
          true,
          'active'
        )
      `;
      console.log('✅ Usuario creado exitosamente');
    }
    
    console.log('\n📧 Email:', email);
    console.log('🔑 Contraseña:', password);
    console.log('\n⚠️  IMPORTANTE: Guarda esta contraseña de forma segura\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

createAccountantUser()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
