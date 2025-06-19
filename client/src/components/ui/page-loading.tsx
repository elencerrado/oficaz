import { LoadingSpinner } from "@/components/ui/loading-spinner";
import oficazLogo from '@/assets/oficaz-logo.png';

interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = "Cargando..." }: PageLoadingProps) {
  return (
    <div className="fixed inset-0 bg-employee-gradient flex items-center justify-center z-50">
      <div className="text-center">
        {/* Logo de Oficaz */}
        <div className="mb-8">
          <img 
            src={oficazLogo} 
            alt="Oficaz" 
            className="h-12 w-auto mx-auto"
          />
        </div>
        
        {/* Spinner personalizado */}
        <div className="mb-6">
          <LoadingSpinner size="lg" className="mx-auto" />
        </div>
        
        {/* Mensaje de carga */}
        <p className="text-white/80 text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}

export default PageLoading;