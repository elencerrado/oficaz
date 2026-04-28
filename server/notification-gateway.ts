import { getWebSocketServer } from './websocket.js';

type RealtimeEventType =
  | 'work_session_updated'
  | 'work_session_created'
  | 'work_session_deleted'
  | 'vacation_request_created'
  | 'vacation_request_updated'
  | 'modification_request_created'
  | 'modification_request_updated'
  | 'document_request_created'
  | 'document_uploaded'
  | 'document_signed'
  | 'message_received'
  | 'work_report_created'
  | 'accounting_entry_created'
  | 'accounting_entry_updated'
  | 'accounting_entry_reviewed'
  | 'accounting_entry_deleted'
  | 'reminder_created'
  | 'reminder_user_completed'
  | 'reminder_all_completed'
  | 'manager_permissions_updated'
  | 'role_changed';

type PushSchedulerModule = typeof import('./pushNotificationScheduler.js');

let pushSchedulerPromise: Promise<PushSchedulerModule> | null = null;

async function getPushScheduler(): Promise<PushSchedulerModule> {
  if (!pushSchedulerPromise) {
    pushSchedulerPromise = import('./pushNotificationScheduler.js');
  }
  return pushSchedulerPromise;
}

async function runPushOperation(operationName: string, operation: (module: PushSchedulerModule) => Promise<void>): Promise<void> {
  try {
    const pushScheduler = await getPushScheduler();
    await operation(pushScheduler);
  } catch (error) {
    console.error(`[NotificationGateway] Push operation failed: ${operationName}`, error);
  }
}

export function broadcastCompanyRealtimeEvent(companyId: number, type: RealtimeEventType, data?: unknown): void {
  const wsServer = getWebSocketServer();
  if (!wsServer) {
    return;
  }

  wsServer.broadcastToCompany(companyId, {
    type,
    companyId,
    ...(data !== undefined ? { data } : {}),
  });
}

export async function notifyAssignedVacationPush(
  userId: number,
  payload: {
    startDate: Date;
    endDate: Date;
    absenceType?: string;
    adminName: string;
    requestId?: number;
  }
): Promise<void> {
  await runPushOperation('sendAssignedVacationNotification', async ({ sendAssignedVacationNotification }) => {
    await sendAssignedVacationNotification(userId, payload);
  });
}

export async function notifyVacationReviewedPush(
  userId: number,
  status: 'approved' | 'denied',
  payload: {
    startDate: Date;
    endDate: Date;
    adminComment?: string;
    requestId?: number;
  }
): Promise<void> {
  await runPushOperation('sendVacationNotification', async ({ sendVacationNotification }) => {
    await sendVacationNotification(userId, status, payload);
  });
}

export async function notifyDocumentUploadedPush(
  userId: number,
  documentName: string,
  documentId?: number,
  isPayroll: boolean = false
): Promise<void> {
  await runPushOperation('sendDocumentNotification', async ({ sendPayrollNotification, sendNewDocumentNotification }) => {
    if (isPayroll) {
      await sendPayrollNotification(userId, documentName, documentId);
      return;
    }

    await sendNewDocumentNotification(userId, documentName, documentId);
  });
}

export async function notifyDocumentRequestPush(
  userId: number,
  documentType: string,
  message: string
): Promise<void> {
  await runPushOperation('sendDocumentRequestNotification', async ({ sendDocumentRequestNotification }) => {
    await sendDocumentRequestNotification(userId, documentType, message);
  });
}

export async function notifyMessagePush(
  userId: number,
  senderName: string,
  subject: string,
  messageId: number
): Promise<void> {
  await runPushOperation('sendMessageNotification', async ({ sendMessageNotification }) => {
    await sendMessageNotification(userId, senderName, subject, messageId);
  });
}

export async function notifyReminderSharedPush(
  userId: number,
  title: string,
  assignerName: string,
  reminderId: number
): Promise<void> {
  await runPushOperation('sendReminderSharedNotification', async ({ sendReminderSharedNotification }) => {
    await sendReminderSharedNotification(userId, title, assignerName, reminderId);
  });
}

export async function reloadRemindersSchedule(): Promise<void> {
  await runPushOperation('reloadReminders', async ({ reloadReminders }) => {
    await reloadReminders();
  });
}
