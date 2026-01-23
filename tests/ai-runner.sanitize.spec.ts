import { describe, it, expect } from 'vitest';
import { runAssistantTurn } from '../server/ai-runner.js';

// Mock an OpenAI client response shape used by runAssistantTurn
const makeOpenAI = (messageContent: string) => ({
  chat: {
    completions: {
      create: async () => ({
        usage: { total_tokens: 10 },
        choices: [{ message: { role: 'assistant', content: messageContent } }]
      })
    }
  }
});

describe('ai-runner sanitization', () => {
  it('removes internal markdown links and replaces vacaciones with ausencias', async () => {
    const raw = 'Tienes 8 solicitudes de vacaciones. Puedes ver más detalles y gestionarlas haciendo clic [aquí](/test/ausencias?tab=requests&status=pending).';
    const openai = makeOpenAI(raw);

    // runAssistantTurn expects tools array; pass empty
    const res = await runAssistantTurn(openai as any, [{ role: 'user', content: 'tengo solicitudes pendientes?' }], []);

    expect(res.assistantMessage.content).not.toMatch(/\[aquí\]|https?:\/\//);
    expect(res.assistantMessage.content).toMatch(/ausencias/);
    expect(res.assistantMessage.content).toMatch(/Tienes 8 solicitudes de ausencias/);
  });

  it('strips "haz clic" and similar suffixes', async () => {
    const raw = 'Hay 2 solicitudes, haz clic aquí para verlas: /ausencias?tab=requests';
    const openai = makeOpenAI(raw);
    const res = await runAssistantTurn(openai as any, [{ role: 'user', content: 'tengo solicitudes pendientes?' }], []);

    expect(res.assistantMessage.content).not.toMatch(/haz clic/i);
    expect(res.assistantMessage.content).toMatch(/Hay 2 solicitudes/);
  });
});
