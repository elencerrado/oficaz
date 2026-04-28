/**
 * Incomplete Session Weekly Reminder Scheduler
 * 
 * Sends weekly email reminders to employees with incomplete work sessions.
 * 
 * Features:
 * - Runs every Monday at 9:00 AM (Spain time)
 * - Sends reminder emails to users with incomplete sessions from the past week
 * - Groups incomplete sessions by user
 * - Includes instructions for closing sessions in employee mode
 * - Batch processing to prevent server overload
 * - Uses existing email queue system
 * - Tracks sent reminders to avoid duplicates within the same week
 * 
 * Schedule: Every Monday at 9:00 AM
 */

import { db } from './db';
import { sql, eq, and, isNull } from 'drizzle-orm';
import { workSessions, users, companies, incompleteSessionWeeklyReminders } from '../shared/schema.js';
import { queueEmail } from './emailQueue.js';
import cron from 'node-cron';

const SPAIN_TIMEZONE = 'Europe/Madrid';
const WEEKLY_REMINDER_LOCK_NAMESPACE = 94821;
let isSchedulerInitialized = false;

// Throttling configuration
const MAX_EMAILS_PER_BATCH = 50; // Send max 50 emails at a time
const BATCH_DELAY_MS = 2000; // Wait 2 seconds between batches

interface UserWithIncompleteSessions {
  userId: number;
  userName: string;
  userEmail: string;
  userPersonalEmail: string | null;
  companyId: number;
  companyName: string;
  companyAlias: string;
  incompleteSessions: Array<{
    id: number;
    clockIn: Date;
    hoursElapsed: number;
  }>;
}

/**
 * Get all users with incomplete sessions from the past week
 */
async function getUsersWithIncompleteSessions(): Promise<UserWithIncompleteSessions[]> {
  // Calculate date range: from 7 days ago to now
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get all incomplete sessions from the past week
  const result = await db.select({
    sessionId: workSessions.id,
    userId: users.id,
    userName: users.fullName,
    userEmail: users.companyEmail,
    userPersonalEmail: users.personalEmail,
    companyId: companies.id,
    companyName: companies.name,
    companyAlias: companies.companyAlias,
    clockIn: workSessions.clockIn,
  })
    .from(workSessions)
    .innerJoin(users, eq(workSessions.userId, users.id))
    .innerJoin(companies, eq(users.companyId, companies.id))
    .where(and(
      isNull(workSessions.clockOut),
      sql`${workSessions.clockIn} >= ${sevenDaysAgo}`,
      // Never notify about an active session started today in Spain time.
      sql`${workSessions.clockIn} < (date_trunc('day', timezone(${SPAIN_TIMEZONE}, now())) AT TIME ZONE ${SPAIN_TIMEZONE})`,
      eq(companies.isDeleted, false),
      eq(users.role, 'employee') // Only employees
    ))
    .orderBy(users.id, workSessions.clockIn);

  // Group sessions by user
  const userMap = new Map<number, UserWithIncompleteSessions>();

  for (const row of result) {
    // Skip if user has no email
    if (!row.userEmail && !row.userPersonalEmail) {
      console.warn(`⚠️  Skipping user ${row.userId} - no email found`);
      continue;
    }

    const hoursElapsed = (now.getTime() - new Date(row.clockIn!).getTime()) / (1000 * 60 * 60);

    if (!userMap.has(row.userId)) {
      userMap.set(row.userId, {
        userId: row.userId,
        userName: row.userName,
        userEmail: row.userEmail || '',
        userPersonalEmail: row.userPersonalEmail,
        companyId: row.companyId,
        companyName: row.companyName,
        companyAlias: row.companyAlias,
        incompleteSessions: []
      });
    }

    userMap.get(row.userId)!.incompleteSessions.push({
      id: row.sessionId,
      clockIn: new Date(row.clockIn!),
      hoursElapsed
    });
  }

  return Array.from(userMap.values());
}

/**
 * Reserve reminder slot atomically to avoid duplicates across concurrent instances.
 * Returns reminder row ID if slot was reserved, otherwise null.
 */
