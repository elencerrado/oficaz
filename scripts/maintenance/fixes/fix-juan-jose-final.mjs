import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

// Now import the rest
import { db } from './server/db.js';
import { hourBasedAbsences, users, companies } from './shared/schema.js';
import { eq, and } from 'drizzle-orm';

async function fixAdverseWeatherByUserId() {
  try {
    console.log('\n🔍 BÚSQUEDA DE JUAN JOSÉ RAMÍREZ MARTÍN\n');
    
    // Buscar a Juan José directamente
    const juanJoseList = await db
      .select()
      .from(users)
      .where(eq(users.fullName, 'Juan José Ramírez Martín'));

    if (!juanJoseList.length) {
      console.log('⚠️  No encontrado con nombre exacto, buscando por similar...\n');
      
      // Try similar names
      const allUsers = await db.select().from(users);
      const matches = allUsers.filter(u => 
        u.fullName?.toLowerCase().includes('juan') && 
        u.fullName?.toLowerCase().includes('ramírez')
      );
      
      if (matches.length) {
        console.log('Usuarios similares encontrados:');
        matches.forEach((u, i) => {
          console.log(`${i + 1}. ${u.fullName} (ID: ${u.userId})`);
        });
        console.log('');
      }
      process.exit(1);
    }

    const juanJose = juanJoseList[0];
    console.log(`✅ ENCONTRADO: ${juanJose.fullName}`);
    console.log(`   Username: ${juanJose.username}`);
    console.log(`   ID: ${juanJose.userId}`);
    console.log(`   Company ID: ${juanJose.companyId}\n`);

    // Get company info
    const companyList = await db
      .select()
      .from(companies)
      .where(eq(companies.id, juanJose.companyId));

    if (!companyList.length) {
      console.log('❌ Empresa no encontrada');
      process.exit(1);
    }

    const company = companyList[0];
    const workingHoursPerDay = Number(company.workingHoursPerDay || 8);
    
    console.log(`📊 EMPRESA: ${company.name}`);
    console.log(`⏰ Working Hours Per Day: ${workingHoursPerDay}h\n`);

    // Get all adverse weather absences
    const absences = await db
      .select()
      .from(hourBasedAbsences)
      .where(
        and(
          eq(hourBasedAbsences.userId, juanJose.userId),
          eq(hourBasedAbsences.absenceType, 'adverse_weather')
        )
      );

    console.log(`📋 ABSENCES ACTUALES (${absences.length} total):\n`);

    let totalRawHours = 0;
    const toFix = [];

    for (const absence of absences) {
      const totalHours = Number(absence.totalHours);
      const hoursStart = Number(absence.hoursStart);
      const hoursEnd = Number(absence.hoursEnd);
      
      const isFullDayLike = Math.abs(totalHours - workingHoursPerDay) < 1.5;
      const isCorrectlyStored = hoursStart === 0 && hoursEnd === workingHoursPerDay;
      
      console.log(`ID ${absence.id}:`);
      console.log(`  Fecha: ${absence.absenceDate}`);
      console.log(`  Horas: ${hoursStart}:00 - ${hoursEnd}:00`);
      console.log(`  Total: ${totalHours}h`);
      console.log(`  Status: ${absence.status}`);
      console.log(`  Parece full-day: ${isFullDayLike ? 'SÍ' : 'NO'}`);
      console.log(`  Guardado correctamente (0-${workingHoursPerDay}): ${isCorrectlyStored ? 'SÍ' : 'NO'}`);
      
      if (isFullDayLike && !isCorrectlyStored) {
        console.log(`  ⚠️  NECESITA FIX\n`);
        toFix.push({
          id: absence.id,
          currentTotal: totalHours,
          date: absence.absenceDate
        });
      } else {
        console.log('');
      }
      
      totalRawHours += totalHours;
    }

    console.log(`\n📊 TOTALES ACTUALES:`);
    console.log(`  Raw hours: ${totalRawHours}h`);
    console.log(`  Days (raw): ${(totalRawHours / workingHoursPerDay).toFixed(2)}d`);
    console.log(`  Computed (70%): ${(totalRawHours * 0.70).toFixed(2)}h = ${((totalRawHours * 0.70) / workingHoursPerDay).toFixed(2)}d\n`);

    if (toFix.length > 0) {
      console.log(`\n🔧 REPARANDO ${toFix.length} absences...\n`);
      
      for (const fix of toFix) {
        await db.update(hourBasedAbsences)
          .set({
            hoursStart: 0,
            hoursEnd: workingHoursPerDay,
            totalHours: workingHoursPerDay
          })
          .where(eq(hourBasedAbsences.id, fix.id));

        console.log(`✅ ID ${fix.id} (${fix.date}): ${fix.currentTotal}h → ${workingHoursPerDay}h`);
      }

      // Recalculate totals
      const updatedAbsences = await db
        .select()
        .from(hourBasedAbsences)
        .where(
          and(
            eq(hourBasedAbsences.userId, juanJose.userId),
            eq(hourBasedAbsences.absenceType, 'adverse_weather')
          )
        );

      let newTotalRawHours = 0;
      for (const absence of updatedAbsences) {
        newTotalRawHours += Number(absence.totalHours);
      }

      console.log(`\n📊 NUEVOS TOTALES:`);
      console.log(`  Raw hours: ${newTotalRawHours}h`);
      console.log(`  Days (raw): ${(newTotalRawHours / workingHoursPerDay).toFixed(2)}d`);
      console.log(`  Computed (70%): ${(newTotalRawHours * 0.70).toFixed(2)}h = ${((newTotalRawHours * 0.70) / workingHoursPerDay).toFixed(2)}d`);
      console.log(`\n✅ REPARACIÓN COMPLETADA\n`);
    } else {
      console.log(`\n✅ Todos los datos están correctos. No hay nada que reparar.\n`);
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

fixAdverseWeatherByUserId();
