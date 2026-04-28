#!/usr/bin/env node
/**
 * Migración: Mover TODAS las absences de adverse_weather desde vacation_requests a hour_based_absences
 * 
 * El problema: Algunas inclemencias estaban en vacation_requests (días completos)
 * La solución: Migrarlas a hour_based_absences (formato de horas: 0 a workingHoursPerDay)
 */

import Database from 'better-sqlite3';
import { eq, and, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './shared/schema.js';

const dbFile = process.env.DATABASE_URL || './app.db';
const sqlite = new Database(dbFile);
sqlite.pragma('journal_mode = WAL');

const db = drizzle(sqlite, { schema });
const { vacationRequests, hourBasedAbsences, users, companies } = schema;

async function migrateAdverseWeatherToHours() {
  console.log('\n🔄 MIGRACIÓN: adverse_weather de vacation_requests → hour_based_absences\n');

  try {
    // 1. Encontrar TODAS las adverse_weather en vacation_requests
    const adverseWeatherInVacation = await db
      .select()
      .from(vacationRequests)
      .innerJoin(users, eq(vacationRequests.userId, users.id))
      .innerJoin(companies, eq(users.companyId, companies.id))
      .where(eq(vacationRequests.absenceType, 'adverse_weather'));

    console.log(`📊 Encontradas ${adverseWeatherInVacation.length} ausencias de adverse_weather en vacation_requests\n`);

    if (adverseWeatherInVacation.length === 0) {
      console.log('✅ No hay adverse_weather en vacation_requests. Sistema ya está unificado.\n');
      return;
    }

    let migratedCount = 0;

    for (const row of adverseWeatherInVacation) {
      const vr = row.vacation_requests;
      const user = row.users;
      const company = row.companies;

      console.log(`\n📋 Migrando: ${user.fullName}`);
      console.log(`   Período: ${vr.startDate.toISOString().split('T')[0]} a ${vr.endDate.toISOString().split('T')[0]}`);
      console.log(`   Estado: ${vr.status}`);

      const workingHoursPerDay = typeof company.workingHoursPerDay === 'string'
        ? parseFloat(company.workingHoursPerDay)
        : Number(company.workingHoursPerDay || 8);

      // Calcular número de días (excluyendo fines de semana)
      let currentDate = new Date(vr.startDate);
      const endDate = new Date(vr.endDate);
      let dayCount = 0;
      const workingDays = company.workingDays || [1, 2, 3, 4, 5]; // Lunes-Viernes por defecto

      while (currentDate <= endDate) {
        if (workingDays.includes(currentDate.getDay())) {
          dayCount++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      const totalHours = dayCount * workingHoursPerDay;

      console.log(`   Días laborales: ${dayCount}, Total horas: ${totalHours}${workingHoursPerDay !== 8 ? ` (${workingHoursPerDay}h/día)` : ''}`);

      // 2. Para cada día laboral en el rango, crear un entry en hour_based_absences
      currentDate = new Date(vr.startDate);
      while (currentDate <= endDate) {
        if (workingDays.includes(currentDate.getDay())) {
          // Verificar si ya existe una entrada para este dia
          const existing = await db
            .select()
            .from(hourBasedAbsences)
            .where(
              and(
                eq(hourBasedAbsences.userId, user.id),
                sql`DATE(${hourBasedAbsences.absenceDate}) = ${currentDate.toISOString().split('T')[0]}`,
                eq(hourBasedAbsences.absenceType, 'adverse_weather')
              )
            )
            .limit(1);

          if (existing.length === 0) {
            // Crear nuevo entry con 0 a workingHoursPerDay (día completo de inclemencias)
            await db.insert(hourBasedAbsences).values({
              userId: user.id,
              absenceDate: new Date(currentDate),
              hoursStart: 0,
              hoursEnd: workingHoursPerDay,
              totalHours: workingHoursPerDay,
              absenceType: 'adverse_weather',
              reason: vr.reason || `Migrado desde vacation_requests: ${vr.startDate.toISOString().split('T')[0]} a ${vr.endDate.toISOString().split('T')[0]}`,
              status: vr.status,
              adminComment: vr.adminComment || undefined,
              attachmentPath: vr.attachmentPath || null,
              autoApprove: vr.autoApprove === 1 || vr.autoApprove === true,
            });

            console.log(`     ✅ Creado: ${currentDate.toISOString().split('T')[0]} (0-${workingHoursPerDay}h)`);
            migratedCount++;
          } else {
            console.log(`     ⏭️  Saltado: ${currentDate.toISOString().split('T')[0]} (ya existe en hour_based_absences)`);
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    console.log(`\n✅ Migración completada: ${migratedCount} nuevos registros de hour_based_absences creados\n`);

    // 3. Verificacion final: mostrar datos de Juan José si existe
    const juanJose = await db
      .select()
      .from(users)
      .where(eq(users.fullName, 'Juan José Ramírez Martín'))
      .limit(1);

    if (juanJose.length > 0) {
      const employee = juanJose[0];
      console.log(`\n🔍 VERIFICACIÓN: Juan José Ramírez Martín (ID: ${employee.id})\n`);

      // Contar absences por tipo
      const allAbsences = await db
        .select({
          absenceType: hourBasedAbsences.absenceType,
          count: sql<number>`COUNT(*)`,
          totalHours: sql<number>`SUM(CAST(${hourBasedAbsences.totalHours} AS FLOAT))`,
        })
        .from(hourBasedAbsences)
        .where(eq(hourBasedAbsences.userId, employee.id))
        .groupBy(hourBasedAbsences.absenceType);

      console.log('📊 Resumen de ausencias:');
      for (const row of allAbsences) {
        console.log(`   ${row.absenceType}: ${row.count} registros, ${row.totalHours?.toFixed(1) || 0}h total`);
      }

      // Mostrar adverse_weather específicamente
      const adverseWeather = await db
        .select()
        .from(hourBasedAbsences)
        .where(
          and(
            eq(hourBasedAbsences.userId, employee.id),
            eq(hourBasedAbsences.absenceType, 'adverse_weather'),
            eq(hourBasedAbsences.status, 'approved')
          )
        );

      if (adverseWeather.length > 0) {
        console.log(`\n🌧️ Adverse Weather (Aprobado): ${adverseWeather.length} registros`);
        const totalRaw = adverseWeather.reduce((sum, a) => sum + Number(a.totalHours), 0);
        const totalComputed = totalRaw * 0.70; // 70% recovery percentage
        const workingHours = 8; // Servited
        const daysComputed = totalComputed / workingHours;
        console.log(`   Total bruto: ${totalRaw}h`);
        console.log(`   Total computado (70%): ${totalComputed.toFixed(1)}h`);
        console.log(`   Días equivalentes: ${daysComputed.toFixed(2)} días`);
        console.log(`\n   Detalle por fecha:`);
        adverseWeather.slice(0, 10).forEach(a => {
          const dateStr = new Date(a.absenceDate).toISOString().split('T')[0];
          console.log(`     ${dateStr}: ${a.hoursStart}-${a.hoursEnd}h (${a.totalHours}h total)`);
        });
        if (adverseWeather.length > 10) {
          console.log(`     ... y ${adverseWeather.length - 10} registros más`);
        }
      }
    }

    console.log('\n✅ Migración completada exitosamente\n');

  } catch (error) {
    console.error('\n❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar migración
migrateAdverseWeatherToHours();
