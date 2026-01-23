import { describe, it, expect, vi } from 'vitest';
import { handleAIChatCore } from '../server/ai-handler.js';

describe('handleAIChatCore hours pre-parser', () => {
  it('detects hours query and returns friendly message + navigateTo', async () => {
    const messages = [{ role: 'user', content: 'cuantas horas trabajo ramirez el mes pasado?' }];

    // Mock storage and executeAIFunction
    const storage = {
      getSubscriptionByCompanyId: async (companyId: number) => ({ features: { ai_assistant: true }, effectivePlan: 'pro' }),
      getCompany: async (companyId: number) => ({ companyAlias: 'comp' })
    };

    const fakeResult = {
      success: true,
      message: 'Juan José Ramirez Martín trabajó 152.7 horas el mes pasado, distribuidas en 19 fichajes.',
      data: { employeeName: 'Juan José Ramirez Martín', totalHours: 152.7, totalSessions: 19, period: 'el mes pasado' },
      navigateTo: '/comp/fichajes?startDate=2025-11-01&endDate=2025-11-30&employeeId=7'
    };

    const executeAIFunction = vi.fn(async (name: string, params: any) => {
      expect(name).toBe('getEmployeeWorkHours');
      expect(params.period).toBe('last_month');
      expect(params.employeeName?.toLowerCase().includes('ramirez')).toBeTruthy();
      return fakeResult;
    });

    const res = await handleAIChatCore({ openai: {}, messages, storage: storage as any, companyId: 1, adminUserId: 1, executeAIFunction, aiFunctions: [] });

    expect(res.status).toBe(200);
    expect(res.body.navigateTo).toBe(fakeResult.navigateTo);
    expect(res.body.message).toMatch(/Sí, Juan José Ramirez Martín trabajó 152.7 horas el mes pasado — te las muestro\./);

    // Now simulate assistant calling the function via tool_calls (tool flow)
    const openai: any = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValueOnce({ usage: { total_tokens: 10 }, choices: [{ message: { tool_calls: [{ id: '1', function: { name: 'getEmployeeWorkHours', arguments: JSON.stringify({ employeeName: 'Ramirez', period: 'last_month' }) } }] } }] })
            .mockResolvedValueOnce({ usage: { total_tokens: 20 }, choices: [{ message: { content: '...' } }] })
        }
      }
    };

    const spyExecute = vi.fn().mockResolvedValue(fakeResult);
    const res2 = await handleAIChatCore({ openai, messages, storage: storage as any, companyId: 1, adminUserId: 1, executeAIFunction: spyExecute, aiFunctions: [{ name: 'getEmployeeWorkHours' }] });

    expect(res2.status).toBe(200);
    expect(res2.body.navigateTo).toBe(fakeResult.navigateTo);
    expect(res2.body.message).toMatch(/Sí, Juan José Ramirez Martín trabajó 152.7 horas el mes pasado — te las muestro\./);
  });

  it('asks for clarification if employee not found', async () => {
    const messages = [{ role: 'user', content: 'cuantas horas trabajo pedro el mes pasado?' }];

    const storage = {
      getSubscriptionByCompanyId: async (companyId: number) => ({ features: { ai_assistant: true } }),
      getCompany: async (companyId: number) => ({ companyAlias: 'comp' })
    };

    const executeAIFunction = vi.fn(async (name: string, params: any) => {
      return { success: false, error: 'No encontré al empleado "pedro"' };
    });

    const res = await handleAIChatCore({ openai: {}, messages, storage: storage as any, companyId: 1, adminUserId: 1, executeAIFunction, aiFunctions: [] });

    expect(res.status).toBe(200);
    expect(res.body.message.toLowerCase()).toMatch(/no encontr/i);
  });
});