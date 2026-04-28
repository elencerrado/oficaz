import webpush from 'web-push';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';
import { db } from './db';
import { eq, and, isNull, sql, lte, inArray, gte, lt } from 'drizzle-orm';
import { workAlarms, pushSubscriptions, workSessions, breakPeriods, users, reminders, systemNotifications, documents } from '@shared/schema';
import { JWT_SECRET } from './utils/jwt-secret.js';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { callInternalAutomationEndpoint, getInternalServerBaseUrl } from './internalAutomationClient';

type ScheduledTask = ReturnType<typeof cron.schedule>;

interface AlarmCheck {
  alarmId: number;
  userId: number;
  title: string;
  type: 'clock_in' | 'clock_out';
  time: string;
  lastChecked: Date;
}

interface WorkStatusButton {
  action: string;
  title: string;
  icon?: string;
}

interface WorkStatus {
  status: string;
  sessionId?: number;
  breakId?: number;
  buttons: WorkStatusButton[];
}

const checkedAlarms = new Map<string, Date>();
const sentIncompleteSessionNotifications = new Map<string, Date>(); // Track daily incomplete session notifications
const scheduledAlarmTimeouts = new Map<number, NodeJS.Timeout>(); // Store alarm timeouts for cleanup
const scheduledReminderTimeouts = new Map<number, NodeJS.Timeout>(); // Store reminder timeouts for cleanup (event-driven)

interface AlarmPushJob {
  userId: number;
  title: string;
  alarmType: 'clock_in' | 'clock_out';
  alarmId: number;
  enqueuedAt: number;
}

const alarmPushQueue: AlarmPushJob[] = [];
const pendingAlarmPushKeys = new Set<string>();
const alarmNoSubscriptionLog = new Map<number, number>();
let alarmPushWorkersRunning = 0;

const ALARM_PUSH_CONCURRENCY = Math.min(
  100,
  Math.max(10, Number(process.env.ALARM_PUSH_CONCURRENCY || 35))
);
const NO_SUBSCRIPTION_LOG_INTERVAL_MS = 30 * 60 * 1000;
const EMAIL_DEBUG_LOGS_ENABLED = process.env.OFICAZ_EMAIL_DEBUG === 'true';

function maskEmail(email?: string | null): string {
  if (!email) return 'none';
  const [local, domain] = email.split('@');
  if (!domain) return 'invalid-email';
  if (local.length <= 2) return `***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function emailDebug(message: string, details?: Record<string, unknown>): void {
  if (!EMAIL_DEBUG_LOGS_ENABLED) return;
  if (details) {
    console.debug(`📧 [EMAIL DEBUG] ${message}`, details);
    return;
  }
  console.debug(`📧 [EMAIL DEBUG] ${message}`);
}

function enqueueAlarmPush(job: Omit<AlarmPushJob, 'enqueuedAt'>): void {
  const dedupeKey = `${job.alarmId}-${job.userId}`;
  if (pendingAlarmPushKeys.has(dedupeKey)) {
    return;
  }

  pendingAlarmPushKeys.add(dedupeKey);
  alarmPushQueue.push({ ...job, enqueuedAt: Date.now() });
  scheduleAlarmPushWorkers();
}

function scheduleAlarmPushWorkers(): void {
  while (alarmPushWorkersRunning < ALARM_PUSH_CONCURRENCY && alarmPushQueue.length > 0) {
    alarmPushWorkersRunning++;

    const nextJob = alarmPushQueue.shift();
    if (!nextJob) {
      alarmPushWorkersRunning--;
      return;
    }

    const dedupeKey = `${nextJob.alarmId}-${nextJob.userId}`;

    void sendPushNotification(nextJob.userId, nextJob.title, nextJob.alarmType, nextJob.alarmId)
      .catch((error) => {
        console.error(`❌ Alarm push worker error for alarm ${nextJob.alarmId}, user ${nextJob.userId}:`, error);
      })
      .finally(() => {
        pendingAlarmPushKeys.delete(dedupeKey);
        alarmPushWorkersRunning--;
        scheduleAlarmPushWorkers();
      });
  }
}

// Helper: Calculate next trigger time for an alarm
function calculateNextAlarmTime(alarmTime: string, weekdays: number[]): Date {
  const [hours, minutes] = alarmTime.split(':').map(Number);
  const now = getSpainTime();
  
  // Start with today
  let nextDate = new Date(now);
  nextDate.setHours(hours, minutes, 0, 0);
  
  // If today's time has already passed, start from tomorrow
  if (nextDate <= now) {
    nextDate.setDate(nextDate.getDate() + 1);
  }
  
  // Find the next day that matches the weekdays
  let daysToCheck = 0;
  while (daysToCheck < 7) {
    const dayOfWeek = nextDate.getDay() === 0 ? 7 : nextDate.getDay();
    if (weekdays.includes(dayOfWeek)) {
      break;
    }
    nextDate.setDate(nextDate.getDate() + 1);
    daysToCheck++;
  }
  
  return nextDate;
}

// Schedule a single alarm with setTimeout
function scheduleAlarm(alarm: typeof workAlarms.$inferSelect): void {
  // Clear any existing timeout for this alarm
  if (scheduledAlarmTimeouts.has(alarm.id)) {
    clearTimeout(scheduledAlarmTimeouts.get(alarm.id)!);
  }
  
  const nextTime = calculateNextAlarmTime(alarm.time, alarm.weekdays);
  const delayMs = nextTime.getTime() - getSpainTime().getTime();
  
  if (delayMs > 0) {
    const timeout = setTimeout(async () => {
      try {
        console.log(`⏰ ALARM TRIGGERED: ${alarm.title} for user ${alarm.userId} at ${alarm.time}`);
        enqueueAlarmPush({
          userId: alarm.userId,
          title: alarm.title,
          alarmType: alarm.type as 'clock_in' | 'clock_out',
          alarmId: alarm.id,
        });
        
        // Reschedule for next occurrence
        scheduleAlarm(alarm);
      } catch (error) {
        console.error(`❌ Error triggering alarm ${alarm.id}:`, error);
        // Retry in 1 minute
        const retryTimeout = setTimeout(() => scheduleAlarm(alarm), 60000);
        scheduledAlarmTimeouts.set(alarm.id, retryTimeout);
      }
    }, delayMs);
    
    scheduledAlarmTimeouts.set(alarm.id, timeout);
    if (process.env.DEBUG_ALARMS) {
      console.log(`⏳ Scheduled alarm ${alarm.id} (${alarm.title}) for ${nextTime.toLocaleString('es-ES')}`);
    }
  }
}

// Load and schedule all active alarms
async function loadAndScheduleAllAlarms(): Promise<void> {
  try {
    const activeAlarms = await db.select()
      .from(workAlarms)
      .where(eq(workAlarms.isActive, true));
    
    if (process.env.DEBUG_SCHEDULER) {
      console.log(`📍 Loading ${activeAlarms.length} active alarm(s)...`);
    }
    
    // 🔒 CRITICAL: Clear all existing alarm timeouts before reloading
    // Prevents duplicate alarms if loadAndScheduleAllAlarms is called multiple times
    for (const [alarmId, timeout] of scheduledAlarmTimeouts.entries()) {
      clearTimeout(timeout);
      scheduledAlarmTimeouts.delete(alarmId);
    }
    
    for (const alarm of activeAlarms) {
      scheduleAlarm(alarm);
    }
  } catch (error) {
    console.error('❌ Error loading alarms:', error);
  }
}

// Public function to reload alarms (call after create/update)
export async function reloadAlarms(): Promise<void> {
  console.log(`🔄 Reloading alarms (triggered by create/update)...`);
  
  // Clear all existing timeouts
  for (const timeout of scheduledAlarmTimeouts.values()) {
    clearTimeout(timeout);
  }
  scheduledAlarmTimeouts.clear();
  
  // Reload all alarms
  await loadAndScheduleAllAlarms();
}

// ===== EVENT-DRIVEN REMINDERS (no polling) =====

// Schedule a single reminder with setTimeout (like alarms)
function scheduleReminder(reminder: typeof reminders.$inferSelect): void {
  // Clear any existing timeout for this reminder
  if (scheduledReminderTimeouts.has(reminder.id)) {
    clearTimeout(scheduledReminderTimeouts.get(reminder.id)!);
  }
  
  // Skip if:
  // - No date set
  // - Already notified
  // - Completed or archived
  // - Notifications disabled
  if (!reminder.reminderDate || 
      reminder.notificationShown || 
      reminder.isCompleted || 
      reminder.isArchived || 
      !reminder.enableNotifications) {
    return;
  }
  
  const nowSpain = getSpainTime();
  const delayMs = new Date(reminder.reminderDate).getTime() - nowSpain.getTime();
  
  // Only schedule if in the future
  if (delayMs > 0) {
    const timeout = setTimeout(async () => {
      try {
        console.log(`🔔 REMINDER TRIGGERED: "${reminder.title}" (ID: ${reminder.id})`);
        
        // Get all assigned users (or just creator if no assignments)
        const userIds = reminder.assignedUserIds && reminder.assignedUserIds.length > 0
          ? reminder.assignedUserIds
          : [reminder.userId];
        
        // Send notification to each assigned user
        for (const userId of userIds) {
          const subscriptions = await db.select()
            .from(pushSubscriptions)
            .where(eq(pushSubscriptions.userId, userId));
          
          if (subscriptions.length === 0) continue;
          
          // Filter to unique devices
          const deviceMap = new Map<string, typeof subscriptions[0]>();
          for (const sub of subscriptions) {
            const deviceKey = sub.deviceId || sub.endpoint;
            const existing = deviceMap.get(deviceKey);
            if (!existing || new Date(sub.updatedAt) > new Date(existing.updatedAt)) {
              deviceMap.set(deviceKey, sub);
            }
          }
          
          const uniqueSubscriptions = Array.from(deviceMap.values());
          
          const payload = JSON.stringify({
            title: 'Recordatorio',
            body: reminder.title,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [200, 100, 200],
            requireInteraction: true,
            tag: `reminder-due-${reminder.id}`,
            data: {
              url: '/employee',
              type: 'reminder_due',
              timestamp: Date.now(),
              userId,
              reminderId: reminder.id
            },
            actions: [
              { action: 'view', title: 'Ver recordatorio', icon: '/icon-192.png' }
            ]
          });
          
          // Send to all unique devices
          for (const sub of uniqueSubscriptions) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                  }
                },
                payload
              );
              console.log(`✅ Reminder notification sent to user ${userId}`);
            } catch (error: any) {
              if (error.statusCode === 410 || error.statusCode === 404) {
                console.log(`🗑️  Removing invalid subscription for user ${userId}`);
                await db.delete(pushSubscriptions)
                  .where(eq(pushSubscriptions.endpoint, sub.endpoint));
              } else {
                console.error(`❌ Error sending reminder notification to user ${userId}:`, error);
              }
            }
          }
        }
        
        // Mark reminder as notified
        await db.update(reminders)
          .set({ notificationShown: true })
          .where(eq(reminders.id, reminder.id));
        
        console.log(`✅ Marked reminder ${reminder.id} as notified`);
        
        // Remove from scheduled timeouts
        scheduledReminderTimeouts.delete(reminder.id);
      } catch (error) {
        console.error(`❌ Error triggering reminder ${reminder.id}:`, error);
        // Retry in 1 minute
        const retryTimeout = setTimeout(() => scheduleReminder(reminder), 60000);
        scheduledReminderTimeouts.set(reminder.id, retryTimeout);
      }
    }, delayMs);
    
    scheduledReminderTimeouts.set(reminder.id, timeout);
    if (process.env.DEBUG_SCHEDULER) {
      console.log(`⏳ Scheduled reminder ${reminder.id} ("${reminder.title}") for ${new Date(reminder.reminderDate).toLocaleString('es-ES')}`);
    }
  }
}

// Load and schedule all future reminders
async function loadAndScheduleAllReminders(): Promise<void> {
  try {
    const nowSpain = getSpainTime();
    
    // Get all future reminders that:
    // - Have notifications enabled
    // - Haven't been notified yet
    // - Are not completed or archived
    // - Have a date in the future
    const futureReminders = await db.select()
      .from(reminders)
      .where(
        and(
          eq(reminders.enableNotifications, true),
          eq(reminders.notificationShown, false),
          eq(reminders.isCompleted, false),
          eq(reminders.isArchived, false),
          gte(reminders.reminderDate, nowSpain)
        )
      );
    
    if (process.env.DEBUG_SCHEDULER) {
      console.log(`📍 Loading ${futureReminders.length} future reminder(s) for event-driven scheduling...`);
    }
    
    for (const reminder of futureReminders) {
      scheduleReminder(reminder);
    }
  } catch (error) {
    console.error('❌ Error loading reminders:', error);
  }
}

// Public function to reload reminders (call after create/update/delete)
export async function reloadReminders(): Promise<void> {
  console.log(`🔄 Reloading reminders (triggered by create/update)...`);
  
  // Clear all existing timeouts
  for (const timeout of scheduledReminderTimeouts.values()) {
    clearTimeout(timeout);
  }
  scheduledReminderTimeouts.clear();
  
  // Reload all reminders
  await loadAndScheduleAllReminders();
}

// Auto-process expired trials every 5 minutes
const INTERNAL_SERVER_BASE_URL = getInternalServerBaseUrl();

async function processExpiredTrials(): Promise<void> {
  try {
    const response = await callInternalAutomationEndpoint('/api/subscription/auto-trial-process');
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error(`❌ Auto-trial processing error: HTTP ${response.status} - ${errorText}`);
      return;
    }
    
    const result = await response.json();
    if (result.processedCount > 0 || result.errorCount > 0) {
      console.log(`🏦 AUTO-TRIAL SCHEDULER: ${result.processedCount} processed, ${result.errorCount} errors`);
    }
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Auto-trial scheduler skipped this cycle (${INTERNAL_SERVER_BASE_URL}) - ${message}`);
  }
}

