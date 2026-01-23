import { Pool } from 'pg';

async function checkEmailQueue() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('\n📧 === VERIFICANDO COLA DE EMAILS ===\n');
    
    // 1. Ver usuario 418
    const userResult = await pool.query(
      'SELECT id, full_name, email, company_id FROM users WHERE id = 418'
    );
    console.log('👤 Usuario Jose Garcia:');
    console.table(userResult.rows);
    
    // 2. Ver cola de emails pendientes
    const queueResult = await pool.query(`
      SELECT 
        id, 
        to_email, 
        subject, 
        status, 
        attempts,
        error_message,
        created_at 
      FROM email_queue 
      WHERE status != 'sent' 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    console.log('\n📬 Cola de emails (no enviados):');
    if (queueResult.rows.length === 0) {
      console.log('✅ No hay emails pendientes en la cola');
    } else {
      console.table(queueResult.rows);
    }
    
    // 3. Ver últimos emails enviados
    const sentResult = await pool.query(`
      SELECT 
        id, 
        to_email, 
        subject, 
        status,
        sent_at 
      FROM email_queue 
      WHERE status = 'sent' 
      ORDER BY sent_at DESC 
      LIMIT 5
    `);
    console.log('\n✅ Últimos emails enviados:');
    if (sentResult.rows.length === 0) {
      console.log('⚠️  No hay emails enviados aún');
    } else {
      console.table(sentResult.rows);
    }
    
    // 4. Ver tokens de firma
    const tokensResult = await pool.query(`
      SELECT 
        document_id,
        user_id,
        used,
        expires_at,
        created_at
      FROM document_signature_tokens 
      WHERE user_id = 418
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.log('\n🔐 Tokens de firma para usuario 418:');
    if (tokensResult.rows.length === 0) {
      console.log('⚠️  No hay tokens de firma generados para este usuario');
    } else {
      console.table(tokensResult.rows);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkEmailQueue();
