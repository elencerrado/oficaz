import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

type LoginPayload = {
  token?: string;
  user?: any;
  company?: any;
  subscription?: any;
};

const EMPLOYEE_TOKEN = process.env.TIME_VISUAL_EMPLOYEE_TOKEN;
const ADMIN_TOKEN = process.env.TIME_VISUAL_ADMIN_TOKEN;

const EMPLOYEE_LOGIN = process.env.TIME_VISUAL_EMPLOYEE_LOGIN;
const EMPLOYEE_PASSWORD = process.env.TIME_VISUAL_EMPLOYEE_PASSWORD;
const EMPLOYEE_COMPANY_ALIAS = process.env.TIME_VISUAL_EMPLOYEE_COMPANY_ALIAS;

const ADMIN_LOGIN = process.env.TIME_VISUAL_ADMIN_LOGIN;
const ADMIN_PASSWORD = process.env.TIME_VISUAL_ADMIN_PASSWORD;
const ADMIN_COMPANY_ALIAS = process.env.TIME_VISUAL_ADMIN_COMPANY_ALIAS;

const canRun = Boolean(
  (EMPLOYEE_TOKEN || (EMPLOYEE_LOGIN && EMPLOYEE_PASSWORD)) &&
  (ADMIN_TOKEN || (ADMIN_LOGIN && ADMIN_PASSWORD))
);

test.describe('Visual Time Tracking', () => {
  test.skip(!canRun, 'Define credenciales/tokens TIME_VISUAL_* para ejecutar visual tests.');

  async function apiLogin(request: APIRequestContext, dniOrEmail: string, password: string, companyAlias?: string): Promise<LoginPayload> {
    const response = await request.post('/api/auth/login', {
      data: {
        dniOrEmail,
        password,
        ...(companyAlias ? { companyAlias } : {}),
      },
    });

    const rawBody = await response.text();
    let parsed: any = null;
    try {
      parsed = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok()) {
      throw new Error(
        `Login failed (${response.status()}) for ${dniOrEmail} in company ${companyAlias || '(none)'}: ${rawBody || 'empty body'}`
      );
    }

    return (parsed || {}) as LoginPayload;
  }

  async function requestWithToken(request: APIRequestContext, token: string, method: 'GET' | 'POST', path: string, data?: any) {
    const response = await request.fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data,
    });

    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return { response, json, text };
  }

  async function bootstrapAuth(page: Page, authData: any) {
    await page.addInitScript((payload: any) => {
      localStorage.setItem('authData', JSON.stringify(payload));
      sessionStorage.removeItem('superAdminToken');
    }, authData);
  }

  test('admin ve panel de fichajes y stats principales', async ({ page, request }) => {
    const adminAuth = ADMIN_TOKEN
      ? {
          token: ADMIN_TOKEN,
          ...(await (async () => {
            const me = await requestWithToken(request, ADMIN_TOKEN, 'GET', '/api/auth/me');
            return me.json || {};
          })()),
        }
      : await apiLogin(request, ADMIN_LOGIN!, ADMIN_PASSWORD!, ADMIN_COMPANY_ALIAS);

    const companyAlias =
      adminAuth?.company?.companyAlias ||
      adminAuth?.company?.company_alias ||
      ADMIN_COMPANY_ALIAS;

    expect(companyAlias).toBeTruthy();

    await bootstrapAuth(page, {
      user: adminAuth.user,
      token: adminAuth.token,
      company: adminAuth.company,
      subscription: adminAuth.subscription || null,
    });

    await page.goto(`/${companyAlias}/fichajes`, { waitUntil: 'networkidle' });

    await expect(page.getByTestId('stat-incomplete-sessions')).toBeVisible();
    await expect(page.getByTestId('stat-weekly-average')).toBeVisible();
    await expect(page.getByTestId('stat-monthly-average')).toBeVisible();
    await expect(page.getByTestId('stat-pending-requests')).toBeVisible();
  });

  test('empleado ficha y admin lo ve en estado de trabajo', async ({ page, request }) => {
    const employeeAuth = EMPLOYEE_TOKEN
      ? {
          token: EMPLOYEE_TOKEN,
          ...(await (async () => {
            const me = await requestWithToken(request, EMPLOYEE_TOKEN, 'GET', '/api/auth/me');
            return me.json || {};
          })()),
        }
      : await apiLogin(request, EMPLOYEE_LOGIN!, EMPLOYEE_PASSWORD!, EMPLOYEE_COMPANY_ALIAS);

    const adminAuth = ADMIN_TOKEN
      ? {
          token: ADMIN_TOKEN,
          ...(await (async () => {
            const me = await requestWithToken(request, ADMIN_TOKEN, 'GET', '/api/auth/me');
            return me.json || {};
          })()),
        }
      : await apiLogin(request, ADMIN_LOGIN!, ADMIN_PASSWORD!, ADMIN_COMPANY_ALIAS);

    const companyAlias =
      adminAuth?.company?.companyAlias ||
      adminAuth?.company?.company_alias ||
      ADMIN_COMPANY_ALIAS;

    const employeeId = employeeAuth?.user?.id;
    expect(employeeId).toBeTruthy();
    expect(companyAlias).toBeTruthy();

    const activeBreak = await requestWithToken(request, employeeAuth.token!, 'GET', '/api/break-periods/active');
    if (activeBreak.response.ok() && activeBreak.json) {
      await requestWithToken(request, employeeAuth.token!, 'POST', '/api/break-periods/end', {});
    }

    const activeSession = await requestWithToken(request, employeeAuth.token!, 'GET', '/api/work-sessions/active');
    if (activeSession.response.ok() && activeSession.json) {
      await requestWithToken(request, employeeAuth.token!, 'POST', '/api/work-sessions/clock-out', {});
    }

    const clockIn = await requestWithToken(request, employeeAuth.token!, 'POST', '/api/work-sessions/clock-in', {});
    expect(clockIn.response.status()).toBe(201);

    await bootstrapAuth(page, {
      user: adminAuth.user,
      token: adminAuth.token,
      company: adminAuth.company,
      subscription: adminAuth.subscription || null,
    });

    await page.goto(`/${companyAlias}/fichajes`, { waitUntil: 'networkidle' });

    const companySessions = await requestWithToken(
      request,
      adminAuth.token!,
      'GET',
      '/api/work-sessions/company?limit=50&offset=0'
    );

    expect(companySessions.response.ok()).toBeTruthy();
    const sessions = companySessions.json?.sessions || [];
    const activeEmployeeSession = sessions.find((s: any) => s.userId === employeeId && s.status === 'active');
    expect(activeEmployeeSession).toBeTruthy();

    await expect(page.getByTestId('stat-incomplete-sessions')).toBeVisible();
  });
});
