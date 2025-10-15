import { SuperAdminLayout } from './super-admin-layout';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function SuperAdminPageLoading() {
  return (
    <SuperAdminLayout>
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    </SuperAdminLayout>
  );
}
