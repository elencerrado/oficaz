import { describe, it, expect } from 'vitest';
import {
  normalizeReferralCode,
  calculateReferralDiscountPercent,
  getReferralCouponId,
  isReferralCouponId,
  buildReferralLink,
} from '../server/utils/referral-utils';

describe('Referral flow logic', () => {
  it('normalizes referral code safely', () => {
    const value = normalizeReferralCode(' ofi*caz 123 ñ -- abc ');
    expect(value).toBe('OFICAZ123--ABC');
    expect(value.length).toBeLessThanOrEqual(32);
  });

  it('calculates referral discount tiers correctly', () => {
    expect(calculateReferralDiscountPercent(0)).toBe(0);
    expect(calculateReferralDiscountPercent(1)).toBe(5);
    expect(calculateReferralDiscountPercent(2)).toBe(10);
    expect(calculateReferralDiscountPercent(3)).toBe(10);
    expect(calculateReferralDiscountPercent(4)).toBe(15);
    expect(calculateReferralDiscountPercent(6)).toBe(15);
    expect(calculateReferralDiscountPercent(7)).toBe(20);
    expect(calculateReferralDiscountPercent(999)).toBe(20);
  });

  it('builds deterministic Stripe coupon ids for referral discounts', () => {
    expect(getReferralCouponId(5)).toBe('oficaz_referral_5');
    expect(getReferralCouponId(10)).toBe('oficaz_referral_10');
    expect(getReferralCouponId(15.5)).toBe('oficaz_referral_15_5');
    expect(getReferralCouponId(20)).toBe('oficaz_referral_20');
  });

  it('detects referral coupon ids', () => {
    expect(isReferralCouponId('oficaz_referral_10')).toBe(true);
    expect(isReferralCouponId('other_coupon')).toBe(false);
    expect(isReferralCouponId(null)).toBe(false);
    expect(isReferralCouponId(undefined)).toBe(false);
  });

  it('builds correct referral registration URL', () => {
    const link = buildReferralLink('https://app.oficaz.es', 'OFI-ABC123');
    expect(link).toBe('https://app.oficaz.es/register?ref=OFI-ABC123');
  });

  it('encodes referral code in URL', () => {
    const link = buildReferralLink('https://app.oficaz.es/', 'OFI CODE/123');
    expect(link).toBe('https://app.oficaz.es/register?ref=OFI%20CODE%2F123');
  });
});
