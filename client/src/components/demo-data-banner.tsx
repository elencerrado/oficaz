import { Info, X } from 'lucide-react';

export function DemoDataBanner() {
  console.log('🎯 DemoDataBanner COMPONENT RENDERING');
  
  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <Info className="h-5 w-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-800">
              Datos de demostración activos (Test)
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