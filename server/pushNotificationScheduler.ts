import webpush from 'web-push';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { workAlarms, pushSubscriptions } from '@shared/schema';

interface AlarmCheck {
  alarmId: number;
  userId: number;
  title: string;
  type: 'clock_in' | 'clock_out';
  time: string;
  lastChecked: Date;
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

// Function to send push notification to user
async function sendPushNotification(userId: number, title: string, body: string, alarmType: 'clock_in' | 'clock_out') {
  try {
    // Get all push subscriptions for this user
    const subscriptions = await db.select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (subscriptions.length === 0) {
      console.log(`📱 No push subscriptions found for user ${userId}`);
      return;
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/apple-touch-icon.png',
      badge: '/apple-touch-icon.png',
      vibrate: [200, 100, 200, 100, 200, 100, 200],
      requireInteraction: true,
      renotify: true,
      tag: `work-alarm-${alarmType}-${Date.now()}`, // Unique tag forces new notification
      data: {
        url: '/employee',
        type: alarmType,
        timestamp: Date.now()
      },
      actions: [
        {
          action: 'open',
          title: 'Abrir Oficaz'
        }
      ]
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
        console.log(`✅ Push notification sent to user ${userId} (${alarmType})`);
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
        
        const body = alarm.type === 'clock_in' 
          ? '¡Hora de fichar entrada!'
          : alarm.type === 'clock_out'
          ? '¡Hora de fichar salida!'
          : alarm.type === 'break_start'
          ? '¡Hora de iniciar descanso!'
          : '¡Hora de terminar descanso!';
        
        await sendPushNotification(alarm.userId, alarm.title, body, alarm.type as 'clock_in' | 'clock_out');
        
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
