import { LoadingSpinner } from './loading-spinner';
import oficazLogo from '@/assets/oficaz-logo.png';

export function PageLoading() {
  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: 'radial-gradient(circle at center, #323A46 0%, #232B36 100%)',
      }}
    >
      <div className="flex flex-col items-center space-y-6">
        <img 
          src={oficazLogo} 
          alt="Oficaz" 
          className="w-20 h-20 object-contain"
        />
        <LoadingSpinner size="lg" />
      </div>
    </div>
  );
}