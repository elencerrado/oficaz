import { describe, it, expect, vi } from 'vitest';
import { handleAIChatCore } from '../server/ai-handler';

describe('handleAIChatCore (simulated E2E core)', () => {
  it('runs assistant and executes a mutative function using mocked storage and AI', async () => {
    const openai: any = {
      models: { list: vi.fn().mockResolvedValue({ data: [{ id: 'gpt-3.5-turbo' }] }) },
      chat: {
        completions: {
          create: vi.fn()
            .mockResolvedValueOnce({ usage: { total_tokens: 10 }, choices: [{ message: { tool_calls: [{ id: '1', function: { name: 'createEmployee', arguments: JSON.stringify({ fullName: 'Test User' }) } }] } }] })
            .mockResolvedValueOnce({ usage: { total_tokens: 40 }, choices: [{ message: { content: '✅ Empleado creado correctamente' } }] })
        }
      }
    };

    const storage: any = {
      getSubscriptionByCompanyId: vi.fn().mockResolvedValue({ features: { ai_assistant: true }, aiTokensUsed: 0 }),
      getSubscriptionPlanByName: vi.fn().mockResolvedValue({ aiTokensLimitMonthly: 10000 }),
      updateCompanySubscription: vi.fn().mockResolvedValue(true)
    };

    // Provide a mocked executeAIFunction directly (avoids importing ai-assistant module and DB init)
    const spyExecute = vi.fn().mockResolvedValue({ success: true });

    const messages = [{ role: 'user', content: 'Crea un empleado de prueba' }];

    const result = await handleAIChatCore({ openai, messages, storage, companyId: 1, adminUserId: 2, executeAIFunction: spyExecute, aiFunctions: [], resolveEmployeeName: vi.fn() });

    expect(result.status).toBe(200);
    expect(result.body.functionCalled).toContain('createEmployee');
    expect(spyExecute).toHaveBeenCalled();
  });
});
