// Script to fix adverse weather full-day absences
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function run() {
  try {
    console.log('🔍 Ejecutando diagnóstico...\n');
    
    // 1. Diagnóstico
    const diagRes = await fetch(`${BASE_URL}/api/hour-based-absences/diagnostic/check-config`, {
      headers: {
        'Cookie': process.env.AUTH_COOKIE || ''
      }
    });
    
    if (!diagRes.ok) {
      console.error('❌ Error en diagnóstico:', diagRes.status, diagRes.statusText);
      console.log('Asegúrate de estar autenticado como admin');
      return;
    }
    
    const diagData = await diagRes.json();
    console.log('📊 DIAGNÓSTICO:');
    console.log(`   Working Hours Per Day: ${diagData.workingHoursPerDay}`);
    console.log(`   Total Absences: ${diagData.totalAbsences}`);
    console.log(`   Suspicious Absences: ${diagData.suspiciousAbsences}\n`);
    
    if (diagData.absences && diagData.absences.length > 0) {
      console.log('📋 Absences con problemas:');
      diagData.absences.forEach(abs => {
        console.log(`   • ID ${abs.id} - ${abs.userName}`);
        console.log(`     Fecha: ${abs.absenceDate}`);
        console.log(`     Horas actuales: ${abs.hoursStart}-${abs.hoursEnd} (${abs.totalHours}h)`);
        console.log(`     Debería ser: 0-${abs.workingHoursPerDay} (${abs.workingHoursPerDay}h)`);
        console.log(`     Estado: ${abs.status}\n`);
      });
      
      console.log('\n🔧 Ejecutando corrección...\n');
      
      // 2. Corrección
      const fixRes = await fetch(`${BASE_URL}/api/hour-based-absences/fix/correct-full-days`, {
        method: 'POST',
        headers: {
          'Cookie': process.env.AUTH_COOKIE || ''
        }
      });
      
      if (!fixRes.ok) {
        console.error('❌ Error en corrección:', fixRes.status, fixRes.statusText);
        return;
      }
      
      const fixData = await fixRes.json();
      console.log('✅ CORRECCIÓN COMPLETADA:');
      console.log(`   ${fixData.message}`);
      console.log(`   Absences corregidas: ${fixData.correctedCount}`);
      console.log(`\n🔄 Recarga la página del navegador para ver los cambios.`);
    } else {
      console.log('✅ No se encontraron absences para corregir.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

run();
