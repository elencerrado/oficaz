import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CheckCircle, Zap, Users, MessageSquare, FileText, Clock, Shield } from 'lucide-react';
import { Link } from 'wouter';
import React from 'react';

// Performance optimization: throttle scroll events
const useThrottledScroll = (callback: () => void, delay: number) => {
  const lastRun = useRef(Date.now());

  const throttledCallback = useCallback(() => {
    if (Date.now() - lastRun.current >= delay) {
      callback();
      lastRun.current = Date.now();
    }
  }, [callback, delay]);

  return throttledCallback;
};

// Memoized data arrays for better performance
const featuresData = [
  {
    icon: Clock,
    title: 'Control de Tiempo',
    description: 'Fichajes automáticos con localización GPS. Control total de horarios en tiempo real.'
  },
  {
    icon: Users,
    title: 'Gestión de Vacaciones',
    description: 'Solicitudes, aprobaciones y calendarios inteligentes. Todo automatizado según normativa española.'
  },
  {
    icon: FileText,
    title: 'Documentos Inteligentes',
    description: 'Distribución automática de nóminas, contratos y documentos. Sin papeles, sin errores.'
  },
  {
    icon: MessageSquare,
    title: 'Comunicación Directa',
    description: 'Chat interno empresarial. Mantén a tu equipo conectado sin aplicaciones externas.'
  },
  {
    icon: Shield,
    title: 'Máxima Seguridad',
    description: 'Cumplimiento RGPD y encriptación bancaria. Tus datos protegidos al máximo nivel.'
  },
  {
    icon: Zap,
    title: 'Implementación Express',
    description: 'De registro a funcionamiento completo en menos de 24 horas. Setup automático incluido.'
  }
];

const plansData = [
  {
    name: 'Basic',
    price: '29',
    period: '/mes',
    description: 'Perfecto para equipos pequeños',
    features: [
      'Hasta 10 empleados',
      'Fichajes y vacaciones',
      'Mensajería interna',
      'Soporte por email',
      '15 días gratis'
    ],
    popular: false,
    cta: 'Empezar Gratis'
  },
  {
    name: 'Pro',
    price: '59',
    period: '/mes',
    description: 'Lo más popular para empresas',
    features: [
      'Hasta 50 empleados',
      'Todo lo de Basic',
      'Documentos inteligentes',
      'Reportes avanzados',
      'Soporte prioritario'
    ],
    popular: true,
    cta: 'Empezar Gratis'
  },
  {
    name: 'Master',
    price: '149',
    period: '/mes',
    description: 'Para empresas grandes',
    features: [
      'Empleados ilimitados',
      'Todo lo de Pro',
      'API personalizada',
      'Manager dedicado',
      'Soporte 24/7'
    ],
    popular: false,
    cta: 'Empezar Gratis'
  }
];

