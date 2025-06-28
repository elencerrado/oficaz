// ⚠️ PROTECTED CODE - DO NOT MODIFY ⚠️
// Esta función es crítica para el cálculo de días de vacaciones
// Cualquier cambio puede romper funcionalidades existentes
import { parseISO, differenceInDays } from 'date-fns';

/**
 * Calcula el número de días entre dos fechas (inclusivo)
 * @param startDate - Fecha de inicio en formato ISO string (YYYY-MM-DD)
 * @param endDate - Fecha de fin en formato ISO string (YYYY-MM-DD)
 * @returns Número de días incluyendo fecha de inicio y fin
 */
export const calculateDays = (startDate: string, endDate: string): number => {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  return differenceInDays(end, start) + 1;
};
// ⚠️ END PROTECTED CODE ⚠️