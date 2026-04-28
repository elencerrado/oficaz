import 'dotenv/config';
import { db } from '../server/db.ts';
import * as schema from '../shared/schema.ts';
import { and, eq } from 'drizzle-orm';
import { startOfDay } from 'date-fns';
import { calculateVacationDaysForRange } from '../server/utils/vacationCalculator.ts';

function toCalculationMode(value) {
  return value === 'working' ? 'working' : 'natural';
}

function normalizeWorkingDays(days) {
  if (!Array.isArray(days) || days.length === 0) return [1, 2, 3, 4, 5];
  const normalized = days
    .map((day) => (day === 7 ? 0 : day))
    .filter((day) => day >= 0 && day <= 6);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : [1, 2, 3, 4, 5];
}

function getCompanyCalculationModes(company) {
  const current = toCalculationMode(company?.absenceDayCalculationMode);
  const previousValue = company?.absenceDayCalculationModePrevious;
  const previous = previousValue ? toCalculationMode(previousValue) : null;
  const effectiveFromValue = company?.absenceDayCalculationModeEffectiveFrom;
  const effectiveFrom = effectiveFromValue ? startOfDay(new Date(effectiveFromValue)) : null;
  return { current, previous, effectiveFrom };
}

function calculateDaysForRangeWithCompanyMode(startDate, endDate, company, workingDays, holidays) {
  const { current, previous, effectiveFrom } = getCompanyCalculationModes(company);
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);

  if (!effectiveFrom || !previous) {
    return calculateVacationDaysForRange(start, end, current, workingDays, holidays);
  }

  if (end < effectiveFrom) {
    return calculateVacationDaysForRange(start, end, previous, workingDays, holidays);
  }

  if (start >= effectiveFrom) {
    return calculateVacationDaysForRange(start, end, current, workingDays, holidays);
  }

  const beforeEnd = new Date(effectiveFrom);
  beforeEnd.setDate(beforeEnd.getDate() - 1);

  const daysBefore = start <= beforeEnd
    ? calculateVacationDaysForRange(start, beforeEnd, previous, workingDays, holidays)
    : 0;
  const daysAfter = calculateVacationDaysForRange(effectiveFrom, end, current, workingDays, holidays);

  return daysBefore + daysAfter;
}

function getVacationPeriod(date, company) {
  const cutoff = company?.vacationCutoffDay || '01-31';
  const parts = cutoff.split('-');
  const mm = Math.max(1, Math.min(12, parseInt(parts[0] || '1', 10))) - 1;
  const dd = Math.max(1, Math.min(31, parseInt(parts[1] || '31', 10)));
  const year = date.getFullYear();
  const cutoffThisYear = new Date(year, mm, dd);
  const periodEnd = date <= cutoffThisYear ? cutoffThisYear : new Date(year + 1, mm, dd);
  const periodStart = new Date(periodEnd);
  periodStart.setFullYear(periodEnd.getFullYear() - 1);
  periodStart.setDate(periodStart.getDate() + 1);
  return { periodStart, periodEnd };
}

function overlapDays(aStart, aEnd, bStart, bEnd, company, workingDays, holidays) {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (end < start) return 0;
  return calculateDaysForRangeWithCompanyMode(start, end, company, workingDays, holidays);
}

async function run() {
  const companies = await db
    .select()
    .from(schema.companies)
    .where(eq(schema.companies.isDeleted, false));

  const today = new Date();

  let totalUsers = 0;
  let usersWithApprovedNonVacation = 0;
  let usersWithPossibleOvercount = 0;
  let totalNonVacationDays = 0;
  let totalVacationDays = 0;

  for (const company of companies) {
    const workingDays = normalizeWorkingDays(company.workingDays);
    const holidays = await db
      .select()
      .from(schema.customHolidays)
      .where(eq(schema.customHolidays.companyId, company.id));

    const users = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.companyId, company.id), eq(schema.users.isActive, true)));

    for (const user of users) {
      totalUsers += 1;

      const requests = await db
        .select()
        .from(schema.vacationRequests)
        .where(and(eq(schema.vacationRequests.userId, user.id), eq(schema.vacationRequests.status, 'approved')));

      if (requests.length === 0) continue;

      const { periodStart, periodEnd } = getVacationPeriod(today, company);

      let vacationUsed = 0;
      let nonVacationUsed = 0;

      for (const req of requests) {
        const start = new Date(req.startDate);
        const end = new Date(req.endDate);
        const days = overlapDays(start, end, periodStart, periodEnd, company, workingDays, holidays);
        if (days <= 0) continue;

        if (req.absenceType === 'vacation') {
          vacationUsed += days;
        } else {
          nonVacationUsed += days;
        }
      }

      totalVacationDays += vacationUsed;
      totalNonVacationDays += nonVacationUsed;

      if (nonVacationUsed > 0) {
        usersWithApprovedNonVacation += 1;
      }

      const storedUsed = parseFloat(user.usedVacationDays || '0');
      const delta = storedUsed - vacationUsed;
      if (nonVacationUsed > 0 && delta > 0.1) {
        usersWithPossibleOvercount += 1;
      }
    }
  }

  console.log('AUDITORIA PERMISOS RETRIBUIDOS VS VACACIONES');
  console.log('---------------------------------------------');
  console.log(`Usuarios activos: ${totalUsers}`);
  console.log(`Usuarios con permisos aprobados no-vacaciones: ${usersWithApprovedNonVacation}`);
  console.log(`Total dias aprobados no-vacaciones (periodo actual): ${totalNonVacationDays.toFixed(1)}`);
  console.log(`Total dias aprobados vacaciones (periodo actual): ${totalVacationDays.toFixed(1)}`);
  console.log(`Usuarios con posible sobreconteo en usedVacationDays: ${usersWithPossibleOvercount}`);
  console.log('\nNota: "posible sobreconteo" = usedVacationDays almacenado > vacaciones aprobadas en el periodo.');
}

run().catch((error) => {
  console.error('Error en auditoria:', error);
  process.exit(1);
});
