import { LoadingSpinner } from './loading-spinner';
import { isNativeAndroid } from '@/lib/server-config';

export function AuthPageLoading() {
  const nativeAndroid = isNativeAndroid();

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${nativeAndroid ? 'bg-[#007AFF]' : 'bg-gradient-to-br from-slate-900 to-slate-800 dark'}`}>
      <LoadingSpinner size="lg" />
    </div>
  );
}
