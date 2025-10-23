import webpush from 'web-push';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { eq, and, isNull } from 'drizzle-orm';
import { workAlarms, pushSubscriptions, workSessions, breakPeriods, users } from '@shared/schema';
import { JWT_SECRET } from './utils/jwt-secret.js';

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

// Helper function to check if alarm should trigger now
function shouldTriggerAlarm(alarmTime: string, weekdays: number[]): boolean {
  const now = new Date();
  const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // Convert Sunday from 0 to 7
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Check if today is in the alarm's weekdays
  if (!weekdays.includes(currentDay)) {
    return false;
  }
  
  // Parse alarm time
  const [alarmHour, alarmMinute] = alarmTime.split(':').map(Number);
  
  // Check if we're in the same hour and minute (within the current minute window)
  // This handles the 30-second check interval properly
  return currentHour === alarmHour && currentMinute === alarmMinute;
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
async function sendPushNotification(userId: number, title: string, alarmType: 'clock_in' | 'clock_out') {
  try {
    // Get all push subscriptions for this user
    const allSubscriptions = await db.select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (allSubscriptions.length === 0) {
      console.log(`📱 No push subscriptions found for user ${userId}`);
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
    console.log(`📱 Sending to ${subscriptions.length} unique device(s) (filtered from ${allSubscriptions.length} total subscriptions)`);

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

    // Generate temporary JWT token valid for 5 minutes (for push notification actions)
    const tempToken = jwt.sign({
      id: user.id,
      email: user.personalEmail || user.companyEmail || `user_${user.id}@temp.com`,
      role: user.role,
      companyId: user.companyId,
      pushAction: true // Mark as push action token
    }, JWT_SECRET, { expiresIn: '5m' });

    // Get current work status to determine available actions
    const workStatus = await getWorkStatus(userId);
    console.log(`📊 User ${userId} work status: ${workStatus.status}, ${workStatus.buttons.length} button(s)`);

    // Build notification actions from work status buttons
    const actions = workStatus.buttons.map(btn => ({
      action: btn.action,
      title: btn.title,
      icon: '/icon-192.png'
    }));

    console.log(`🔔 Preparing notification with ${actions.length} action(s):`, actions.map(a => a.action));

    // Use unique tag per notification to avoid replacement on iOS
    // But include userId in tag for tracking
    const notificationTag = `work-alarm-${userId}-${Date.now()}`;
    
    const payload = JSON.stringify({
      title: 'Oficaz',
      body: '🔔 Hora de fichar',
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
        authToken: tempToken // Include temporary auth token
      },
      actions
    });

    // Send to all user's devices
    const promises = subscriptions.map(async (sub) => {
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
        console.log(`✅ Push notification sent to user ${userId} with ${actions.length} action(s)`);
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

// Main scheduler function - runs every 30 seconds
export async function checkWorkAlarms() {
  try {
    const now = new Date();
    const currentMinute = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}:${now.getMinutes()}`;
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Get all active alarms
    const activeAlarms = await db.select()
      .from(workAlarms)
      .where(eq(workAlarms.isActive, true));
    
    console.log(`📱 Checking alarms at ${currentTime} (${activeAlarms.length} active alarms)`);

    for (const alarm of activeAlarms) {
      // Create unique key for this alarm in this specific minute
      const checkKey = `${alarm.id}-${currentMinute}`;
      
      // Skip if already sent in this exact minute
      if (checkedAlarms.has(checkKey)) {
        console.log(`⏭️  Alarm ${alarm.id} already sent this minute`);
        continue;
      }

      // Check if alarm should trigger
      const shouldTrigger = shouldTriggerAlarm(alarm.time, alarm.weekdays);
      console.log(`🔍 Alarm ${alarm.id} (${alarm.title}) at ${alarm.time}: shouldTrigger=${shouldTrigger}`);
      
      if (shouldTrigger) {
        console.log(`⏰ TRIGGERING ALARM: ${alarm.title} for user ${alarm.userId} at ${currentTime}`);
        
        await sendPushNotification(alarm.userId, alarm.title, alarm.type as 'clock_in' | 'clock_out');
        
        // Mark as sent for this specific minute
        checkedAlarms.set(checkKey, now);
        console.log(`✅ Alarm ${alarm.id} marked as sent for minute ${currentMinute}`);
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

// Start the scheduler
export function startPushNotificationScheduler() {
  console.log('🚀 Starting Push Notification Scheduler...');
  
  // Check every 30 seconds for more responsive notifications
  const interval = setInterval(() => {
    checkWorkAlarms().catch(err => {
      console.error('❌ Error in scheduled alarm check:', err);
    });
  }, 30000);
  
  // Run immediately on start
  checkWorkAlarms().catch(err => {
    console.error('❌ Error in initial alarm check:', err);
  });
  
  console.log('✅ Push Notification Scheduler started - checking every 30 seconds');
  
  return interval;
}
