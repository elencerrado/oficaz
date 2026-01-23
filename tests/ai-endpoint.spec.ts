import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock OpenAI client module
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      baseURL: any;
      apiKey: any;
      models: any;
      chat: any;
      constructor(opts: any) {
        this.baseURL = opts.baseURL;
        this.apiKey = opts.apiKey;
        this.models = { list: vi.fn().mockResolvedValue({ data: [{ id: 'gpt-3.5-turbo' }] }) };
        const firstResponse = {
          usage: { total_tokens: 10 },
          choices: [{ message: { tool_calls: [{ id: '1', function: { name: 'createEmployee', arguments: JSON.stringify({ fullName: 'Test User', email: 'test@example.com' }) } }] } }]
        };
        const secondResponse = {
          usage: { total_tokens: 40 },
          choices: [{ message: { content: '✅ Empleado creado correctamente' } }]
        };
        const create = vi.fn()
          .mockResolvedValueOnce(firstResponse)
          .mockResolvedValueOnce(secondResponse);
        this.chat = { completions: { create } };
      }
    }
  };
});

// Mock ai-assistant module (functions & execute, no DB changes)
vi.mock('../server/ai-assistant.js', async () => {
  const actual = await vi.importActual('../server/ai-assistant.js');
  return {
    AI_FUNCTIONS: actual.AI_FUNCTIONS,
    executeAIFunction: vi.fn(async (name: string, params: any) => {
      if (name === 'createEmployee') {
        return { success: true, createdEmployeeId: 999, navigateTo: '/empleados/999' };
      }
      return { success: true };
    }),
    resolveEmployeeName: vi.fn()
  };
});

// Mock storage to prevent DB writes and allow subscription checks
vi.mock('../server/storage', async () => {
  return {
    storage: {
      getSubscriptionByCompanyId: vi.fn().mockResolvedValue({ features: { ai_assistant: true }, aiTokensUsed: 0 }),
      getSubscriptionPlanByName: vi.fn().mockResolvedValue({ aiTokensLimitMonthly: 10000 }),
      updateCompanySubscription: vi.fn().mockResolvedValue(true),
    }
  };
});

import { registerRoutes } from '../server/routes';
import { generateToken } from '../server/middleware/auth';

describe('AI assistant endpoint (simulated E2E)', () => {
  let app: any;
  beforeEach(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });

  it('accepts a chat request and executes a mutative function without touching DB (mocked)', async () => {
    // Create admin token
    const token = generateToken({ id: 2, username: 'admin@t.test', role: 'admin', companyId: 1 });

    const res = await request(app)
      .post('/api/ai-assistant/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ messages: [{ role: 'user', content: 'Crea un empleado de prueba llamado Test User' }] })
      .expect(200);

    expect(res.body).toBeDefined();
    // The mocked ai-assistant returns a message or result; ensure navigateTo present in response
    expect(res.body.navigateTo).toBeDefined();
  }, 20000);
});