// Memoized components for better performance
const FeaturesSection = React.memo(() => {
  return (
    <section id="funciones" className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 relative overflow-hidden flex items-center py-8 md:py-12">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#007AFF]/10 via-transparent to-purple-500/10"></div>
        <div className="absolute top-20 right-20 w-96 h-96 bg-[#007AFF]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-cyan-400/5 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
        <div className="text-center mb-6 lg:mb-8">
          <div className="inline-flex items-center gap-2 bg-[#007AFF]/10 backdrop-blur-sm border border-[#007AFF]/20 rounded-full px-4 py-2 mb-4">
            <div className="w-2 h-2 bg-[#007AFF] rounded-full animate-pulse"></div>
            <span className="text-[#007AFF] font-semibold text-xs">Funcionalidades Principales</span>
          </div>
          <h2 className="text-3xl lg:text-5xl xl:text-6xl font-black text-gray-900 mb-4 tracking-tight">
            Todo en una
            <span className="block bg-gradient-to-r from-[#007AFF] via-blue-500 to-cyan-400 bg-clip-text text-transparent">
              plataforma
            </span>
          </h2>
          <p className="text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Diseñada para empresas que buscan <span className="text-gray-900 font-semibold">eficiencia sin complicaciones</span>
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {featuresData.map((feature, index) => (
            <div 
              key={index} 
              className="group relative h-full"
              style={{
                animationDelay: `${index * 150}ms`,
                animationFillMode: 'both'
              }}
            >
              <div className="relative bg-white rounded-2xl p-4 lg:p-6 shadow-lg shadow-gray-900/5 border border-gray-100/50 hover:shadow-2xl hover:shadow-[#007AFF]/10 hover:border-[#007AFF]/20 transition-all duration-500 hover:scale-105 hover:-translate-y-1 backdrop-blur-xl h-full flex flex-col">
                <div className="relative mb-4">
                  <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-[#007AFF] to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-[#007AFF]/25 group-hover:shadow-xl group-hover:shadow-[#007AFF]/30 transition-all duration-500">
                    <feature.icon className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
                  </div>
                  <div className="absolute inset-0 w-12 h-12 lg:w-16 lg:h-16 bg-[#007AFF]/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>
                
                <div className="flex-1 flex flex-col">
                  <h3 className="text-lg lg:text-xl font-bold text-gray-900 mb-2 group-hover:text-[#007AFF] transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-sm lg:text-base text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8 lg:mt-12">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              500+ empresas confían en nosotros
            </span>
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              Implementación en 24h
            </span>
          </div>
        </div>
      </div>
    </section>
  );
});

const PricingSection = React.memo(() => {
  return (
    <section id="precios" className="py-16 lg:py-24 bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-400/5 to-cyan-400/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-400/5 to-pink-400/5 rounded-full blur-3xl"></div>
      
      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4 px-4 py-2 text-sm font-medium bg-blue-50/10 text-blue-200 border-blue-400/30 backdrop-blur-sm">
            Precios Transparentes
          </Badge>
          <h2 className="text-4xl lg:text-6xl font-bold text-white mb-6">
            Planes que
            <span className="block bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              se adaptan a ti
            </span>
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Sin permanencia, sin letra pequeña. Cambia o cancela cuando quieras.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plansData.map((plan, index) => (
            <div
              key={index}
              className={`relative rounded-3xl p-8 backdrop-blur-xl border transition-all duration-500 hover:scale-105 hover:-translate-y-2 group ${
                plan.popular
                  ? 'bg-white/20 border-cyan-400/50 shadow-2xl shadow-cyan-400/20'
                  : 'bg-white/10 border-white/20 hover:border-white/30'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-1 text-sm font-semibold">
                    Más Popular
                  </Badge>
                </div>
              )}
              
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-300 text-sm mb-6">{plan.description}</p>
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-bold text-white">€{plan.price}</span>
                  <span className="text-gray-300 ml-1">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <span className="text-gray-200 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                className={`w-full text-lg font-semibold py-3 rounded-xl transition-all duration-300 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                    : 'bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm'
                }`}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-400 text-sm">
            Todos los planes incluyen 15 días de prueba gratuita. Sin tarjeta de crédito requerida.
          </p>
        </div>
      </div>
    </section>
  );
});

export default function Landing() {
  const [scrollY, setScrollY] = useState(0);
  
  const handleScroll = useCallback(() => {
    setScrollY(window.scrollY);
  }, []);

  const throttledScroll = useThrottledScroll(handleScroll, 100);

  useEffect(() => {
    window.addEventListener('scroll', throttledScroll);
    return () => window.removeEventListener('scroll', throttledScroll);
  }, [throttledScroll]);

  // Memoized hero icons with performance optimization
  const heroIcons = useMemo(() => {
    const icons = [Clock, Users, FileText, MessageSquare, Shield, Zap, CheckCircle];
    return Array(32).fill(null).map((_, i) => {
      const Icon = icons[i % icons.length];
      return (
        <div
          key={i}
          className="w-20 h-20 md:w-32 md:h-32 bg-white/5 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/10 hover:bg-white/10 transition-all duration-300"
          style={{
            animation: `pulse ${2 + (i % 3)}s ease-in-out infinite`,
            animationDelay: `${i * 150}ms`
          }}
        >
          <Icon className="w-8 h-8 md:w-12 md:h-12 text-white/60" />
        </div>
      );
    });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Oficaz</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-8">
              <a href="#funciones" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                Funciones
              </a>
              <a href="#precios" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                Precios
              </a>
            </nav>
            
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                  Iniciar Sesión
                </Button>
              </Link>
              <Link href="/request-code">
                <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white">
                  Empezar Gratis
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20"></div>
        
        {/* Hero Icons Grid - Optimized */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-slate-900/30 to-slate-900/10"></div>
          <div className="grid grid-cols-3 md:grid-cols-8 gap-6 md:gap-8 p-6 h-full items-center justify-center">
            {heroIcons}
          </div>
        </div>

        <div className="relative z-10 text-center px-6 lg:px-8 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full px-6 py-3 mb-8">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
            <span className="text-white/90 font-medium text-sm">La revolución en gestión empresarial</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-8xl font-black tracking-tight mb-6">
            <span className="block text-white">Oficaz es</span>
            <span className="block bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              simplificar
            </span>
            <span className="block text-white text-4xl md:text-5xl lg:text-6xl font-semibold">
              para empresas que lo quieren fácil
            </span>
          </h1>

          <div className="mb-12">
            <Link href="/request-code">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 hover:from-cyan-600 hover:via-blue-600 hover:to-purple-600 text-white px-12 py-4 text-xl font-bold rounded-xl shadow-2xl hover:shadow-cyan-500/25 transition-all duration-300 hover:scale-105"
              >
                Empezar Gratis
              </Button>
            </Link>
          </div>

          <div className="flex flex-col md:flex-row justify-center items-center gap-6 md:gap-8 text-sm text-white/70">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
              <span>Siempre disponible</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
              <span>Datos protegidos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
              <span>Cumple normativas</span>
            </div>
          </div>
        </div>
      </section>

      {/* Use Memoized Features Section */}
      <FeaturesSection />

      {/* Use Memoized Pricing Section */}
      <PricingSection />

      {/* Screenshots Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 via-white to-blue-50/30 relative">
        <div className="absolute inset-0 opacity-30">
          <div className="w-full h-full bg-repeat bg-[length:40px_40px]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='0.02'%3E%3Cpath d='m0 40 40-40h20v20l-20 20z'/%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-2 text-sm font-medium bg-blue-50 text-blue-700 border-blue-200">
              En Acción
            </Badge>
            <h2 className="text-5xl font-bold text-gray-900 mb-4">
              Ve cómo funciona
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Captura en tiempo real de nuestro sistema funcionando en empresas reales
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <Card className="p-8 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-105">
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-1">
                    TIEMPO REAL
                  </Badge>
                  <h3 className="text-2xl font-bold text-gray-900">Panel de Empleados</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">JD</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Juan Díaz</p>
                        <p className="text-sm text-gray-500">Desarrollador</p>
                      </div>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800">Descanso</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">MG</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Marta García</p>
                        <p className="text-sm text-gray-500">Marketing</p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Trabajando</Badge>
                  </div>
                </div>
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="p-6 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl">
                <Badge className="bg-blue-100 text-blue-800 mb-4">Gestión</Badge>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Control de Fichajes</h4>
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                  <span className="text-gray-600">09:00 - En curso</span>
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                    Descanso
                  </Button>
                </div>
              </Card>
              
              <Card className="p-6 bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl">
                <Badge className="bg-purple-100 text-purple-800 mb-4">Seguridad</Badge>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Documentos Inteligentes</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>📄 Nómina Febrero</span>
                    <span className="text-green-600">Distribuido</span>
                  </div>
                  <div className="flex justify-between">
                    <span>📋 Contrato Juan</span>
                    <span className="text-blue-600">En proceso</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="text-center mt-12">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              Ver Demo Completa
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-400/10 to-cyan-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-400/10 to-pink-400/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative text-center">
          <h2 className="text-5xl lg:text-6xl font-bold mb-6">
            <span className="block text-white">Transforma tu empresa</span>
            <span className="block bg-gradient-to-r from-cyan-400 via-white to-blue-400 bg-clip-text text-transparent">
              en minutos
            </span>
          </h2>
          
          <p className="text-xl text-gray-200 max-w-4xl mx-auto mb-12 leading-relaxed">
            Deja atrás los papeles perdidos, las horas extras no controladas y los procesos complicados. 
            <span className="block mt-2 font-semibold text-white">
              Con Oficaz, automatiza lo tedioso para que te enfoques en lo importante.
            </span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
            <div className="text-center p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Configuración Instantánea</h3>
              <p className="text-gray-300 text-sm">Lista en menos de 5 minutos</p>
            </div>
            
            <div className="text-center p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Equipo Productivo</h3>
              <p className="text-gray-300 text-sm">Ahorra 10+ horas semanales</p>
            </div>
            
            <div className="text-center p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Crecimiento Real</h3>
              <p className="text-gray-300 text-sm">Resultados desde día 1</p>
            </div>
          </div>

          <Button 
            size="lg" 
            className="bg-white text-blue-900 hover:bg-gray-100 px-12 py-4 text-xl font-bold rounded-xl shadow-2xl hover:shadow-white/20 transition-all duration-300 hover:scale-110 mb-8"
          >
            Empezar Gratis Ahora
          </Button>

          <div className="flex justify-center items-center gap-8 text-sm text-gray-300">
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              Datos seguros
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              15 días gratis
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              Sin tarjeta requerida
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">O</span>
                </div>
                <span className="text-xl font-bold">Oficaz</span>
              </div>
              <p className="text-gray-400 max-w-md">
                La plataforma de gestión empresarial que simplifica tu día a día. 
                Para empresas que lo quieren fácil.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Producto</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#funciones" className="hover:text-white transition-colors">Funciones</a></li>
                <li><a href="#precios" className="hover:text-white transition-colors">Precios</a></li>
                <li><Link href="/request-code" className="hover:text-white transition-colors">Registrarse</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacidad</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Términos</Link></li>
                <li><Link href="/cookies" className="hover:text-white transition-colors">Cookies</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Oficaz. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}