// Auto-process scheduled deletions (companies past 30-day grace period) - runs every hour
async function processScheduledDeletions(): Promise<void> {
  try {
    const response = await callInternalAutomationEndpoint('/api/account/auto-deletion-process');
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error(`❌ Auto-deletion processing error: HTTP ${response.status} - ${errorText}`);
      return;
    }
    
    const result = await response.json();
    if (result.deletedCount > 0 || result.errorCount > 0) {
      console.log(`🗑️ AUTO-DELETION SCHEDULER: ${result.deletedCount} deleted, ${result.errorCount} errors`);
    }
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ Auto-deletion scheduler skipped this cycle (${INTERNAL_SERVER_BASE_URL}) - ${message}`);
  }
}

// 🔒 CRITICAL iOS SAFARI BUG WORKAROUND: Prevent duplicate push sends within 10 seconds
// Maps "userId-endpoint-notificationType-minute" -> timestamp of last send
const recentPushSends = new Map<string, number>();
const PUSH_SEND_THROTTLE_MS = 10000; // 10 seconds

// ⚠️ CRITICAL: Spain timezone constant - ALL time comparisons must use this
const SPAIN_TZ = 'Europe/Madrid';

// Helper: Get current time in Spain timezone
function getSpainTime(): Date {
  return toZonedTime(new Date(), SPAIN_TZ);
}

// Helper function to check if alarm should trigger now
// 🔧 IMPROVED: Added 5-minute tolerance window for missed alarms (server sleep/restart)
function shouldTriggerAlarm(alarmTime: string, weekdays: number[]): boolean {
  const now = getSpainTime(); // ⚠️ CRITICAL: Use Spain time, not server UTC
  const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // Convert Sunday from 0 to 7
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Check if today is in the alarm's weekdays
  if (!weekdays.includes(currentDay)) {
    return false;
  }
  
  // Parse alarm time
  const [alarmHour, alarmMinute] = alarmTime.split(':').map(Number);
  
  // Calculate minutes since midnight for both current time and alarm time
  const currentTotalMinutes = currentHour * 60 + currentMinute;
  const alarmTotalMinutes = alarmHour * 60 + alarmMinute;
  
  // Calculate difference
  const minutesDiff = currentTotalMinutes - alarmTotalMinutes;
  
  // Trigger if we're within 0-5 minutes AFTER the alarm time (catch-up window)
  // This handles server restarts and sleep states
  return minutesDiff >= 0 && minutesDiff <= 5;
}

// Get current work status for user
async function getWorkStatus(userId: number): Promise<WorkStatus> {
  try {
    // Get active work session
    const [activeSession] = await db.select()
      .from(workSessions)
      .where(and(
        eq(workSessions.userId, userId),
        eq(workSessions.status, 'active'),
        isNull(workSessions.clockOut)
      ))
      .limit(1);
    
    if (!activeSession) {
      // Not clocked in
      return {
        status: 'not_clocked_in',
        buttons: [
          { action: 'clock_in', title: 'Fichar entrada' }
        ]
      };
    }

    // Check if currently on break
    const [activeBreak] = await db.select()
      .from(breakPeriods)
      .where(and(
        eq(breakPeriods.workSessionId, activeSession.id),
        eq(breakPeriods.status, 'active'),
        isNull(breakPeriods.breakEnd)
      ))
      .limit(1);

    if (activeBreak) {
      // On break
      return {
        status: 'on_break',
        sessionId: activeSession.id,
        breakId: activeBreak.id,
        buttons: [
          { action: 'end_break', title: 'Terminar descanso' }
        ]
      };
    }

    // Clocked in, not on break
    return {
      status: 'clocked_in',
      sessionId: activeSession.id,
      buttons: [
        { action: 'start_break', title: 'Iniciar descanso' },
        { action: 'clock_out', title: 'Fichar salida' }
      ]
    };

  } catch (error) {
    console.error('Error getting work status:', error);
    // Fallback to basic clock in button
    return {
      status: 'unknown',
      buttons: [
        { action: 'clock_in', title: '⏱️ Fichar entrada' }
      ]
    };
  }
}

// Function to send push notification to user
async function sendPushNotification(userId: number, title: string, alarmType: 'clock_in' | 'clock_out', alarmId: number) {
  try {
    // Get all push subscriptions for this user
    const allSubscriptions = await db.select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (allSubscriptions.length === 0) {
      const now = Date.now();
      const lastLog = alarmNoSubscriptionLog.get(userId) || 0;
      if (now - lastLog > NO_SUBSCRIPTION_LOG_INTERVAL_MS) {
        console.log(`📱 No push subscriptions found for user ${userId}`);
        alarmNoSubscriptionLog.set(userId, now);
      }
      return;
    }

    // 🔒 CRITICAL: Send only ONE notification per unique device
    // Group by deviceId and keep only the most recent subscription for each device
    const deviceMap = new Map<string, typeof allSubscriptions[0]>();
    
    for (const sub of allSubscriptions) {
      const deviceKey = sub.deviceId || sub.endpoint; // Use deviceId if available, otherwise endpoint
      const existing = deviceMap.get(deviceKey);
      
      // Keep the most recent subscription for this device
      if (!existing || new Date(sub.updatedAt) > new Date(existing.updatedAt)) {
        deviceMap.set(deviceKey, sub);
      }
    }

    const subscriptions = Array.from(deviceMap.values());
    if (process.env.DEBUG_ALARMS) {
      console.log(`📱 Sending to ${subscriptions.length} unique device(s) (filtered from ${allSubscriptions.length} total subscriptions)`);
    }

    if (subscriptions.length === 0) {
      console.log(`📱 No unique devices found for user ${userId}`);
      return;
    }

    // Get user info for token generation
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      console.error(`❌ User ${userId} not found`);
      return;
    }

    // Generate temporary JWT token valid for 15 minutes (for push notification actions)
    // Balance between usability (time to respond) and security (replay window)
    const tempToken = jwt.sign({
      id: user.id,
      email: user.personalEmail || user.companyEmail || `user_${user.id}@temp.com`,
      role: user.role,
      companyId: user.companyId,
      type: 'push_action',
      pushAction: true // Mark as push action token - limits scope of this token
    }, JWT_SECRET, { expiresIn: '15m' });

    // Get current work status to determine available actions
    const workStatus = await getWorkStatus(userId);
    if (process.env.DEBUG_ALARMS) {
      console.log(`📊 User ${userId} work status: ${workStatus.status}, ${workStatus.buttons.length} button(s)`);
    }

    // Build notification actions from work status buttons
    const actions = workStatus.buttons.map(btn => ({
      action: btn.action,
      title: btn.title,
      icon: '/icon-192.png'
    }));

    if (process.env.DEBUG_ALARMS) {
      console.log(`🔔 Preparing notification with ${actions.length} action(s):`, actions.map(a => a.action));
    }

    // 🔒 CRITICAL: Use alarm-specific tag to deduplicate across multiple service workers
    // Tag format: alarm-{alarmId}-{second} - prevents duplicate notifications in same second
    const now = new Date();
    const notificationTag = `alarm-${alarmId}-${now.getTime()}`;
    
    const payload = JSON.stringify({
      title: 'Alarma',
      body: 'Es hora de fichar',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 200, 100, 200],
      requireInteraction: true,
      tag: notificationTag,
      data: {
        url: '/employee',
        type: alarmType,
        timestamp: Date.now(),
        userId,
        sessionId: workStatus.sessionId,
        breakId: workStatus.breakId,
        workStatus: workStatus.status,
        actionToken: tempToken // Include short-lived action token
      },
      actions
    });

    // Send to all user's devices
    const nowMs = Date.now();
    
    const promises = subscriptions.map(async (sub) => {
      // 🔒 CRITICAL: Prevent duplicate sends to same alarm+endpoint combination
      // Use more granular key: alarm+endpoint (not minute-based)
      const throttleKey = `alarm-${alarmId}-${sub.endpoint}`;
      const lastSend = recentPushSends.get(throttleKey);
      
      if (lastSend && (nowMs - lastSend) < PUSH_SEND_THROTTLE_MS) {
        if (process.env.DEBUG_ALARMS) {
          console.log(`⏭️  SKIPPING duplicate push to alarm ${alarmId} on endpoint (last sent ${nowMs - lastSend}ms ago)`);
        }
        return;
      }
      
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        );
        
        // Mark this send in the throttle map
        recentPushSends.set(throttleKey, nowMs);
        
        // Clean up old entries (older than throttle period)
        for (const [key, timestamp] of Array.from(recentPushSends.entries())) {
          if (nowMs - timestamp > PUSH_SEND_THROTTLE_MS) {
            recentPushSends.delete(key);
          }
        }
        
        if (process.env.DEBUG_ALARMS) {
          console.log(`✅ Push notification sent to user ${userId} with ${actions.length} action(s)`);
        }
      } catch (error: any) {
        // If subscription is invalid, remove it
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`🗑️  Removing invalid subscription for user ${userId}`);
          await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
        } else {
          console.error(`❌ Error sending push to user ${userId}:`, error);
        }
      }
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
  }
}

// ⚠️ OPTIMIZED: Function to check for incomplete work sessions and send notifications
// Optimized for scalability with batch queries and parallel processing
async function checkIncompleteSessions() {
  try {
    const now = getSpainTime();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const currentHour = now.getHours();
    
    // Only check at 9 AM (Spain time)
    if (currentHour !== 9) {
      return;
    }
    
    // Skip if already checked today (in-memory guard for same process)
    if (sentIncompleteSessionNotifications.has(todayKey)) {
      return;
    }
    
    // Set flag IMMEDIATELY to prevent race conditions within same process
    sentIncompleteSessionNotifications.set(todayKey, now);
    console.log(`🔒 Locked incomplete session check for ${todayKey}`);
    
    const startTime = Date.now();
    console.log('🔍 [OPTIMIZED] Checking for incomplete work sessions...');
    
    // ==================== STEP 1: Calculate timezone-safe date boundaries ====================
    // Use UTC boundaries that correspond to Spain timezone day
    const todaySpainDateStr = formatInTimeZone(new Date(), SPAIN_TZ, 'yyyy-MM-dd');
    // Spain is UTC+1 in winter, UTC+2 in summer. Calculate exact UTC boundaries.
    const todayStartSpainUTC = new Date(`${todaySpainDateStr}T00:00:00+01:00`); // Approximate, will adjust
    const tomorrowStartSpainUTC = new Date(todayStartSpainUTC.getTime() + 24 * 60 * 60 * 1000);
    
    // Yesterday cutoff for incomplete sessions
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    
    // ==================== STEP 2: Batch fetch incomplete sessions ====================
    const incompleteSessions = await db.select({
      id: workSessions.id,
      userId: workSessions.userId,
      clockIn: workSessions.clockIn,
      user: {
        id: users.id,
        fullName: users.fullName,
        personalEmail: users.personalEmail,
        companyEmail: users.companyEmail,
        role: users.role,
        companyId: users.companyId
      }
    })
      .from(workSessions)
      .innerJoin(users, eq(workSessions.userId, users.id))
      .where(and(
        isNull(workSessions.clockOut),
        sql`${workSessions.clockIn} < ${yesterday}`
      ));
    
    if (incompleteSessions.length === 0) {
      console.log('✅ No incomplete sessions found');
      return;
    }
    
    console.log(`📊 Found ${incompleteSessions.length} incomplete session(s)`);
    
    // Group sessions by user
    const userSessionsMap = new Map<number, typeof incompleteSessions>();
    for (const session of incompleteSessions) {
      const existing = userSessionsMap.get(session.userId) || [];
      existing.push(session);
      userSessionsMap.set(session.userId, existing);
    }
    
    const userIds = Array.from(userSessionsMap.keys());
    console.log(`📊 Affecting ${userIds.length} unique user(s)`);
    
    // ==================== STEP 3: Batch fetch existing push markers (index-friendly) ====================
    // Use range query instead of to_char() for index efficiency
    const existingMarkers = await db.select({
      userId: systemNotifications.userId
    })
      .from(systemNotifications)
      .where(and(
        inArray(systemNotifications.userId, userIds),
        eq(systemNotifications.type, 'incomplete_session_push_sent'),
        eq(systemNotifications.category, 'time-tracking'),
        gte(systemNotifications.createdAt, todayStartSpainUTC),
        lt(systemNotifications.createdAt, tomorrowStartSpainUTC)
      ));
    
    const usersWithMarkerToday = new Set(existingMarkers.map(m => m.userId));
    console.log(`📊 ${usersWithMarkerToday.size} user(s) already have push markers today`);
    
    // Filter to users who need notifications
    const usersToNotify = userIds.filter(id => !usersWithMarkerToday.has(id));
    
    if (usersToNotify.length === 0) {
      console.log('✅ All users already notified today');
      return;
    }
    
    console.log(`📊 ${usersToNotify.length} user(s) need push notifications`);
    
    // ==================== STEP 4: Batch fetch all push subscriptions ====================
    const allSubscriptions = await db.select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, usersToNotify));
    
    // Group subscriptions by user and filter to unique devices
    const subscriptionsByUser = new Map<number, typeof allSubscriptions>();
    for (const sub of allSubscriptions) {
      const existing = subscriptionsByUser.get(sub.userId) || [];
      existing.push(sub);
      subscriptionsByUser.set(sub.userId, existing);
    }
    
    // ==================== STEP 5: Batch fetch existing session notifications ====================
    const sessionIds = incompleteSessions.map(s => s.id);
    const existingSessionNotifications = await db.select({
      metadata: systemNotifications.metadata
    })
      .from(systemNotifications)
      .where(and(
        inArray(systemNotifications.userId, userIds),
        eq(systemNotifications.type, 'incomplete_session'),
        eq(systemNotifications.category, 'time-tracking'),
        eq(systemNotifications.isCompleted, false)
      ));
    
    // Extract session IDs that already have notifications
    const sessionsWithNotifications = new Set<number>();
    for (const notif of existingSessionNotifications) {
      try {
        const meta = JSON.parse(notif.metadata || '{}');
        if (meta.workSessionId) {
          sessionsWithNotifications.add(Number(meta.workSessionId));
        }
      } catch {}
    }
    
    // ==================== STEP 6: Batch create missing system notifications ====================
    const notificationsToCreate: any[] = [];
    for (const session of incompleteSessions) {
      if (!sessionsWithNotifications.has(session.id)) {
        notificationsToCreate.push({
          userId: session.userId,
          type: 'incomplete_session',
          category: 'time-tracking',
          title: 'Fichaje Incompleto',
          message: 'Tienes una sesión de trabajo abierta que necesita ser cerrada.',
          actionUrl: '/employee/time-tracking',
          priority: 'high',
          isRead: false,
          isCompleted: false,
          metadata: JSON.stringify({ workSessionId: session.id }),
          createdBy: 1
        });
      }
    }
    
    if (notificationsToCreate.length > 0) {
      await db.insert(systemNotifications).values(notificationsToCreate);
      console.log(`📊 Created ${notificationsToCreate.length} system notification(s) in batch`);
    }
    
    // ==================== STEP 7: Send push notifications in parallel batches ====================
    const BATCH_SIZE = 10; // Process 10 users at a time to avoid overwhelming
    let successCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < usersToNotify.length; i += BATCH_SIZE) {
      const batch = usersToNotify.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (userId) => {
        const sessions = userSessionsMap.get(userId) || [];
        const user = sessions[0]?.user;
        if (!user) return { userId, success: false, reason: 'no_user' };
        
        const userSubs = subscriptionsByUser.get(userId) || [];
        if (userSubs.length === 0) {
          return { userId, success: false, reason: 'no_subscriptions' };
        }
        
        // Filter to unique devices
        const deviceMap = new Map<string, typeof userSubs[0]>();
        for (const sub of userSubs) {
          const deviceKey = sub.deviceId || sub.endpoint;
          const existing = deviceMap.get(deviceKey);
          if (!existing || new Date(sub.updatedAt) > new Date(existing.updatedAt)) {
            deviceMap.set(deviceKey, sub);
          }
        }
        const uniqueSubs = Array.from(deviceMap.values());
        
        // Generate short-lived JWT token for push actions
        const tempToken = jwt.sign({
          id: user.id,
          email: user.personalEmail || user.companyEmail || `user_${user.id}@temp.com`,
          role: user.role,
          companyId: user.companyId,
          type: 'push_action',
          pushAction: true
        }, JWT_SECRET, { expiresIn: '15m' });
        
        const sessionCount = sessions.length;
        const payload = JSON.stringify({
          title: 'Sesión Incompleta',
          body: sessionCount === 1 
            ? '⚠️ Tienes una sesión de trabajo sin cerrar' 
            : `⚠️ Tienes ${sessionCount} sesiones de trabajo sin cerrar`,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
          tag: `incomplete-session-${userId}-${todayKey}`,
          data: {
            url: '/employee/misfichajes',
            type: 'incomplete_session',
            timestamp: Date.now(),
            userId,
            sessionCount,
            actionToken: tempToken
          },
          actions: [
            { action: 'view', title: 'Ver fichajes', icon: '/icon-192.png' }
          ]
        });
        
        // Send to all devices in parallel
        let atLeastOneSent = false;
        const invalidEndpoints: string[] = [];
        
        await Promise.all(uniqueSubs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
            atLeastOneSent = true;
          } catch (error: any) {
            if (error.statusCode === 410 || error.statusCode === 404) {
              invalidEndpoints.push(sub.endpoint);
            }
          }
        }));
        
        // Clean up invalid subscriptions
        if (invalidEndpoints.length > 0) {
          await db.delete(pushSubscriptions)
            .where(inArray(pushSubscriptions.endpoint, invalidEndpoints));
        }
        
        // Only create marker if at least one push succeeded
        if (atLeastOneSent) {
          await db.insert(systemNotifications).values({
            userId,
            type: 'incomplete_session_push_sent',
            category: 'time-tracking',
            title: 'Push Notification Marker',
            message: `Marker for ${todaySpainDateStr}`,
            actionUrl: null,
            priority: 'low',
            isRead: true,
            isCompleted: true,
            metadata: JSON.stringify({ 
              pushSentDate: todaySpainDateStr,
              sessionCount,
              subscriptionCount: uniqueSubs.length
            }),
            createdBy: 1
          });
          return { userId, success: true, reason: 'sent' };
        }
        
        return { userId, success: false, reason: 'all_failed' };
      });
      
      const results = await Promise.all(batchPromises);
      for (const r of results) {
        if (r.success) successCount++;
        else if (r.reason === 'no_subscriptions') skipCount++;
      }
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Incomplete sessions check completed in ${elapsed}ms: ${successCount} sent, ${skipCount} skipped (no subs)`);
    
    // Clean up old in-memory entries
    const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    for (const [key, date] of Array.from(sentIncompleteSessionNotifications.entries())) {
      if (date.getTime() < sevenDaysAgo) {
        sentIncompleteSessionNotifications.delete(key);
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking incomplete sessions:', error);
  }
}

