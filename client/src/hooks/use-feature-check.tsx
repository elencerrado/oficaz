import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { checkFeatureAccess, getRequiredPlanForFeature, type FeatureKey } from '@/lib/feature-restrictions';

const featureToAddonKey: Record<string, string> = {
  time_tracking: 'time_tracking',
  timeTracking: 'time_tracking',
  vacation: 'vacation',
  schedules: 'schedules',
  documents: 'documents',
  messages: 'messages',
  reminders: 'reminders',
  work_reports: 'work_reports',
  reports: 'work_reports',
  ai_assistant: 'ai_assistant',
};

export function useFeatureCheck() {
  const { subscription, user } = useAuth();

  const { data: permissionsData } = useQuery<{ managerPermissions?: { visibleFeatures?: string[] | null } }>({
    queryKey: ['/api/settings/manager-permissions'],
    enabled: user?.role === 'manager',
    staleTime: 60000,
  });

  const hasAccess = (feature: FeatureKey): boolean => {
    const subscriptionAccess = checkFeatureAccess(subscription, feature);
    if (!subscriptionAccess) return false;

    if (user?.role === 'manager') {
      const visibleFeatures = permissionsData?.managerPermissions?.visibleFeatures;

      if (visibleFeatures === null || visibleFeatures === undefined) {
        return true;
      }

      if (visibleFeatures.length === 0) {
        return false;
      }

      const addonKey = featureToAddonKey[feature] || feature;
      return visibleFeatures.includes(addonKey);
    }

    return subscriptionAccess;
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