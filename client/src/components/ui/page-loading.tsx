import { LoadingSpinner } from './loading-spinner';
import { isNativeAndroid } from '@/lib/server-config';

export function PageLoading() {
  const nativeAndroid = isNativeAndroid();

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${nativeAndroid ? 'bg-[#007AFF]' : 'bg-white dark:bg-gradient-to-br dark:from-[#323A46] dark:to-[#232B36]'}`}>
      <LoadingSpinner size="lg" />
    </div>
  );
}