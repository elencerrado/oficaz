import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

interface DemoDataStatus {
  hasDemoData: boolean;
}

export function useDemoBanner() {
  const { user, isAuthenticated } = useAuth();

  const { data: demoStatus } = useQuery<DemoDataStatus>({
    queryKey: ['/api/demo-data/status'],
    enabled: isAuthenticated && user?.role === 'admin',
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Return true if banner should be shown
  const showBanner = isAuthenticated && 
                    user?.role === 'admin' && 
                    demoStatus?.hasDemoData === true;

  return {
    showBanner,
    bannerHeight: 60 // Height of the banner in pixels (py-3 = 12px top + 12px bottom + content)
  };
}