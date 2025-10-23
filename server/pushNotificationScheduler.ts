import webpush from 'web-push';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { eq, and, isNull, sql } from 'drizzle-orm';
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
const sentIncompleteSessionNotifications = new Map<string, Date>(); // Track daily incomplete session notifications

// 🔒 CRITICAL iOS SAFARI BUG WORKAROUND: Prevent duplicate push sends within 10 seconds
// Maps "userId-endpoint-notificationType-minute" -> timestamp of last send
const recentPushSends = new Map<string, number>();
const PUSH_SEND_THROTTLE_MS = 10000; // 10 seconds

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
async function sendPushNotification(userId: number, title: string, alarmType: 'clock_in' | 'clock_out', alarmId: number) {
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

    // 🔒 CRITICAL: Use alarm-specific tag to deduplicate across multiple service workers
    // Tag format: alarm-{alarmId}-{minute} - iOS will show only ONE notification even with duplicate SWs
    const currentMinute = `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}-${new Date().getHours()}:${new Date().getMinutes()}`;
    const notificationTag = `alarm-${alarmId}-${currentMinute}`;
    
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
    const now = Date.now();
    
    const promises = subscriptions.map(async (sub) => {
      // 🔒 CRITICAL: Prevent duplicate sends to same endpoint within throttle period
      const throttleKey = `${userId}-${sub.endpoint}-${alarmType}-${currentMinute}`;
      const lastSend = recentPushSends.get(throttleKey);
      
      if (lastSend && (now - lastSend) < PUSH_SEND_THROTTLE_MS) {
        console.log(`⏭️  SKIPPING duplicate push send to endpoint (last sent ${now - lastSend}ms ago)`);
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
        
        // Mark this send in the throttle cache
        recentPushSends.set(throttleKey, now);
        
        // Clean up old entries (older than throttle period)
        for (const [key, timestamp] of Array.from(recentPushSends.entries())) {
          if (now - timestamp > PUSH_SEND_THROTTLE_MS) {
            recentPushSends.delete(key);
          }
        }
        
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

// Function to check for incomplete work sessions and send notifications
async function checkIncompleteSessions() {
  try {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const currentHour = now.getHours();
    
    // Only check at 9 AM
    if (currentHour !== 9) {
      return;
    }
    
    // Skip if already checked today
    if (sentIncompleteSessionNotifications.has(todayKey)) {
      return;
    }
    
    console.log('🔍 Checking for incomplete work sessions...');
    
    // Find all incomplete sessions (sessions from previous days without clock out)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    
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
    
    console.log(`📊 Found ${incompleteSessions.length} incomplete session(s)`);
    
    // Group by user to send only one notification per user
    const userSessionsMap = new Map<number, typeof incompleteSessions>();
    for (const session of incompleteSessions) {
      const existing = userSessionsMap.get(session.userId) || [];
      existing.push(session);
      userSessionsMap.set(session.userId, existing);
    }
    
    // Send notifications to users with incomplete sessions
    for (const [userId, sessions] of Array.from(userSessionsMap.entries())) {
      const user = sessions[0].user;
      const sessionCount = sessions.length;
      
      console.log(`📱 Sending incomplete session notification to user ${userId} (${sessionCount} session(s))`);
      
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
      
      // Generate temporary JWT token
      const tempToken = jwt.sign({
        id: user.id,
        email: user.personalEmail || user.companyEmail || `user_${user.id}@temp.com`,
        role: user.role,
        companyId: user.companyId,
        pushAction: true
      }, JWT_SECRET, { expiresIn: '24h' }); // 24 hours for incomplete session notifications
      
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
          authToken: tempToken
        },
        actions: [
          { action: 'view', title: 'Ver fichajes', icon: '/icon-192.png' }
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
          console.log(`✅ Incomplete session notification sent to user ${userId}`);
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`🗑️  Removing invalid subscription for user ${userId}`);
            await db.delete(pushSubscriptions)
              .where(eq(pushSubscriptions.endpoint, sub.endpoint));
          } else {
            console.error(`❌ Error sending notification to user ${userId}:`, error);
          }
        }
      }
    }
    
    // Mark as checked for today
    sentIncompleteSessionNotifications.set(todayKey, now);
    console.log(`✅ Incomplete sessions checked for ${todayKey}`);
    
    // Clean up old entries (older than 7 days)
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
        
        await sendPushNotification(alarm.userId, alarm.title, alarm.type as 'clock_in' | 'clock_out', alarm.id);
        
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
    
    // Create notification content
    const title = status === 'approved' 
      ? '✅ Vacaciones Aprobadas' 
      : '❌ Vacaciones Rechazadas';
    
    const body = status === 'approved'
      ? `Tu solicitud de vacaciones del ${startDateStr} al ${endDateStr} ha sido aprobada`
      : `Tu solicitud de vacaciones del ${startDateStr} al ${endDateStr} ha sido rechazada${details.adminComment ? ': ' + details.adminComment : ''}`;
    
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

// Function to send payroll document notification (pending signature)
export async function sendPayrollNotification(userId: number, documentName: string, documentId?: number) {
  try {
    console.log(`📱 Sending payroll notification to user ${userId} for document ${documentId || 'unknown'}`);
    
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
export async function sendNewDocumentNotification(userId: number, documentName: string, documentId?: number) {
  try {
    console.log(`📱 Sending new document notification to user ${userId} for document ${documentId || 'unknown'}`);
    
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

// 🔒 PROTECTED: Use global process to persist scheduler state across hot reloads
// DO NOT MODIFY - This prevents duplicate notifications from module reloads
declare global {
  var pushSchedulerAlarmInterval: NodeJS.Timeout | undefined;
  var pushSchedulerIncompleteInterval: NodeJS.Timeout | undefined;
  var pushSchedulerRunning: boolean | undefined;
}

// Call counter for debugging
let startCallCount = 0;

// Start the scheduler
export function startPushNotificationScheduler() {
  startCallCount++;
  const processId = `PID-${process.pid}`;
  const callNum = startCallCount;
  console.log(`🚀 [CALL #${callNum}] Starting Push Notification Scheduler... [${processId}]`);
  console.log(`📊 [CALL #${callNum}] Call stack:`, new Error().stack?.split('\n').slice(1, 4).join('\n'));
  
  // 🔒 CRITICAL: Only ONE instance should run - prevent duplicates
  if (global.pushSchedulerRunning) {
    console.log(`⚠️  [CALL #${callNum}] Push Notification Scheduler already running - skipping [${processId}]`);
    return {
      alarmInterval: global.pushSchedulerAlarmInterval,
      incompleteSessionInterval: global.pushSchedulerIncompleteInterval
    };
  }
  
  // 🔒 CRITICAL: ALWAYS clear existing intervals (prevents duplicates from hot reloads)
  // This is MORE important than checking if scheduler is running, because hot reloads
  // can leave orphaned intervals running even after the module reloads
  if (global.pushSchedulerAlarmInterval) {
    console.log(`🧹 Forcefully clearing old alarm interval (hot reload cleanup) [${processId}]`);
    clearInterval(global.pushSchedulerAlarmInterval);
    global.pushSchedulerAlarmInterval = undefined;
  }
  if (global.pushSchedulerIncompleteInterval) {
    console.log(`🧹 Forcefully clearing old incomplete session interval (hot reload cleanup) [${processId}]`);
    clearInterval(global.pushSchedulerIncompleteInterval);
    global.pushSchedulerIncompleteInterval = undefined;
  }
  
  // Mark as running BEFORE creating intervals
  global.pushSchedulerRunning = true;
  
  // Check every 30 seconds for work alarms
  const intervalId = Math.random().toString(36).substring(7);
  console.log(`🔵 Creating new alarm interval with ID: ${intervalId}`);
  global.pushSchedulerAlarmInterval = setInterval(() => {
    console.log(`🔵 Alarm interval ${intervalId} executing`);
    checkWorkAlarms().catch(err => {
      console.error('❌ Error in scheduled alarm check:', err);
    });
  }, 30000);
  
  // Check every 5 minutes for incomplete sessions (will only notify at 9 AM)
  global.pushSchedulerIncompleteInterval = setInterval(() => {
    checkIncompleteSessions().catch(err => {
      console.error('❌ Error checking incomplete sessions:', err);
    });
  }, 5 * 60 * 1000); // Every 5 minutes
  
  // Mark as running
  global.pushSchedulerRunning = true;
  
  // ⚠️ DO NOT run immediately on start to avoid duplicate notifications
  // Let the interval handle all checks consistently
  
  console.log('✅ Push Notification Scheduler started - checking alarms every 30s, incomplete sessions every 5min');
  
  return { 
    alarmInterval: global.pushSchedulerAlarmInterval, 
    incompleteSessionInterval: global.pushSchedulerIncompleteInterval 
  };
}
