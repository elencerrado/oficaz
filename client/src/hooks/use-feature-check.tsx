import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { checkFeatureAccess, getRequiredPlanForFeature, type FeatureKey } from '@/lib/feature-restrictions';
import { useEmployeeViewMode } from '@/hooks/use-employee-view-mode';

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
  const { isEmployeeViewMode } = useEmployeeViewMode();

  const { data: permissionsData, isLoading: isLoadingPermissions } = useQuery<{ managerPermissions?: { visibleFeatures?: string[] | null } }>({
    queryKey: ['/api/settings/manager-permissions'],
    enabled: user?.role === 'manager',
    staleTime: 60000,
  });

  const isManagerPermissionsLoading = user?.role === 'manager' && isLoadingPermissions;

  // Features that are ALWAYS enabled for managers (not configurable)
  const alwaysEnabledForManagers = ['messages', 'reminders'];

  const hasAccess = (feature: FeatureKey, options?: { bypassManagerRestrictions?: boolean }): boolean => {
    const subscriptionAccess = checkFeatureAccess(subscription, feature);
    if (!subscriptionAccess) return false;

    // In Employee View Mode OR when explicitly bypassing manager restrictions,
    // show ALL company-contracted features
    if (isEmployeeViewMode || options?.bypassManagerRestrictions) {
      return subscriptionAccess;
    }

    if (user?.role === 'manager') {
      const addonKey = featureToAddonKey[feature] || feature;
      
      // Messages and reminders are ALWAYS enabled for managers
      if (alwaysEnabledForManagers.includes(addonKey)) {
        return subscriptionAccess;
      }
      
      // While permissions are loading, deny access to prevent flicker
      if (isLoadingPermissions) {
        return false;
      }
      
      const visibleFeatures = permissionsData?.managerPermissions?.visibleFeatures;

      if (visibleFeatures === null || visibleFeatures === undefined) {
        return true;
      }

      if (visibleFeatures.length === 0) {
        return false;
      }

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
    subscription,
    isManagerPermissionsLoading
  };
}