// Main scheduler function - NOW DEPRECATED for alarms (using event-driven setTimeout instead)
// Kept for backward compatibility if needed, but not called for alarm checking
export async function checkWorkAlarms() {
  try {
    const now = getSpainTime(); // ⚠️ CRITICAL: Use Spain time, not server UTC
    const currentMinute = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}:${now.getMinutes()}`;
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Get all active alarms
    const activeAlarms = await db.select()
      .from(workAlarms)
      .where(eq(workAlarms.isActive, true));
    
    if (process.env.DEBUG_ALARMS) {
      console.log(`📱 Checking alarms at ${currentTime} (${activeAlarms.length} active alarms)`);
    }

    for (const alarm of activeAlarms) {
      // Create unique key for this alarm using the ALARM'S scheduled time (not current minute)
      // This prevents duplicate sends during the 5-minute catch-up window
      const alarmDateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      const checkKey = `${alarm.id}-${alarmDateKey}-${alarm.time}`;
      
      // Skip if already sent today for this alarm time
      if (checkedAlarms.has(checkKey)) {
        continue; // Silent skip - don't log every 30 seconds
      }

      // Check if alarm should trigger (now includes 5-minute catch-up window)
      const shouldTrigger = shouldTriggerAlarm(alarm.time, alarm.weekdays);
      if (process.env.DEBUG_ALARMS) {
        console.log(`🔍 Alarm ${alarm.id} (${alarm.title}) at ${alarm.time}: shouldTrigger=${shouldTrigger}`);
      }
      
      if (shouldTrigger) {
        console.log(`⏰ TRIGGERING ALARM: ${alarm.title} for user ${alarm.userId} at ${currentTime}`);
        
        await sendPushNotification(alarm.userId, alarm.title, alarm.type as 'clock_in' | 'clock_out', alarm.id);
        
        // Mark as sent for TODAY at this alarm time (prevents re-sends during catch-up window)
        checkedAlarms.set(checkKey, now);
        console.log(`✅ Alarm ${alarm.id} marked as sent for ${alarmDateKey} at ${alarm.time}`);
      }
    }

    // Clean up old entries (older than 2 hours)
    const twoHoursAgo = now.getTime() - (2 * 60 * 60 * 1000);
    for (const [key, date] of Array.from(checkedAlarms.entries())) {
      if (date.getTime() < twoHoursAgo) {
        checkedAlarms.delete(key);
      }
    }

  } catch (error) {
    console.error('❌ Error checking work alarms:', error);
  }
}

// Function to send vacation approval/denial notifications
export async function sendVacationNotification(
  userId: number, 
  status: 'approved' | 'denied',
  details: {
    startDate: Date;
    endDate: Date;
    adminComment?: string;
    requestId?: number;
  }
) {
  try {
    console.log(`📱 Sending vacation ${status} notification to user ${userId}`);
    
    // Get push subscriptions for the user
    const subscriptions = await db.select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    
    if (subscriptions.length === 0) {
      console.log(`📱 No push subscriptions found for user ${userId}`);
      return;
    }
    
    // Filter to unique devices
    const deviceMap = new Map<string, typeof subscriptions[0]>();
    for (const sub of subscriptions) {
      const deviceKey = sub.deviceId || sub.endpoint;
      const existing = deviceMap.get(deviceKey);
      if (!existing || new Date(sub.updatedAt) > new Date(existing.updatedAt)) {
        deviceMap.set(deviceKey, sub);
      }
    }
    
    const uniqueSubscriptions = Array.from(deviceMap.values());
    
    // Format dates for display
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    };
    
    const startDateStr = formatDate(details.startDate);
    const endDateStr = formatDate(details.endDate);
    
    // Check if it's a single day vacation
    const isSingleDay = startDateStr === endDateStr;
    const dateRangeText = isSingleDay 
      ? `el día ${startDateStr}` 
      : `del ${startDateStr} al ${endDateStr}`;
    
    // Create notification content
    const title = status === 'approved' 
      ? '✅ Vacaciones Aprobadas' 
      : '❌ Vacaciones Rechazadas';
    
    const body = status === 'approved'
      ? `Tu solicitud de vacaciones ${dateRangeText} ha sido aprobada`
      : `Tu solicitud de vacaciones ${dateRangeText} ha sido rechazada${details.adminComment ? ': ' + details.adminComment : ''}`;
    
    const payload = JSON.stringify({
      title,
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: details.requestId ? `vacation-${status}-${details.requestId}` : `vacation-${status}-${userId}`,
      data: {
        url: '/employee/vacaciones',
        type: 'vacation_update',
        status,
        timestamp: Date.now(),
        userId
      },
      actions: [
        { action: 'view', title: 'Ver vacaciones', icon: '/icon-192.png' }
      ]
    });
    
    // Send to all unique devices
    for (const sub of uniqueSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        );
        console.log(`✅ Vacation ${status} notification sent to user ${userId}`);
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`🗑️  Removing invalid subscription for user ${userId}`);
          await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
        } else {
          console.error(`❌ Error sending vacation notification to user ${userId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendVacationNotification:', error);
  }
}

