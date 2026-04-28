import { describe, expect, it } from 'vitest';
import { confirmScheduleCreation, confirmVacationApproval } from '../server/confirmationBuilders';

describe('confirmationBuilders', () => {
  it('builds professional schedule confirmation payload', () => {
    const payload = confirmScheduleCreation(
      'Juan Perez',
      5,
      '2026-04-07',
      '2026-04-11',
      '08:00 - 14:00',
      ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes']
    );

    expect(payload.needsConfirmation).toBe(true);
    expect(payload.confirmationModal.icon).toBe('info');
    expect(payload.confirmationModal.items.some((item) => item.label === 'Cantidad de turnos' && item.value === 5)).toBe(true);
  });

  it('builds vacation approval confirmation with all_pending context', () => {
    const payload = confirmVacationApproval(2, [
      { employeeName: 'Ana Ruiz', startDate: '2026-04-10', endDate: '2026-04-12' },
      { employeeName: 'Luis Mena', startDate: '2026-04-15', endDate: '2026-04-18' }
    ]);

    expect(payload.needsConfirmation).toBe(true);
    expect(payload.confirmationContext.action).toBe('approveVacations');
    expect(payload.confirmationContext.requestIds).toBe('all_pending');
  });
});
