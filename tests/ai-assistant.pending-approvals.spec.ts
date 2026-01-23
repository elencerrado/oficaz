import { describe, it, expect, beforeAll } from 'vitest';

// Ensure ai-assistant can import without real DB during unit tests
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/testdb';

let getPendingApprovals: any;
beforeAll(async () => {
  ({ getPendingApprovals } = await import('../server/ai-assistant.js'));
});

const makeStorage = (companyAlias: string, vacationCount = 0, timeCount = 0, reportCount = 0) => ({
  getCompany: async (companyId: number) => ({ id: companyId, companyAlias }),
  getVacationRequestsByCompany: async (companyId: number) => (
    Array.from({ length: vacationCount }).map((_, i) => ({ id: i + 1, status: 'pending', user: { fullName: `User ${i + 1}` } }))
  ),
  getCompanyModificationRequests: async (companyId: number) => (
    Array.from({ length: timeCount }).map((_, i) => ({ id: i + 1, status: 'pending', requestType: 'edit' }))
  ),
  getWorkReportsByCompany: async (companyId: number) => (
    Array.from({ length: reportCount }).map((_, i) => ({ id: i + 1, status: 'pending' }))
  ),
  getUsersByCompany: async (companyId: number) => ([])
});

describe('getPendingApprovals', () => {
  it('navigates to ausencias when there are pending absences (vacation requests) and uses "ausencias" wording', async () => {
    const storage = makeStorage('comp', 2, 0, 0);
    const res = await getPendingApprovals({ storage: storage as any, companyId: 1, adminUserId: 1 });

    expect(res.navigateTo).toBe('/comp/ausencias?tab=requests&status=pending');
    expect(res.message).toMatch(/ausencias/);
    expect(res.pending.vacations).toBe(2);
    expect(res.pending.total).toBe(2);
  });

  it('navigates to fichajes when time modifications are the largest', async () => {
    const storage = makeStorage('comp', 0, 3, 1);
    const res = await getPendingApprovals({ storage: storage as any, companyId: 1, adminUserId: 1 });

    expect(res.navigateTo).toBe('/comp/fichajes?tab=requests&status=pending');
    expect(res.pending.timeModifications).toBe(3);
    expect(res.pending.total).toBe(4);
  });
});
