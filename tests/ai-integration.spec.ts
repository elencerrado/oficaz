/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import OpenAI from 'openai';
import { runAssistantTurn } from '../server/ai-runner';

const API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

if (!API_KEY) {
  describe.skip('AI integration tests (skipped) - set AI_INTEGRATIONS_OPENAI_API_KEY to run', () => {
    it('skipped', () => {});
  });
} else {
  const base = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const client = new OpenAI({ apiKey: API_KEY, baseURL: base });

  describe('AI integration (requires API key)', () => {
    it('smoke: can list models (checks auth and baseURL)', async () => {
      const models = await client.models.list();
      expect(models).toBeDefined();
      expect(models.data).toBeDefined();
    }, 20000);

    it('runs a simple informative turn (fast model) and returns text but only if smoke test passes', async () => {
      // Check models first to avoid confusing failures
      const models = await client.models.list();
      expect(models.data.length).toBeGreaterThan(0);

      const messages = [{ role: 'user', content: '¿Cuántas horas trabajó Ramírez esta semana?' }];
      const result = await runAssistantTurn(client, messages, []);
      expect(result.assistantMessage).toBeDefined();
      expect(result.usedTokens).toBeGreaterThanOrEqual(0);
    }, 20000);

    it('runs an escalation scenario (mutative) - only to confirm escalation path (no destructive actions)', async () => {
      // Only proceed if listing models works
      const models = await client.models.list();
      expect(models.data.length).toBeGreaterThan(0);

      const messages = [{ role: 'user', content: 'Por favor, prepara la creación de un empleado de prueba llamado Test User' }];
      const result = await runAssistantTurn(client, messages, []);
      // We don't actually create in this test, only ensure the flow completes and returns a message
      expect(result.assistantMessage).toBeDefined();
    }, 20000);
  });
}