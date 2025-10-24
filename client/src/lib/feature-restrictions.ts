// Sistema de restricciones de funcionalidades por plan
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
}

export interface Subscription {
  id: number;
  plan: string;
  status: string;
  features: SubscriptionFeatures;
  maxUsers: number;
}

// Trial and active subscriptions now use the same feature system
// Features are determined by the subscription plan configuration in the database

export const checkFeatureAccess = (subscription: Subscription | null, feature: keyof SubscriptionFeatures): boolean => {
  if (!subscription) {
    return false;
  }
  
  // Allow access for both active subscriptions and trial periods
  if (subscription.status !== 'active' && subscription.status !== 'trial') {
    return false;
  }
  
  // Core features that are ALWAYS available in any plan (never restricted)
  const alwaysAvailableFeatures: (keyof SubscriptionFeatures)[] = [
    'timeTracking', // Panel Principal siempre disponible, Fichajes siempre disponible
    // Note: Configuración y Empleados no se verifican con features, están disponibles por rol
  ];
  
  if (alwaysAvailableFeatures.includes(feature)) {
    return true;
  }
  
  // Map frontend feature names to database feature names
  const featureMapping: Record<keyof SubscriptionFeatures, string> = {
    timeTracking: 'time',
    messages: 'messages',
    documents: 'documents',
    vacation: 'vacation',
    schedules: 'schedules',
    reminders: 'reminders',
    timeEditingPermissions: 'employee_time_edit_permission',
    analytics: 'reports',
    customization: 'customization',
    logoUpload: 'logoUpload',
    api: 'api',
    employee_time_edit_permission: 'employee_time_edit_permission',
    employee_time_edit: 'employee_time_edit'
  };
  
  // Get the database feature name
  const dbFeatureName = featureMapping[feature] || feature;
  
  // For both trial and active subscriptions, use the features configured in the database
  // Trial periods should have same features as the chosen plan, just time-limited
  const hasFeature = (subscription.features as any)[dbFeatureName] || false;
  return hasFeature;
};

export const getRequiredPlanForFeature = (feature: keyof SubscriptionFeatures): string => {
  const featurePlanMap = {
    messages: 'Basic',
    documents: 'Pro',
    vacation: 'Basic',
    schedules: 'Basic',
    timeTracking: 'Basic',
    timeEditingPermissions: 'Pro',
    analytics: 'Pro',
    customization: 'Master',
    logoUpload: 'Pro',
    api: 'Master',
    reminders: 'Pro',
    employee_time_edit_permission: 'Master',
    employee_time_edit: 'Master'
  };
  
  return featurePlanMap[feature] || 'Pro';
};

export const getFeatureRestrictionMessage = (feature: keyof SubscriptionFeatures): string => {
  const featureNames: Record<keyof SubscriptionFeatures, string> = {
    messages: 'Mensajes',
    documents: 'Documentos',
    vacation: 'Vacaciones',
    schedules: 'Cuadrante de horarios',
    timeTracking: 'Fichajes',
    timeEditingPermissions: 'Editar horas empleados',
    analytics: 'Analíticas',
    customization: 'Personalización',
    logoUpload: 'Subir logo',
    api: 'API',
    reminders: 'Recordatorios',
    employee_time_edit_permission: 'Permisos edición tiempo empleados',
    employee_time_edit: 'Empleados pueden editar sus tiempos'
  };

  return `La funcionalidad de ${featureNames[feature]} no está disponible en tu plan actual. Contacta con el administrador para actualizar tu suscripción.`;
};

export const checkUserLimit = (subscription: Subscription | null, currentUsers: number): boolean => {
  if (!subscription) return false;
  if (!subscription.maxUsers) return true; // Unlimited
  return currentUsers <= subscription.maxUsers;
};

