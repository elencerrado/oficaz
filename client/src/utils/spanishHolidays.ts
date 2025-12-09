interface Holiday {
  name: string;
  date: string;
  type: 'national' | 'regional' | 'local';
}

const holidayCache = new Map<number, Holiday[]>();

function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getSpanishNationalHolidays(year: number): Holiday[] {
  if (holidayCache.has(year)) {
    return holidayCache.get(year)!;
  }

  const easter = computeEasterSunday(year);
  const viernesSanto = new Date(easter);
  viernesSanto.setDate(easter.getDate() - 2);

  const holidays: Holiday[] = [
    { name: "Año Nuevo", date: `${year}-01-01`, type: "national" },
    { name: "Día de Reyes", date: `${year}-01-06`, type: "national" },
    { name: "Viernes Santo", date: formatDate(viernesSanto), type: "national" },
    { name: "Día del Trabajo", date: `${year}-05-01`, type: "national" },
    { name: "Asunción de la Virgen", date: `${year}-08-15`, type: "national" },
    { name: "Día de la Hispanidad", date: `${year}-10-12`, type: "national" },
    { name: "Todos los Santos", date: `${year}-11-01`, type: "national" },
    { name: "Día de la Constitución", date: `${year}-12-06`, type: "national" },
    { name: "Inmaculada Concepción", date: `${year}-12-08`, type: "national" },
    { name: "Navidad", date: `${year}-12-25`, type: "national" },
  ];

  holidayCache.set(year, holidays);
  return holidays;
}

export function getHolidaysForDateRange(startDate: Date, endDate: Date): Holiday[] {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const holidays: Holiday[] = [];

  for (let year = startYear; year <= endYear; year++) {
    holidays.push(...getSpanishNationalHolidays(year));
  }

  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  return holidays.filter(h => h.date >= startStr && h.date <= endStr);
}

export function getUpcomingHolidays(monthsAhead: number = 3, maxResults: number = 4): Holiday[] {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setMonth(endDate.getMonth() + monthsAhead);

  const holidays = getHolidaysForDateRange(today, endDate);
  
  return holidays
    .filter(h => h.date > formatDate(today))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, maxResults);
}

export function getNationalHolidaysForCalendar(visibleMonth: Date): Holiday[] {
  const year = visibleMonth.getFullYear();
  const prevYear = year - 1;
  const nextYear = year + 1;
  
  return [
    ...getSpanishNationalHolidays(prevYear),
    ...getSpanishNationalHolidays(year),
    ...getSpanishNationalHolidays(nextYear),
  ];
}
