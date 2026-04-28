/**
 * Utility functions for hour-based absence calculations
 */

export interface HourBasedAbsence {
  id: number;
  userId: number;
  absenceDate: Date;
  hoursStart: number;
  hoursEnd: number;
  totalHours: number;
  absenceType: string;
  reason?: string;
  status: string;
  createdAt: Date;
}

export interface HourSummary {
  date: Date;
  totalHours: number;
  absences: HourBasedAbsence[];
  byType: Record<string, number>; // absenceType -> hours
}

/**
 * Calculates total hours between start and end hour
 * Handles edge cases like midnight crossings
 */
export function calculateHoursDifference(hoursStart: number | string, hoursEnd: number | string): number {
  const start = typeof hoursStart === 'string' ? parseFloat(hoursStart) : hoursStart;
  const end = typeof hoursEnd === 'string' ? parseFloat(hoursEnd) : hoursEnd;

  if (start < 0 || start > 24 || end < 0 || end > 24) {
    throw new Error('Hours must be between 0 and 24');
  }

  if (end < start) {
    // Handles midnight crossing (e.g., 22:00 to 02:00 next day = 4 hours)
    return (24 - start) + end;
  }

  return end - start;
}

/**
 * Validates hour range for absence
 * Checks for overlapping absences on the same day
 */
export function validateHourRange(
  hoursStart: number,
  hoursEnd: number,
  existingAbsences: HourBasedAbsence[] = []
): { valid: boolean; conflicts: HourBasedAbsence[] } {
  // Basic validation
  if (hoursStart < 0 || hoursStart > 24 || hoursEnd < 0 || hoursEnd > 24) {
    return { valid: false, conflicts: [] };
  }

  if (hoursEnd <= hoursStart) {
    return { valid: false, conflicts: [] };
  }

  // Check for overlaps
  const conflicts = existingAbsences.filter(absence => {
    const existingStart = typeof absence.hoursStart === 'string' ? parseFloat(absence.hoursStart) : absence.hoursStart;
    const existingEnd = typeof absence.hoursEnd === 'string' ? parseFloat(absence.hoursEnd) : absence.hoursEnd;

    // Two ranges overlap if: start1 < end2 AND start2 < end1
    return hoursStart < existingEnd && existingStart < hoursEnd;
  });

  return { valid: conflicts.length === 0, conflicts };
}

/**
 * Groups hour-based absences by date and calculates daily totals
 */
export function groupAbsencesByDate(absences: HourBasedAbsence[]): Map<string, HourSummary> {
  const grouped = new Map<string, HourSummary>();

  for (const absence of absences) {
    const dateKey = absence.absenceDate.toISOString().split('T')[0];
    
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, {
        date: absence.absenceDate,
        totalHours: 0,
        absences: [],
        byType: {},
      });
    }

    const summary = grouped.get(dateKey)!;
    const hours = typeof absence.totalHours === 'string' ? parseFloat(absence.totalHours) : absence.totalHours;
    
    summary.totalHours += hours;
    summary.absences.push(absence);
    
    if (!summary.byType[absence.absenceType]) {
      summary.byType[absence.absenceType] = 0;
    }
    summary.byType[absence.absenceType] += hours;
  }

  return grouped;
}

/**
 * Calculates hours to deduct from vacation balance
 * Only applicable for certain absence types
 */
export function calculateVacationDeduction(
  absenceType: string,
  absenceHours: number,
  workingHoursPerDay: number = 8
): number {
  // Types that should deduct from vacation
  const deductibleTypes = ['adverse_weather'];

  if (!deductibleTypes.includes(absenceType)) {
    return 0;
  }

  // Convert hours to days (e.g., 4 hours = 0.5 days)
  return absenceHours / workingHoursPerDay;
}

/**
 * Formats hours for display (converts decimal to HH:MM format where needed)
 */
export function formatHours(hours: number | string): string {
  const h = typeof hours === 'string' ? parseFloat(hours) : hours;
  const wholeHours = Math.floor(h);
  const minutes = Math.round((h - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours}h`;
  }
  
  return `${wholeHours}h ${minutes}m`;
}

/**
 * Converts time string (HH:MM) to decimal hours
 */
export function timeStringToDecimal(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error('Invalid time format');
  }
  return hours + minutes / 60;
}

/**
 * Converts decimal hours to time string (HH:MM)
 */
export function decimalToTimeString(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  return `${String(wholeHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
