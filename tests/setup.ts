// Test setup file para Vitest
import { vi } from 'vitest';

// Mock global de localStorage para tests
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock global de fetch para tests de API
global.fetch = vi.fn();

// Configurar timezone para tests consistentes
process.env.TZ = 'Europe/Madrid';