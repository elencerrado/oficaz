/**
 * Vacation Days Calculator Utilities
 * Supports both natural days and working days calculation modes
 * 
 * Day numbering: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
 * customHoliday format: { startDate: Date, endDate: Date }
 */

type HolidayRange = {
  startDate: Date;
  endDate: Date;
};

/**
 * Check if a specific date is a working day
 * @param date - Date to check
 * @param workingDays - Array of day numbers (0-6) that are working days. Default: [1,2,3,4,5]
 * @param holidays - Array of CustomHoliday objects to exclude
 * @returns boolean - true if date is a working day
 */
export function isWorkingDay(
  date: Date,
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: HolidayRange[] = []
): boolean {
  // Check if it's a weekend
  const dayOfWeek = date.getDay();
  if (!workingDays.includes(dayOfWeek)) {
    return false;
  }

  // Check if it's a holiday
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  for (const holiday of holidays) {
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);
    holidayStart.setHours(0, 0, 0, 0);
    holidayEnd.setHours(0, 0, 0, 0);

    if (dateOnly >= holidayStart && dateOnly <= holidayEnd) {
      return false;
    }
  }

  return true;
}

/**
 * Count natural calendar days between two dates (inclusive)
 * Useful for "natural days" vacation calculation mode
 * 
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @returns number - Total days between dates, minimum 1
 * 
 * @example
 * // Jan 5 to Jan 7 = 3 days
 * countNaturalDays(new Date('2025-01-05'), new Date('2025-01-07'));  // returns 3
 */
export function countNaturalDays(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normalize to midnight to avoid time zone issues
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (end < start) {
    throw new Error("endDate must be greater than or equal to startDate");
  }

  // Calculate difference in milliseconds, convert to days, add 1 for inclusive count
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // +1 because we want inclusive count (both start and end included)
}

/**
 * Count working days between two dates (exclusive of weekends and holidays)
 * Useful for "working days" vacation calculation mode
 * 
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @param workingDays - Array of day numbers (0-6) that are working days. Default: [1,2,3,4,5]
 * @param holidays - Array of CustomHoliday objects to exclude. Default: []
 * @returns number - Count of working days, minimum 1 if start/end dates are working days
 * 
 * @example
 * // Jan 6 (Mon) to Jan 10 (Fri) with no holidays = 5 days
 * countWorkingDays(
 *   new Date('2025-01-06'),
 *   new Date('2025-01-10'),
 *   [1,2,3,4,5],
 *   []
 * );  // returns 5
 * 
 * @example
 * // Jan 17 (Fri) to Jan 21 (Tue) spanning weekend = 3 days
 * countWorkingDays(
 *   new Date('2025-01-17'),
 *   new Date('2025-01-21'),
 *   [1,2,3,4,5],
 *   []
 * );  // returns 3 (17=Fri, 20=Mon, 21=Tue)
 */
export function countWorkingDays(
  startDate: Date,
  endDate: Date,
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: HolidayRange[] = []
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normalize to midnight
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (end < start) {
    throw new Error("endDate must be greater than or equal to startDate");
  }

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    if (isWorkingDay(current, workingDays, holidays)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Get all holidays within a date range
 * Useful for filtering and display purposes
 * 
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @param holidays - Array of CustomHoliday objects
 * @returns CustomHoliday[] - Holidays that fall within the range
 */
export function getHolidaysInRange(
  startDate: Date,
  endDate: Date,
  holidays: HolidayRange[] = []
): HolidayRange[] {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return holidays.filter((holiday) => {
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);
    holidayStart.setHours(0, 0, 0, 0);
    holidayEnd.setHours(0, 0, 0, 0);

    // Check if holiday overlaps with range
    return !(holidayEnd < start || holidayStart > end);
  });
}

/**
 * Calculate vacation days based on mode
 * Wrapper function that uses the appropriate calculation method
 * 
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @param mode - "natural" or "working"
 * @param workingDays - Array of working day numbers. Default: [1,2,3,4,5]
 * @param holidays - Array of CustomHoliday objects. Default: []
 * @returns number - Total vacation days
 */
export function calculateVacationDaysForRange(
  startDate: Date,
  endDate: Date,
  mode: "natural" | "working" = "natural",
  workingDays: number[] = [1, 2, 3, 4, 5],
  holidays: HolidayRange[] = []
): number {
  if (mode === "working") {
    return countWorkingDays(startDate, endDate, workingDays, holidays);
  } else {
    return countNaturalDays(startDate, endDate);
  }
}

/**
 * Expand vacation dates to include complete weekends when in natural days mode
 * This ensures that if an employee requests Mon-Fri, they get the weekend too (7 natural days)
 * 
 * Examples:
 * - Mon Jan 6 to Fri Jan 10 → Fri Jan 3 to Sun Jan 12 (includes full week)
 * - Fri Jan 10 to Mon Jan 13 → Fri Jan 10 to Mon Jan 13 (already spans weekend)
 * - Single day Wed Jan 8 → Mon Jan 6 to Fri Jan 10 (full work week)
 * 
 * @param startDate - Start date of requested vacation
 * @param endDate - End date of requested vacation
 * @param workingDays - Array of working day numbers (default [1,2,3,4,5] = Mon-Fri)
 * @returns Object with expanded startDate and endDate
 */
export function expandDatesToIncludeWeekends(
  startDate: Date,
  endDate: Date,
  workingDays: number[] = [1, 2, 3, 4, 5]
): { startDate: Date; endDate: Date } {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Normalize to midnight
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const expandedStart = new Date(start);
  const expandedEnd = new Date(end);

  // In natural-day mode, a request ending on Friday should include Saturday and Sunday.
  // If it already ends on Saturday, include Sunday.
  const endDay = expandedEnd.getDay();
  if (endDay === 5) {
    expandedEnd.setDate(expandedEnd.getDate() + 2);
  } else if (endDay === 6) {
    expandedEnd.setDate(expandedEnd.getDate() + 1);
  }

  return { startDate: expandedStart, endDate: expandedEnd };
}
