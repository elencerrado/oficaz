import { LoadingSpinner } from './loading-spinner';

interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = "Cargando..." }: PageLoadingProps) {
  return (
    <div className="min-h-screen bg-employee-gradient flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mb-4" />
        <p className="text-white/70 text-sm">{message}</p>
      </div>
    </div>
  );
}