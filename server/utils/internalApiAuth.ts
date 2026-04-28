import crypto from 'crypto';

/**
 * Returns the shared secret used by internal scheduler HTTP endpoints.
 * If not explicitly configured, a per-process random value is generated once.
 */
export function getInternalApiSecret(): string {
  if (!process.env.INTERNAL_API_SECRET) {
    process.env.INTERNAL_API_SECRET = crypto.randomBytes(32).toString('hex');
  }

  return process.env.INTERNAL_API_SECRET;
}
