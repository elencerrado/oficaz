#!/usr/bin/env node
/**
 * Diagnóstico y reparación de absences de Juan José
 */

async function run() {
  const BASE_URL = 'http://localhost:5000';
  
  // Get token from environment or ask user
  let token = process.env.AUTH_TOKEN;
  
  if (!token) {
    console.log('\n❌ AUTH_TOKEN no está definida en environment variables');
    console.log('\nPara obtener el token:');
    console.log('1. Abre el navegador en http://localhost:5000');
    console.log('2. Abre la consola del navegador (F12)');
    console.log('3. Ejecuta: localStorage.getItem("token")');
    console.log('4. Copia el token y ejecuta:');
    console.log('   AUTH_TOKEN=<token> node scripts/maintenance/diagnose-juan-jose.mjs\n');
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log('\n🔍 Buscando a Juan José Ramírez Martín...\n');
    
    // First, get list of users to find Juan José's ID
    const usersRes = await fetch(`${BASE_URL}/api/users`, { headers });
    if (!usersRes.ok) {
      console.log('❌ Error getting users:', usersRes.status);
      const text = await usersRes.text();
      console.log(text);
      process.exit(1);
    }

    const users = await usersRes.json();
    const juanJose = users.find((u) => u.fullName === 'Juan José Ramírez Martín');
    
    if (!juanJose) {
      console.log('❌ No se encontró a Juan José Ramírez Martín');
      console.log('Usuarios encontrados:', users.map((u) => u.fullName).join(', '));
      process.exit(1);
    }

    console.log(`✅ Encontrado: ${juanJose.fullName} (ID: ${juanJose.userId})\n`);

    // Get diagnostic info
    console.log('📊 Obteniendo diagnóstico...\n');
    
    const diagRes = await fetch(`${BASE_URL}/api/debug/employee-adverse-hours/${juanJose.userId}`, { headers });
    if (!diagRes.ok) {
      console.log('❌ Error getting diagnostic:', diagRes.status);
      process.exit(1);
    }

    const diag = await diagRes.json();
    
    console.log(`Empresa: ${diag.company.name}`);
    console.log(`Working Hours Per Day: ${diag.company.workingHoursPerDay}h\n`);
    console.log(`ABSENCES DE INCLEMENCIAS:\n`);

    let needsFix = false;
    for (const absence of diag.absences) {
      console.log(`  ID ${absence.id}:`);
      console.log(`    Fecha: ${absence.date}`);
      console.log(`    Horas: ${absence.hoursStart}:00 - ${absence.hoursEnd}:00 = ${absence.totalHours}h`);
      console.log(`    Estado: ${absence.status}`);
      console.log(`    Parece full day: ${absence.isLikelyFullDay ? 'SÍ' : 'NO'}`);
      console.log(`    Guardado como full day (0-${diag.company.workingHoursPerDay}): ${absence.isStoredAsFullDay ? 'SÍ' : 'NO'}`);
      
      if (absence.isLikelyFullDay && !absence.isStoredAsFullDay) {
        console.log(`    ⚠️  NECESITA REPARACIÓN\n`);
        needsFix = true;
      } else {
        console.log('');
      }
    }

    console.log(`TOTALES:`);
    console.log(`  Raw hours: ${diag.totals.rawHours}h`);
    console.log(`  Days (raw): ${diag.totals.days}d`);
    console.log(`  Computed hours (70%): ${diag.totals.computedHours}h`);
    console.log(`  Days (computed): ${diag.totals.daysComputed}d\n`);

    if (needsFix) {
      console.log('🔧 Ejecutando reparación...\n');
      const fixRes = await fetch(`${BASE_URL}/api/hour-based-absences/emergency-fix`, {
        method: 'POST',
        headers
      });

      if (!fixRes.ok) {
        console.log('❌ Error en reparación:', fixRes.status);
        process.exit(1);
      }

      const fix = await fixRes.json();
      console.log(`✅ ${fix.message}`);
      console.log(`   Absences corregidas: ${fix.correctedCount}\n`);
      
      if (fix.correctedAbsences && fix.correctedAbsences.length > 0) {
        console.log('Detalles:');
        for (const c of fix.correctedAbsences) {
          console.log(`  ${c.userName}: ${c.changed_from} → ${c.changed_to}`);
        }
      }

      console.log('\n🔄 Recarga la página del navegador (Ctrl+F5) para ver los cambios.\n');
    } else {
      console.log('✅ Todo está correctamente configurado. No se necesita reparación.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

run();
