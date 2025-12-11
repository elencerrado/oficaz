import { LoadingSpinner } from './loading-spinner';

export function InstantLoading() {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'radial-gradient(circle at center, #323A46 0%, #232B36 100%)',
      }}
    >
      <LoadingSpinner size="xl" />
    </div>
  );
}