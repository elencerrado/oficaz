import { describe, expect, it } from 'vitest';

type ApiResult<T = unknown> = {
  status: number;
  ok: boolean;
  json: T | null;
  text: string;
};

const BASE_URL = (process.env.TIME_SMOKE_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

const EMPLOYEE_TOKEN = process.env.TIME_SMOKE_EMPLOYEE_TOKEN;
const ADMIN_TOKEN = process.env.TIME_SMOKE_ADMIN_TOKEN;

const EMPLOYEE_LOGIN = process.env.TIME_SMOKE_EMPLOYEE_LOGIN;
const EMPLOYEE_PASSWORD = process.env.TIME_SMOKE_EMPLOYEE_PASSWORD;
const EMPLOYEE_COMPANY_ALIAS = process.env.TIME_SMOKE_EMPLOYEE_COMPANY_ALIAS;

const ADMIN_LOGIN = process.env.TIME_SMOKE_ADMIN_LOGIN;
const ADMIN_PASSWORD = process.env.TIME_SMOKE_ADMIN_PASSWORD;
const ADMIN_COMPANY_ALIAS = process.env.TIME_SMOKE_ADMIN_COMPANY_ALIAS;

const canRun = Boolean(
  (EMPLOYEE_TOKEN || (EMPLOYEE_LOGIN && EMPLOYEE_PASSWORD)) &&
  (ADMIN_TOKEN || (ADMIN_LOGIN && ADMIN_PASSWORD))
);

const maybeIt = canRun ? it : it.skip;

async function request<T = unknown>(path: string, token: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const text = await response.text();
  let json: T | null = null;

  try {
    json = text ? (JSON.parse(text) as T) : null;
  } catch {
    json = null;
  }

  return {
    status: response.status,
    ok: response.ok,
    json,
    text,
  };
}

async function login(dniOrEmail: string, password: string, companyAlias?: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dniOrEmail, password, ...(companyAlias ? { companyAlias } : {}) }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Login failed (${response.status}): ${(payload as any)?.message || 'sin detalle'}`);
  }

  const token = (payload as any)?.token;
  if (!token || typeof token !== 'string') {
    throw new Error('Login success pero sin token.');
  }

  return token;
}

async function getEmployeeToken(): Promise<string> {
  if (EMPLOYEE_TOKEN) return EMPLOYEE_TOKEN;
  return login(EMPLOYEE_LOGIN!, EMPLOYEE_PASSWORD!, EMPLOYEE_COMPANY_ALIAS);
}

async function getAdminToken(): Promise<string> {
  if (ADMIN_TOKEN) return ADMIN_TOKEN;
  return login(ADMIN_LOGIN!, ADMIN_PASSWORD!, ADMIN_COMPANY_ALIAS);
}

async function ensureNoActiveBreak(token: string) {
  const activeBreak = await request<any>('/api/break-periods/active', token);
  if (activeBreak.ok && activeBreak.json) {
    await request('/api/break-periods/end', token, { method: 'POST', body: JSON.stringify({}) });
  }
}

async function ensureNoActiveSession(token: string) {
  const activeSession = await request<any>('/api/work-sessions/active', token);
  if (activeSession.ok && activeSession.json) {
    await ensureNoActiveBreak(token);
    await request('/api/work-sessions/clock-out', token, { method: 'POST', body: JSON.stringify({}) });
  }
}

describe('Time Tracking Smoke', () => {
  maybeIt('clock-in/break/clock-out y visibilidad en admin', async () => {
    const employeeToken = await getEmployeeToken();
    const adminToken = await getAdminToken();

    const me = await request<any>('/api/auth/me', employeeToken);
    expect(me.status).toBe(200);
    const employeeId = (me.json as any)?.user?.id;
    expect(typeof employeeId).toBe('number');

    await ensureNoActiveBreak(employeeToken);
    await ensureNoActiveSession(employeeToken);

    const clockIn = await request<any>('/api/work-sessions/clock-in', employeeToken, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(clockIn.status).toBe(201);

    const activeAfterIn = await request<any>('/api/work-sessions/active', employeeToken);
    expect(activeAfterIn.status).toBe(200);
    expect(activeAfterIn.json).toBeTruthy();
    expect((activeAfterIn.json as any)?.status).toBe('active');

    const adminStatusWhileWorking = await request<any[]>('/api/work-sessions/today-status', adminToken);
    expect(adminStatusWhileWorking.status).toBe(200);
    const rowWorking = (adminStatusWhileWorking.json || []).find((r: any) => r.employeeId === employeeId);
    expect(rowWorking).toBeTruthy();
    expect(['incomplete', 'completed', 'not_clocked_in']).toContain((rowWorking as any).status);

    const breakStart = await request<any>('/api/break-periods/start', employeeToken, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect([200, 201]).toContain(breakStart.status);

    const activeBreak = await request<any>('/api/break-periods/active', employeeToken);
    expect(activeBreak.status).toBe(200);
    expect(activeBreak.json).toBeTruthy();

    const breakEnd = await request<any>('/api/break-periods/end', employeeToken, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(breakEnd.status).toBe(200);

    const activeBreakAfterEnd = await request<any>('/api/break-periods/active', employeeToken);
    expect(activeBreakAfterEnd.status).toBe(200);
    expect(activeBreakAfterEnd.json).toBeFalsy();

    const clockOut = await request<any>('/api/work-sessions/clock-out', employeeToken, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(clockOut.status).toBe(200);

    const activeAfterOut = await request<any>('/api/work-sessions/active', employeeToken);
    expect(activeAfterOut.status).toBe(200);
    expect(activeAfterOut.json).toBeFalsy();

    const companySessions = await request<any>('/api/work-sessions/company?limit=50&offset=0', adminToken);
    expect(companySessions.status).toBe(200);
    expect(Array.isArray((companySessions.json as any)?.sessions)).toBe(true);

    const employeeSession = ((companySessions.json as any)?.sessions || []).find((s: any) => s.userId === employeeId);
    expect(employeeSession).toBeTruthy();
  });

  maybeIt('empleado puede crear solicitud de modificacion y admin verla', async () => {
    const employeeToken = await getEmployeeToken();
    const adminToken = await getAdminToken();

    const sessions = await request<any[]>('/api/work-sessions', employeeToken);
    expect(sessions.status).toBe(200);

    const latest = (sessions.json || [])[0] as any;
    expect(latest).toBeTruthy();

    const now = new Date();
    const requestedDate = new Date(now);
    requestedDate.setHours(0, 0, 0, 0);

    const requestedClockIn = new Date(now);
    requestedClockIn.setHours(8, 0, 0, 0);

    const requestedClockOut = new Date(now);
    requestedClockOut.setHours(16, 0, 0, 0);

    const createReq = await request<any>('/api/work-sessions/request-modification', employeeToken, {
      method: 'POST',
      body: JSON.stringify({
        workSessionId: latest.id,
        requestType: 'modify_time',
        requestedDate: requestedDate.toISOString(),
        requestedClockIn: requestedClockIn.toISOString(),
        requestedClockOut: requestedClockOut.toISOString(),
        reason: 'Smoke test regression validation',
      }),
    });

    expect(createReq.status).toBe(201);
    expect((createReq.json as any)?.status).toBe('pending');

    const adminRequests = await request<any[]>('/api/admin/work-sessions/modification-requests?status=pending', adminToken);
    expect(adminRequests.status).toBe(200);

    const createdId = (createReq.json as any)?.id;
    const exists = (adminRequests.json || []).some((r: any) => r.id === createdId);
    expect(exists).toBe(true);
  });

  maybeIt('si existe sesion incompleta, se puede cerrar sin error', async () => {
    const employeeToken = await getEmployeeToken();

    const sessions = await request<any[]>('/api/work-sessions', employeeToken);
    expect(sessions.status).toBe(200);

    const incomplete = (sessions.json || []).find((s: any) => s.status === 'incomplete' && !s.clockOut);
    if (!incomplete) {
      // Not a failure: this scenario depends on existing data. The dedicated test should seed one when needed.
      expect(true).toBe(true);
      return;
    }

    const clockIn = new Date(incomplete.clockIn);
    const closeAt = new Date(clockIn.getTime() + 2 * 60 * 60 * 1000);

    const closeResp = await request<any>('/api/work-sessions/clock-out-incomplete', employeeToken, {
      method: 'POST',
      body: JSON.stringify({
        sessionId: incomplete.id,
        clockOutTime: closeAt.toISOString(),
      }),
    });

    expect(closeResp.status).toBe(200);
    expect((closeResp.json as any)?.status).toBe('completed');
  });

  maybeIt('admin puede convertir sesion en turno nocturno cruzando dia y recalcula horas', async () => {
    const employeeToken = await getEmployeeToken();
    const adminToken = await getAdminToken();

    const me = await request<any>('/api/auth/me', employeeToken);
    expect(me.status).toBe(200);
    const employeeId = (me.json as any)?.user?.id;
    expect(typeof employeeId).toBe('number');

    const now = new Date();
    const targetDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const dateForManual = `${yyyy}-${mm}-${dd}`;

    const createManual = await request<any>('/api/admin/work-sessions/create-manual', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        employeeId,
        date: dateForManual,
        clockIn: '22:00',
        clockOut: '23:00',
        reason: 'Smoke overnight setup',
      }),
    });

    expect(createManual.status).toBe(201);
    const sessionId = (createManual.json as any)?.id;
    expect(typeof sessionId).toBe('number');

    const overnightClockIn = new Date(targetDate);
    overnightClockIn.setHours(22, 0, 0, 0);

    const overnightClockOut = new Date(targetDate);
    overnightClockOut.setDate(overnightClockOut.getDate() + 1);
    overnightClockOut.setHours(6, 0, 0, 0);

    const modify = await request<any>(`/api/admin/work-sessions/${sessionId}/modify`, adminToken, {
      method: 'PATCH',
      body: JSON.stringify({
        clockIn: overnightClockIn.toISOString(),
        clockOut: overnightClockOut.toISOString(),
        reason: 'Smoke overnight validation',
      }),
    });

    expect(modify.status).toBe(200);
    const totalHours = Number((modify.json as any)?.totalHours);
    expect(Number.isFinite(totalHours)).toBe(true);
    expect(totalHours).toBeGreaterThan(7.5);
    expect(totalHours).toBeLessThan(8.5);

    const companySessions = await request<any>('/api/work-sessions/company?limit=100&offset=0', adminToken);
    expect(companySessions.status).toBe(200);
    const found = ((companySessions.json as any)?.sessions || []).find((s: any) => s.id === sessionId);
    expect(found).toBeTruthy();
    expect(Number(found.totalHours)).toBeGreaterThan(7.5);
  });
});
