// Script to check and fix adverse weather absences directly in DB
import { db } from './server/db.js';
import { hourBasedAbsences, users, companies } from './shared/schema.js';
import { eq, and } from 'drizzle-orm';

async function run() {
  try {
    console.log('🔍 Buscando empresa Servited...\n');
    
    // Get Servited company
    const allCompanies = await db.select().from(companies);
    const servited = allCompanies.find(c => c.name && c.name.includes('Servited'));
    
    if (!servited) {
      console.log('❌ No se encontró la empresa Servited');
      console.log('Empresas disponibles:', allCompanies.map(c => c.name));
      process.exit(1);
    }
    
    console.log(`✅ Empresa encontrada: ${servited.name} (ID: ${servited.id})`);
    console.log(`   Working Hours Per Day: ${servited.workingHoursPerDay || 8}\n`);
    
    const workingHoursPerDay = Number(servited.workingHoursPerDay || 8);
    
    // Get all users from Servited
    const servitedUsers = await db.select().from(users).where(eq(users.companyId, servited.id));
    console.log(`👥 Usuarios en Servited: ${servitedUsers.length}\n`);
    
    // Get all adverse weather absences for Servited users
    const userIds = servitedUsers.map(u => u.id);
    const allAbsences = [];
    
    for (const userId of userIds) {
      const absences = await db.select()
        .from(hourBasedAbsences)
        .where(
          and(
            eq(hourBasedAbsences.userId, userId),
            eq(hourBasedAbsences.absenceType, 'adverse_weather')
          )
        );
      allAbsences.push(...absences.map(a => ({ ...a, user: servitedUsers.find(u => u.id === userId) })));
    }
    
    console.log(`📋 Total absences de tipo adverse_weather: ${allAbsences.length}\n`);
    
    if (allAbsences.length === 0) {
      console.log('No hay absences para revisar.');
      process.exit(0);
    }
    
    // Analyze absences
    console.log('🔍 DIAGNÓSTICO:\n');
    const suspiciousAbsences = [];
    
    for (const absence of allAbsences) {
      const totalHours = Number(absence.totalHours);
      const hoursStart = Number(absence.hoursStart);
      const hoursEnd = Number(absence.hoursEnd);
      
      // Check if it's a candidate for being a full day
      const isFullDayCandidate = Math.abs(totalHours - workingHoursPerDay) < 1.5;
      const isCorrect = hoursStart === 0 && hoursEnd === workingHoursPerDay;
      
      if (isFullDayCandidate && !isCorrect) {
        suspiciousAbsences.push(absence);
        console.log(`⚠️  ID ${absence.id} - ${absence.user?.fullName || 'Unknown'}`);
        console.log(`    Fecha: ${absence.absenceDate}`);
        console.log(`    Horas: ${hoursStart}-${hoursEnd} = ${totalHours}h`);
        console.log(`    Debería ser: 0-${workingHoursPerDay} = ${workingHoursPerDay}h`);
        console.log(`    Estado: ${absence.status}\n`);
      }
    }
    
    if (suspiciousAbsences.length === 0) {
      console.log('✅ No se encontraron absences incorrectas. Todo está bien.');
      process.exit(0);
    }
    
    console.log(`\n🔧 Se encontraron ${suspiciousAbsences.length} absences para corregir.\n`);
    console.log('Corrigiendo...\n');
    
    // Fix them
    let correctedCount = 0;
    for (const absence of suspiciousAbsences) {
      await db.update(hourBasedAbsences)
        .set({
          hoursStart: 0,
          hoursEnd: workingHoursPerDay,
          totalHours: workingHoursPerDay.toString()
        })
        .where(eq(hourBasedAbsences.id, absence.id));
      
      console.log(`✅ Corregida absence ID ${absence.id} → 0-${workingHoursPerDay}h`);
      correctedCount++;
    }
    
    console.log(`\n✅ COMPLETADO: ${correctedCount} absences corregidas.`);
    console.log('\n🔄 Recarga la página del navegador para ver los cambios.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

run().then(() => process.exit(0));
