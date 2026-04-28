import { db } from './server/db.js';
import { hourBasedAbsences, users, companies } from './shared/schema.js';
import { eq, and, or } from 'drizzle-orm';

async function fixAdverseWeatherAbsences() {
  try {
    console.log('🔍 Buscando absences incorrectas...\n');

    // Get all companies
    const allCompanies = await db.select().from(companies);
    
    for (const company of allCompanies) {
      const workingHoursPerDay = Number(company.workingHoursPerDay || 8);
      console.log(`\n📊 Empresa: ${company.name} (Working Hours: ${workingHoursPerDay}h)\n`);

      // Get all users from this company
      const companyUsers = await db
        .select()
        .from(users)
        .where(eq(users.companyId, company.id));

      // Get all adverse weather absences
      const allAbsences = await db
        .select()
        .from(hourBasedAbsences)
        .innerJoin(users, eq(hourBasedAbsences.userId, users.id))
        .where(
          and(
            eq(hourBasedAbsences.absenceType, 'adverse_weather'),
            eq(users.companyId, company.id)
          )
        );

      console.log(`   Total absences: ${allAbsences.length}`);

      let correctedCount = 0;
      const correctedList = [];

      // Check each absence
      for (const row of allAbsences) {
        const absence = row.hour_based_absences;
        const totalHours = Number(absence.totalHours);
        const hoursStart = Number(absence.hoursStart);
        const hoursEnd = Number(absence.hoursEnd);
        const userName = row.users.fullName;

        // If it looks like a full day but isn't stored correctly
        if (
          Math.abs(totalHours - workingHoursPerDay) < 1.5 &&
          !(hoursStart === 0 && hoursEnd === workingHoursPerDay)
        ) {
          console.log(`\n   ⚠️  ${userName} - ${absence.absenceDate}`);
          console.log(`      BEFORE: ${hoursStart}:00-${hoursEnd}:00 = ${totalHours}h`);

          // Fix it
          await db.update(hourBasedAbsences)
            .set({
              hoursStart: 0,
              hoursEnd: workingHoursPerDay,
              totalHours: workingHoursPerDay
            })
            .where(eq(hourBasedAbsences.id, absence.id));

          console.log(`      AFTER:  0:00-${workingHoursPerDay}:00 = ${workingHoursPerDay}h ✅`);

          correctedList.push({
            user: userName,
            date: absence.absenceDate,
            before: `${hoursStart}-${hoursEnd}h`,
            after: `0-${workingHoursPerDay}h`
          });
          correctedCount++;
        }
      }

      if (correctedCount > 0) {
        console.log(`\n   ✅ ${correctedCount} absences corregidas en ${company.name}\n`);
      } else {
        console.log(`   ✅ No hay absences para corregir en ${company.name}\n`);
      }
    }

    console.log('\n✅ FIX COMPLETADO');
    console.log('🔄 Recarga la página del navegador para ver los cambios.\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAdverseWeatherAbsences();
