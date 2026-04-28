import type { Request } from 'express';

const REFERRAL_COUPON_ID_PREFIX = 'oficaz_referral_';

export function normalizeReferralCode(value: string): string {
  return (value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 32);
}

export function calculateReferralDiscountPercent(activePaidReferrals: number): number {
  if (activePaidReferrals >= 7) return 20;
  if (activePaidReferrals >= 4) return 15;
  if (activePaidReferrals >= 2) return 10;
  if (activePaidReferrals >= 1) return 5;
  return 0;
}

export function getReferralCouponId(discountPercent: number): string {
  const normalized = Math.max(0, Math.min(100, Math.round(discountPercent * 100) / 100));
  return `${REFERRAL_COUPON_ID_PREFIX}${String(normalized).replace('.', '_')}`;
}

export function isReferralCouponId(couponId: string | null | undefined): boolean {
  return Boolean(couponId && couponId.startsWith(REFERRAL_COUPON_ID_PREFIX));
}

export function getPublicBaseUrl(req: Request): string {
  const configuredBaseUrl = process.env.PUBLIC_APP_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  const forwardedProtoRaw = req.headers['x-forwarded-proto'];
  const forwardedHostRaw = req.headers['x-forwarded-host'];

  const forwardedProto = Array.isArray(forwardedProtoRaw)
    ? forwardedProtoRaw[0]
    : typeof forwardedProtoRaw === 'string'
      ? forwardedProtoRaw.split(',')[0].trim()
      : null;

  const forwardedHost = Array.isArray(forwardedHostRaw)
    ? forwardedHostRaw[0]
    : typeof forwardedHostRaw === 'string'
      ? forwardedHostRaw.split(',')[0].trim()
      : null;

  const protocol = forwardedProto || req.protocol || 'https';
  const host = forwardedHost || req.get('host') || 'localhost:5000';

  return `${protocol}://${host}`;
}

export function buildReferralLink(baseUrl: string, referralCode: string): string {
  return `${baseUrl.replace(/\/$/, '')}/register?ref=${encodeURIComponent(referralCode)}`;
}
