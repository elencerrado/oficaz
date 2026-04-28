import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { generateToken } from '../server/middleware/auth';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/testdb';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mocked';

const assignScheduleInRangeMock = vi.fn();
const approveVacationRequestsMock = vi.fn();
const executeAIFunctionMock = vi.fn();

vi.mock('openai', () => ({
  default: class MockOpenAI {
    models = { list: vi.fn().mockResolvedValue({ data: [{ id: 'gpt-3.5-turbo' }] }) };
    chat = { completions: { create: vi.fn() } };
    constructor(_opts: any) {}
  }
}));

vi.mock('../server/ai-assistant.js', async () => {
  const actual = await vi.importActual('../server/ai-assistant.js');
  return {
    ...actual,
    executeAIFunction: executeAIFunctionMock,
    resolveEmployeeName: vi.fn(),
    assignScheduleInRange: assignScheduleInRangeMock,
    approveVacationRequests: approveVacationRequestsMock,
  };
});

vi.mock('../server/storage', async () => ({
  storage: {
    getSubscriptionByCompanyId: vi.fn().mockResolvedValue({ features: { ai_assistant: true }, aiTokensUsed: 0 }),
    getSubscriptionPlanByName: vi.fn().mockResolvedValue({ aiTokensLimitMonthly: 10000 }),
    updateCompanySubscription: vi.fn().mockResolvedValue(true),
    hasActiveAddon: vi.fn().mockResolvedValue(false),
  }
}));

describe('AI confirmAction endpoint', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    assignScheduleInRangeMock.mockResolvedValue({
      success: true,
      message: '✅ Turnos creados correctamente.',
      createdCount: 5,
    });

    const { registerRoutes } = await import('../server/routes');
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });

  it('executes createSchedule confirmation through confirmAction', async () => {
    const token = generateToken({ id: 2, username: 'admin@t.test', role: 'admin', companyId: 1 });

    const res = await request(app)
      .post('/api/ai-assistant/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        messages: [{ role: 'user', content: 'Confirma la creación de turnos' }],
        confirmAction: {
          action: 'createSchedule',
          employeeId: 10,
          startDate: '2026-04-07',
          endDate: '2026-04-11',
          startTime: '08:00',
          endTime: '14:00',
          skipWeekends: true,
          excludedWeekdays: [0, 6],
        }
      })
      .expect(200);

    expect(assignScheduleInRangeMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        employeeId: 10,
        startDate: '2026-04-07',
        endDate: '2026-04-11',
        startTime: '08:00',
        endTime: '14:00',
        forceOverwrite: true,
      })
    );

    expect(res.body.functionCalled).toBe('assignScheduleInRange');
    expect(res.body.navigateTo).toBe('/schedules');
    expect(res.body.message).toMatch(/turnos creados/i);
  });
});