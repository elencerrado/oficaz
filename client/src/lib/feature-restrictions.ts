// NEW MODEL: Feature access based on add-ons (not plans)
// Free features: time_tracking, vacation, schedules - always available
// Paid add-ons: messages, reminders, documents, ai_assistant, work_reports - require purchase

export interface SubscriptionFeatures {
  messages: boolean;
  documents: boolean;
  vacation: boolean;
  schedules: boolean;
  timeTracking: boolean;
  timeEditingPermissions: boolean;
  analytics: boolean;
  customization: boolean;
  logoUpload: boolean;
  api: boolean;
  reminders: boolean;
  employee_time_edit_permission: boolean;
  employee_time_edit: boolean;
  ai_assistant: boolean;
  reports: boolean;
  work_reports: boolean;
  time_tracking: boolean;
}

export interface Subscription {
  id: number;
  plan: string;
  status: string;
  features: SubscriptionFeatures;
  maxUsers: number;
}

// Feature key mapping to addon keys in database
const FEATURE_TO_ADDON_KEY: Record<string, string> = {
  timeTracking: 'time_tracking',
  time_tracking: 'time_tracking',
  messages: 'messages',
  documents: 'documents',
  vacation: 'vacation',
  schedules: 'schedules',
  reminders: 'reminders',
  ai_assistant: 'ai_assistant',
  work_reports: 'work_reports',
  reports: 'work_reports',
  analytics: 'work_reports',
  timeEditingPermissions: 'employee_time_edit_permission',
  employee_time_edit_permission: 'employee_time_edit_permission',
  employee_time_edit: 'employee_time_edit',
  customization: 'customization',
  logoUpload: 'logoUpload',
  api: 'api',
};

// Feature display names
const FEATURE_NAMES: Record<string, string> = {
  messages: 'Mensajería Interna',
  documents: 'Gestión Documental',
  vacation: 'Vacaciones',
  schedules: 'Cuadrante de horarios',
  timeTracking: 'Fichajes',
  time_tracking: 'Fichajes',
  reminders: 'Recordatorios',
  ai_assistant: 'Asistente IA',
  work_reports: 'Partes de Trabajo',
  reports: 'Partes de Trabajo',
  analytics: 'Partes de Trabajo',
  timeEditingPermissions: 'Editar tiempos empleados',
  employee_time_edit_permission: 'Permisos edición tiempo',
  employee_time_edit: 'Editar tiempos',
  customization: 'Personalización',
  logoUpload: 'Subir logo',
  api: 'API',
};

export const checkFeatureAccess = (subscription: Subscription | null, feature: keyof SubscriptionFeatures): boolean => {
  if (!subscription) {
    return false;
  }
  
  // Allow access for both active subscriptions and trial periods
  if (subscription.status !== 'active' && subscription.status !== 'trial') {
    return false;
  }
  
  // Get the addon key for this feature
  const addonKey = FEATURE_TO_ADDON_KEY[feature] || feature;
  
  // Check if the feature is available in subscription.features
  // This is populated from the backend based on purchased addons and free features
  const features = subscription.features as unknown as Record<string, boolean>;
  const hasFeature = features[addonKey] || features[feature] || false;
  return hasFeature;
};

// Get the display name for a feature
export const getFeatureName = (feature: keyof SubscriptionFeatures): string => {
  return FEATURE_NAMES[feature] || feature;
};

// DEPRECATED: Returns generic message since we no longer use plan names
export const getRequiredPlanForFeature = (_feature: keyof SubscriptionFeatures): string => {
  return 'Complemento requerido';
};

export const getFeatureRestrictionMessage = (feature: keyof SubscriptionFeatures): string => {
  const featureName = FEATURE_NAMES[feature] || feature;
  return `La funcionalidad de ${featureName} no está disponible. Puedes añadirla desde la Tienda de Complementos.`;
};

export const checkUserLimit = (subscription: Subscription | null, currentUsers: number): boolean => {
  if (!subscription) return false;
  if (!subscription.maxUsers) return true; // Unlimited
  return currentUsers <= subscription.maxUsers;
};
