import { describe, it, expect, vi } from 'vitest';
import { runAssistantTurn } from '../server/ai-runner';

describe('ai-runner escalation flow', () => {
  it('escalates when cheap model attempts a mutative function', async () => {
    // Mock openai client with sequential responses
    const firstResponse = {
      usage: { total_tokens: 10 },
      choices: [ { message: { function_call: { name: 'createEmployee' }, content: null } } ]
    };

    const secondResponse = {
      usage: { total_tokens: 40 },
      choices: [ { message: { content: '✅ Empleado creado correctamente' } } ]
    };

    const create = vi.fn()
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse);

    const openai: any = { chat: { completions: { create } } };

    const messages = [{ role: 'user', content: 'Crea un empleado' }];
    const tools: any[] = [];

    const result = await runAssistantTurn(openai, messages, tools);

    expect(create).toHaveBeenCalledTimes(2);
    expect(result.escalated).toBe(true);
    expect(result.assistantMessage.content).toContain('Empleado creado');
    expect(result.usedTokens).toBe(50);
  });

  it('does not escalate for simple informative response', async () => {
    const onlyResponse = {
      usage: { total_tokens: 5 },
      choices: [ { message: { content: 'Ramírez trabajó 32 horas esta semana' } } ]
    };

    const create = vi.fn().mockResolvedValueOnce(onlyResponse);
    const openai: any = { chat: { completions: { create } } };

    const messages = [{ role: 'user', content: '¿Cuántas horas trabajó Ramírez?' }];
    const tools: any[] = [];

    const result = await runAssistantTurn(openai, messages, tools);

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.escalated).toBe(false);
    expect(result.assistantMessage.content).toContain('Ramírez trabajó');
    expect(result.usedTokens).toBe(5);
  });
});
