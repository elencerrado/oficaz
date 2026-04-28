import type { QueryClient } from '@tanstack/react-query';
import { formatVacationPeriod } from '@/utils/dateUtils';

export type RealtimeEvent = {
  type: string;
  companyId?: number;
  eventId?: string;
  occurredAt?: string;
  data?: any;
};

const REALTIME_EVENT_NAME = 'oficaz:realtime-event';
const EVENT_DEDUP_TTL_MS = 30000;
const seenEventIds = new Map<string, number>();

function cleanupSeenEventIds(now: number) {
  seenEventIds.forEach((timestamp, eventId) => {
    if (now - timestamp > EVENT_DEDUP_TTL_MS) {
      seenEventIds.delete(eventId);
    }
  });
}

function isDuplicateEvent(event: RealtimeEvent): boolean {
  if (!event.eventId) {
    return false;
  }

  const now = Date.now();
  cleanupSeenEventIds(now);

  if (seenEventIds.has(event.eventId)) {
    return true;
  }

  seenEventIds.set(event.eventId, now);
  return false;
}

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  vacation: 'vacaciones',
  maternity_paternity: 'baja de maternidad/paternidad',
  marriage: 'permiso por matrimonio',
  bereavement: 'permiso por fallecimiento',
  moving: 'permiso por mudanza',
  medical_appointment: 'cita medica',
  public_duty: 'deber publico',
  training: 'formacion',
  temporary_disability: 'baja medica',
  personal_leave: 'asuntos propios',
};

function invalidateByPath(queryClient: QueryClient, basePath: string) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return typeof key === 'string' && key.startsWith(basePath);
    },
  });
}

export function dispatchRealtimeEvent(event: RealtimeEvent) {
  if (isDuplicateEvent(event)) {
    return;
  }

  window.dispatchEvent(new CustomEvent<RealtimeEvent>(REALTIME_EVENT_NAME, { detail: event }));
}

export function subscribeRealtimeEvents(handler: (event: RealtimeEvent) => void): () => void {
  const listener: EventListener = (rawEvent) => {
    const event = rawEvent as CustomEvent<RealtimeEvent>;
    if (event.detail?.type) {
      handler(event.detail);
    }
  };

  window.addEventListener(REALTIME_EVENT_NAME, listener);
  return () => window.removeEventListener(REALTIME_EVENT_NAME, listener);
}

export function invalidateForRealtimeEvent(queryClient: QueryClient, event: RealtimeEvent) {
  switch (event.type) {
    case 'message_received':
      invalidateByPath(queryClient, '/api/messages');
      invalidateByPath(queryClient, '/api/messages/unread');
      invalidateByPath(queryClient, '/api/admin/dashboard');
      break;

    case 'work_session_created':
    case 'work_session_updated':
    case 'work_session_deleted':
      invalidateByPath(queryClient, '/api/work-sessions');
      invalidateByPath(queryClient, '/api/break-periods');
      invalidateByPath(queryClient, '/api/admin/work-sessions');
      invalidateByPath(queryClient, '/api/admin/dashboard');
      break;

    case 'vacation_request_created':
    case 'vacation_request_updated':
      invalidateByPath(queryClient, '/api/vacation-requests');
      invalidateByPath(queryClient, '/api/hour-based-absences');
      invalidateByPath(queryClient, '/api/admin/dashboard');
      break;

    case 'modification_request_created':
    case 'modification_request_updated':
      invalidateByPath(queryClient, '/api/admin/work-sessions/modification-requests');
      invalidateByPath(queryClient, '/api/admin/work-sessions/modification-requests/count');
      invalidateByPath(queryClient, '/api/admin/dashboard');
      break;

    case 'document_request_created':
    case 'document_uploaded':
    case 'document_signed':
      invalidateByPath(queryClient, '/api/documents');
      invalidateByPath(queryClient, '/api/document-notifications');
      invalidateByPath(queryClient, '/api/admin/dashboard');
      break;

    case 'reminder_created':
    case 'reminder_user_completed':
    case 'reminder_all_completed':
      invalidateByPath(queryClient, '/api/reminders');
      invalidateByPath(queryClient, '/api/admin/dashboard');
      break;

    case 'manager_permissions_updated':
      invalidateByPath(queryClient, '/api/settings/manager-permissions');
      invalidateByPath(queryClient, '/api/company/config');
      invalidateByPath(queryClient, '/api/subscription/info');
      invalidateByPath(queryClient, '/api/seats/can-add');
      invalidateByPath(queryClient, '/api/company/addons');
      invalidateByPath(queryClient, '/api/employees');
      break;

    case 'work_report_created':
      invalidateByPath(queryClient, '/api/admin/work-reports');
      invalidateByPath(queryClient, '/api/work-reports');
      invalidateByPath(queryClient, '/api/admin/dashboard');
      break;

    case 'accounting_entry_created':
    case 'accounting_entry_updated':
    case 'accounting_entry_reviewed':
    case 'accounting_entry_deleted':
      invalidateByPath(queryClient, '/api/accounting/entries');
      invalidateByPath(queryClient, '/api/accounting/dashboard');
      invalidateByPath(queryClient, '/api/admin/dashboard');
      break;
  }
}

