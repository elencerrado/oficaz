// Sistema de restricciones de funcionalidades por plan
export interface SubscriptionFeatures {
  messages: boolean;
  documents: boolean;
  vacation: boolean;
  timeTracking: boolean;
  timeEditingPermissions: boolean;
  reports: boolean;
  analytics: boolean;
  customization: boolean;
  logoUpload: boolean;
  api: boolean;
  reminders: boolean;
  employee_time_edit_permission: boolean;
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
  console.log('checkFeatureAccess called with:', { subscription, feature });
  if (!subscription) {
    console.log('No subscription found');
    return false;
  }
  
  // Allow access for both active subscriptions and trial periods
  if (subscription.status !== 'active' && subscription.status !== 'trial') {
    console.log('Subscription not active or trial:', subscription.status);
    return false;
  }
  
  // For both trial and active subscriptions, use the features configured in the database
  // Trial periods should have same features as the chosen plan, just time-limited
  const hasFeature = subscription.features[feature] || false;
  console.log('Feature access:', { 
    status: subscription.status, 
    plan: subscription.plan, 
    feature, 
    hasFeature, 
    features: subscription.features 
  });
  return hasFeature;
};

export const getRequiredPlanForFeature = (feature: keyof SubscriptionFeatures): string => {
  const featurePlanMap = {
    messages: 'Basic',
    documents: 'Pro',
    vacation: 'Basic',
    timeTracking: 'Basic',
    timeEditingPermissions: 'Pro',
    reports: 'Pro',
    analytics: 'Pro',
    customization: 'Master',
    logoUpload: 'Pro',
    api: 'Master',
    reminders: 'Pro',
    employee_time_edit_permission: 'Master'
  };
  
  return featurePlanMap[feature] || 'Pro';
};

export const getFeatureRestrictionMessage = (feature: keyof SubscriptionFeatures): string => {
  const featureNames = {
    messages: 'Mensajes',
    documents: 'Documentos',
    vacation: 'Vacaciones',
    timeTracking: 'Fichajes',
    timeEditingPermissions: 'Editar horas empleados',
    reports: 'Reportes',
    analytics: 'Analíticas',
    customization: 'Personalización',
    logoUpload: 'Subir logo',
    api: 'API',
    reminders: 'Recordatorios',
    employee_time_edit_permission: 'Permisos edición tiempo empleados'
  };

  return `La funcionalidad de ${featureNames[feature]} no está disponible en tu plan actual. Contacta con el administrador para actualizar tu suscripción.`;
};

export const checkUserLimit = (subscription: Subscription | null, currentUsers: number): boolean => {
  if (!subscription) return false;
  if (!subscription.maxUsers) return true; // Unlimited
  return currentUsers <= subscription.maxUsers;
};