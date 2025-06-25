import { useAuth } from '@/hooks/use-auth';
import { checkFeatureAccess, getRequiredPlanForFeature, type SubscriptionFeatures } from '@/lib/feature-restrictions';

export function useFeatureCheck() {
  const { subscription } = useAuth();

  const hasAccess = (feature: keyof SubscriptionFeatures): boolean => {
    console.log('Checking access for feature:', feature, 'with subscription:', subscription);
    const access = checkFeatureAccess(subscription, feature);
    console.log('Access result for', feature, ':', access);
    if (feature === 'reminders') {
      console.log('REMINDERS ACCESS CHECK:', { feature, subscription: subscription?.features, hasAccess: access });
    }
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