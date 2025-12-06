// ═══════════════════════════════════════════════════════════════════════════
// MODELO DE ACCESO A FUNCIONALIDADES
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ PÁGINAS BASE (siempre disponibles para TODAS las cuentas, NO son add-ons):
//    - Panel de Control (dashboard/inicio)
//    - Configuración (settings)
//    - Empleados (employees) 
//    - Tienda de Complementos (addon-store)
//
// ADD-ONS GRATUITOS (incluidos en todas las suscripciones):
//    - time_tracking (Fichajes)
//    - vacation (Vacaciones)
//    - schedules (Cuadrante de horarios)
//
// ADD-ONS DE PAGO (requieren compra):
//    - messages (9€) - Mensajería Interna
//    - reminders (6€) - Recordatorios
//    - documents (15€) - Gestión Documental
//    - work_reports (12€) - Partes de Trabajo
//    - ai_assistant (25€) - Asistente IA
// ═══════════════════════════════════════════════════════════════════════════

// Canonical addon keys matching backend database
export const CANONICAL_ADDON_KEYS = [
  'time_tracking',
  'vacation', 
  'schedules',
  'messages',
  'reminders',
  'documents',
  'ai_assistant',
  'work_reports',
  'inventory'
] as const;

export type CanonicalAddonKey = typeof CANONICAL_ADDON_KEYS[number];

// Legacy feature keys used in existing code that need to be mapped
export type LegacyFeatureKey = 
  | 'timeTracking'           // → time_tracking
  | 'reports'                // → work_reports
  | 'analytics'              // → work_reports
  | 'logoUpload'             // company setting (always true if logo exists)
  | 'employee_time_edit'     // company setting
  | 'employee_time_edit_permission'; // company setting

// All feature keys (canonical + legacy)
export type FeatureKey = CanonicalAddonKey | LegacyFeatureKey;

// Backend subscription features - only canonical keys
export interface SubscriptionFeatures {
  time_tracking: boolean;
  vacation: boolean;
  schedules: boolean;
  messages: boolean;
  reminders: boolean;
  documents: boolean;
  ai_assistant: boolean;
  work_reports: boolean;
  inventory: boolean;
  // Company settings (not addon-based)
  logoUpload?: boolean;
  employee_time_edit?: boolean;
  employee_time_edit_permission?: boolean;
}

export interface Subscription {
  id: number;
  plan: string;
  status: string;
  features: SubscriptionFeatures;
  maxUsers: number;
}

// Map legacy feature names to canonical addon keys
const LEGACY_TO_CANONICAL: Record<LegacyFeatureKey, CanonicalAddonKey | 'logoUpload' | 'employee_time_edit' | 'employee_time_edit_permission'> = {
  timeTracking: 'time_tracking',
  reports: 'work_reports',
  analytics: 'work_reports',
  logoUpload: 'logoUpload',
  employee_time_edit: 'employee_time_edit',
  employee_time_edit_permission: 'employee_time_edit_permission',
};

// Feature display names for UI
const FEATURE_NAMES: Record<FeatureKey, string> = {
  time_tracking: 'Fichajes',
  vacation: 'Vacaciones',
  schedules: 'Cuadrante de horarios',
  messages: 'Mensajería Interna',
  reminders: 'Recordatorios',
  documents: 'Gestión Documental',
  ai_assistant: 'Asistente IA',
  work_reports: 'Partes de Trabajo',
  inventory: 'Inventario',
  timeTracking: 'Fichajes',
  reports: 'Partes de Trabajo',
  analytics: 'Partes de Trabajo',
  logoUpload: 'Logo personalizado',
  employee_time_edit: 'Edición de tiempos',
  employee_time_edit_permission: 'Permisos de edición de tiempos',
};

// Normalize feature key to canonical form
function normalizeFeatureKey(feature: FeatureKey): string {
  if (feature in LEGACY_TO_CANONICAL) {
    return LEGACY_TO_CANONICAL[feature as LegacyFeatureKey];
  }
  return feature;
}

export const checkFeatureAccess = (subscription: Subscription | null, feature: FeatureKey): boolean => {
  if (!subscription) {
    return false;
  }
  
  // Allow access for both active subscriptions and trial periods
  if (subscription.status !== 'active' && subscription.status !== 'trial') {
    return false;
  }
  
  // Normalize to canonical key
  const canonicalKey = normalizeFeatureKey(feature);
  
  // Company settings that are not addon-based - always check directly
  if (canonicalKey === 'logoUpload' || canonicalKey === 'employee_time_edit' || canonicalKey === 'employee_time_edit_permission') {
    return subscription.features[canonicalKey as keyof SubscriptionFeatures] ?? true;
  }
  
  // Check addon access via subscription.features
  return subscription.features[canonicalKey as keyof SubscriptionFeatures] ?? false;
};

// Get the display name for a feature
export const getFeatureName = (feature: FeatureKey): string => {
  return FEATURE_NAMES[feature] || feature;
};

// DEPRECATED: Returns generic message since we no longer use plan names
export const getRequiredPlanForFeature = (_feature: FeatureKey): string => {
  return 'Complemento requerido';
};

export const getFeatureRestrictionMessage = (feature: FeatureKey): string => {
  const featureName = getFeatureName(feature);
  return `La funcionalidad de ${featureName} no está disponible. Puedes añadirla desde la Tienda de Complementos.`;
};

export const checkUserLimit = (subscription: Subscription | null, currentUsers: number): boolean => {
  if (!subscription) return false;
  if (!subscription.maxUsers) return true; // Unlimited
  return currentUsers <= subscription.maxUsers;
};
