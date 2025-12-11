import { LoadingSpinner } from './loading-spinner';

export function PageLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gradient-to-br dark:from-[#323A46] dark:to-[#232B36]">
      <LoadingSpinner size="xl" />
    </div>
  );
}