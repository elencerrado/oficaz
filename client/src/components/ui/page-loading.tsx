import { LoadingSpinner } from './loading-spinner';

export function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <LoadingSpinner size="lg" />
    </div>
  );
}