import { describe, it, expect, vi } from 'vitest';
import { runAssistantTurn } from '../server/ai-runner';

describe('runAssistantTurn model fallback', () => {
  it('uses fallback model when preferred unavailable and then escalates', async () => {
    const firstResp = {
      usage: { total_tokens: 10 },
      choices: [{ message: { function_call: { name: 'createEmployee' }, content: 'No puedo confirmar sin revisar mejor.' } }]
    };

    const secondResp = {
      usage: { total_tokens: 40 },
      choices: [{ message: { content: '✅ Empleado creado correctamente' } }]
    };

    const create = vi.fn()
      // first call: models.list (for pickAvailableModel)
      .mockResolvedValueOnce({ data: [{ id: 'gpt-3.5-turbo' }] })
      // second call: cheap model response
      .mockResolvedValueOnce(firstResp)
      // third call: strong model response
      .mockResolvedValueOnce(secondResp);

    const openai: any = { models: { list: create.bind(null) }, chat: { completions: { create } } };

    const messages = [{ role: 'user', content: 'Crea un empleado' }];

    const result = await runAssistantTurn(openai as any, messages, []);

    expect(result.escalated).toBe(true);
    expect(result.usedTokens).toBe(50);
  });
});
