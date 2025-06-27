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
}

export interface Subscription {
  id: number;
  plan: string;
  status: string;
  features: SubscriptionFeatures;
  maxUsers: number;
}

// Trial includes same features as chosen plan - only time limited (14 days)
const getTrialFeaturesForPlan = (plan: string): SubscriptionFeatures => {
  const basicFeatures: SubscriptionFeatures = {
    messages: true,
    vacation: true,
    timeTracking: true,
    documents: false,
    timeEditingPermissions: false,
    reports: false,
    analytics: false,
    customization: true,
    logoUpload: false,
    api: false,
    reminders: false
  };

  const proFeatures: SubscriptionFeatures = {
    messages: true,
    vacation: true,
    timeTracking: true,
    documents: true,
    timeEditingPermissions: true,
    reports: true,
    analytics: true,
    customization: true,
    logoUpload: true,
    api: false,
    reminders: true
  };

  // Return features based on chosen plan during trial
  switch (plan.toLowerCase()) {
    case 'basic':
      return basicFeatures;
    case 'pro':
      return proFeatures;
    default:
      return basicFeatures;
  }
};

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
  
  // For trial periods, limit features based on chosen plan (Basic or Pro)
  // Master plan features will be handled later
  if (subscription.status === 'trial') {
    const trialFeatures = getTrialFeaturesForPlan(subscription.plan);
    const hasTrialAccess = trialFeatures[feature] || false;
    console.log('Trial feature access:', { plan: subscription.plan, feature, hasTrialAccess, trialFeatures });
    return hasTrialAccess;
  }
  
  // For active subscriptions, use regular feature check
  const hasFeature = subscription.features[feature] || false;
  console.log('Active subscription feature access:', { feature, hasFeature, features: subscription.features });
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
    reminders: 'Pro'
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
    reminders: 'Recordatorios'
  };

  return `La funcionalidad de ${featureNames[feature]} no está disponible en tu plan actual. Contacta con el administrador para actualizar tu suscripción.`;
};

export const checkUserLimit = (subscription: Subscription | null, currentUsers: number): boolean => {
  if (!subscription) return false;
  if (!subscription.maxUsers) return true; // Unlimited
  return currentUsers <= subscription.maxUsers;
};