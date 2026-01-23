import { describe, it, expect, vi } from 'vitest';
import { runToolCalls } from '../server/ai-tool-runner';

describe('ai-tool-runner', () => {
  it('resolves employee names and executes functions', async () => {
    const toolCalls = [
      {
        id: '1',
        function: {
          name: 'createReminder',
          arguments: JSON.stringify({ title: 'Recordar', assignToEmployeeNames: ['Ana', 'Pedro'], reminderDate: '2026-01-01' })
        }
      }
    ];

    const mockResolve = vi.fn()
      .mockResolvedValueOnce({ employeeId: 10 })
      .mockResolvedValueOnce({ employeeId: 11 });

    const mockExecute = vi.fn().mockResolvedValue({ success: true, navigateTo: '/reminders' });

    const ctx: any = { storage: {}, companyId: 1, adminUserId: 2 };

    const results = await runToolCalls(toolCalls as any, ctx, mockResolve as any, mockExecute as any, {} as any);

    expect(mockResolve).toHaveBeenCalledTimes(2);
    expect(mockExecute).toHaveBeenCalledWith('createReminder', {
      title: 'Recordar',
      reminderDate: '2026-01-01',
      assignToEmployeeIds: [10, 11]
    }, ctx);

    const parsed = JSON.parse(results[0].content);
    expect(parsed.success).toBe(true);
    expect(parsed.navigateTo).toBe('/reminders');
  });

  it('returns error result if name resolution fails', async () => {
    const toolCalls = [
      {
        id: '1',
        function: {
          name: 'createReminder',
          arguments: JSON.stringify({ title: 'Recordar', assignToEmployeeNames: ['NoExiste'] })
        }
      }
    ];

    const mockResolve = vi.fn().mockResolvedValueOnce({ error: 'no encontrado' });
    const mockExecute = vi.fn();

    const results = await runToolCalls(toolCalls as any, { companyId: 1 } as any, mockResolve as any, mockExecute as any, {} as any);

    const parsed = JSON.parse(results[0].content);
    expect(parsed.error).toContain('Empleado');
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
