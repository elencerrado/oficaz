import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { 
  Clock, 
  Users, 
  FileText, 
  MessageSquare, 
  Calendar,
  Shield,
  Zap,
  CheckCircle,
  ArrowRight,
  Star,
  Building,
  Smartphone,
  Globe
} from "lucide-react";

// Simple SVG logo component to avoid loading external images
const OfficazLogo = ({ isDark = false }: { isDark?: boolean }) => (
  <svg width="120" height="32" viewBox="0 0 120 32" className="h-8 w-auto">
    <rect x="0" y="8" width="24" height="16" rx="4" fill="#2563eb" />
    <rect x="6" y="14" width="12" height="4" rx="2" fill="white" />
    <text x="32" y="22" fontSize="18" fontWeight="bold" fill={isDark ? "#f9fafb" : "#1f2937"}>Oficaz</text>
  </svg>
);

export default function Landing() {
  const features = [
    {
      icon: Clock,
      title: "Control de Tiempo",
      description: "Fichajes simples con un solo clic. Seguimiento automático de horas trabajadas."
    },
    {
      icon: Calendar,
      title: "Gestión de Vacaciones",
      description: "Solicitudes y aprobaciones digitales. Cálculo automático de días disponibles."
    },
    {
      icon: FileText,
      title: "Documentos Centralizados",
      description: "Almacena nóminas, contratos y documentos importantes en un solo lugar."
    },
    {
      icon: MessageSquare,
      title: "Comunicación Interna",
      description: "Chat empresarial directo entre empleados y responsables."
    },
    {
      icon: Users,
      title: "Gestión de Empleados",
      description: "Organiza equipos, roles y permisos de forma sencilla."
    },
    {
      icon: Shield,
      title: "Seguridad Enterprise",
      description: "Protección de datos con los más altos estándares de seguridad."
    }
  ];

  const plans = [
    {
      name: "Basic",
      price: "29",
      description: "Perfecto para pequeñas empresas",
      features: [
        "Hasta 25 empleados",
        "Control de tiempo",
        "Gestión de vacaciones",
        "Soporte por email"
      ],
      popular: false
    },
    {
      name: "Pro",
      price: "59",
      description: "Para empresas en crecimiento",
      features: [
        "Hasta 100 empleados",
        "Todas las funciones Basic",
        "Documentos y mensajería",
        "Recordatorios inteligentes",
        "Soporte prioritario"
      ],
      popular: true
    },
    {
      name: "Master",
      price: "149",
      description: "Para grandes organizaciones",
      features: [
        "Empleados ilimitados",
        "Todas las funciones Pro",
        "Análisis avanzados",
        "API personalizada",
        "Gestor de cuenta dedicado"
      ],
      popular: false
    }
  ];

  const testimonials = [
    {
      name: "María González",
      role: "Directora de RRHH",
      company: "TechStart Solutions",
      content: "Oficaz transformó nuestra gestión de empleados. Lo que antes nos tomaba horas, ahora lo hacemos en minutos.",
      rating: 5
    },
    {
      name: "Carlos Martín",
      role: "CEO",
      company: "Innovación Digital",
      content: "La simplicidad de Oficaz es su mayor fortaleza. Nuestro equipo lo adoptó inmediatamente sin necesidad de formación.",
      rating: 5
    },
    {
      name: "Ana Rodríguez",
      role: "Gerente de Operaciones",
      company: "Consultoría Moderna",
      content: "Finalmente una herramienta que hace lo que promete. Fichajes, vacaciones y documentos en una sola plataforma.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <OfficazLogo />
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-gray-700 hover:text-blue-600 transition-colors">Funciones</a>
              <a href="#pricing" className="text-gray-700 hover:text-blue-600 transition-colors">Precios</a>
              <a href="#testimonials" className="text-gray-700 hover:text-blue-600 transition-colors">Testimonios</a>
            </nav>
            <Link href="/login">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Acceder
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-16 bg-blue-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="mb-6 inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm">
            ✨ La gestión empresarial que buscabas
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Oficaz no es para las empresas que lo quieren
            <span className="text-blue-600 block">todo, sino para las que lo quieren fácil</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Gestiona tu equipo, tiempo y documentos en una plataforma tan simple que cualquiera puede usarla desde el primer día.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3">
                Prueba gratis 14 días
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="px-6 py-3">
                Ver demo
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Sin tarjeta de crédito • Configuración en 2 minutos
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Todo lo que necesitas, nada que no uses
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Funciones diseñadas para resolver problemas reales, no para impresionar con listas interminables de características.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-6 bg-white border rounded-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                La filosofía de la simplicidad
              </h2>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Rápido de implementar</h3>
                    <p className="text-gray-600">Tu equipo estará operativo en menos de 5 minutos. Sin instalaciones complejas ni configuraciones eternas.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Smartphone className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Diseñado para móvil</h3>
                    <p className="text-gray-600">Fichar desde el móvil es tan fácil como enviar un WhatsApp. Tus empleados lo agradecerán.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Globe className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Acceso desde cualquier lugar</h3>
                    <p className="text-gray-600">Oficina, casa, obra, viaje de trabajo... Oficaz funciona donde tú trabajes.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-4">¿Por qué elegir Oficaz?</h3>
                <ul className="space-y-3">
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-300" />
                    <span>Configuración instantánea</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-300" />
                    <span>Interfaz intuitiva</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-300" />
                    <span>Soporte en español</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-300" />
                    <span>Cumplimiento normativo</span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-300" />
                    <span>Precios transparentes</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Lo que dicen nuestros clientes
            </h2>
            <p className="text-xl text-gray-600">
              Empresas que ya han simplificado su gestión con Oficaz
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="p-8">
                  <div className="flex space-x-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    "{testimonial.content}"
                  </p>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Building className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{testimonial.name}</div>
                      <div className="text-sm text-gray-600">{testimonial.role}</div>
                      <div className="text-sm text-gray-500">{testimonial.company}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Precios simples, sin sorpresas
            </h2>
            <p className="text-xl text-gray-600">
              Paga solo por lo que necesitas. Cambia de plan cuando quieras.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <Card key={index} className={`relative border-0 shadow-lg ${plan.popular ? 'ring-2 ring-blue-500 scale-105' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white px-4 py-1">
                      Más popular
                    </Badge>
                  </div>
                )}
                <CardContent className="p-8 text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 mb-6">{plan.description}</p>
                  <div className="mb-8">
                    <span className="text-5xl font-bold text-gray-900">€{plan.price}</span>
                    <span className="text-gray-600">/mes</span>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register">
                    <Button 
                      className={`w-full ${plan.popular ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
                    >
                      Empezar prueba gratuita
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            ¿Listo para simplificar tu gestión empresarial?
          </h2>
          <p className="text-xl text-blue-100 mb-10">
            Únete a cientos de empresas que ya gestionan su equipo de forma más eficiente con Oficaz.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 text-lg">
                Crear cuenta gratis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-blue-600 px-8 py-4 text-lg">
                Ver demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="mb-4">
                <OfficazLogo isDark={true} />
              </div>
              <p className="text-gray-400 mb-4">
                La gestión empresarial simple que funciona.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Producto</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-white transition-colors">Funciones</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Precios</a></li>
                <li><a href="/login" className="hover:text-white transition-colors">Demo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Empresa</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">Sobre nosotros</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contacto</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Soporte</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">Centro de ayuda</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentación</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Política de privacidad</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-gray-400">
              © 2025 Oficaz. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}