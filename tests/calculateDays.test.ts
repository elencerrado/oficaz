import { describe, it, expect } from 'vitest';
import { calculateDays } from '@/utils/dateUtils';

describe('calculateDays - Función crítica de cálculo de días de vacaciones', () => {
  describe('Casos básicos', () => {
    it('calcula correctamente un solo día', () => {
      expect(calculateDays('2025-07-01', '2025-07-01')).toBe(1);
    });

    it('calcula correctamente múltiples días', () => {
      expect(calculateDays('2025-07-01', '2025-07-05')).toBe(5);
    });

    it('calcula correctamente una semana completa', () => {
      expect(calculateDays('2025-07-01', '2025-07-07')).toBe(7);
    });
  });

  describe('Casos con fines de semana', () => {
    it('incluye fines de semana en el cálculo', () => {
      // Lunes a domingo (incluye sábado y domingo)
      expect(calculateDays('2025-06-30', '2025-07-06')).toBe(7);
    });

    it('calcula correctamente período que incluye fin de semana', () => {
      // Viernes a lunes siguiente
      expect(calculateDays('2025-07-04', '2025-07-07')).toBe(4);
    });
  });

  describe('Casos con cambios de mes', () => {
    it('calcula días entre diferentes meses', () => {
      // Del 30 de junio al 2 de julio
      expect(calculateDays('2025-06-30', '2025-07-02')).toBe(3);
    });

    it('calcula días al final del año', () => {
      // Del 30 de diciembre al 2 de enero siguiente
      expect(calculateDays('2024-12-30', '2025-01-02')).toBe(4);
    });
  });

  describe('Casos con años bisiestos', () => {
    it('maneja correctamente febrero en año bisiesto', () => {
      // 2024 es año bisiesto (febrero tiene 29 días)
      expect(calculateDays('2024-02-28', '2024-03-01')).toBe(3);
    });

    it('maneja correctamente febrero en año no bisiesto', () => {
      // 2025 no es año bisiesto (febrero tiene 28 días)
      expect(calculateDays('2025-02-28', '2025-03-01')).toBe(2);
    });
  });

  describe('Casos especiales para sistema de vacaciones', () => {
    it('calcula vacaciones típicas de una semana laboral', () => {
      // Lunes a viernes (5 días laborables + fin de semana = 7 días)
      expect(calculateDays('2025-07-07', '2025-07-13')).toBe(7);
    });

    it('calcula vacaciones de dos semanas', () => {
      expect(calculateDays('2025-07-01', '2025-07-14')).toBe(14);
    });

    it('calcula vacaciones de un mes completo', () => {
      // Todo julio (31 días)
      expect(calculateDays('2025-07-01', '2025-07-31')).toBe(31);
    });
  });

  describe('Validación de formato de fechas', () => {
    it('maneja fechas en formato ISO correcto', () => {
      expect(calculateDays('2025-01-01', '2025-01-03')).toBe(3);
    });

    it('funciona con fechas del mismo día diferentes años', () => {
      expect(calculateDays('2024-07-01', '2025-07-01')).toBe(366); // 2024 es bisiesto
    });
  });
});