async function reserveWeeklyReminderSlot(user: UserWithIncompleteSessions): Promise<number | null> {
  return db.transaction(async (tx) => {
    const lockResult = await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(${WEEKLY_REMINDER_LOCK_NAMESPACE}, ${user.userId}) AS locked`
    );
    const isLocked = Boolean((lockResult.rows[0] as any)?.locked);

    if (!isLocked) {
      return null;
    }

    const existingThisWeek = await tx.select({ id: incompleteSessionWeeklyReminders.id })
      .from(incompleteSessionWeeklyReminders)
      .where(and(
        eq(incompleteSessionWeeklyReminders.userId, user.userId),
        sql`${incompleteSessionWeeklyReminders.sentAt} >= (date_trunc('week', timezone(${SPAIN_TIMEZONE}, now())) AT TIME ZONE ${SPAIN_TIMEZONE})`
      ))
      .limit(1);

    if (existingThisWeek.length > 0) {
      return null;
    }

    const inserted = await tx.insert(incompleteSessionWeeklyReminders)
      .values({
        userId: user.userId,
        companyId: user.companyId,
        sessionCount: user.incompleteSessions.length,
        emailQueueId: null,
        sentAt: new Date(),
      })
      .returning({ id: incompleteSessionWeeklyReminders.id });

    return inserted[0]?.id ?? null;
  });
}

/**
 * Send reminder email for incomplete sessions
 */
async function sendReminderEmail(user: UserWithIncompleteSessions): Promise<number | null> {
  try {
    // Use personal email if available, otherwise company email
    const toEmail = user.userPersonalEmail || user.userEmail;
    
    if (!toEmail) {
      console.error(`❌ No email found for user ${user.userId}`);
      return null;
    }

    // Build login URL
    const loginUrl = `${process.env.VITE_APP_URL || 'http://localhost:5000'}/${user.companyAlias}/inicio`;
    const timeTrackingUrl = `${process.env.VITE_APP_URL || 'http://localhost:5000'}/${user.companyAlias}/employee/misfichajes`;

    // Sort sessions by clockIn (oldest first)
    const sortedSessions = [...user.incompleteSessions].sort((a, b) => 
      a.clockIn.getTime() - b.clockIn.getTime()
    );

    // Queue the email
    const emailId = await queueEmail({
      userId: user.userId,
      toEmail,
      toName: user.userName,
      subject: user.incompleteSessions.length === 1 
        ? '⏰ Tienes 1 sesión de trabajo sin cerrar'
        : `⏰ Tienes ${user.incompleteSessions.length} sesiones de trabajo sin cerrar`,
      templateType: 'incomplete_session_weekly_reminder',
      templateData: {
        userName: user.userName,
        sessionCount: user.incompleteSessions.length,
        sessions: sortedSessions.map(s => ({
          clockInDate: s.clockIn.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          clockInTime: s.clockIn.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          hoursElapsed: Math.round(s.hoursElapsed)
        })),
        loginUrl,
        timeTrackingUrl,
        isEmployee: true
      },
      companyId: user.companyId,
      priority: 4, // Medium priority
    });

    console.log(`📧 Weekly reminder queued for user ${user.userId} (${user.userName}) with ${user.incompleteSessions.length} incomplete session(s) - email queue ID: ${emailId}`);

    return emailId;
  } catch (error) {
    console.error(`❌ Error queueing reminder for user ${user.userId}:`, error);
    return null;
  }
}

/**
 * Record that a reminder was sent
 */
async function recordReminderSent(
  reminderId: number,
  emailQueueId: number | null
): Promise<void> {
  await db.update(incompleteSessionWeeklyReminders)
    .set({
      emailQueueId,
    })
    .where(eq(incompleteSessionWeeklyReminders.id, reminderId));
}

async function releaseReservedReminder(reminderId: number): Promise<void> {
  await db.delete(incompleteSessionWeeklyReminders)
    .where(eq(incompleteSessionWeeklyReminders.id, reminderId));
}

/**
 * Process reminders in batches with throttling
 */
async function processRemindersInBatches(
  usersToNotify: UserWithIncompleteSessions[]
): Promise<void> {
  const batches: typeof usersToNotify[] = [];
  
  // Split into batches
  for (let i = 0; i < usersToNotify.length; i += MAX_EMAILS_PER_BATCH) {
    batches.push(usersToNotify.slice(i, i + MAX_EMAILS_PER_BATCH));
  }

  console.log(`📧 Processing ${usersToNotify.length} reminders in ${batches.length} batch(es)`);

  // Process each batch with delay between batches
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    
    console.log(`📧 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} reminders)`);

    // Process all reminders in this batch in parallel
    const batchPromises = batch.map(async (user) => {
      try {
        const reminderId = await reserveWeeklyReminderSlot(user);
        if (!reminderId) {
          console.log(`⏭️  User ${user.userId} (${user.userName}) already reserved/notified this week, skipping`);
          return;
        }

        const emailQueueId = await sendReminderEmail(user);
        if (!emailQueueId) {
          await releaseReservedReminder(reminderId);
          console.warn(`⚠️ Weekly reminder for user ${user.userId} (${user.userName}) was not queued. Reservation released for retry.`);
          return;
        }

        await recordReminderSent(reminderId, emailQueueId);
      } catch (error) {
        console.error(`❌ Error processing reminder for user ${user.userId}:`, error);
      }
    });

    await Promise.all(batchPromises);

    // Wait before processing next batch (except for last batch)
    if (batchIndex < batches.length - 1) {
      console.log(`⏳ Waiting ${BATCH_DELAY_MS}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }
}

