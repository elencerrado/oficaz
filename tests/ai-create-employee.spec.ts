import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/testdb';

const sendEmployeeWelcomeEmailMock = vi.fn();

vi.mock('../server/email.js', () => ({
  sendEmployeeWelcomeEmail: sendEmployeeWelcomeEmailMock,
}));

let createEmployee: typeof import('../server/ai-assistant.js').createEmployee;

beforeAll(async () => {
  ({ createEmployee } = await import('../server/ai-assistant.js'));
});

describe('createEmployee', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendEmployeeWelcomeEmailMock.mockResolvedValue(true);
  });

  it('creates pending activation employee and sends activation email', async () => {
    const storage = {
      getCompany: vi.fn().mockResolvedValue({ id: 1, name: 'Oficaz Demo', companyAlias: 'demo' }),
      getSubscriptionByCompanyId: vi.fn().mockResolvedValue({
        includedAdmins: 1,
        extraAdmins: 0,
        includedManagers: 1,
        extraManagers: 0,
        includedEmployees: 10,
        extraEmployees: 0,
        maxUsers: 20,
      }),
      getUsersByCompany: vi.fn().mockResolvedValue([]),
      createUser: vi.fn().mockResolvedValue({
        id: 7,
        fullName: 'Ana Ruiz',
        personalEmail: 'ana@test.com',
        companyEmail: 'ana@test.com',
        position: 'Empleado',
        role: 'employee',
      }),
      createActivationToken: vi.fn().mockResolvedValue({ token: 'activation-token-123' }),
      createAuditLog: vi.fn().mockResolvedValue({ id: 1 }),
      getUser: vi.fn().mockResolvedValue({ companyEmail: 'admin@test.com' }),
    };

    const result = await createEmployee(
      { storage: storage as any, companyId: 1, adminUserId: 99 },
      {
        fullName: 'Ana Ruiz',
        email: 'ana@test.com',
        dni: '12345678A',
      }
    );

    expect(storage.createUser).toHaveBeenCalledWith(expect.objectContaining({
      fullName: 'Ana Ruiz',
      personalEmail: 'ana@test.com',
      companyEmail: 'ana@test.com',
      password: '',
      isPendingActivation: true,
      isActive: true,
    }));

    expect(storage.createActivationToken).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      email: 'ana@test.com',
      createdBy: 99,
      token: expect.any(String),
    }));

    expect(sendEmployeeWelcomeEmailMock).toHaveBeenCalledWith(
      'ana@test.com',
      'Ana Ruiz',
      'Oficaz Demo',
      'activation-token-123',
      expect.stringContaining('/employee-activation?token=activation-token-123')
    );

    expect(result.success).toBe(true);
    expect(result.message).toMatch(/establezca su contraseña/i);
  });
});