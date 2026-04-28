import { describe, expect, it } from 'vitest';
import dotenv from 'dotenv';

dotenv.config();

type SmokeResponse<T = unknown> = {
  status: number;
  ok: boolean;
  json: T | null;
  text: string;
  headers: Headers;
};

const BASE_URL = (process.env.SUPERADMIN_SMOKE_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const EXPLICIT_TOKEN = process.env.SUPERADMIN_SMOKE_TOKEN;
const EMAIL = process.env.SUPER_ADMIN_EMAIL;
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
const TOTP_CODE = process.env.SUPERADMIN_SMOKE_TOTP;
const RUN_SUPERADMIN_SMOKE = process.env.RUN_SUPERADMIN_SMOKE === '1';

const canRun = RUN_SUPERADMIN_SMOKE && Boolean(EXPLICIT_TOKEN || (EMAIL && PASSWORD));
const maybeIt = canRun ? it : it.skip;

async function request<T = unknown>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<SmokeResponse<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
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
    headers: response.headers,
  };
}

async function getSuperAdminToken(): Promise<string> {
  if (EXPLICIT_TOKEN) {
    return EXPLICIT_TOKEN;
  }

  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'Configura SUPERADMIN_SMOKE_TOKEN o SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD para ejecutar el smoke test.',
    );
  }

  const loginResponse = await fetch(`${BASE_URL}/api/super-admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      ...(TOTP_CODE ? { totpCode: TOTP_CODE } : {}),
    }),
  });

  const payload = await loginResponse.json().catch(() => ({}));

  if (!loginResponse.ok) {
    if ((payload as any)?.requiresTOTP && !TOTP_CODE) {
      throw new Error(
        'El login superadmin requiere TOTP. Configura SUPERADMIN_SMOKE_TOTP para ejecutar este smoke test.',
      );
    }

    throw new Error(
      `Login superadmin falló (${loginResponse.status}): ${(payload as any)?.message || 'sin detalle'}`,
    );
  }

  const token = (payload as any)?.token;
  if (!token || typeof token !== 'string') {
    throw new Error('Login superadmin respondió sin token válido.');
  }

  return token;
}

describe('SuperAdmin Smoke API', () => {
  maybeIt('valida endpoints críticos y controles de seguridad básicos', async () => {
    const token = await getSuperAdminToken();

    const stats = await request('/api/super-admin/stats', token);
    expect(stats.status).toBe(200);
    expect(stats.json).toBeTypeOf('object');

    const companies = await request('/api/super-admin/companies', token);
    expect(companies.status).toBe(200);
    expect(Array.isArray(companies.json)).toBe(true);

    const seatPrices = await request('/api/super-admin/seat-prices', token);
    expect(seatPrices.status).toBe(200);
    expect(Array.isArray(seatPrices.json)).toBe(true);

    const addonPrices = await request('/api/super-admin/addon-prices', token);
    expect(addonPrices.status).toBe(200);
    expect(Array.isArray(addonPrices.json)).toBe(true);

    const plans = await request('/api/super-admin/subscription-plans', token);
    expect(plans.status).toBe(200);
    expect(Array.isArray(plans.json)).toBe(true);

    const features = await request('/api/super-admin/features', token);
    expect(features.status).toBe(200);
    expect(Array.isArray(features.json)).toBe(true);

    const auditLogs = await request('/api/super-admin/audit-logs?limit=5&offset=0', token);
    expect(auditLogs.status).toBe(200);
    expect((auditLogs.json as any)?.limit).toBe(5);
    expect((auditLogs.json as any)?.offset).toBe(0);
    expect(Array.isArray((auditLogs.json as any)?.logs)).toBe(true);

    const pendingDeletion = await request('/api/superadmin/companies/pending-deletion', token);
    expect(pendingDeletion.status).toBe(200);
    expect(Array.isArray(pendingDeletion.json)).toBe(true);
    expect(pendingDeletion.headers.get('cache-control') || '').toContain('no-store');

    const referralResync = await request('/api/super-admin/referrals/resync-stripe-discounts', token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(referralResync.status).toBe(200);
    if (referralResync.json && typeof referralResync.json === 'object') {
      expect(typeof (referralResync.json as any)?.totalSubscriptionsScanned).toBe('number');
      expect(typeof (referralResync.json as any)?.totalStripeCandidates).toBe('number');
      expect(typeof (referralResync.json as any)?.syncedCount).toBe('number');
      expect(typeof (referralResync.json as any)?.failedCount).toBe('number');
      expect(Array.isArray((referralResync.json as any)?.results)).toBe(true);
    } else {
      expect(referralResync.text.length).toBeGreaterThan(0);
    }

    const invalidCompanyId = await request('/api/super-admin/companies/abc', token);
    expect(invalidCompanyId.status).toBe(400);

    const invalidCampaignId = await request('/api/super-admin/email-campaigns/abc/history', token);
    expect(invalidCampaignId.status).toBe(400);
  });
});
