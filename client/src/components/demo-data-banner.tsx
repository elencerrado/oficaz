import { useState, useEffect } from 'react';
import { Info, X } from 'lucide-react';
import { logger } from '@/lib/logger';
import { getAuthData, getAuthHeaders } from '@/lib/auth';

interface DemoDataStatus {
  hasDemoData: boolean;
}

export function DemoDataBanner() {
  logger.log('🎯 DemoDataBanner COMPONENT RENDERING');
  
  const [isVisible, setIsVisible] = useState(true);
  const [hasData, setHasData] = useState(false); // Actually check server status

  // Check demo data status
  useEffect(() => {
    logger.log('🎯 DemoDataBanner useEffect RUNNING');
    const checkDemoData = async () => {
      try {
        const authData = getAuthData();
        const token = authData?.token;
        logger.log('🎯 Token exists:', !!token);
        if (!token) return;

        logger.log('🎯 Making request to /api/demo-data/status');
        const response = await fetch('/api/demo-data/status', {
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          }
        });
        
        logger.log('🎯 Response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          logger.log('🎯 Demo data status RECEIVED:', data);
          setHasData(data.hasDemoData);
        } else {
          logger.log('🎯 Response not OK:', response.status);
        }
      } catch (error) {
        console.error('🎯 Error checking demo data:', error);
      }
    };

    checkDemoData();
  }, []);

  logger.log('🎯 DemoDataBanner render state:', { isVisible, hasData });

  if (!isVisible || !hasData) {
    logger.log('🎯 DemoDataBanner NOT RENDERING - isVisible:', isVisible, 'hasData:', hasData);
    return null;
  }

  logger.log('🎯 DemoDataBanner RENDERING BANNER');

  return (
    <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-400 dark:border-blue-500 p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <Info className="h-5 w-5 text-blue-400 dark:text-blue-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Datos de demostración activos
            </h3>
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              <p>
                Esta empresa está utilizando datos de demostración que incluyen:
              </p>
              <ul className="mt-2 ml-4 space-y-1 list-disc">
                <li>Empleados de ejemplo con fichajes realistas del mes anterior y actual</li>
                <li>Solicitudes de vacaciones aprobadas y pendientes</li>
                <li>Mensajes bidireccionales entre empleados y administradores</li>
                <li>Tareas y documentos de muestra</li>
              </ul>
              <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                Los datos demo se generan basándose en la fecha de registro de la empresa para mayor realismo.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          <button
            className="text-blue-400 hover:text-blue-600 dark:text-blue-300 dark:hover:text-blue-200 p-1"
            title="Cerrar"
            onClick={() => setIsVisible(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}