import { useAuth } from '@/hooks/use-auth';
import { checkFeatureAccess, getRequiredPlanForFeature, type FeatureKey } from '@/lib/feature-restrictions';

export function useFeatureCheck() {
  const { subscription } = useAuth();

  const hasAccess = (feature: FeatureKey): boolean => {
    const access = checkFeatureAccess(subscription, feature);
    return access;
  };

  const getRequiredPlan = (feature: FeatureKey): string => {
    return getRequiredPlanForFeature(feature);
  };

  const isFeatureRestricted = (feature: FeatureKey): boolean => {
    return !hasAccess(feature);
  };

  return {
    hasAccess,
    getRequiredPlan,
    isFeatureRestricted,
    subscription
  };
}