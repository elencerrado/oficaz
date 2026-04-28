// Test setup file para Vitest
import { vi } from 'vitest';

// Mock global de localStorage para tests
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Guard to avoid errors when running in Node environment (no `window`)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });
}

// Mock global de fetch para tests de API (solo en entornos con `window`, p.ej. jsdom)
if (typeof window !== 'undefined') {
  const useRealFetch =
    process.env.RUN_LIVE_PAYMENT_INTEGRATION === '1' ||
    process.env.RUN_SUPERADMIN_SMOKE === '1' ||
    process.env.RUN_TIME_TRACKING_SMOKE === '1';

  if (!useRealFetch) {
    global.fetch = vi.fn();
  }
}

// Configurar timezone para tests consistentes
process.env.TZ = 'Europe/Madrid';