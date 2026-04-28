import { describe, expect, it, vi } from 'vitest';
import {
  dispatchRealtimeEvent,
  getAdminToastFromRealtimeEvent,
  subscribeRealtimeEvents,
} from '../client/src/lib/realtime-events';

describe('realtime-events deduplication', () => {
  it('dispatches only once for duplicate eventId values', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeRealtimeEvents(handler);

    dispatchRealtimeEvent({
      type: 'message_received',
      eventId: 'evt-1',
      data: { senderId: 2, senderName: 'Ana' },
    });
    dispatchRealtimeEvent({
      type: 'message_received',
      eventId: 'evt-1',
      data: { senderId: 2, senderName: 'Ana' },
    });

    unsubscribe();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe events without eventId', () => {
    const handler = vi.fn();
    const unsubscribe = subscribeRealtimeEvents(handler);

    dispatchRealtimeEvent({ type: 'vacation_request_created', data: { employeeName: 'Juan' } });
    dispatchRealtimeEvent({ type: 'vacation_request_created', data: { employeeName: 'Juan' } });

    unsubscribe();
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

describe('admin realtime toast mapping', () => {
  it('suppresses self-sent message toasts for admin', () => {
    const toast = getAdminToastFromRealtimeEvent(
      {
        type: 'message_received',
        data: { senderId: 7, senderName: 'Admin' },
      },
      7
    );

    expect(toast).toBeNull();
  });

  it('returns message toast for messages from other users', () => {
    const toast = getAdminToastFromRealtimeEvent(
      {
        type: 'message_received',
        data: { senderId: 9, senderName: 'Empleado 1' },
      },
      7
    );

    expect(toast).not.toBeNull();
    expect(toast?.title).toContain('Nuevo mensaje');
  });

  it('suppresses admin-assigned vacation toasts to avoid duplicate local feedback', () => {
    const toast = getAdminToastFromRealtimeEvent({
      type: 'vacation_request_created',
      data: {
        employeeName: 'Pedro',
        assignedByAdmin: true,
        startDate: '2026-04-20',
        endDate: '2026-04-21',
        absenceType: 'vacation',
      },
    });

    expect(toast).toBeNull();
  });

  it('returns toast for employee-created vacation requests', () => {
    const toast = getAdminToastFromRealtimeEvent({
      type: 'vacation_request_created',
      data: {
        employeeName: 'Pedro',
        assignedByAdmin: false,
        startDate: '2026-04-20',
        endDate: '2026-04-21',
        absenceType: 'vacation',
      },
    });

    expect(toast).not.toBeNull();
    expect(toast?.title).toContain('solicitud');
  });

  it('returns toast for reminder task completion by all assignees', () => {
    const toast = getAdminToastFromRealtimeEvent({
      type: 'reminder_all_completed',
      data: {
        title: 'Enviar parte semanal',
        completedCount: 3,
      },
    });

    expect(toast).not.toBeNull();
    expect(toast?.description).toContain('Enviar parte semanal');
  });
});
