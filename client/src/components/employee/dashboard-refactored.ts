/**
 * REFACTORIZACIÓN SEGURA: Employee Dashboard Refactored
 * 
 * Esta versión refactorizada mantiene TODA la lógica en el padre (employee-dashboard.tsx)
 * pero extrae componentes presentacionales puros en subcomponentes reutilizables.
 * 
 * Beneficios:
 * - Bundle splitting: Los subcomponentes pueden lazy-loadear si es necesario
 * - Mantenibilidad: Cada componente tiene una responsabilidad clara
 * - Testabilidad: Componentes sin state son fáciles de testear
 * - No breaking changes: El padre sigue siendo la fuente de verdad
 */

import {
  EmployeeWorkSessionCard,
  FeatureNotifications,
  EmployeeHeader,
} from './index';

export {
  EmployeeWorkSessionCard,
  FeatureNotifications,
  EmployeeHeader,
};
