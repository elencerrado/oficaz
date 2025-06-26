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
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 min-h-[calc(100vh-4rem)]">
        {/* Advanced Background Effects */}
        <div className="absolute inset-0">
          {/* Dynamic gradient mesh */}
          <div className="absolute top-0 left-0 w-full h-full opacity-40">
            <div className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-r from-[#007AFF]/50 via-purple-500/40 to-cyan-400/50 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-32 right-32 w-80 h-80 bg-gradient-to-l from-purple-600/40 via-pink-500/40 to-[#007AFF]/50 rounded-full blur-3xl animate-pulse delay-1000"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-gradient-to-br from-cyan-400/30 via-blue-500/30 to-purple-500/30 rounded-full blur-3xl animate-pulse delay-2000"></div>
          </div>
          
          {/* Floating particles */}
          <div className="absolute inset-0">
            <div className="absolute top-1/4 left-1/6 w-1 h-1 bg-white/60 rounded-full animate-ping delay-300"></div>
            <div className="absolute top-3/4 left-1/3 w-1.5 h-1.5 bg-[#007AFF]/80 rounded-full animate-pulse delay-700"></div>
            <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-cyan-400/70 rounded-full animate-ping delay-1000"></div>
            <div className="absolute bottom-1/3 left-2/3 w-2 h-2 bg-purple-400/60 rounded-full animate-bounce delay-1500"></div>
          </div>
          
          {/* Subtle grid overlay */}
          <div className="absolute inset-0 opacity-[0.03]">
            <div className="absolute inset-0" style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '100px 100px'
            }}></div>
          </div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-24 min-h-[calc(100vh-4rem)] flex items-center">
          <div className="w-full max-w-5xl mx-auto">
            <div className="text-center space-y-10">
              
              {/* Premium Badge */}
              <div className="inline-flex items-center gap-3 bg-gradient-to-r from-white/10 via-white/5 to-white/10 backdrop-blur-xl border border-white/20 rounded-full px-6 py-3 shadow-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <div className="w-1.5 h-1.5 bg-green-400/60 rounded-full animate-pulse delay-200"></div>
                  <div className="w-1 h-1 bg-green-400/40 rounded-full animate-pulse delay-400"></div>
                </div>
                <span className="text-white/90 font-medium text-sm tracking-wide">Gestión empresarial inteligente</span>
                <div className="w-6 h-6 bg-gradient-to-br from-[#007AFF] to-cyan-400 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
              
              {/* Enhanced Main Heading */}
              <div className="space-y-6">
                <h1 className="text-5xl sm:text-6xl md:text-7xl xl:text-8xl font-black text-white leading-[0.9] tracking-tight">
                  Para empresas
                  <span className="block bg-gradient-to-r from-[#007AFF] via-blue-500 to-cyan-400 bg-clip-text text-transparent">
                    que lo quieren
                  </span>
                  <span className="block bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                    fácil
                  </span>
                </h1>
                <div className="space-y-4">
                  <p className="text-2xl md:text-3xl text-white font-light leading-relaxed">
                    La plataforma de gestión empresarial
                  </p>
                  <p className="text-xl md:text-2xl text-slate-300 leading-relaxed">
                    <span className="text-white font-semibold bg-gradient-to-r from-[#007AFF]/20 to-cyan-400/20 px-3 py-1 rounded-lg border border-white/10">más intuitiva</span> del mercado
                  </p>
                  <p className="text-lg md:text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                    Diseñada para empresas que buscan eficiencia sin complicaciones
                  </p>
                </div>
              </div>

              {/* Enhanced CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-6 pt-8">
                <Link href="/request-code">
                  <Button size="lg" className="group relative bg-gradient-to-r from-[#007AFF] via-blue-600 to-cyan-500 hover:from-[#0056CC] hover:via-blue-700 hover:to-cyan-600 text-white px-10 py-5 text-xl font-bold shadow-2xl shadow-[#007AFF]/30 border-0 rounded-2xl w-full sm:w-auto transform hover:scale-105 transition-all duration-300 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    <span className="relative flex items-center justify-center">
                      Empezar Gratis
                      <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform duration-300" />
                    </span>
                  </Button>
                </Link>
                <Button variant="outline" size="lg" className="group border-2 border-white/30 text-white hover:bg-white hover:text-slate-900 px-10 py-5 text-xl font-bold rounded-2xl backdrop-blur-xl w-full sm:w-auto transition-all duration-300 hover:shadow-xl hover:shadow-white/20">
                  <Play className="w-6 h-6 mr-3 group-hover:scale-110 transition-transform duration-300" />
                  Ver en Acción
                </Button>
              </div>

              {/* Trust indicators */}
              <div className="pt-8 space-y-4">
                <p className="text-slate-400 text-sm font-medium">Trusted by 500+ companies</p>
                <div className="flex items-center gap-8 text-slate-500 flex-wrap justify-center lg:justify-start">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-sm">99.9% uptime</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span className="text-sm">SSL encryption</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                    <span className="text-sm">GDPR compliant</span>
                  </div>
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

      {/* Screenshots Section - Bento Grid Style */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-gray-900 via-slate-800 to-gray-900 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#007AFF]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-32 right-16 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Header */}
          <div className="text-center mb-16 md:mb-24">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-6 py-3 mb-8">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white/90 font-medium">En vivo desde empresas reales</span>
            </div>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
              Mira cómo 
              <span className="bg-gradient-to-r from-[#007AFF] to-cyan-400 bg-clip-text text-transparent"> funciona</span>
            </h2>
            <p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
              Capturas reales de empresas que ya transformaron su gestión
            </p>
          </div>
          
          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
            
            {/* Large Feature Card */}
            <div className="md:col-span-8 group relative">
              <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border border-white/20 rounded-3xl overflow-hidden hover:border-[#007AFF]/50 transition-all duration-500">
                <div className="p-8 md:p-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-green-500/20 rounded-2xl flex items-center justify-center">
                      <Clock className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl md:text-3xl font-bold text-white">Fichajes Inteligentes</h3>
                      <p className="text-green-400 font-medium">GPS + IA + Tiempo Real</p>
                    </div>
                  </div>
                  <div className="relative">
                    <img 
                      src={timeTrackingScreenshot} 
                      alt="Control de tiempo" 
                      className="w-full h-auto rounded-2xl shadow-2xl border border-white/10 group-hover:scale-105 transition-transform duration-700" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent rounded-2xl"></div>
                    <div className="absolute bottom-6 left-6 right-6">
                      <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="font-medium">8h 32m trabajadas hoy</span>
                        </div>
                        <div className="bg-green-500/20 backdrop-blur-sm px-3 py-1 rounded-full">
                          <span className="text-green-400 font-medium">+12% eficiencia</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Side Cards */}
            <div className="md:col-span-4 space-y-6 md:space-y-8">
              
              {/* Profile Card */}
              <div className="group relative">
                <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-lg border border-white/20 rounded-3xl overflow-hidden hover:border-blue-400/50 transition-all duration-500 h-full">
                  <div className="p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">Perfiles 360°</h3>
                        <p className="text-blue-400 text-sm font-medium">Todo centralizado</p>
                      </div>
                    </div>
                    <img 
                      src={userProfileScreenshot} 
                      alt="Gestión de perfiles" 
                      className="w-full h-32 md:h-40 object-cover rounded-xl group-hover:scale-105 transition-transform duration-500" 
                    />
                  </div>
                </div>
              </div>

              {/* Security Card */}
              <div className="group relative">
                <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-lg border border-white/20 rounded-3xl overflow-hidden hover:border-purple-400/50 transition-all duration-500 h-full">
                  <div className="p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                        <Shield className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">Ultra Seguro</h3>
                        <p className="text-purple-400 text-sm font-medium">Nivel bancario</p>
                      </div>
                    </div>
                    <img 
                      src={loginScreenshot} 
                      alt="Acceso seguro" 
                      className="w-full h-32 md:h-40 object-cover rounded-xl group-hover:scale-105 transition-transform duration-500" 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mt-16 md:mt-24">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">99.9%</div>
              <div className="text-gray-400">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">500+</div>
              <div className="text-gray-400">Empresas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">15K+</div>
              <div className="text-gray-400">Usuarios</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-white mb-2">4.9★</div>
              <div className="text-gray-400">Valoración</div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-16 md:mt-24">
            <Link href="/request-code">
              <Button size="lg" className="bg-gradient-to-r from-[#007AFF] via-blue-500 to-cyan-500 hover:from-[#0056CC] hover:via-blue-600 hover:to-cyan-600 text-white px-12 py-6 text-xl font-bold shadow-2xl shadow-[#007AFF]/25 border-0 rounded-2xl transform hover:scale-105 transition-all duration-300">
                Probar Gratis Ahora
                <ArrowRight className="w-6 h-6 ml-3" />
              </Button>
            </Link>
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