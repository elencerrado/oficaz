import { MessageSquare, FileText, Calendar, Bell, Crown } from "lucide-react";

interface FeatureUnavailableProps {
  feature: 'messages' | 'documents' | 'reminders' | 'vacation';
}

const featureConfig = {
  messages: {
    icon: MessageSquare,
    title: "Mensajes Internos",
    description: "Sistema de comunicación empresarial integrado",
    features: [
      "Chat en tiempo real entre empleados y administradores",
      "Historial completo de conversaciones",
      "Notificaciones de mensajes no leídos",
      "Mensajes grupales para comunicaciones masivas",
      "Interfaz moderna estilo WhatsApp",
      "Indicadores de entrega y lectura"
    ],
    requiredPlan: "Pro"
  },
  documents: {
    icon: FileText,
    title: "Gestión de Documentos",
    description: "Centro completo de documentación empresarial",
    features: [
      "Subida automática de nóminas y contratos",
      "Categorización inteligente de documentos",
      "Solicitud de documentos a empleados",
      "Vista previa y descarga segura",
      "Búsqueda avanzada por categorías",
      "Historial de versiones y cambios"
    ],
    requiredPlan: "Pro"
  },
  reminders: {
    icon: Bell,
    title: "Recordatorios Inteligentes",
    description: "Sistema avanzado de recordatorios y notificaciones",
    features: [
      "Recordatorios personalizables por colores",
      "Programación de notificaciones",
      "Sistema de prioridades (alta, media, baja)",
      "Recordatorios recurrentes",
      "Notificaciones en tiempo real",
      "Organización tipo Google Keep"
    ],
    requiredPlan: "Pro"
  },
  vacation: {
    icon: Calendar,
    title: "Gestión de Vacaciones",
    description: "Control completo del tiempo libre empresarial",
    features: [
      "Solicitud de vacaciones con calendario",
      "Aprobación automática por administradores",
      "Cálculo automático de días disponibles",
      "Historial completo de solicitudes",
      "Días festivos por comunidades autónomas",
      "Notificaciones de estado de solicitudes"
    ],
    requiredPlan: "Pro"
  }
};

export default function FeatureUnavailable({ feature }: FeatureUnavailableProps) {
  const config = featureConfig[feature];
  const IconComponent = config.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-6">
            <IconComponent className="h-10 w-10 text-white" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            {config.title}
          </h1>
          
          <p className="text-lg text-gray-600 mb-6">
            {config.description}
          </p>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
            <Crown className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              No está disponible en tu plan
            </span>
          </div>
        </div>

        {/* Features Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            ¿Qué incluye esta funcionalidad?
          </h2>
          
          <div className="space-y-4">
            {config.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                </div>
                <p className="text-gray-700 leading-relaxed">{feature}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-gray-600 mb-4">
              ¿Quieres acceder a todas estas funcionalidades?
            </p>
            <button className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl">
              <Crown className="h-4 w-4" />
              Actualizar Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}