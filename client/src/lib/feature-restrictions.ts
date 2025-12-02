// NEW MODEL: Feature access based on add-ons (not plans)
// Free features: time_tracking, vacation, schedules - always available
// Paid add-ons: messages, reminders, documents, ai_assistant, work_reports - require purchase

export interface SubscriptionFeatures {
  time_tracking: boolean;
  vacation: boolean;
  schedules: boolean;
  messages: boolean;
  reminders: boolean;
  documents: boolean;
  ai_assistant: boolean;
  work_reports: boolean;
}

export interface Subscription {
  id: number;
  plan: string;
  status: string;
  features: SubscriptionFeatures;
  maxUsers: number;
}

// Canonical addon keys matching backend database
const ADDON_KEYS = [
  'time_tracking',
  'vacation', 
  'schedules',
  'messages',
  'reminders',
  'documents',
  'ai_assistant',
  'work_reports'
] as const;

type AddonKey = typeof ADDON_KEYS[number];

// Feature display names for UI
const FEATURE_NAMES: Record<AddonKey, string> = {
  time_tracking: 'Fichajes',
  vacation: 'Vacaciones',
  schedules: 'Cuadrante de horarios',
  messages: 'Mensajería Interna',
  reminders: 'Recordatorios',
  documents: 'Gestión Documental',
  ai_assistant: 'Asistente IA',
  work_reports: 'Partes de Trabajo',
};

// Legacy feature name aliases that map to canonical addon keys
const LEGACY_FEATURE_MAP: Record<string, AddonKey> = {
  timeTracking: 'time_tracking',
  analytics: 'work_reports',
  reports: 'work_reports',
};

export const checkFeatureAccess = (subscription: Subscription | null, feature: keyof SubscriptionFeatures | string): boolean => {
  if (!subscription) {
    return false;
  }
  
  // Allow access for both active subscriptions and trial periods
  if (subscription.status !== 'active' && subscription.status !== 'trial') {
    return false;
  }
  
  // Resolve legacy feature names to canonical addon keys
  const canonicalKey = LEGACY_FEATURE_MAP[feature] || feature;
  
  // Check if the feature is available in subscription.features
  const features = subscription.features as unknown as Record<string, boolean>;
  return features[canonicalKey] || false;
};

// Get the display name for a feature
export const getFeatureName = (feature: keyof SubscriptionFeatures | string): string => {
  const canonicalKey = LEGACY_FEATURE_MAP[feature] || feature;
  return FEATURE_NAMES[canonicalKey as AddonKey] || feature;
};

// DEPRECATED: Returns generic message since we no longer use plan names
export const getRequiredPlanForFeature = (_feature: keyof SubscriptionFeatures | string): string => {
  return 'Complemento requerido';
};

export const getFeatureRestrictionMessage = (feature: keyof SubscriptionFeatures | string): string => {
  const featureName = getFeatureName(feature);
  return `La funcionalidad de ${featureName} no está disponible. Puedes añadirla desde la Tienda de Complementos.`;
};

export const checkUserLimit = (subscription: Subscription | null, currentUsers: number): boolean => {
  if (!subscription) return false;
  if (!subscription.maxUsers) return true; // Unlimited
  return currentUsers <= subscription.maxUsers;
};
