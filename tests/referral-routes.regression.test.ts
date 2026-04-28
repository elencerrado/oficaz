import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const routesPath = path.resolve(process.cwd(), 'server/routes.ts');
const routesSource = fs.readFileSync(routesPath, 'utf8');

describe('Referral routes regression guards', () => {
  it('registers the Stripe webhook route only once', () => {
    const matches = routesSource.match(/app\.post\('\/api\/stripe\/webhook'/g) || [];
    expect(matches).toHaveLength(1);
  });

  it('refreshes referrer discounts on failed payments and cancellations', () => {
    expect(routesSource).toMatch(/case 'invoice\.payment_failed':[\s\S]*await refreshReferrerDiscountFromReferredCompany\(companyId\);/);
    expect(routesSource).toMatch(/case 'customer\.subscription\.deleted':[\s\S]*await refreshReferrerDiscountFromReferredCompany\(companyId\);/);
  });

  it('syncs Stripe when account referral stats correct a stale discount', () => {
    expect(routesSource).toMatch(/if \(Number\(subscriptionRow\.referralDiscountPercent \|\| 0\) !== computedDiscountPercent\)[\s\S]*await syncReferralDiscountToStripeForCompany\(companyId, computedDiscountPercent\);/);
  });
});