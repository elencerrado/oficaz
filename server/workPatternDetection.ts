// Work Pattern Detection Module
// Analyzes employee work history to detect natural work patterns
// Used to determine if employee should have clocked in today

import { db } from './db.js';
import { workSessions, users } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { WorkSession } from '@shared/schema';

interface DayPattern {
  entry?: number; // Hour.minutes as decimal (e.g., 9.25 = 9:15)
  exit?: number;
  frequency: number; // Count of days this pattern appeared
}

interface WorkPattern {
  [dayOfWeek: number]: DayPattern; // 0-6
  last_updated: string;
  reliability: number; // 0-1, indicates pattern consistency
  analysis_days: number;
}

export interface EmployeeClockingStatus {
  employeeId: number;
  name: string;
  date: string;
  status: 'completed' | 'incomplete' | 'not_clocked_in' | 'not_scheduled' | 'absent';
  expectedEntryTime?: string;
  actualEntryTime?: string;
  expectedExitTime?: string;
  actualExitTime?: string;
  hoursWorked?: number;
  timeSinceExpected?: number; // minutes
}

/**
 * Detects work patterns from historical data
 * Analyzes last 30-60 days to find when employee typically works and at what times
 */
export async function detectEmployeeWorkPattern(
  userId: number,
  analysisDays: number = 60
): Promise<WorkPattern | null> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - analysisDays);
    startDate.setHours(0, 0, 0, 0);

    // Fetch sessions within analysis period
    const sessions = await db
      .select()
      .from(workSessions)
      .where(
        and(
          eq(workSessions.userId, userId),
          gte(workSessions.clockIn, startDate)
        )
      );

    if (sessions.length < 5) {
      // Not enough data for reliable pattern
      return null;
    }

    // Group by day of week
    const dayPatterns: { [key: number]: { entries: number[]; exits: number[] } } = {};

    sessions.forEach((session) => {
      const date = new Date(session.clockIn);
      const dayOfWeek = date.getDay();

      if (!dayPatterns[dayOfWeek]) {
        dayPatterns[dayOfWeek] = { entries: [], exits: [] };
      }

      // Convert to decimal hours (9.25 = 9:15)
      const entryHour =
        date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
      dayPatterns[dayOfWeek].entries.push(entryHour);

      if (session.clockOut) {
        const exitDate = new Date(session.clockOut);
        const exitHour =
          exitDate.getHours() +
          exitDate.getMinutes() / 60 +
          exitDate.getSeconds() / 3600;
        dayPatterns[dayOfWeek].exits.push(exitHour);
      }
    });

    // Calculate pattern for each day (using median for robustness)
    const pattern: WorkPattern = {
      last_updated: new Date().toISOString(),
      reliability: 0,
      analysis_days: analysisDays,
    };

    let totalDays = 0;
    let consistentDays = 0;

    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      if (!dayPatterns[dayOfWeek] || dayPatterns[dayOfWeek].entries.length === 0) {
        // Employee doesn't work this day
        pattern[dayOfWeek] = { frequency: 0 };
      } else {
        const { entries, exits } = dayPatterns[dayOfWeek];
        const entryMedian = median(entries);
        const exitMedian = exits.length > 0 ? median(exits) : undefined;
        const frequency = entries.length;

        pattern[dayOfWeek] = {
          entry: entryMedian,
          exit: exitMedian,
          frequency: frequency,
        };

        // Calculate consistency score (variance of times)
        const entryVariance = calculateVariance(entries);
        if (entryVariance < 1.0) {
          // Less than 1 hour variance = consistent
          consistentDays++;
        }
        totalDays++;
      }
    }

    // Reliability score: how consistent is the pattern
    pattern.reliability =
      totalDays > 0 ? Math.max(0, Math.min(1, consistentDays / totalDays)) : 0;

    return pattern;
  } catch (error) {
    console.error('Error detecting work pattern:', error);
    return null;
  }
}

/**
 * Updates detected pattern in database
 */
export async function updateDetectedPattern(userId: number): Promise<void> {
  const pattern = await detectEmployeeWorkPattern(userId);

  if (pattern) {
    await db
      .update(users)
      .set({
        detectedWorkPattern: pattern,
        lastPatternAnalysis: new Date(),
      })
      .where(eq(users.id, userId));
  }
}

/**
 * Determines if employee should have worked today based on:
 * 1. Company global schedule
 * 2. Employee's detected pattern
 * 3. Absence records
 */
export async function shouldEmployeeWorkToday(
  userId: number,
  companyId: number,
  today: Date
): Promise<boolean> {
  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user || user.length === 0) return false;

    const employee = user[0];
    const dayOfWeek = today.getDay();

    // Check if employee has absence today
    // TODO: Check vacations, sick leave, etc.

    // Get employee's detected pattern
     let pattern = employee.detectedWorkPattern as WorkPattern | null;

     // If no pattern exists or pattern is stale, detect it now
     if (!pattern || !pattern.last_updated) {
       console.log(`🔍 Detecting pattern for employee ${userId}`);
       pattern = await detectEmployeeWorkPattern(userId);
       
               if (pattern) {
                 pattern.last_updated = new Date().toISOString();
               }
       
       if (pattern) {
         await db
           .update(users)
           .set({
             detectedWorkPattern: pattern,
             lastPatternAnalysis: new Date(),
           })
           .where(eq(users.id, userId));
       }
     } else {
       // Refresh if older than 7 days
       const lastUpdate = new Date(pattern.last_updated);
       const daysSinceUpdate = Math.floor((today.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
       
       if (daysSinceUpdate > 7) {
         const newPattern = await detectEmployeeWorkPattern(userId);
         if (newPattern) {
           pattern = newPattern;
                     pattern.last_updated = new Date().toISOString();
           await db
             .update(users)
             .set({
               detectedWorkPattern: pattern,
               lastPatternAnalysis: new Date(),
             })
             .where(eq(users.id, userId));
         }
       }
     }

    if (pattern && pattern[dayOfWeek]) {
      const dayPattern = pattern[dayOfWeek];
      // If frequency is 0, employee doesn't work this day
      if (dayPattern.frequency === 0) {
        return false;
      }
    }

    // Get company global schedule for this day
    // const schedule = await getCompanyScheduleForDay(companyId, dayOfWeek);
    // if (schedule && !schedule.isWorkingDay) return false;

    return true;
  } catch (error) {
    console.error('Error checking if employee should work:', error);
    return true; // Default to true to avoid hiding missing clocks
  }
}

/**
 * Helper: Calculate median of array
 */
function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Helper: Calculate variance (standard deviation squared)
 */
function calculateVariance(arr: number[]): number {
  if (arr.length < 2) return 0;

  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const squareDiffs = arr.map((value) => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / arr.length;

  return Math.sqrt(avgSquareDiff); // Return std dev for easier interpretation
}

/**
 * Format decimal hours to HH:MM
 */
export function decimalHoursToTime(hours: number): string {
  if (!hours && hours !== 0) return '--:--';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
