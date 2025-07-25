import { 
  Clock, 
  Users, 
  FileText, 
  MessageSquare, 
  Calendar,
  Settings,
  CheckCircle,
  Star,
  Building2,
  Smartphone,
  Globe,
  TrendingUp,
  CreditCard,
  Shield
} from 'lucide-react';

export default function FeaturesSection() {
  const features = [
    {
      icon: Clock,
      title: "Control de Fichajes",
      description: "Sistema completo de registro de entrada y salida con geolocalización y control de descansos"
    },
    {
      icon: Calendar,
      title: "Gestión de Vacaciones", 
      description: "Solicitudes, aprobaciones y calendario de vacaciones integrado con el equipo"
    },
    {
      icon: FileText,
      title: "Gestión Documental",
      description: "Almacena y organiza contratos, nóminas y documentos importantes de forma segura"
    },
    {
      icon: Users,
      title: "Gestión de Empleados",
      description: "Perfiles completos, roles y permisos personalizables para cada miembro del equipo"
    },
    {
      icon: MessageSquare,
      title: "Comunicación Interna",
      description: "Chat integrado para mejorar la comunicación entre equipos y departamentos"
    },
    {
      icon: TrendingUp,
      title: "Informes y Analytics",
      description: "Reportes detallados de productividad, asistencia y rendimiento del equipo"
    },
    {
      icon: Smartphone,
      title: "Acceso Móvil",
      description: "Aplicación web responsive optimizada para todos los dispositivos"
    },
    {
      icon: Shield,
      title: "Seguridad Avanzada",
      description: "Encriptación de datos y cumplimiento con normativas de protección de datos"
    }
  ];

  return (
    <section id="features" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Todo lo que necesitas para gestionar tu empresa
          </h2>
          <p className="text-xl text-gray-600 mt-4 max-w-3xl mx-auto">
            Herramientas profesionales diseñadas para optimizar la productividad y simplificar la gestión
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}