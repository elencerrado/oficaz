import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Clock, 
  Users, 
  FileText, 
  MessageSquare, 
  Calendar,
  Shield,
  Zap,
  CheckCircle,
  Star,
  ArrowRight,
  Play,
  ChevronRight,
  Building2,
  Smartphone,
  Globe
} from 'lucide-react';

// Importar capturas de pantalla de los assets
import dashboardScreenshot from '@assets/Main Screen - Empleado_1750328650633.jpg';
import timeTrackingScreenshot from '@assets/Fichajes - Empleado_1750329669169.jpg';
import userProfileScreenshot from '@assets/Usuario - Empleado_1750333758244.jpg';
import loginScreenshot from '@assets/Login_1750322343051.jpg';
import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';

export default function Landing() {
  const features = [
    {
      icon: Clock,
      title: "Control de Tiempo",
      description: "Fichajes automáticos con seguimiento en tiempo real y reportes detallados"
    },
    {
      icon: Calendar,
      title: "Gestión de Vacaciones",
      description: "Solicitudes digitales con flujo de aprobación y calendario integrado"
    },
    {
      icon: FileText,
      title: "Documentos Inteligentes",
      description: "Subida automática con detección de empleados y categorización"
    },
    {
      icon: MessageSquare,
      title: "Comunicación Interna",
      description: "Mensajería empresarial estilo WhatsApp para toda la organización"
    },
    {
      icon: Users,
      title: "Gestión de Empleados",
      description: "Base de datos completa con roles, permisos y configuración flexible"
    },
    {
      icon: Shield,
      title: "Seguridad Avanzada",
      description: "Encriptación de datos, autenticación segura y cumplimiento GDPR"
    }
  ];

  const plans = [
    {
      name: "Basic",
      price: "29",
      description: "Perfecto para pequeñas empresas",
      features: [
        "Hasta 15 empleados",
        "Control de tiempo básico",
        "Gestión de vacaciones",
        "Mensajería interna",
        "Soporte por email"
      ],
      popular: false
    },
    {
      name: "Pro",
      price: "59",
      description: "Ideal para empresas en crecimiento",
      features: [
        "Hasta 50 empleados",
        "Todas las funciones Basic",
        "Gestión de documentos",
        "Reportes avanzados",
        "Logos personalizados",
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
        "API personalizada",
        "Integración avanzada",
        "Soporte 24/7",
        "Gerente de cuenta dedicado"
      ],
      popular: false
    }
  ];

  const testimonials = [
    {
      name: "María González",
      role: "Directora de RRHH",
      company: "TechCorp",
      content: "Oficaz transformó completamente nuestra gestión de empleados. Lo que antes tomaba horas ahora se hace en minutos.",
      rating: 5
    },
    {
      name: "Carlos Ruiz",
      role: "CEO",
      company: "StartupFlow",
      content: "La facilidad de uso es increíble. Nuestros empleados se adaptaron en días, no semanas.",
      rating: 5
    },
    {
      name: "Ana Martín",
      role: "Responsable de Operaciones",
      company: "LogisticsPro",
      content: "El control de tiempo en tiempo real nos ahorró miles de euros en el primer mes.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img src={oficazLogo} alt="Oficaz" className="h-10 w-auto" />
            </div>
            
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Funciones</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Precios</a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900 transition-colors">Testimonios</a>
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Iniciar Sesión
                </Button>
              </Link>
              <Link href="/request-code">
                <Button size="sm" className="bg-[#007AFF] hover:bg-[#0056CC]">
                  Prueba Gratis
                </Button>
              </Link>
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Link href="/login">
                <Button size="sm" className="bg-[#007AFF] hover:bg-[#0056CC]">
                  Entrar
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-[calc(100vh-4rem)]">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#007AFF]/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/50 to-transparent"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-16 min-h-[calc(100vh-4rem)] flex items-center">
          <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center w-full">
            <div className="text-center lg:text-left">

              
              {/* Main Headline */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-white mb-6 leading-tight">
                Para empresas que lo quieren
                <span className="block bg-gradient-to-r from-[#007AFF] to-cyan-400 bg-clip-text text-transparent">
                  fácil
                </span>
              </h1>
              
              {/* Subtitle */}
              <p className="text-lg md:text-xl lg:text-2xl text-slate-300 mb-8 lg:mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                La plataforma más intuitiva para gestionar tu empresa. 
                <span className="text-white font-semibold">Sin complicaciones,</span> solo resultados que puedes ver desde el primer día.
              </p>
              
              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
                <Link href="/request-code">
                  <Button size="lg" className="bg-gradient-to-r from-[#007AFF] to-cyan-500 hover:from-[#0056CC] hover:to-cyan-600 text-white px-10 py-4 text-lg font-semibold shadow-2xl shadow-[#007AFF]/25 border-0">
                    Comenzar Ahora
                    <ArrowRight className="w-6 h-6 ml-2" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg" className="px-10 py-4 text-lg font-semibold border-white/30 text-white hover:bg-white/10 hover:border-white/50">
                  <Play className="w-6 h-6 mr-2" />
                  Ver en Acción
                </Button>
              </div>

            </div>
            
            {/* Visual Elements - Only visible on desktop */}
            <div className="hidden lg:block lg:col-span-1 mt-16 lg:mt-0">
              <div className="relative min-h-[500px] xl:h-[calc(100vh-12rem)]">
                {/* Floating Cards */}
                <div className="absolute top-0 right-0 w-80 h-48 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-green-400 rounded-lg flex items-center justify-center">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">Control de Tiempo</div>
                      <div className="text-slate-300 text-sm">En tiempo real</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 bg-green-400/30 rounded-full">
                      <div className="h-2 bg-green-400 rounded-full w-3/4"></div>
                    </div>
                    <div className="text-white text-sm">8h 32m trabajadas hoy</div>
                  </div>
                </div>

                <div className="absolute top-32 left-0 w-72 h-44 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 transform -rotate-2 hover:rotate-0 transition-transform duration-500">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-blue-400 rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">Equipo Activo</div>
                      <div className="text-slate-300 text-sm">12 de 15 conectados</div>
                    </div>
                  </div>
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full border-2 border-white"></div>
                    <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-cyan-400 rounded-full border-2 border-white"></div>
                    <div className="w-8 h-8 bg-gradient-to-r from-orange-400 to-red-400 rounded-full border-2 border-white"></div>
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold">+8</div>
                  </div>
                </div>

                <div className="absolute bottom-20 right-8 w-64 h-36 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-5 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 bg-purple-400 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">Documentos</div>
                      <div className="text-slate-300 text-sm">Gestión automática</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <div className="text-slate-300 text-sm">Nómina Abril.pdf</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      <div className="text-slate-300 text-sm">Contrato Juan.pdf</div>
                    </div>
                  </div>
                </div>

                {/* Animated Background Elements */}
                <div className="absolute top-20 left-20 w-3 h-3 bg-[#007AFF] rounded-full animate-pulse"></div>
                <div className="absolute bottom-40 left-8 w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
                <div className="absolute top-60 right-20 w-4 h-4 bg-purple-400 rounded-full animate-bounce"></div>
                
                {/* Grid Pattern */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
                    backgroundSize: '40px 40px'
                  }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Todo lo que necesitas en una sola plataforma
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Diseñado específicamente para empresas españolas que buscan eficiencia sin complicaciones
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-[#007AFF]/10 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-[#007AFF]" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Diseño intuitivo que funciona
            </h2>
            <p className="text-xl text-gray-600">
              Interfaz moderna optimizada para móvil y desktop
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <img src={timeTrackingScreenshot} alt="Control de tiempo" className="w-full h-64 object-cover" />
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-2">Control de Tiempo</h3>
                <p className="text-gray-600 text-sm">Fichajes rápidos y seguimiento en tiempo real</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <img src={userProfileScreenshot} alt="Perfil de usuario" className="w-full h-64 object-cover" />
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-2">Gestión de Perfiles</h3>
                <p className="text-gray-600 text-sm">Información completa y actualizable</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <img src={loginScreenshot} alt="Login seguro" className="w-full h-64 object-cover" />
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-2">Acceso Seguro</h3>
                <p className="text-gray-600 text-sm">Autenticación robusta y fácil de usar</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Precios transparentes y justos
            </h2>
            <p className="text-xl text-gray-600">
              Elige el plan que mejor se adapte a tu empresa
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <Card key={index} className={`relative ${plan.popular ? 'border-[#007AFF] border-2 shadow-xl' : 'border shadow-lg'}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-[#007AFF] text-white px-4 py-1">
                      Más Popular
                    </Badge>
                  </div>
                )}
                
                <CardContent className="p-6">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <p className="text-gray-600 mb-4">{plan.description}</p>
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-gray-900">€{plan.price}</span>
                      <span className="text-gray-600">/mes</span>
                    </div>
                  </div>
                  
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Link href="/request-code">
                    <Button 
                      className={`w-full ${plan.popular ? 'bg-[#007AFF] hover:bg-[#0056CC] text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
                    >
                      Empezar Prueba Gratis
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4">
              <strong>30 días de prueba gratuita</strong> • Sin tarjeta de crédito • Cancela cuando quieras
            </p>
            <div className="flex justify-center items-center space-x-8 text-sm text-gray-500">
              <div className="flex items-center">
                <Building2 className="w-4 h-4 mr-2" />
                +500 empresas confían en nosotros
              </div>
              <div className="flex items-center">
                <Smartphone className="w-4 h-4 mr-2" />
                Apps móviles nativas
              </div>
              <div className="flex items-center">
                <Globe className="w-4 h-4 mr-2" />
                Soporte 24/7 en español
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Lo que dicen nuestros clientes
            </h2>
            <p className="text-xl text-gray-600">
              Más de 500 empresas ya confían en Oficaz
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-4 italic">"{testimonial.content}"</p>
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                    <p className="text-sm text-[#007AFF]">{testimonial.company}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[#007AFF]">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            ¿Listo para simplificar tu gestión empresarial?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Únete a las empresas que ya disfrutan de una gestión sin complicaciones
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/request-code">
              <Button size="lg" className="bg-white text-[#007AFF] hover:bg-gray-100 px-8">
                Empezar Prueba Gratis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-[#007AFF] px-8">
              Hablar con Ventas
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-6">
                <div className="w-8 h-8 bg-[#007AFF] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">O</span>
                </div>
                <span className="text-xl font-bold">Oficaz</span>
              </div>
              <p className="text-gray-400 mb-4">
                La plataforma de gestión empresarial más intuitiva para empresas modernas.
              </p>
              <div className="text-sm text-gray-500">
                © 2025 Oficaz. Todos los derechos reservados.
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Producto</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Funciones</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Precios</a></li>
                <li><a href="/request-code" className="hover:text-white transition-colors">Prueba Gratis</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integraciones</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Empresa</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Sobre Nosotros</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Carreras</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contacto</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Política de Privacidad</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Términos de Servicio</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookies</a></li>
                <li><a href="#" className="hover:text-white transition-colors">GDPR</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>Oficaz - Gestión empresarial inteligente para empresas que lo quieren fácil</p>
          </div>
        </div>
      </footer>
    </div>
  );
}