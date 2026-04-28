// Check what's in the database for Juan José
import { db } from './server/db.js';
import { hourBasedAbsences, users, companies } from './shared/schema.js';
import { eq, and } from 'drizzle-orm';

async function checkJuanJose() {
  try {
    // Find Juan José
    const juanJose = await db.select().from(users).where(eq(users.fullName, 'Juan José Ramírez Martín')).limit(1);
    
    if (!juanJose.length) {
      console.log('❌ No se encontró a Juan José Ramírez Martín');
      process.exit(1);
    }

    const employee = juanJose[0];
    console.log(`\n✅ Encontrado: ${employee.fullName} (ID: ${employee.userId})\n`);

    // Get company
    const company = await db.select().from(companies).where(eq(companies.id, employee.companyId)).limit(1);
    if (!company.length) {
      console.log('❌ Empresa no encontrada');
      process.exit(1);
    }

    const workingHoursPerDay = Number(company[0].workingHoursPerDay || 8);
    console.log(`📊 Empresa: ${company[0].name}`);
    console.log(`⏰ Working Hours Per Day: ${workingHoursPerDay}\n`);

    // Get all adverse weather absences for Juan José
    const absences = await db
      .select()
      .from(hourBasedAbsences)
      .where(
        and(
          eq(hourBasedAbsences.userId, employee.userId),
          eq(hourBasedAbsences.absenceType, 'adverse_weather')
        )
      );

    console.log(`📋 TODAS las absences de inclemencias (${absences.length}):\n`);

    let totalHours = 0;
    for (const absence of absences) {
      const totalHours_val = Number(absence.totalHours);
      const hoursStart = Number(absence.hoursStart);
      const hoursEnd = Number(absence.hoursEnd);
      
      console.log(`ID ${absence.id}:`);
      console.log(`  Fecha: ${absence.absenceDate}`);
      console.log(`  Horas: ${hoursStart}:00 - ${hoursEnd}:00`);
      console.log(`  Total: ${totalHours_val}h`);
      console.log(`  Estado: ${absence.status}\n`);
      
      totalHours += totalHours_val;
    }

    console.log(`\n📊 TOTALES:`);
    console.log(`Raw hours: ${totalHours}h`);
    console.log(`Days (raw / ${workingHoursPerDay}): ${(totalHours / workingHoursPerDay).toFixed(2)}d`);
    console.log(`Computed (70%): ${(totalHours * 0.70)}h = ${((totalHours * 0.70) / workingHoursPerDay).toFixed(2)}d\n`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkJuanJose();
