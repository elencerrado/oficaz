import { Button } from '@/components/ui/button';
import { CheckCircle, Plus, Users, Zap } from 'lucide-react';
import { Link } from 'wouter';

export default function PricingSection() {
  const baseFeatures = [
    'Panel de control completo',
    'Gestión de empleados',
    'Control de fichajes',
    'Gestión de vacaciones',
    'Cuadrante de trabajo',
    'Tienda de add-ons',
    '1 Admin + 1 Manager + 10 Empleados incluidos'
  ];

  const addons = [
    { name: 'Mensajería', price: 9, description: 'Comunicación interna entre empleados' },
    { name: 'Recordatorios', price: 6, description: 'Alertas y recordatorios programados' },
    { name: 'Documentos', price: 15, description: 'Gestión y almacenamiento de documentos' },
    { name: 'Partes de Trabajo', price: 12, description: 'Registro de partes y reportes' },
    { name: 'Asistente IA', price: 25, description: 'Automatización con inteligencia artificial' },
  ];

  const userPricing = [
    { role: 'Empleado', price: 2 },
    { role: 'Manager', price: 6 },
    { role: 'Admin', price: 12 },
  ];

  return (
    <section id="pricing" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-4">
            Un plan simple, modular y escalable
          </h2>
          <p className="text-xl text-gray-600 mt-4 max-w-3xl mx-auto">
            Paga solo por lo que necesitas. Empieza con el plan base y añade funcionalidades según crezcas.
          </p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="rounded-2xl p-8 bg-gradient-to-b from-blue-50 to-white border-2 border-blue-200">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900">
                Plan Oficaz
              </h3>
              <div className="mt-4 flex items-center justify-center">
                <span className="text-5xl font-bold text-gray-900">€39</span>
                <span className="text-gray-600 ml-2">/mes</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Base mensual fija
              </p>
            </div>
            
            <ul className="mt-8 space-y-3">
              {baseFeatures.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
            
            <div className="mt-8">
              <Link href="/request-code">
                <Button className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25">
                  Empezar Prueba Gratis de 14 días
                </Button>
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl p-6 bg-white border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="w-5 h-5 text-blue-600" />
                <h4 className="text-lg font-semibold text-gray-900">Add-ons Disponibles</h4>
              </div>
              <div className="space-y-3">
                {addons.map((addon, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{addon.name}</p>
                      <p className="text-xs text-gray-500">{addon.description}</p>
                    </div>
                    <span className="text-sm font-semibold text-blue-600">+€{addon.price}/mes</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-6 bg-white border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-600" />
                <h4 className="text-lg font-semibold text-gray-900">Usuarios Adicionales</h4>
              </div>
              <div className="space-y-2">
                {userPricing.map((user, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900">{user.role}</p>
                    <span className="text-sm font-semibold text-blue-600">+€{user.price}/mes</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">
                *Más allá de los usuarios incluidos en el plan base
              </p>
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full">
            <Zap className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-700 font-medium">
              Sin compromiso. Cancela cuando quieras.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