// Function to send assigned vacation notification (when admin assigns absence to employee)
export async function sendAssignedVacationNotification(
  userId: number,
  details: {
    startDate: Date;
    endDate: Date;
    absenceType?: string;
    adminName: string;
    requestId?: number;
  }
) {
  try {
    console.log(`📱 Sending assigned vacation notification to user ${userId}`);
    
    // Get push subscriptions for the user
    const subscriptions = await db.select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    
    if (subscriptions.length === 0) {
      console.log(`📱 No push subscriptions found for user ${userId}`);
      return;
    }
    
    // Filter to unique devices
    const deviceMap = new Map<string, typeof subscriptions[0]>();
    for (const sub of subscriptions) {
      const deviceKey = sub.deviceId || sub.endpoint;
      const existing = deviceMap.get(deviceKey);
      if (!existing || new Date(sub.updatedAt) > new Date(existing.updatedAt)) {
        deviceMap.set(deviceKey, sub);
      }
    }
    
    const uniqueSubscriptions = Array.from(deviceMap.values());
    
    // Format dates for display
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    };
    
    const startDateStr = formatDate(details.startDate);
    const endDateStr = formatDate(details.endDate);
    
    // Check if it's a single day
    const isSingleDay = startDateStr === endDateStr;
    const dateRangeText = isSingleDay 
      ? `el día ${startDateStr}` 
      : `del ${startDateStr} al ${endDateStr}`;
    
    // Get absence type label
    const absenceTypeLabels: Record<string, string> = {
      'vacation': 'Vacaciones',
      'sick_leave': 'Baja médica',
      'paternity_maternity': 'Paternidad/Maternidad',
      'personal': 'Asuntos personales',
      'training': 'Formación',
      'work_related': 'Asuntos laborales',
      'public_duty': 'Deber inexcusable',
      'temporary_disability': 'Incapacidad temporal',
      'adverse_weather': 'Condiciones climáticas adversas'
    };
    
    const absenceTypeLabel = absenceTypeLabels[details.absenceType || 'vacation'] || 'Ausencia';
    
    // Create notification content
    const title = '📋 Nueva Ausencia Asignada';
    const body = `Te han asignado ${absenceTypeLabel.toLowerCase()} ${dateRangeText}`;
    
    const payload = JSON.stringify({
      title,
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: details.requestId ? `assigned-vacation-${details.requestId}` : `assigned-vacation-${userId}`,
      data: {
        url: '/employee/vacaciones',
        type: 'assigned_vacation',
        timestamp: Date.now(),
        userId,
        requestId: details.requestId
      },
      actions: [
        { action: 'view', title: 'Verificar', icon: '/icon-192.png' }
      ]
    });
    
    // Send to all unique devices
    for (const sub of uniqueSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        );
        console.log(`✅ Assigned vacation notification sent to user ${userId}`);
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`🗑️  Removing invalid subscription for user ${userId}`);
          await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
        } else {
          console.error(`❌ Error sending assigned vacation notification to user ${userId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendAssignedVacationNotification:', error);
  }
}

// Function to send payroll document notification (pending signature)
export async function sendPayrollNotification(
  userId: number,
  documentName: string,
  documentId?: number,
  options?: { skipEmail?: boolean }
) {
  try {
    console.log(`📱 Sending payroll notification to user ${userId} for document ${documentId || 'unknown'}`);
    
    // 📧 QUEUE EMAIL NOTIFICATION
    if (documentId && !options?.skipEmail) {
      try {
        emailDebug('Starting email queue process', { userId, documentId });
        const { queueEmail, createDocumentSignatureToken } = await import('./emailQueue');
        const { storage } = await import('./storage');
        
        emailDebug('Fetching user data', { userId });
        // Get user and company info
        const user = await storage.getUser(userId);
        
        // Priority: personalEmail > companyEmail (work email)
        const userEmail = user?.personalEmail || user?.companyEmail;
        
        emailDebug('User data fetched', {
          userFound: Boolean(user),
          userId,
          companyEmail: maskEmail(user?.companyEmail),
          personalEmail: maskEmail(user?.personalEmail),
          selectedEmail: maskEmail(userEmail),
        });
        
        if (user && userEmail) {
          emailDebug('Fetching company data', { companyId: user.companyId });
          const company = await storage.getCompany(user.companyId);
          emailDebug('Company data fetched', {
            companyFound: Boolean(company),
            companyId: user.companyId,
            companyAlias: company?.companyAlias || null,
          });
          
          // Build login URL (not direct document link - user must login first)
          const companyAlias = company?.companyAlias || 'app';
          const loginUrl = `${process.env.VITE_APP_URL || 'http://localhost:5000'}/${companyAlias}/inicio`;
          emailDebug('Login URL prepared');
          
          // Queue email with high priority
          emailDebug('Queueing payroll email', { to: maskEmail(userEmail) });
          await queueEmail({
            userId,
            toEmail: userEmail,
            toName: user.fullName,
            subject: 'Nueva Nómina Pendiente de Firma',
            templateType: 'payroll_available',
            templateData: {
              userName: user.fullName,
              documentName,
              documentId,
              loginUrl,
              companyAlias,
              companyName: company?.name || 'Tu empresa'
            },
            companyId: user.companyId,
            priority: 1, // High priority
          });
          
          console.log(`📧 Payroll email queued for user ${userId} to ${userEmail}`);
        } else {
          console.error(`❌ [EMAIL DEBUG] User ${userId} not found or has no email (work or personal)`);
        }
      } catch (error) {
        console.error('❌ Error queueing payroll email:', error);
        console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        // Don't fail the entire notification if email fails
      }
    }
    
    // Get push subscriptions for the user
    const subscriptions = await db.select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    
    if (subscriptions.length === 0) {
      console.log(`📱 No push subscriptions found for user ${userId}`);
      return;
    }
    
    // Filter to unique devices
    const deviceMap = new Map<string, typeof subscriptions[0]>();
    for (const sub of subscriptions) {
      const deviceKey = sub.deviceId || sub.endpoint;
      const existing = deviceMap.get(deviceKey);
      if (!existing || new Date(sub.updatedAt) > new Date(existing.updatedAt)) {
        deviceMap.set(deviceKey, sub);
      }
    }
    
    const uniqueSubscriptions = Array.from(deviceMap.values());
    
    // 🔒 CRITICAL: Use document ID for tag to deduplicate across all devices
    // Same document = same tag = only ONE notification shown across all devices
    const notificationTag = documentId ? `payroll-${documentId}` : `payroll-${userId}`;
    
    const payload = JSON.stringify({
      title: '📄 Nueva Nómina Pendiente',
      body: 'Tienes una nueva nómina pendiente de firmar',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: notificationTag,
      data: {
        url: '/employee/documentos',
        type: 'payroll_pending',
        timestamp: Date.now(),
        userId,
        documentId
      },
      actions: [
        { action: 'view', title: 'Ver nómina', icon: '/icon-192.png' }
      ]
    });
    
    // Send to all unique devices
    for (const sub of uniqueSubscriptions) {
      try {
        console.log(`📤 Attempting to send payroll notification to device: ${sub.endpoint.substring(0, 50)}...`);
        const result = await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        );
        console.log(`✅ Payroll notification successfully sent to user ${userId}, status: ${result.statusCode}`);
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`🗑️  Removing invalid subscription for user ${userId} (status: ${error.statusCode})`);
          await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
        } else {
          console.error(`❌ Error sending payroll notification to user ${userId}:`);
          console.error(`   Status Code: ${error.statusCode}`);
          console.error(`   Message: ${error.message}`);
          console.error(`   Body: ${error.body}`);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendPayrollNotification:', error);
  }
}

// Function to send new document notification
export async function sendNewDocumentNotification(
  userId: number,
  documentName: string,
  documentId?: number,
  options?: { skipEmail?: boolean }
) {
  try {
    console.log(`📱 Sending new document notification to user ${userId} for document ${documentId || 'unknown'}`);
    
    // 📧 QUEUE EMAIL NOTIFICATION
    if (documentId && !options?.skipEmail) {
      try {
        emailDebug('Starting email queue process', { userId, documentId });
        const { queueEmail, createDocumentSignatureToken } = await import('./emailQueue');
        const { storage } = await import('./storage');
        
        emailDebug('Fetching user data', { userId });
        // Get user and company info
        const user = await storage.getUser(userId);
        
        // Priority: personalEmail > companyEmail (work email)
        const userEmail = user?.personalEmail || user?.companyEmail;
        
        emailDebug('User data fetched', {
          userFound: Boolean(user),
          userId,
          companyEmail: maskEmail(user?.companyEmail),
          personalEmail: maskEmail(user?.personalEmail),
          selectedEmail: maskEmail(userEmail),
        });
        
        if (user && userEmail) {
          emailDebug('Fetching company data', { companyId: user.companyId });
          const company = await storage.getCompany(user.companyId);
          emailDebug('Company data fetched', {
            companyFound: Boolean(company),
            companyId: user.companyId,
            companyAlias: company?.companyAlias || null,
          });
          
          // Generate signature token for direct email link
          emailDebug('Creating signature token', { userId, documentId });
          const signatureToken = await createDocumentSignatureToken(
            documentId,
            userId,
            user.companyId
          );
          emailDebug('Signature token created');
          
          // Build direct signature URL
          const companyAlias = company?.companyAlias || 'app';
          const signatureUrl = `${process.env.VITE_APP_URL || 'http://localhost:5000'}/${companyAlias}/inicio?signDocument=${documentId}&token=${signatureToken}`;
          emailDebug('Signature URL prepared');
          
          // Queue email
          emailDebug('Queueing document email', { to: maskEmail(userEmail) });
          await queueEmail({
            userId,
            toEmail: userEmail,
            toName: user.fullName,
            subject: 'Nuevo Documento Pendiente de Firma',
            templateType: 'document_signature_required',
            templateData: {
              userName: user.fullName,
              documentName,
              documentId,
              signatureUrl,
              companyName: company?.name || 'Tu empresa'
            },
            companyId: user.companyId,
            priority: 3, // Normal priority
          });
          
          console.log(`📧 Document email queued for user ${userId} to ${userEmail}`);
        } else {
          console.error(`❌ [EMAIL DEBUG] User ${userId} not found or has no email (work or personal)`);
        }
      } catch (error) {
        console.error('❌ Error queueing document email:', error);
        console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        // Don't fail the entire notification if email fails
      }
    }
    
    // Get push subscriptions for the user
    const subscriptions = await db.select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    
    if (subscriptions.length === 0) {
      console.log(`📱 No push subscriptions found for user ${userId}`);
      return;
    }
    
    // Filter to unique devices
    const deviceMap = new Map<string, typeof subscriptions[0]>();
    for (const sub of subscriptions) {
      const deviceKey = sub.deviceId || sub.endpoint;
      const existing = deviceMap.get(deviceKey);
      if (!existing || new Date(sub.updatedAt) > new Date(existing.updatedAt)) {
        deviceMap.set(deviceKey, sub);
      }
    }
    
    const uniqueSubscriptions = Array.from(deviceMap.values());
    
    // 🔒 CRITICAL: Use document ID for tag to deduplicate across all devices
    // Same document = same tag = only ONE notification shown across all devices
    const notificationTag = documentId ? `document-${documentId}` : `document-new-${userId}`;
    
    const payload = JSON.stringify({
      title: '📎 Nuevo Documento',
      body: 'Tienes un nuevo documento disponible',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: notificationTag,
      data: {
        url: '/employee/documentos',
        type: 'document_new',
        timestamp: Date.now(),
        userId,
        documentId
      },
      actions: [
        { action: 'view', title: 'Ver documentos', icon: '/icon-192.png' }
      ]
    });
    
    // Send to all unique devices
    for (const sub of uniqueSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        );
        console.log(`✅ New document notification sent to user ${userId}`);
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`🗑️  Removing invalid subscription for user ${userId}`);
          await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
        } else {
          console.error(`❌ Error sending document notification to user ${userId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendNewDocumentNotification:', error);
  }
}

// Function to send document upload request notification
export async function sendDocumentRequestNotification(userId: number, documentType: string, message: string) {
  try {
    console.log(`📱 Sending document request notification to user ${userId}`);
    
    // Get push subscriptions for the user
    const subscriptions = await db.select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    
    if (subscriptions.length === 0) {
      console.log(`📱 No push subscriptions found for user ${userId}`);
      return;
    }
    
    // Filter to unique devices
    const deviceMap = new Map<string, typeof subscriptions[0]>();
    for (const sub of subscriptions) {
      const deviceKey = sub.deviceId || sub.endpoint;
      const existing = deviceMap.get(deviceKey);
      if (!existing || new Date(sub.updatedAt) > new Date(existing.updatedAt)) {
        deviceMap.set(deviceKey, sub);
      }
    }
    
    const uniqueSubscriptions = Array.from(deviceMap.values());
    
    const payload = JSON.stringify({
      title: '📤 Solicitud de Documento',
      body: message || `Por favor, sube tu ${documentType}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: `document-request-${userId}-${documentType}`,
      data: {
        url: '/employee/documentos',
        type: 'document_request',
        documentType,
        timestamp: Date.now(),
        userId
      },
      actions: [
        { action: 'view', title: 'Subir documento', icon: '/icon-192.png' }
      ]
    });
    
    // Send to all unique devices
    for (const sub of uniqueSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        );
        console.log(`✅ Document request notification sent to user ${userId}`);
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`🗑️  Removing invalid subscription for user ${userId}`);
          await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
        } else {
          console.error(`❌ Error sending document request notification to user ${userId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendDocumentRequestNotification:', error);
  }
}

// Function to send new message notification
export async function sendMessageNotification(
  receiverId: number, 
  senderName: string, 
  subject: string,
  messageId: number
) {
  try {
    console.log(`📱 Sending message notification to user ${receiverId} from ${senderName}`);
    
    // Get push subscriptions for the receiver
    const subscriptions = await db.select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, receiverId));
    
    if (subscriptions.length === 0) {
      console.log(`📱 No push subscriptions found for user ${receiverId}`);
      return;
    }
    
    // Filter to unique devices
    const deviceMap = new Map<string, typeof subscriptions[0]>();
    for (const sub of subscriptions) {
      const deviceKey = sub.deviceId || sub.endpoint;
      const existing = deviceMap.get(deviceKey);
      if (!existing || new Date(sub.updatedAt) > new Date(existing.updatedAt)) {
        deviceMap.set(deviceKey, sub);
      }
    }
    
    const uniqueSubscriptions = Array.from(deviceMap.values());
    
    // 🔒 CRITICAL: Use message ID for tag to deduplicate across all devices
    const notificationTag = `message-${messageId}`;
    
    const payload = JSON.stringify({
      title: `Mensaje de ${senderName}`,
      body: subject || 'Tienes un nuevo mensaje',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: notificationTag,
      data: {
        url: '/employee/mensajes',
        type: 'message',
        messageId,
        timestamp: Date.now(),
        userId: receiverId
      },
      actions: [
        { action: 'view', title: 'Ver mensaje', icon: '/icon-192.png' }
      ]
    });
    
    // Send to all unique devices
    for (const sub of uniqueSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        );
        console.log(`✅ Message notification sent to user ${receiverId}`);
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`🗑️  Removing invalid subscription for user ${receiverId}`);
          await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
        } else {
          console.error(`❌ Error sending message notification to user ${receiverId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendMessageNotification:', error);
  }
}

// Function to send notification when reminder is shared
export async function sendReminderSharedNotification(
  userId: number,
  reminderTitle: string,
  sharedByName: string,
  reminderId: number
) {
  try {
    console.log(`📱 Sending reminder shared notification to user ${userId}`);
    
    // Get push subscriptions for the user
    const subscriptions = await db.select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    
    if (subscriptions.length === 0) {
      console.log(`📱 No push subscriptions found for user ${userId}`);
      return;
    }
    
    // Filter to unique devices
    const deviceMap = new Map<string, typeof subscriptions[0]>();
    for (const sub of subscriptions) {
      const deviceKey = sub.deviceId || sub.endpoint;
      const existing = deviceMap.get(deviceKey);
      if (!existing || new Date(sub.updatedAt) > new Date(existing.updatedAt)) {
        deviceMap.set(deviceKey, sub);
      }
    }
    
    const uniqueSubscriptions = Array.from(deviceMap.values());
    
    const payload = JSON.stringify({
      title: `Recordatorio compartido por ${sharedByName}`,
      body: reminderTitle,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: `reminder-shared-${reminderId}`,
      data: {
        url: '/employee',
        type: 'reminder_shared',
        timestamp: Date.now(),
        userId,
        reminderId
      },
      actions: [
        { action: 'view', title: 'Ver recordatorio', icon: '/icon-192.png' }
      ]
    });
    
    // Send to all unique devices
    for (const sub of uniqueSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        );
        console.log(`✅ Reminder shared notification sent to user ${userId}`);
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`🗑️  Removing invalid subscription for user ${userId}`);
          await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
        } else {
          console.error(`❌ Error sending reminder shared notification to user ${userId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendReminderSharedNotification:', error);
  }
}

// Function to check and send reminder notifications when reminderDate arrives
async function checkReminders() {
  try {
    // ⚠️ CRITICAL: Get Spain time for comparison
    const nowSpain = getSpainTime();
    if (process.env.DEBUG_ALARMS) {
      console.log(`🔔 Checking reminders at ${formatInTimeZone(nowSpain, SPAIN_TZ, 'HH:mm:ss')} (Spain time)`);
    }
    
    // Get all reminders that:
    // 1. Have enableNotifications = true
    // 2. Have not been notified yet (notificationShown = false)
    // 3. reminderDate is in the past or within next minute (Spain time)
    // 4. Are not completed or archived
    const oneMinuteFromNow = new Date(nowSpain.getTime() + 60000);
    
    if (process.env.DEBUG_ALARMS) {
      console.log(`🔍 Debug - nowSpain: ${nowSpain.toISOString()}, oneMinuteFromNow: ${oneMinuteFromNow.toISOString()}`);
    }
    
    const remindersToNotify = await db.select()
      .from(reminders)
      .where(
        and(
          eq(reminders.enableNotifications, true),
          eq(reminders.notificationShown, false),
          eq(reminders.isCompleted, false),
          eq(reminders.isArchived, false),
          lte(reminders.reminderDate, oneMinuteFromNow)
        )
      );
    
    // Debug: Check all active reminders
    const allActiveReminders = await db.select()
      .from(reminders)
      .where(
        and(
          eq(reminders.enableNotifications, true),
          eq(reminders.notificationShown, false),
          eq(reminders.isCompleted, false),
          eq(reminders.isArchived, false)
        )
      );
    
    console.log(`📋 All active reminders with notifications enabled: ${allActiveReminders.length}`);
    for (const r of allActiveReminders) {
      if (r.reminderDate) {
        console.log(`  - ID ${r.id}: "${r.title}" at ${r.reminderDate.toISOString()}, should notify: ${r.reminderDate <= oneMinuteFromNow}`);
      } else {
        console.log(`  - ID ${r.id}: "${r.title}" - NO DATE SET`);
      }
    }
    
    console.log(`📋 Found ${remindersToNotify.length} reminder(s) to notify`);
    
    for (const reminder of remindersToNotify) {
      // Get all assigned users (or just creator if no assignments)
      const userIds = reminder.assignedUserIds && reminder.assignedUserIds.length > 0
        ? reminder.assignedUserIds
        : [reminder.userId];
      
      console.log(`📌 Processing reminder "${reminder.title}" for ${userIds.length} user(s)`);
      
      // Send notification to each assigned user
      for (const userId of userIds) {
        // Get push subscriptions
        const subscriptions = await db.select()
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.userId, userId));
        
        if (subscriptions.length === 0) {
          console.log(`📱 No push subscriptions found for user ${userId}`);
          continue;
        }
        
        // Filter to unique devices
        const deviceMap = new Map<string, typeof subscriptions[0]>();
        for (const sub of subscriptions) {
          const deviceKey = sub.deviceId || sub.endpoint;
          const existing = deviceMap.get(deviceKey);
          if (!existing || new Date(sub.updatedAt) > new Date(existing.updatedAt)) {
            deviceMap.set(deviceKey, sub);
          }
        }
        
        const uniqueSubscriptions = Array.from(deviceMap.values());
        
        const payload = JSON.stringify({
          title: 'Recordatorio',
          body: reminder.title,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
          tag: `reminder-due-${reminder.id}`,
          data: {
            url: '/employee',
            type: 'reminder_due',
            timestamp: Date.now(),
            userId,
            reminderId: reminder.id
          },
          actions: [
            { action: 'view', title: 'Ver recordatorio', icon: '/icon-192.png' }
          ]
        });
        
        // Send to all unique devices
        for (const sub of uniqueSubscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth
                }
              },
              payload
            );
            console.log(`✅ Reminder notification sent to user ${userId}`);
          } catch (error: any) {
            if (error.statusCode === 410 || error.statusCode === 404) {
              console.log(`🗑️  Removing invalid subscription for user ${userId}`);
              await db.delete(pushSubscriptions)
                .where(eq(pushSubscriptions.endpoint, sub.endpoint));
            } else {
              console.error(`❌ Error sending reminder notification to user ${userId}:`, error);
            }
          }
        }
      }
      
      // Mark reminder as notified
      await db.update(reminders)
        .set({ notificationShown: true })
        .where(eq(reminders.id, reminder.id));
      
      console.log(`✅ Marked reminder ${reminder.id} as notified`);
    }
  } catch (error) {
    console.error('Error in checkReminders:', error);
  }
}

