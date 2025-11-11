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