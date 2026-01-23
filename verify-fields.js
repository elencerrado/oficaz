import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

(async () => {
  try {
    console.log('🔍 Verificando campos fiscales en accounting_entries...\n');
    
    // Verificar campos de IVA
    const ivaFields = await sql`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'accounting_entries' 
      AND column_name IN ('amount', 'vat_rate', 'vat_amount', 'total_amount')
      ORDER BY column_name
    `;
    
    console.log('📊 Campos IVA:');
    console.table(ivaFields);
    
    // Verificar campos de IRPF
    const irpfFields = await sql`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'accounting_entries' 
      AND column_name IN (
        'irpf_retention_rate', 
        'irpf_retention_amount', 
        'irpf_deductible',
        'irpf_deduction_percentage',
        'irpf_is_social_security',
        'irpf_is_amortization',
        'irpf_fiscal_adjustment',
        'fiscal_notes'
      )
      ORDER BY column_name
    `;
    
    console.log('\n📊 Campos IRPF:');
    console.table(irpfFields);
    
    // Contar total de campos fiscales
    const totalFiscalFields = ivaFields.length + irpfFields.length;
    
    console.log(`\n✅ Total campos fiscales encontrados: ${totalFiscalFields}/12`);
    
    // Verificar índices
    const indexes = await sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'accounting_entries'
      ORDER BY indexname
    `;
    
    console.log('\n📊 Índices en accounting_entries:');
    console.table(indexes);
    
    console.log('\n✨ Verificación completada!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();
