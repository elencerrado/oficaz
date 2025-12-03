import { LoadingSpinner } from './loading-spinner';

export function AuthPageLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 dark">
      <LoadingSpinner size="lg" />
    </div>
  );
}
