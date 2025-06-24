// Sistema de restricciones de funcionalidades por plan
export interface SubscriptionFeatures {
  messages: boolean;
  documents: boolean;
  vacation: boolean;
  timeTracking: boolean;
  reports: boolean;
  analytics: boolean;
  customization: boolean;
  api: boolean;
}

export interface Subscription {
  id: number;
  plan: string;
  status: string;
  features: SubscriptionFeatures;
  maxUsers: number;
}

export const checkFeatureAccess = (subscription: Subscription | null, feature: keyof SubscriptionFeatures): boolean => {
  console.log('checkFeatureAccess called with:', { subscription, feature });
  if (!subscription) {
    console.log('No subscription found');
    return false;
  }
  if (subscription.status !== 'active') {
    console.log('Subscription not active:', subscription.status);
    return false;
  }
  const hasFeature = subscription.features[feature] || false;
  console.log('Feature access result:', { feature, hasFeature, features: subscription.features });
  return hasFeature;
};

export const getRequiredPlanForFeature = (feature: keyof SubscriptionFeatures): string => {
  const featurePlanMap = {
    messages: 'Basic',
    documents: 'Pro',
    vacation: 'Basic',
    timeTracking: 'Basic',
    reports: 'Pro',
    analytics: 'Pro',
    customization: 'Master',
    api: 'Master'
  };
  
  return featurePlanMap[feature] || 'Pro';
};

export const getFeatureRestrictionMessage = (feature: keyof SubscriptionFeatures): string => {
  const featureNames = {
    messages: 'Mensajes',
    documents: 'Documentos',
    vacation: 'Vacaciones',
    timeTracking: 'Fichajes',
    reports: 'Reportes',
    analytics: 'Analíticas',
    customization: 'Personalización',
    api: 'API'
  };

  return `La funcionalidad de ${featureNames[feature]} no está disponible en tu plan actual. Contacta con el administrador para actualizar tu suscripción.`;
};

export const checkUserLimit = (subscription: Subscription | null, currentUsers: number): boolean => {
  if (!subscription) return false;
  if (!subscription.maxUsers) return true; // Unlimited
  return currentUsers <= subscription.maxUsers;
};