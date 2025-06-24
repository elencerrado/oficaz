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
  if (!subscription) return false;
  if (subscription.status !== 'active') return false;
  return subscription.features[feature] || false;
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