/**
 * Main function: Check and send incomplete session reminders
 */
export async function checkAndSendIncompleteSessionReminders(): Promise<void> {
  console.log('\n⏰ ====== INCOMPLETE SESSION WEEKLY REMINDER CHECK ======');
  console.log(`⏰ Started at: ${new Date().toISOString()}`);

  try {
    // Get all users with incomplete sessions from the past week
    const usersWithIncompleteSessions = await getUsersWithIncompleteSessions();
    console.log(`📊 Found ${usersWithIncompleteSessions.length} user(s) with incomplete sessions from the past week`);

    if (usersWithIncompleteSessions.length === 0) {
      console.log('✅ No users with incomplete sessions found. Exiting.');
      return;
    }

    // Process reminders in batches
    await processRemindersInBatches(usersWithIncompleteSessions);

    console.log(`✅ Reminder check completed successfully`);
    console.log(`📊 Summary: processing attempted for ${usersWithIncompleteSessions.length} user(s)`);

  } catch (error) {
    console.error('❌ Error in incomplete session reminder scheduler:', error);
    throw error;
  }
}

/**
 * Initialize the scheduler (called from server startup)
 */
export function initializeIncompleteSessionWeeklyReminderScheduler(): void {
  if (isSchedulerInitialized) {
    console.warn('⚠️ Incomplete session weekly reminder scheduler already initialized. Skipping duplicate init.');
    return;
  }

  isSchedulerInitialized = true;

  console.log('⏰ Initializing Incomplete Session Weekly Reminder Scheduler');
  console.log(`⏰ Schedule: Every Monday at 9:00 AM (Spain time)`);
  console.log(`📬 Batch size: ${MAX_EMAILS_PER_BATCH} emails`);
  console.log(`⏱️  Batch delay: ${BATCH_DELAY_MS}ms`);

  // Schedule to run every Monday at 9:00 AM (Spain time) 
  // Cron format: minute hour day-of-month month day-of-week
  // '0 9 * * 1' = 9:00 AM every Monday
  const cronSchedule = '0 9 * * 1';

  cron.schedule(cronSchedule, () => {
    console.log('⏰ Triggered: Incomplete Session Weekly Reminder');
    checkAndSendIncompleteSessionReminders().catch(err => {
      console.error('❌ Error in scheduled incomplete session reminder check:', err);
    });
  }, {
    timezone: 'Europe/Madrid',
    scheduled: true
  } as any);

  console.log('✅ Incomplete Session Weekly Reminder Scheduler initialized');
  console.log('ℹ️  Next run: Next Monday at 9:00 AM (Spain time)');

  // Optionally run immediately on startup for testing (comment out in production)
  // checkAndSendIncompleteSessionReminders().catch(err => {
  //   console.error('❌ Error in initial reminder check:', err);
  // });
}
