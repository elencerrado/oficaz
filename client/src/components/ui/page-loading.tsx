import { LoadingSpinner } from './loading-spinner';

export function PageLoading() {
  return (
    <div className="min-h-screen bg-employee-gradient flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}