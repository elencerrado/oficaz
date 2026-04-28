#!/usr/bin/env node
/**
 * Fix Juan José's adverse weather absences via API
 * Requires the server to be running
 */

const BASE_URL = 'http://localhost:5000';

async function findJuanJose(token) {
  console.log('\n🔍 Buscando a Juan José...\n');
  
  try {
    const res = await fetch(`${BASE_URL}/api/admin/employees`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      console.log('❌ Error fetching employees:', res.status);
      return null;
    }

    const employees = await res.json();
    const juanJose = employees.find(e => e.fullName === 'Juan José Ramírez Martín');
    
    if (!juanJose) {
      console.log('❌ Juan José Ramírez Martín no encontrado');
      console.log('Empleados disponibles:', employees.map(e => e.fullName).slice(0, 5).join(', '), '...');
      return null;
    }

    console.log(`✅ Encontrado: ${juanJose.fullName} (ID: ${juanJose.id || juanJose.userId})`);
    return juanJose;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

async function diagnosisAndFix(token, employeeId) {
  console.log(`\n📊 Obteniendo diagnóstico...\n`);
  
  try {
    const res = await fetch(`${BASE_URL}/api/debug/employee-adverse-hours/${employeeId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!res.ok) {
      console.log('❌ Error en diagnóstico:', res.status);
      const text = await res.text();
      console.log(text);
      return false;
    }

    const diag = await res.json();
    
    console.log(`Empresa: ${diag.company.name}`);
    console.log(`Working Hours Per Day: ${diag.company.workingHoursPerDay}h\n`);
    console.log(`ABSENCES (${diag.absences.length} total):\n`);

    let needsFix = false;
    for (const absence of diag.absences) {
      console.log(`ID ${absence.id}:`);
      console.log(`  Fecha: ${absence.date}`);
      console.log(`  Horas: ${absence.hoursStart}:00 - ${absence.hoursEnd}:00 = ${absence.totalHours}h`);
      console.log(`  Estado: ${absence.status}`);
      console.log(`  Full-day: ${absence.isLikelyFullDay ? 'SÍ' : 'NO'} | Guardado bien: ${absence.isStoredAsFullDay ? 'SÍ' : 'NO'}`);
      
      if (absence.isLikelyFullDay && !absence.isStoredAsFullDay) {
        console.log(`  ⚠️  NECESITA FIX\n`);
        needsFix = true;
      } else {
        console.log('');
      }
    }

    console.log(`TOTALES:\n  Raw: ${diag.totals.rawHours}h (${diag.totals.days}d) | Computed: ${diag.totals.computedHours}h (${diag.totals.daysComputed}d)\n`);

    if (needsFix) {
      console.log('🔧 Ejecutando emergency-fix...\n');
      
      const fixRes = await fetch(`${BASE_URL}/api/hour-based-absences/emergency-fix`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!fixRes.ok) {
        console.log('❌ Error en fix:', fixRes.status);
        return false;
      }

      const fix = await fixRes.json();
      console.log(`✅ ${fix.message}`);
      console.log(`   ${fix.correctedCount} absences corregidas\n`);
      
      if (fix.correctedAbsences && fix.correctedAbsences.length > 0) {
        for (const c of fix.correctedAbsences) {
          console.log(`  ${c.userName}: ${c.changed_from} → ${c.changed_to}`);
        }
      }

      return true;
    } else {
      console.log('✅ Todo está correcto. No se necesita reparación.\n');
      return false;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

async function run() {
  const token = process.env.AUTH_TOKEN;
  
  if (!token) {
    console.log('\n❌ AUTH_TOKEN no está definida\n');
    console.log('Usa: SET AUTH_TOKEN=<tu-token> && node scripts/maintenance/fix-via-api.mjs\n');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log('  DIAGNÓSTICO Y REPARACIÓN DE INCLEMENCIAS DE JUAN JOSÉ');
  console.log('═══════════════════════════════════════════════════════');

  const employee = await findJuanJose(token);
  if (!employee) {
    process.exit(1);
  }

  const employeeId = employee.id || employee.userId;
  const fixed = await diagnosisAndFix(token, employeeId);

  if (fixed) {
    console.log('\n🔄 Recarga la página del navegador (Ctrl+F5) para ver los cambios.\n');
  }

  process.exit(0);
}

run();