// Daily document reminder: send notifications for ALL unsigned documents (not just payrolls)
async function notifyUnsignedDocuments() {
  try {
    console.log('📧 [DOCUMENT REMINDER] Starting daily unsigned documents reminder check...');
    
    // Get ALL documents that require signature but haven't been signed yet
    const unsignedDocs = await db.select({
      documentId: documents.id,
      userId: documents.userId,
      fileName: documents.fileName,
      originalName: documents.originalName,
      requiresSignature: documents.requiresSignature,
      createdAt: documents.createdAt
    })
      .from(documents)
      .where(
        and(
          eq(documents.requiresSignature, true), // Must require signature
          isNull(documents.signedAt) // Not signed yet
        )
      );

    if (unsignedDocs.length === 0) {
      console.log('✅ [DOCUMENT REMINDER] No unsigned documents found');
      return;
    }

    console.log(`📧 [DOCUMENT REMINDER] Found ${unsignedDocs.length} unsigned documents requiring signatures`);

    // Group documents by user to send one notification per user (not one per document)
    const docsByUser = new Map<number, typeof unsignedDocs>();
    for (const doc of unsignedDocs) {
      if (!docsByUser.has(doc.userId)) {
        docsByUser.set(doc.userId, []);
      }
      docsByUser.get(doc.userId)!.push(doc);
    }

    console.log(`📧 [DOCUMENT REMINDER] Notifying ${docsByUser.size} users with unsigned documents`);

    // Send reminder to each user (one notification per user with count)
    for (const [userId, userDocs] of docsByUser.entries()) {
      try {
        const docCount = userDocs.length;
        const isPayroll = userDocs.some(d => 
          (d.originalName || d.fileName).toLowerCase().includes('nomina') ||
          (d.originalName || d.fileName).toLowerCase().includes('nómina') ||
          (d.originalName || d.fileName).toLowerCase().includes('payroll')
        );
        
        console.log(`📧 [DOCUMENT REMINDER] User ${userId}: ${docCount} unsigned document(s), includes payroll: ${isPayroll}`);
        
        // If user has multiple documents, send a summary notification
        if (docCount > 1) {
          await sendMultipleDocumentsNotification(userId, docCount, isPayroll);
        } else {
          // Single document - send specific notification
          const doc = userDocs[0];
          const documentName = doc.originalName || doc.fileName;
          await sendPayrollNotification(userId, documentName, doc.documentId, { skipEmail: true });
        }
      } catch (error) {
        console.error(`❌ [DOCUMENT REMINDER] Error sending reminder to user ${userId}:`, error);
        // Continue with next user instead of failing
      }
    }

    console.log(`✅ [DOCUMENT REMINDER] Daily reminder completed for ${unsignedDocs.length} unsigned documents across ${docsByUser.size} users`);
  } catch (error) {
    console.error('❌ [DOCUMENT REMINDER] Error in notifyUnsignedDocuments:', error);
  }
}

