import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const routesPath = path.resolve(process.cwd(), 'server/routes.ts');
const routesSource = fs.readFileSync(routesPath, 'utf8');

describe('Demo billing exemption regression guards', () => {
  it('uses the persistent demoMode company field as the source of truth', () => {
    expect(routesSource).toMatch(/return company\?\.demoMode === true;/);
  });

  it('uses the demo billing exemption in trial status and auto-trial processing', () => {
    expect(routesSource).toMatch(/const isDemoBillingExempt = isDemoBillingExemptCompany\(/);
    expect(routesSource).toMatch(/if \(isDemoBillingExemptCompany\(\{ demoMode: t\.demo_mode === true \}\)\)/);
  });

  it('prevents cancellation warnings for the demo company', () => {
    expect(routesSource).toMatch(/if \(isDemoBillingExempt\) \{[\s\S]*scheduledForCancellation: false,[\s\S]*status: 'active'/);
  });

  it('allows superadmin to toggle demo mode from the company update endpoint', () => {
    expect(routesSource).toMatch(/if \(updates\.demoMode !== undefined\)/);
    expect(routesSource).toMatch(/demoMode,/);
  });
});