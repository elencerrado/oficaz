import { useAuth } from '@/hooks/use-auth';
import { checkFeatureAccess, getRequiredPlanForFeature, type SubscriptionFeatures } from '@/lib/feature-restrictions';

export function useFeatureCheck() {
  const { subscription } = useAuth();

  const hasAccess = (feature: keyof SubscriptionFeatures): boolean => {
    const access = checkFeatureAccess(subscription, feature);
    return access;
  };

  const getRequiredPlan = (feature: keyof SubscriptionFeatures): string => {
    return getRequiredPlanForFeature(feature);
  };

  const isFeatureRestricted = (feature: keyof SubscriptionFeatures): boolean => {
    return !hasAccess(feature);
  };

  return {
    hasAccess,
    getRequiredPlan,
    isFeatureRestricted,
    subscription
  };
}