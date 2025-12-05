// ⚠️ PROTECTED CODE - DO NOT MODIFY ⚠️
// Esta función es crítica para el cálculo de días de vacaciones
// Cualquier cambio puede romper funcionalidades existentes
import { parseISO, differenceInDays } from 'date-fns';

/**
 * Calcula el número de días entre dos fechas (inclusivo)
 * @param startDate - Fecha de inicio en formato ISO string (YYYY-MM-DD)
 * @param endDate - Fecha de fin en formato ISO string (YYYY-MM-DD)
 * @returns Número de días incluyendo fecha de inicio y fin
 */
export const calculateDays = (startDate: string, endDate: string): number => {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  return differenceInDays(end, start) + 1;
};
// ⚠️ END PROTECTED CODE ⚠️

// Timezone utilities for reminders (Spain timezone)
import { toZonedTime } from 'date-fns-tz';
import { format as formatDate } from 'date-fns';

export const SPAIN_TZ = 'Europe/Madrid';

/**
 * Converts a datetime-local input string (YYYY-MM-DDTHH:mm) to UTC ISO string
 * Treats the input as Madrid time and converts to UTC for storage
 * CRITICAL: Works correctly regardless of client's actual timezone
 * @param localDateTimeString - Format: YYYY-MM-DDTHH:mm (from datetime-local input)
 * @returns ISO string in UTC for database storage
 */
export const convertMadridToUTC = (localDateTimeString: string): string => {
  // Parse the input components
  const [datePart, timePart] = localDateTimeString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  
  // Create a temporary UTC date with these exact components
  const tempUTC = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  
  // Convert this UTC time to what it would be in Madrid
  const madridEquivalent = toZonedTime(tempUTC, SPAIN_TZ);
  
  // Calculate the offset difference
  const offsetMs = madridEquivalent.getTime() - tempUTC.getTime();
  
  // Subtract the offset to get the correct UTC time that represents the Madrid local time
  const correctUTC = new Date(tempUTC.getTime() - offsetMs);
  
  return correctUTC.toISOString();
};

/**
 * Converts a UTC ISO string from database to Madrid time for datetime-local input
 * @param utcISOString - ISO string from database (e.g., "2025-11-11T14:00:00.000Z")
 * @returns Format: YYYY-MM-DDTHH:mm (for datetime-local input)
 */
export const convertUTCToMadrid = (utcISOString: string): string => {
  const utcDate = new Date(utcISOString);
  
  // Convert to Madrid timezone
  const madridDate = toZonedTime(utcDate, SPAIN_TZ);
  
  // Format for datetime-local input
  const year = madridDate.getFullYear();
  const month = String(madridDate.getMonth() + 1).padStart(2, '0');
  const day = String(madridDate.getDate()).padStart(2, '0');
  const hours = String(madridDate.getHours()).padStart(2, '0');
  const minutes = String(madridDate.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Gets a Date object in Madrid timezone from a UTC ISO string
 * Use this for formatting/displaying dates
 * @param utcISOString - ISO string from database
 * @returns Date object adjusted to Madrid timezone
 */
export const getMadridDate = (utcISOString: string): Date => {
  const utcDate = new Date(utcISOString);
  return toZonedTime(utcDate, SPAIN_TZ);
};

/**
 * Formats a UTC ISO string as a Madrid time string
 * CRITICAL: Always displays Madrid time regardless of client timezone
 * @param utcISOString - ISO string from database
 * @param formatString - date-fns format string (e.g., 'HH:mm', 'dd/MM/yyyy HH:mm')
 * @returns Formatted string in Madrid timezone
 */
export const formatInMadridTime = (utcISOString: string, formatString: string): string => {
  const madridDate = getMadridDate(utcISOString);
  return formatDate(madridDate, formatString);
};

/**
 * Gets time string in Madrid timezone (HH:mm format)
 * CRITICAL: Always displays Madrid time regardless of client timezone
 * @param utcISOString - ISO string from database
 * @returns Time string in format "HH:mm"
 */
export const getMadridTimeString = (utcISOString: string): string => {
  const madridDate = getMadridDate(utcISOString);
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: SPAIN_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(madridDate);
};

/**
 * Formats vacation period in Spanish
 * If single day: "el 22 de diciembre"
 * If multiple days: "del 22 al 25 de diciembre" or "del 22 de noviembre al 5 de diciembre"
 * @param startDate - Start date (Date object, ISO string, or date string)
 * @param endDate - End date (Date object, ISO string, or date string)
 * @returns Formatted string in Spanish
 */
export const formatVacationPeriod = (startDate: Date | string, endDate: Date | string): string => {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.toLocaleDateString('es-ES', { month: 'long' });
  const endMonth = end.toLocaleDateString('es-ES', { month: 'long' });
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  
  const isSameDay = start.toDateString() === end.toDateString();
  const isSameMonth = start.getMonth() === end.getMonth() && startYear === endYear;
  const isSameYear = startYear === endYear;
  
  if (isSameDay) {
    return `el ${startDay} de ${startMonth}`;
  }
  
  if (isSameMonth) {
    return `del ${startDay} al ${endDay} de ${startMonth}`;
  }
  
  if (isSameYear) {
    return `del ${startDay} de ${startMonth} al ${endDay} de ${endMonth}`;
  }
  
  return `del ${startDay} de ${startMonth} ${startYear} al ${endDay} de ${endMonth} ${endYear}`;
};

/**
 * Formats a single vacation date with full format
 * @param date - Date object or ISO string
 * @returns Formatted date like "22 de diciembre de 2025"
 */
export const formatVacationDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Formats vacation dates for display in cards/lists (shorter format)
 * If single day: "22/12/2025"
 * If multiple days: "22/12 - 25/12/2025" (same year) or full dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Formatted date range
 */
export const formatVacationDatesShort = (startDate: Date | string, endDate: Date | string): string => {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  const isSameDay = start.toDateString() === end.toDateString();
  
  if (isSameDay) {
    return start.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  
  const startStr = start.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const endStr = end.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  
  return `${startStr} - ${endStr}`;
};