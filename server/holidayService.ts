import { db } from './db.js';
import { and, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { startOfDay, differenceInCalendarDays, format } from 'date-fns';
import { customHolidays, officialHolidays, companyHolidayExceptions } from '../shared/schema.js';
import { getRegionCodeFromProvince } from './utils/spanishRegions.js';

const NAGER_BASE_URL = 'https://date.nager.at/api/v3/PublicHolidays';

interface NagerHoliday {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties?: string[];
  launchYear?: number;
  types?: string[];
}

const toDateOnly = (value: string): Date => {
  const [year, month, day] = value.split('-').map((part) => parseInt(part, 10));
  return new Date(year, (month || 1) - 1, day || 1);
};

export async function ensureOfficialHolidaysForYears(years: number[]): Promise<void> {
  const uniqueYears = Array.from(new Set(years.filter((y) => Number.isFinite(y))));
  if (uniqueYears.length === 0) return;

  console.log('[HolidayService] Checking official holidays for years:', uniqueYears);

  const existing = await db
    .select({ year: officialHolidays.year, count: sql<number>`count(*)` })
    .from(officialHolidays)
    .where(inArray(officialHolidays.year, uniqueYears))
    .groupBy(officialHolidays.year);

  const existingYears = new Set(existing.filter((row) => row.count > 0).map((row) => row.year));
  const missingYears = uniqueYears.filter((year) => !existingYears.has(year));

  console.log('[HolidayService] Existing years:', Array.from(existingYears));
  console.log('[HolidayService] Missing years to fetch:', missingYears);

  for (const year of missingYears) {
    console.log(`[HolidayService] Fetching holidays from Nager.Date API for year ${year}...`);
    const response = await fetch(`${NAGER_BASE_URL}/${year}/ES`);
    if (!response.ok) {
      console.error(`[HolidayService] API request failed: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch official holidays for ${year}`);
    }

    const holidays = (await response.json()) as NagerHoliday[];
    console.log(`[HolidayService] Received ${holidays.length} holidays from API for year ${year}`);
    const records: Array<{
      countryCode: string;
      regionCode: string | null;
      name: string;
      date: string;
      type: string;
      source: string;
      year: number;
    }> = holidays.flatMap((holiday) => {
      if (holiday.global) {
        return [{
          countryCode: 'ES',
          regionCode: null as string | null,
          name: holiday.localName || holiday.name,
          date: holiday.date,
          type: 'national',
          source: 'nager',
          year
        }];
      }

      if (Array.isArray(holiday.counties) && holiday.counties.length > 0) {
        return holiday.counties.map((county) => ({
          countryCode: 'ES',
          regionCode: county as string,
          name: holiday.localName || holiday.name,
          date: holiday.date,
          type: 'regional',
          source: 'nager',
          year
        }));
      }

      return [{
        countryCode: 'ES',
        regionCode: null as string | null,
        name: holiday.localName || holiday.name,
        date: holiday.date,
        type: 'national',
        source: 'nager',
        year
      }];
    });

    if (records.length > 0) {
      console.log(`[HolidayService] Inserting ${records.length} holiday records into database...`);
      await db.insert(officialHolidays)
        .values(records as any[])
        .onConflictDoNothing({ target: [officialHolidays.date, officialHolidays.regionCode, officialHolidays.name] });
      console.log(`[HolidayService] Successfully inserted holidays for year ${year}`);
    }
  }
  console.log('[HolidayService] Finished ensuring official holidays');
}

export function getCompanyRegionCode(company: any): string | null {
  return getRegionCodeFromProvince(company?.province || null);
}

export async function getOfficialHolidaysForCompanyRange(
  company: any,
  startDate: Date,
  endDate: Date
) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  await ensureOfficialHolidaysForYears([startYear, endYear]);

  const regionCode = getCompanyRegionCode(company);

  const holidays = await db
    .select()
    .from(officialHolidays)
    .where(and(
      gte(officialHolidays.date, format(start, 'yyyy-MM-dd')),
      lte(officialHolidays.date, format(end, 'yyyy-MM-dd')),
      or(
        isNull(officialHolidays.regionCode),
        regionCode ? eq(officialHolidays.regionCode, regionCode) : sql`false`
      )
    ));

  const exceptions = await db
    .select()
    .from(companyHolidayExceptions)
    .where(eq(companyHolidayExceptions.companyId, company.id));

  const excludedIds = new Set(exceptions.filter((ex) => ex.isExcluded).map((ex) => ex.officialHolidayId));

  return { holidays, excludedIds, regionCode };
}

export async function getCustomHolidaysForRange(companyId: number, startDate: Date, endDate: Date) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);

  const baseHolidays = await db
    .select()
    .from(customHolidays)
    .where(eq(customHolidays.companyId, companyId));

  const expanded: typeof baseHolidays = [];
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  for (const holiday of baseHolidays) {
    const originalStart = startOfDay(new Date(holiday.startDate));
    const originalEnd = startOfDay(new Date(holiday.endDate));
    const durationDays = Math.max(0, differenceInCalendarDays(originalEnd, originalStart));
    const isSingleDay = durationDays === 0;
    const hasRecurrenceInfo = Boolean(holiday.recurrenceMonth && holiday.recurrenceDay);
    const shouldTreatAsRecurring = Boolean(holiday.isRecurring || hasRecurrenceInfo || (isSingleDay && originalStart.getFullYear() < startYear));

    if (!shouldTreatAsRecurring) {
      expanded.push(holiday);
      continue;
    }

    const recurrenceMonth = holiday.recurrenceMonth ?? (originalStart.getMonth() + 1);
    const recurrenceDay = holiday.recurrenceDay ?? originalStart.getDate();

    for (let year = startYear; year <= endYear; year += 1) {
      const startRecurring = new Date(year, recurrenceMonth - 1, recurrenceDay);
      const endRecurring = new Date(startRecurring);
      endRecurring.setDate(startRecurring.getDate() + durationDays);

      expanded.push({
        ...holiday,
        startDate: startRecurring,
        endDate: endRecurring
      });
    }
  }

  return expanded.filter((holiday) => {
    const hStart = startOfDay(new Date(holiday.startDate));
    const hEnd = startOfDay(new Date(holiday.endDate));
    return !(hEnd < start || hStart > end);
  });
}

export async function getCompanyHolidaysForRange(
  company: any,
  startDate: Date,
  endDate: Date
) {
  const { holidays: official, excludedIds } = await getOfficialHolidaysForCompanyRange(company, startDate, endDate);
  const custom = await getCustomHolidaysForRange(company.id, startDate, endDate);

  const officialAsCustom = official
    .filter((holiday) => !excludedIds.has(holiday.id))
    .map((holiday) => ({
      id: `official-${holiday.id}`,
      companyId: company.id,
      name: holiday.name,
      startDate: startOfDay(new Date(holiday.date)),
      endDate: startOfDay(new Date(holiday.date)),
      type: holiday.type,
      region: holiday.regionCode,
      description: holiday.source,
      isRecurring: false,
      recurrenceMonth: null,
      recurrenceDay: null,
      createdAt: holiday.createdAt,
      updatedAt: holiday.createdAt
    }));

  return [...custom, ...officialAsCustom];
}