export function getAdminToastFromRealtimeEvent(
  event: RealtimeEvent,
  currentUserId?: number
): { title: string; description: string; duration?: number } | null {
  const messageData = event.data || {};

  if (event.type === 'message_received' && messageData.senderName) {
    if (currentUserId && messageData.senderId === currentUserId) {
      return null;
    }

    return {
      title: '💬 Nuevo mensaje',
      description: `${messageData.senderName} te ha enviado un mensaje`,
      duration: 8000,
    };
  }

  if (event.type === 'document_uploaded' && messageData.employeeName) {
    const docType = messageData.requestType ? ` (${messageData.requestType})` : '';
    return {
      title: '📄 Documento subido',
      description: `${messageData.employeeName} ha subido un documento${docType}`,
      duration: 8000,
    };
  }

  if (event.type === 'document_signed' && messageData.userName) {
    return {
      title: '✍️ Documento firmado',
      description: `${messageData.userName} ha firmado: ${messageData.fileName || 'Documento'}`,
      duration: 8000,
    };
  }

  if (event.type === 'work_report_created' && messageData.employeeName) {
    return {
      title: '📋 Nuevo parte de trabajo',
      description: `${messageData.employeeName} ha enviado un parte${messageData.location ? ` desde ${messageData.location}` : ''}`,
      duration: 8000,
    };
  }

  if (event.type === 'accounting_entry_created') {
    const isExpense = messageData.type === 'expense';
    const actorName = messageData.employeeName || 'Empleado';
    return {
      title: isExpense ? '💸 Nuevo gasto enviado' : '💰 Nuevo ingreso registrado',
      description: `${actorName} ha enviado un ${isExpense ? 'gasto' : 'ingreso'}${messageData.concept ? `: ${messageData.concept}` : ''}`,
      duration: 8000,
    };
  }

  if (event.type === 'reminder_all_completed' && messageData.title) {
    return {
      title: '✅ Recordatorio completado',
      description: `Todos (${messageData.completedCount || 0}) han completado: ${messageData.title}`,
      duration: 8000,
    };
  }

  if (event.type === 'vacation_request_created') {
    const { employeeName, startDate, endDate, absenceType } = messageData;
    if (messageData.assignedByAdmin) {
      return null;
    }

    const periodText = startDate && endDate ? ` ${formatVacationPeriod(startDate, endDate)}` : '';
    const absenceLabel = ABSENCE_TYPE_LABELS[absenceType || 'vacation'] || 'ausencia';
    const isVacation = !absenceType || absenceType === 'vacation';

    return {
      title: isVacation ? '🏖️ Nueva solicitud de vacaciones' : '📋 Nueva solicitud de ausencia',
      description: employeeName
        ? `${employeeName} ha solicitado ${absenceLabel}${periodText}`
        : `Se ha recibido una nueva solicitud de ${absenceLabel}`,
      duration: 8000,
    };
  }

  if (event.type === 'modification_request_created') {
    const { employeeName, requestType, requestedDate } = messageData;
    const dateFormatted = requestedDate
      ? new Date(requestedDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
      : '';
    const requestTypeText = requestType === 'forgotten_checkin'
      ? 'fichaje olvidado'
      : 'modificacion de horario';

    return {
      title: '🕐 Nueva solicitud de fichaje',
      description: employeeName
        ? `${employeeName} solicita ${requestTypeText}${dateFormatted ? ` del ${dateFormatted}` : ''}`
        : 'Se ha recibido una nueva solicitud de fichaje',
      duration: 8000,
    };
  }

  return null;
}