// Exported test version that returns detailed results
export async function notifyUnsignedDocumentsTest() {
  try {
    console.log('🧪 [TEST] Starting unsigned documents reminder check...');
    
    // Get ALL documents that require signature but haven't been signed yet
    const unsignedDocs = await db.select({
      documentId: documents.id,
      userId: documents.userId,
      fileName: documents.fileName,
      originalName: documents.originalName,
      requiresSignature: documents.requiresSignature,
      createdAt: documents.createdAt
    })
      .from(documents)
      .where(
        and(
          eq(documents.requiresSignature, true), // Must require signature
          isNull(documents.signedAt) // Not signed yet
        )
      );

    if (unsignedDocs.length === 0) {
      console.log('✅ [TEST] No unsigned documents found');
      return {
        totalDocuments: 0,
        usersNotified: 0,
        details: []
      };
    }

    console.log(`🧪 [TEST] Found ${unsignedDocs.length} unsigned documents`);

    // Group documents by user
    const docsByUser = new Map<number, typeof unsignedDocs>();
    for (const doc of unsignedDocs) {
      if (!docsByUser.has(doc.userId)) {
        docsByUser.set(doc.userId, []);
      }
      docsByUser.get(doc.userId)!.push(doc);
    }

    console.log(`🧪 [TEST] Notifying ${docsByUser.size} users`);

    const details: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Send reminder to each user
    for (const [userId, userDocs] of docsByUser.entries()) {
      try {
        const docCount = userDocs.length;
        const isPayroll = userDocs.some(d => 
          (d.originalName || d.fileName).toLowerCase().includes('nomina') ||
          (d.originalName || d.fileName).toLowerCase().includes('nómina') ||
          (d.originalName || d.fileName).toLowerCase().includes('payroll')
        );
        
        console.log(`🧪 [TEST] User ${userId}: ${docCount} document(s), payroll: ${isPayroll}`);
        
        // Send notification
        if (docCount > 1) {
          await sendMultipleDocumentsNotification(userId, docCount, isPayroll);
        } else {
          const doc = userDocs[0];
          const documentName = doc.originalName || doc.fileName;
          await sendPayrollNotification(userId, documentName, doc.documentId, { skipEmail: true });
        }
        
        successCount++;
        details.push({
          userId,
          documentCount: docCount,
          hasPayroll: isPayroll,
          documents: userDocs.map(d => ({
            id: d.documentId,
            name: d.originalName || d.fileName
          })),
          status: 'sent'
        });
      } catch (error) {
        errorCount++;
        console.error(`❌ [TEST] Error for user ${userId}:`, error);
        details.push({
          userId,
          documentCount: userDocs.length,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`✅ [TEST] Completed: ${successCount} success, ${errorCount} errors`);

    return {
      totalDocuments: unsignedDocs.length,
      usersNotified: docsByUser.size,
      successCount,
      errorCount,
      details
    };
  } catch (error) {
    console.error('❌ [TEST] Error in notifyUnsignedDocumentsTest:', error);
    throw error;
  }
}

// Send notification for multiple unsigned documents
async function sendMultipleDocumentsNotification(userId: number, docCount: number, hasPayroll: boolean) {
  try {
    console.log(`📱 Sending multiple documents notification to user ${userId} (${docCount} documents, payroll: ${hasPayroll})`);
    
    // Get push subscriptions for the user
    const subscriptions = await db.select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    
    if (subscriptions.length === 0) {
      console.log(`📱 No push subscriptions found for user ${userId}`);
      return;
    }
    
    // Filter to unique devices
    const deviceMap = new Map<string, typeof subscriptions[0]>();
    for (const sub of subscriptions) {
      const deviceKey = sub.deviceId || sub.endpoint;
      const existing = deviceMap.get(deviceKey);
      if (!existing || new Date(sub.updatedAt) > new Date(existing.updatedAt)) {
        deviceMap.set(deviceKey, sub);
      }
    }
    
    const uniqueSubscriptions = Array.from(deviceMap.values());
    
    // Use user-based tag for summary notifications
    const notificationTag = `unsigned-docs-${userId}`;
    
    const title = hasPayroll ? '📄 Documentos y Nóminas Pendientes' : '📄 Documentos Pendientes de Firma';
    const body = hasPayroll 
      ? `Tienes ${docCount} documentos pendientes de firmar, incluyendo nóminas`
      : `Tienes ${docCount} documentos pendientes de firmar`;
    
    const payload = JSON.stringify({
      title,
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: notificationTag,
      data: {
        url: '/employee/documentos',
        type: 'multiple_documents_pending',
        timestamp: Date.now(),
        userId,
        documentCount: docCount
      },
      actions: [
        { action: 'view', title: 'Ver documentos', icon: '/icon-192.png' }
      ]
    });
    
    // Send to all unique devices
    for (const sub of uniqueSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        );
        console.log(`✅ Multiple documents notification sent to user ${userId}`);
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`🗑️  Removing invalid subscription for user ${userId}`);
          await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
        } else {
          console.error(`❌ Error sending notification to user ${userId}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Error in sendMultipleDocumentsNotification:', error);
  }
}

// 🔒 PROTECTED: Use global process to persist scheduler state across hot reloads
// DO NOT MODIFY - This prevents duplicate notifications from module reloads
declare global {
  var pushSchedulerIncompleteTask: ScheduledTask | undefined;
  var pushSchedulerTrialTask: ScheduledTask | undefined;
  var pushSchedulerDeletionTask: ScheduledTask | undefined;
  var pushSchedulerPayrollTask: ScheduledTask | undefined;
  var pushSchedulerRunning: boolean | undefined;
}

// Call counter for debugging
let startCallCount = 0;

// Start the scheduler
export async function startPushNotificationScheduler() {
  startCallCount++;
  const processId = `PID-${process.pid}`;
  const callNum = startCallCount;
  
  // Silenced startup logs - only show critical info
  if (process.env.DEBUG_SCHEDULER) {
    console.log(`🚀 [CALL #${callNum}] Starting Push Notification Scheduler... [${processId}]`);
    console.log(`📊 [CALL #${callNum}] Call stack:`, new Error().stack?.split('\n').slice(1, 4).join('\n'));
  }
  
  // 🔒 CRITICAL: Only ONE instance should run - prevent duplicates
  if (global.pushSchedulerRunning) {
    if (process.env.DEBUG_SCHEDULER) {
      console.log(`⚠️  [CALL #${callNum}] Push Notification Scheduler already running - skipping [${processId}]`);
    }
    return {
      incompleteSessionTask: global.pushSchedulerIncompleteTask,
      trialTask: global.pushSchedulerTrialTask,
      deletionTask: global.pushSchedulerDeletionTask
    };
  }
  
  // 🔒 CRITICAL: ALWAYS stop existing cron tasks (prevents duplicates from hot reloads)
  if (global.pushSchedulerIncompleteTask) {
    if (process.env.DEBUG_SCHEDULER) {
      console.log(`🧹 Stopping old incomplete session task (hot reload cleanup) [${processId}]`);
    }
    global.pushSchedulerIncompleteTask.stop();
    global.pushSchedulerIncompleteTask = undefined;
  }
  if (global.pushSchedulerTrialTask) {
    if (process.env.DEBUG_SCHEDULER) {
      console.log(`🧹 Stopping old trial task (hot reload cleanup) [${processId}]`);
    }
    global.pushSchedulerTrialTask.stop();
    global.pushSchedulerTrialTask = undefined;
  }
  if (global.pushSchedulerDeletionTask) {
    if (process.env.DEBUG_SCHEDULER) {
      console.log(`🧹 Stopping old deletion task (hot reload cleanup) [${processId}]`);
    }
    global.pushSchedulerDeletionTask.stop();
    global.pushSchedulerDeletionTask = undefined;
  }
  if (global.pushSchedulerPayrollTask) {
    if (process.env.DEBUG_SCHEDULER) {
      console.log(`🧹 Stopping old payroll reminder task (hot reload cleanup) [${processId}]`);
    }
    global.pushSchedulerPayrollTask.stop();
    global.pushSchedulerPayrollTask = undefined;
  }
  
  // Mark as running BEFORE creating cron tasks
  global.pushSchedulerRunning = true;
  
  // Load and schedule all alarms with setTimeout (event-driven, no polling)
  await loadAndScheduleAllAlarms();
  
  // ✅ Load and schedule all reminders with setTimeout (event-driven, no polling)
  await loadAndScheduleAllReminders();
  
  // 📋 Schedule batch tasks with cron (production-ready, timezone-aware)
  
  // ✅ Cron #1: Incomplete sessions notification (daily at 9:00 AM Spain time)
  global.pushSchedulerIncompleteTask = cron.schedule('0 9 * * *', async () => {
    if (process.env.DEBUG_SCHEDULER) {
      console.log('🕘 Running daily incomplete sessions check (9:00 AM Spain time)');
    }
    await checkIncompleteSessions().catch(err => {
      console.error('❌ Error checking incomplete sessions:', err);
    });
  }, {
    timezone: 'Europe/Madrid'
  });
  
  // ✅ Cron #2: Process expired trials (every hour at minute 7 to avoid :00 congestion)
  global.pushSchedulerTrialTask = cron.schedule('7 * * * *', async () => {
    if (process.env.DEBUG_SCHEDULER) {
      console.log('💳 Running trial expiration check (every hour)');
    }
    await processExpiredTrials().catch(err => {
      console.error('❌ Error processing expired trials:', err);
    });
  }, {
    timezone: 'Europe/Madrid'
  });
  
  // ✅ Cron #4: Process scheduled deletions (daily at 2:00 AM Spain time)
  global.pushSchedulerDeletionTask = cron.schedule('0 2 * * *', async () => {
    if (process.env.DEBUG_SCHEDULER) {
      console.log('🗑️ Running deletion check (2:00 AM Spain time)');
    }
    await processScheduledDeletions().catch(err => {
      console.error('❌ Error processing scheduled deletions:', err);
    });
  }, {
    timezone: 'Europe/Madrid'
  });

  // ✅ Cron #5: Document signature reminder notifications (daily at 10:00 AM Spain time)
  // Sends reminders for ALL unsigned documents (payrolls, contracts, etc.)
  global.pushSchedulerPayrollTask = cron.schedule('0 10 * * *', async () => {
    if (process.env.DEBUG_SCHEDULER) {
      console.log('📧 Running unsigned documents reminder check (10:00 AM Spain time)');
    }
    await notifyUnsignedDocuments().catch(err => {
      console.error('❌ Error notifying unsigned documents:', err);
    });
  }, {
    timezone: 'Europe/Madrid'
  });
  
  console.log('✅ Scheduler started: Alarms+Reminders=event-driven, Incomplete/Documents=daily-cron, Trials=hourly-cron');
  if (process.env.DEBUG_SCHEDULER) {
    console.log(`   • Alarms: Event-driven (setTimeout per alarm)`);
    console.log(`   • Reminders: Event-driven (setTimeout per reminder) ✅ NO POLLING`);
    console.log(`   • Incomplete sessions: 09:00 Europe/Madrid (daily)`);
    console.log(`   • Unsigned documents: 10:00 Europe/Madrid (daily) - ALL documents requiring signature`);
    console.log(`   • Deletions: 02:00 Europe/Madrid (daily)`);
    console.log(`   • Stripe Reconciliation: 02:00 Europe/Madrid (daily) - Syncs all subscriptions from Stripe to DB`);
    console.log(`   • Trials: 0 * * * * (hourly - TODO: Stripe webhooks)`);
  }
  
  return { 
    incompleteSessionTask: global.pushSchedulerIncompleteTask,
    trialTask: global.pushSchedulerTrialTask,
    deletionTask: global.pushSchedulerDeletionTask,
    payrollTask: global.pushSchedulerPayrollTask
  };
}

