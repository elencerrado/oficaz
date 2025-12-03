import oficazLogo from '@/assets/oficaz-logo.png';
import { LoadingSpinner } from './loading-spinner';

export function AuthPageLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 dark">
      <img 
        src={oficazLogo} 
        alt="Oficaz" 
        className="h-10 w-auto mb-8 brightness-0 invert"
      />
      <LoadingSpinner size="lg" />
    </div>
  );
}
