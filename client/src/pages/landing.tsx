import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { 
  Clock, 
  Users, 
  FileText, 
  MessageSquare, 
  Calendar, 
  Settings,
  ArrowRight,
  CheckCircle,
  Star,
  Shield,
  Zap,
  Smartphone,
  Globe,
  BarChart,
  Heart,
  Target,
  TrendingUp,
  Award
} from 'lucide-react';

import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';

export default function Landing() {
  const [isScrolled, setIsScrolled] = useState(false);

  // Check if public registration is enabled with optimized cache
  const { data: registrationSettings } = useQuery({
    queryKey: ['/api/registration-status'],
    queryFn: async () => {
      const response = await fetch('/api/registration-status');
      return response.json();
    },
    staleTime: 1000 * 60 * 15, // 15 minutes - increased cache time
    gcTime: 1000 * 60 * 30, // 30 minutes garbage collection
    refetchOnWindowFocus: false, // Disable unnecessary refetches
  });

  // Optimized scroll handler with throttling
  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY;
    setIsScrolled(scrollTop > 50);
  }, []);

  useEffect(() => {
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });
    return () => window.removeEventListener('scroll', throttledScroll);
  }, [handleScroll]);

  // Memoized static data for performance
  const features = useMemo(() => [
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
      icon: Settings,
      title: "Y mucho más",
      description: "Recordatorios personalizados, reportes avanzados, integraciones y configuración flexible"
    }
  ], []);

  const plans = useMemo(() => [
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
        "Integraciones avanzadas",
        "Personalización completa",
        "Soporte 24/7",
        "Gerente de cuenta dedicado"
      ],
      popular: false
    }
  ], []);

  const testimonials = useMemo(() => [
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
  ], []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className={`border-b fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/95 backdrop-blur-md shadow-lg shadow-black/5 border-gray-200' 
          : 'bg-white backdrop-blur-md shadow-xl shadow-black/30 border-gray-300'
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img src={oficazLogo} alt="Oficaz" className="h-10 w-auto" />
            </div>
            
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#funciones" className="text-gray-700 hover:text-gray-900 transition-colors">Funciones</a>
              <a href="#precios" className="text-gray-700 hover:text-gray-900 transition-colors">Precios</a>
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Iniciar Sesión
                </Button>
              </Link>
              {registrationSettings?.publicRegistrationEnabled ? (
                <Link href="/request-code">
                  <Button size="sm" className="bg-[#007AFF] hover:bg-[#0056CC]">
                    Prueba Gratis
                  </Button>
                </Link>
              ) : (
                <Button size="sm" className="bg-gray-400 cursor-not-allowed" disabled>
                  Registro Cerrado
                </Button>
              )}
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden">
              {registrationSettings?.publicRegistrationEnabled ? (
                <Link href="/request-code">
                  <Button size="sm" className="bg-[#007AFF] hover:bg-[#0056CC]">
                    Registrarse
                  </Button>
                </Link>
              ) : (
                <Button size="sm" className="bg-gray-400 cursor-not-allowed" disabled>
                  Cerrado
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white" style={{
        minHeight: 'calc(100vh - 4rem)'
      }}>
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl"></div>
        </div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

        {/* Floating Icons Grid */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="relative w-full h-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-radial from-transparent via-slate-900/30 to-slate-900/10"></div>
            
            {/* Desktop Grid */}
            <div className="hidden lg:grid grid-cols-8 gap-8 w-full h-full p-8">
              {Array.from({ length: 32 }, (_, i) => {
                const icons = [Clock, Users, FileText, MessageSquare, Calendar, Settings, BarChart, Shield];
                const Icon = icons[i % icons.length];
                return (
                  <div 
                    key={i} 
                    className="flex items-center justify-center w-32 h-32 animate-pulse"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <Icon className="w-16 h-16" />
                  </div>
                );
              })}
            </div>

            {/* Mobile Grid */}
            <div className="lg:hidden grid grid-cols-3 gap-6 w-full h-full p-6">
              {Array.from({ length: 12 }, (_, i) => {
                const icons = [Clock, Users, FileText, MessageSquare, Calendar, Settings];
                const Icon = icons[i % icons.length];
                return (
                  <div 
                    key={i} 
                    className="flex items-center justify-center w-20 h-20 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }}
                  >
                    <Icon className="w-12 h-12" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center">
            {/* Badge */}
            <Badge variant="secondary" className="mb-8 bg-white/10 text-white border-white/20 px-6 py-3 text-sm font-medium backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <div className="w-1 h-1 bg-white/40 rounded-full animate-ping"></div>
                <div className="w-1 h-1 bg-white/40 rounded-full animate-ping" style={{ animationDelay: '200ms' }}></div>
                <span className="ml-2">Plataforma Todo-en-Uno</span>
              </div>
            </Badge>

            {/* Main Title */}
            <h1 className="text-6xl lg:text-8xl font-black mb-8 tracking-tight leading-none">
              <span className="block">Gestión</span>
              <span className="block bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent">empresarial</span>
              <span className="block text-4xl lg:text-5xl font-bold mt-4 text-gray-300">para empresas que lo quieren fácil</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl lg:text-2xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
              Oficaz automatiza las tareas repetitivas que consumen tiempo valioso: envío de archivos, control horarios manual, papeles perdidos, procesos complicados.
              <span className="block mt-2 text-cyan-300 font-medium">Automatiza lo tedioso para que te enfoques en lo importante.</span>
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Link href={registrationSettings?.publicRegistrationEnabled ? "/request-code" : "/login"}>
                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-[#007AFF] to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-4 text-lg font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 border-0">
                  {registrationSettings?.publicRegistrationEnabled ? "Empezar Gratis" : "Acceder al Sistema"}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span>Siempre disponible</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-400" />
                <span>Datos protegidos</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-400" />
                <span>Cumple normativas</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="funciones" className="min-h-screen flex items-center bg-gradient-to-b from-gray-50 via-white to-blue-50/30 relative overflow-hidden">
        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-32 right-16 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-6 bg-blue-50 text-blue-700 border-blue-200 px-4 py-2 text-sm font-medium">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></div>
              Funcionalidades Principales
            </Badge>
            <h2 className="text-7xl font-black tracking-tight text-gray-900 mb-6 leading-none">
              Una nueva era
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 bg-clip-text text-transparent">
                de plataforma
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className="group p-8 rounded-3xl border-0 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-2xl hover:scale-105 hover:-translate-y-2 transition-all duration-300 cursor-pointer"
                style={{
                  animationDelay: `${index * 150}ms`
                }}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#007AFF] to-blue-600 p-5 mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                      <feature.icon className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Link href={registrationSettings?.publicRegistrationEnabled ? "/request-code" : "/login"}>
              <Button size="lg" className="bg-gradient-to-r from-[#007AFF] to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-4 text-lg font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                {registrationSettings?.publicRegistrationEnabled ? "Empezar Gratis Ahora" : "Acceder al Sistema"}
              </Button>
            </Link>
            <div className="flex items-center justify-center gap-8 mt-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                500+ empresas confían en nosotros
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Implementación en 24h
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precios" className="relative min-h-screen flex items-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <h2 className="text-5xl lg:text-6xl font-black mb-6 bg-gradient-to-r from-white via-blue-200 to-white bg-clip-text text-transparent">
              Precios transparentes
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Sin sorpresas, sin letra pequeña. Solo herramientas poderosas a precios justos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div 
                key={index}
                className={`relative group ${
                  plan.popular 
                    ? 'transform scale-105 lg:scale-110' 
                    : 'hover:scale-105'
                } transition-all duration-300`}
              >
                <div className={`relative h-full p-8 rounded-3xl backdrop-blur-xl border transition-all duration-300 ${
                  plan.popular
                    ? 'bg-white/10 border-blue-400/50 shadow-2xl shadow-blue-500/25'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}>
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-1 text-sm font-semibold">
                        Más Popular
                      </Badge>
                    </div>
                  )}

                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                    <p className="text-gray-300 mb-6">{plan.description}</p>
                    <div className="flex items-baseline justify-center mb-6">
                      <span className="text-4xl font-black text-white">€{plan.price}</span>
                      <span className="text-gray-400 ml-2">/mes</span>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-200">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto">
                    <Link href={registrationSettings?.publicRegistrationEnabled ? "/request-code" : "/login"}>
                      <Button 
                        className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                          plan.popular
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
                            : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                        }`}
                      >
                        {registrationSettings?.publicRegistrationEnabled ? "Empezar 15 días gratis" : "Acceder"}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <p className="text-gray-400 mb-4">¿Necesitas algo diferente?</p>
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
              Hablemos de tu proyecto
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative py-20 bg-gradient-to-r from-blue-600 via-blue-700 to-purple-800 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-6xl font-black mb-6 bg-gradient-to-r from-cyan-300 via-white to-blue-300 bg-clip-text text-transparent leading-tight">
            Transforma tu empresa
            <br />
            en minutos
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Configuración Instantánea</h3>
              <p className="text-blue-100">Tu empresa funcionando en menos de 10 minutos</p>
            </div>
            
            <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Equipo Productivo</h3>
              <p className="text-blue-100">Empleados más eficientes desde el primer día</p>
            </div>
            
            <div className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Crecimiento Real</h3>
              <p className="text-blue-100">Más tiempo para lo que realmente importa</p>
            </div>
          </div>

          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto leading-relaxed">
            Deja atrás los papeles perdidos, las horas extras innecesarias y los procesos complicados. 
            Tu equipo merece herramientas que funcionen tan bien como ellos.
          </p>

          <div className="mb-8">
            <Link href={registrationSettings?.publicRegistrationEnabled ? "/request-code" : "/login"}>
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 text-lg font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
                {registrationSettings?.publicRegistrationEnabled ? "Empezar Gratis Ahora" : "Acceder al Sistema"}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-sm text-blue-200">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-0 px-3 py-1">
                <Shield className="w-3 h-3 mr-1" />
                Datos seguros
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-0 px-3 py-1">
                <CheckCircle className="w-3 h-3 mr-1" />
                15 días gratis
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-white/20 text-white border-0 px-3 py-1">
                <Heart className="w-3 h-3 mr-1" />
                Sin tarjeta requerida
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <img src={oficazLogo} alt="Oficaz" className="h-10 w-auto mb-4 filter brightness-0 invert" />
              <p className="text-gray-400 max-w-md">
                La plataforma todo-en-uno para la gestión empresarial moderna. 
                Simplificamos lo complejo para que puedas enfocarte en hacer crecer tu negocio.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Producto</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#funciones" className="hover:text-white transition-colors">Funcionalidades</a></li>
                <li><a href="#precios" className="hover:text-white transition-colors">Precios</a></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Iniciar Sesión</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Política de Privacidad</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Términos de Servicio</Link></li>
                <li><Link href="/cookies" className="hover:text-white transition-colors">Política de Cookies</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Oficaz. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}