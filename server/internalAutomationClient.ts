import { getInternalApiSecret } from './utils/internalApiAuth';

const INTERNAL_SERVER_PORT = Number(process.env.PORT || 5000);
const INTERNAL_SERVER_BASE_URL = `http://127.0.0.1:${INTERNAL_SERVER_PORT}`;

type InternalCallOptions = {
  timeoutMs?: number;
  maxAttempts?: number;
};

export function getInternalServerBaseUrl(): string {
  return INTERNAL_SERVER_BASE_URL;
}

/**
 * Calls an internal HTTP endpoint exposed by this server process.
 * Retries transient failures to absorb short startup/network hiccups.
 */
export async function callInternalAutomationEndpoint(
  path: string,
  options: InternalCallOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxAttempts = options.maxAttempts ?? 3;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${INTERNAL_SERVER_BASE_URL}${normalizedPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': getInternalApiSecret(),
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response;
    } catch (error: any) {
      clearTimeout(timeout);

      const message = error instanceof Error ? error.message : String(error);
      const isTransient =
        message.includes('fetch failed') ||
        message.includes('ECONNREFUSED') ||
        message.includes('aborted') ||
        message.includes('ECONNRESET');

      if (!isTransient || attempt === maxAttempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  throw new Error(`Unable to call internal endpoint ${normalizedPath}`);
}
