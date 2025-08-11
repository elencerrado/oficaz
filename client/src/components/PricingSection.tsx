import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { Link } from 'wouter';

interface PricingSectionProps {
  subscriptionPlans?: any[];
}

export default function PricingSection({ subscriptionPlans }: PricingSectionProps) {
  // Feature names mapping for display
  const featureNames: Record<string, string> = {
    time: 'Control de fichajes',
    vacation: 'Gestión de vacaciones',
    messages: 'Mensajería interna',
    documents: 'Gestión de documentos',
    notifications: 'Notificaciones y recordatorios',
    reminders: 'Recordatorios programados',
    employee_time_edit: 'Edición de fichajes',
    logoUpload: 'Subida de logotipo',
    reports: 'Informes avanzados',
    api_access: 'Acceso a API'
  };

  // Feature order for consistent display
  const featureOrder = [
    'time', 'vacation', 'messages', 'documents', 
    'notifications', 'reminders', 'employee_time_edit', 
    'logoUpload', 'reports', 'api_access'
  ];

  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-4">
            Planes que se adaptan a tu empresa
          </h2>
          <p className="text-xl text-gray-600 mt-4 max-w-3xl mx-auto">
            Desde pequeñas empresas hasta grandes corporaciones, tenemos el plan perfecto para ti
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {subscriptionPlans?.map((plan, index) => {
            console.log('DEBUG - Plan data:', plan, 'monthlyPrice:', plan.monthlyPrice, 'type:', typeof plan.monthlyPrice);
            return (
            <div key={plan.id} className={`rounded-2xl p-8 relative ${
              index === 1 
                ? 'bg-gradient-to-b from-blue-50 to-white border-2 border-blue-200 scale-105' 
                : 'bg-white border border-gray-200'
            }`}>
              {index === 1 && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Más Popular
                  </span>
                </div>
              )}
              
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 capitalize">
                  Plan {plan.displayName}
                </h3>
                <div className="mt-4 flex items-center justify-center">
                  <span className="text-4xl font-bold text-gray-900">
                    €{parseFloat(plan.monthlyPrice) || '...'}
                  </span>
                  <span className="text-gray-600 ml-2">/mes</span>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  Hasta {plan.maxUsers} usuarios
                </div>
              </div>
              
              <ul className="mt-8 space-y-4">
                {featureOrder.map((featureKey) => {
                  const isEnabled = plan.features?.[featureKey];
                  if (!isEnabled) return null;
                  
                  return (
                    <li key={featureKey} className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-gray-700">
                        {featureNames[featureKey] || featureKey}
                      </span>
                    </li>
                  );
                })}
              </ul>
              
              <div className="mt-8">
                <Link href="/request-code">
                  <Button 
                    className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 ${
                      index === 1
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    Empezar Prueba Gratis
                  </Button>
                </Link>
              </div>
            </div>
          );
          })}
        </div>
      </div>
    </section>
  );
}