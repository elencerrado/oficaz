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
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  // Check if today is in the alarm's weekdays
  if (!weekdays.includes(currentDay)) {
    return false;
  }
  
  // Check if current time matches alarm time
  return currentTime === alarmTime;
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
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 200, 100, 200],
      requireInteraction: true,
      tag: `work-alarm-${alarmType}`,
      data: {
        url: '/employee',
        type: alarmType
      }
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
        continue;
      }

      // Check if alarm should trigger
      if (shouldTriggerAlarm(alarm.time, alarm.weekdays)) {
        console.log(`⏰ Triggering alarm: ${alarm.title} for user ${alarm.userId} at ${currentMinute}`);
        
        const body = alarm.type === 'clock_in' 
          ? '¡Hora de fichar entrada!'
          : '¡Hora de fichar salida!';
        
        await sendPushNotification(alarm.userId, alarm.title, body, alarm.type as 'clock_in' | 'clock_out');
        
        // Mark as sent for this specific minute
        checkedAlarms.set(checkKey, now);
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
