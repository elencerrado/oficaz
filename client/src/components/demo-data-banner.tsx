import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Info, Loader2, X, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface DemoDataStatus {
  hasDemoData: boolean;
}

export function DemoDataBanner() {
  const [isVisible, setIsVisible] = useState(true);

  const { data: demoStatus, isLoading, error, refetch } = useQuery<DemoDataStatus>({
    queryKey: ['/api/demo-data/status'],
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  // Don't show banner if not visible, loading failed, or no demo data
  if (!isVisible || error || !demoStatus?.hasDemoData) {
    return null;
  }

  const handleRefresh = () => {
    refetch();
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {isLoading ? (
              <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
            ) : (
              <Info className="h-5 w-5 text-blue-400" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-800">
              Datos de demostración activos
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Esta empresa está utilizando datos de demostración que incluyen:
              </p>
              <ul className="mt-2 ml-4 space-y-1 list-disc">
                <li>Empleados de ejemplo con fichajes realistas del mes anterior y actual</li>
                <li>Solicitudes de vacaciones aprobadas y pendientes</li>
                <li>Mensajes bidireccionales entre empleados y administradores</li>
                <li>Recordatorios y documentos de muestra</li>
              </ul>
              <p className="mt-2 text-xs text-blue-600">
                Los datos demo se generan basándose en la fecha de registro de la empresa para mayor realismo.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          <button
            onClick={handleRefresh}
            className="text-blue-400 hover:text-blue-600 p-1"
            title="Actualizar estado"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handleDismiss}
            className="text-blue-400 hover:text-blue-600 p-1"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}