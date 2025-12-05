import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
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

// Employee-specific routes where managers should have full access to company features
const EMPLOYEE_ROUTES = [
  '/inicio',
  '/misfichajes', 
  '/documentos',
  '/recordatorios',
  '/mensajes',
  '/cuadrante',
  '/vacaciones',
  '/horas',
  '/partes-trabajo'
];

export function useFeatureCheck() {
  const { subscription, user } = useAuth();
  const { isEmployeeViewMode } = useEmployeeViewMode();
  const [location] = useLocation();
  
  // Detect if current route is an employee-facing page
  const isEmployeePage = EMPLOYEE_ROUTES.some(route => location.endsWith(route));

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

    // In Employee View Mode, on employee pages, OR when explicitly bypassing manager restrictions,
    // show ALL company-contracted features (bypass admin visibility restrictions)
    if (isEmployeeViewMode || isEmployeePage || options?.bypassManagerRestrictions) {
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

  // Special access mode for documents: managers can always see their own files
  // but can only manage others' files if they have the feature enabled
  const getDocumentAccessMode = (): 'full' | 'self' | 'none' => {
    const subscriptionAccess = checkFeatureAccess(subscription, 'documents');
    
    // No subscription access = no access at all
    if (!subscriptionAccess) return 'none';
    
    // Admins always have full access
    if (user?.role === 'admin') return 'full';
    
    // Employees always have self access only
    if (user?.role === 'employee') return 'self';
    
    // For managers: check if documents is in their visible features
    if (user?.role === 'manager') {
      const visibleFeatures = permissionsData?.managerPermissions?.visibleFeatures;
      
      // If permissions not loaded yet, assume self access
      if (isLoadingPermissions) return 'self';
      
      // If visibleFeatures is null/undefined, manager has full access (no restrictions)
      if (visibleFeatures === null || visibleFeatures === undefined) return 'full';
      
      // If documents is in the list, full access
      if (visibleFeatures.includes('documents')) return 'full';
      
      // Otherwise, self access only (can see own documents)
      return 'self';
    }
    
    return 'none';
  };

  // Special access mode for work reports: managers can always see their own reports
  // but can only manage others' reports if they have the feature enabled
  const getWorkReportsAccessMode = (): 'full' | 'self' | 'none' => {
    const subscriptionAccess = checkFeatureAccess(subscription, 'work_reports');
    
    // No subscription access = no access at all
    if (!subscriptionAccess) return 'none';
    
    // Admins always have full access
    if (user?.role === 'admin') return 'full';
    
    // Employees always have self access only
    if (user?.role === 'employee') return 'self';
    
    // For managers: check if work_reports is in their visible features
    if (user?.role === 'manager') {
      const visibleFeatures = permissionsData?.managerPermissions?.visibleFeatures;
      
      // If permissions not loaded yet, assume self access
      if (isLoadingPermissions) return 'self';
      
      // If visibleFeatures is null/undefined, manager has full access (no restrictions)
      if (visibleFeatures === null || visibleFeatures === undefined) return 'full';
      
      // If work_reports is in the list, full access
      if (visibleFeatures.includes('work_reports')) return 'full';
      
      // Otherwise, self access only (can see own reports)
      return 'self';
    }
    
    return 'none';
  };

  return {
    hasAccess,
    getRequiredPlan,
    isFeatureRestricted,
    getDocumentAccessMode,
    getWorkReportsAccessMode,
    subscription,
    isManagerPermissionsLoading
  };
}