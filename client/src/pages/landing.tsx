import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/use-page-title';
import { lazy, Suspense } from 'react';

// Lazy load non-critical components for better initial load performance
const ContactForm = lazy(() => import('@/components/contact-form'));
import oficazWhiteLogo from '@assets/Imagotipo Oficaz white_1750407614936.png';
// Optimized icon imports - critical and frequently used icons
import { 
  Clock, 
  Users, 
  CheckCircle,
  ArrowRight,
  Play,
  ChevronRight,
  Star,
  Calendar,
  CalendarDays,
  FileText,
  MessageSquare,
  Shield,
  TrendingUp,
  Building2,
  Smartphone,
  Globe,
  Mail,
  Settings,
  Zap,
  CreditCard,
  Bell,
  Square,
  Eye
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';
import heroBackground from '@assets/oficaz_hero_1764771312944.webp';

function DifficultySlider() {
  const [selected, setSelected] = useState<'dificil' | 'normal' | 'oficaz'>('normal');
  const [, navigate] = useLocation();
  
  const handleSelect = (option: 'dificil' | 'normal' | 'oficaz') => {
    setSelected(option);
    if (option === 'oficaz') {
      setTimeout(() => {
        navigate('/request-code');
      }, 400);
    }
  };
  
  return (
    <div className="relative inline-flex bg-white/10 backdrop-blur-md rounded-2xl p-1.5 border border-white/20">
      {/* Sliding background indicator */}
      <div 
        className="absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-300 ease-out"
        style={{
          width: 'calc(33.333% - 4px)',
          left: selected === 'dificil' ? '6px' : selected === 'normal' ? 'calc(33.333% + 2px)' : 'calc(66.666% - 2px)',
          background: selected === 'oficaz' 
            ? 'linear-gradient(135deg, #007AFF 0%, #0066DD 100%)' 
            : selected === 'dificil'
            ? 'rgba(239, 68, 68, 0.3)'
            : 'rgba(255, 255, 255, 0.15)',
          boxShadow: selected === 'oficaz' ? '0 4px 20px rgba(0, 122, 255, 0.4)' : 'none'
        }}
      />
      
      {/* Options */}
      <button
        onClick={() => handleSelect('dificil')}
        className={`relative z-10 px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 ${
          selected === 'dificil' 
            ? 'text-red-400' 
            : 'text-white/60 hover:text-white/80'
        }`}
      >
        Difícil
      </button>
      
      <button
        onClick={() => handleSelect('normal')}
        className={`relative z-10 px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 ${
          selected === 'normal' 
            ? 'text-white' 
            : 'text-white/60 hover:text-white/80'
        }`}
      >
        Normal
      </button>
      
      <button
        onClick={() => handleSelect('oficaz')}
        className={`relative z-10 px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-sm sm:text-base font-bold transition-all duration-300 ${
          selected === 'oficaz' 
            ? 'text-white' 
            : 'text-white/60 hover:text-white/80'
        }`}
      >
        Oficaz
      </button>
    </div>
  );
}

export default function Landing() {
  usePageTitle('Bienvenido a Oficaz');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Pricing calculator state - starts with 1 admin (required), employees (always included) and time_tracking selected
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set(['employees', 'time_tracking']));
  const [userCounts, setUserCounts] = useState({ employees: 0, managers: 0, admins: 1 });

  // Defer API calls until after critical content renders
  const [shouldLoadData, setShouldLoadData] = useState(false);
  
  useEffect(() => {
    // Trigger entrance animations after mount
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    // Defer data loading to prevent blocking initial render
    const timer = setTimeout(() => setShouldLoadData(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Track landing page visit
  useEffect(() => {
    const trackVisit = async () => {
      try {
        await fetch('/api/track/landing-visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referrer: document.referrer || '',
          }),
        });
      } catch (error) {
        console.error('Failed to track visit:', error);
      }
    };
    
    trackVisit();
  }, []);

  // Check if public registration is enabled - defer after critical content loads
  const { data: registrationSettings } = useQuery({
    queryKey: ['/api/registration-status'],
    queryFn: async () => {
      const response = await fetch('/api/registration-status');
      return response.json();
    },
    enabled: shouldLoadData, // Only execute after initial render
    staleTime: 1000 * 60 * 60, // 60 minutes - much longer cache
    gcTime: 1000 * 60 * 60 * 2, // 2 hours garbage collection time
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false, // Disable automatic refetching
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Addon definitions for pricing calculator - employees is free and always included
  const addons = [
    { key: 'employees', name: 'Empleados', price: 0, icon: Users, isLocked: true },
    { key: 'time_tracking', name: 'Fichajes', price: 3, icon: Clock, isLocked: false },
    { key: 'vacation', name: 'Vacaciones', price: 3, icon: Calendar, isLocked: false },
    { key: 'schedules', name: 'Cuadrante', price: 3, icon: CalendarDays, isLocked: false },
    { key: 'messages', name: 'Mensajes', price: 5, icon: MessageSquare, isLocked: false },
    { key: 'reminders', name: 'Recordatorios', price: 5, icon: Bell, isLocked: false },
    { key: 'documents', name: 'Documentos', price: 10, icon: FileText, isLocked: false },
    { key: 'work_reports', name: 'Partes de Trabajo', price: 8, icon: Settings, isLocked: false },
    { key: 'ai_assistant', name: 'OficazIA', price: 15, icon: Zap, isLocked: false },
  ];

  // Calculate total price (employees is free, not counted)
  const addonsTotal = addons.filter(a => selectedAddons.has(a.key) && a.price > 0).reduce((sum, a) => sum + a.price, 0);
  const usersTotal = (userCounts.employees * 2) + (userCounts.managers * 4) + (userCounts.admins * 6);
  const monthlyTotal = addonsTotal + usersTotal;

  const toggleAddon = (key: string) => {
    // Employees is always included, cannot be removed
    if (key === 'employees') return;
    
    const newSet = new Set(selectedAddons);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedAddons(newSet);
  };

  // Funciones principales
  const mainFeatures = [
    {
      icon: Clock,
      title: "Control horario",
      description: "Control automático con seguimiento en tiempo real y reportes detallados"
    },
    {
      icon: Calendar,
      title: "Gestión de vacaciones",
      description: "Solicitudes digitales con flujo de aprobación y calendario integrado"
    },
    {
      icon: CalendarDays,
      title: "Cuadrante",
      description: "Planificación visual drag & drop con turnos inteligentes y gestión semanal"
    }
  ];

  // Funciones adicionales
  const additionalFeatures = [
    {
      icon: FileText,
      title: "Documentos",
      description: "Subida automática con detección de empleados y categorización inteligente"
    },
    {
      icon: MessageSquare,
      title: "Mensajes",
      description: "Comunicación empresarial estilo WhatsApp para toda la organización"
    },
    {
      icon: Settings,
      title: "Recordatorios",
      description: "Recordatorios personalizados, tareas automáticas y notificaciones inteligentes"
    }
  ];

  const features = [...mainFeatures, ...additionalFeatures];

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
      <header className={`border-b fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/95 backdrop-blur-md shadow-lg shadow-black/5 border-gray-200' 
          : 'bg-white backdrop-blur-md shadow-xl shadow-black/30 border-gray-300'
      }`}
      style={{
        paddingTop: '8px',
        paddingBottom: '8px',
        marginTop: 'env(safe-area-inset-top, 0px)'
      }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-10">
            <div className="flex items-center">
              <img src={oficazLogo} alt="Oficaz" className="h-8 md:h-10 w-auto object-contain" loading="eager" style={{ minWidth: '120px' }} />
            </div>
            
            <nav className="hidden md:flex items-center justify-between flex-1 ml-8">
              <div className="flex items-center space-x-8">
                <a href="#funciones" className="text-gray-700 hover:text-gray-900 transition-colors font-medium">Funciones</a>
                <a href="#precios" className="text-gray-700 hover:text-gray-900 transition-colors font-medium">Precios</a>
              </div>
              
              <div className="flex items-center space-x-3">
                <a 
                  href="https://wa.me/34614028600" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center mr-2"
                >
                  <Button 
                    size="sm" 
                    className="bg-[#25D366] hover:bg-[#20BA5A] text-white font-semibold px-4 py-2 shadow-lg shadow-[#25D366]/25 border-0 rounded-lg hover:shadow-xl hover:shadow-[#25D366]/30 transition-all duration-300 hover:scale-105"
                  >
                    <FaWhatsapp className="w-5 h-5 mr-2" />
                    WhatsApp
                  </Button>
                </a>
                {registrationSettings?.publicRegistrationEnabled ? (
                  <Link href="/request-code">
                    <Button size="sm" className="bg-gradient-to-r from-[#007AFF] to-blue-600 hover:from-[#0056CC] hover:to-blue-700 text-white font-semibold px-6 py-2 shadow-lg shadow-[#007AFF]/25 border-0 rounded-lg hover:shadow-xl hover:shadow-[#007AFF]/30 transition-all duration-300 hover:scale-105">
                      Prueba Gratis
                    </Button>
                  </Link>
                ) : (
                  <Button 
                    size="sm" 
                    onClick={() => setIsContactFormOpen(true)}
                    className="bg-gradient-to-r from-[#007AFF] to-blue-600 hover:from-[#0056CC] hover:to-blue-700 text-white font-semibold px-6 py-2 shadow-lg shadow-[#007AFF]/25 border-0 rounded-lg hover:shadow-xl hover:shadow-[#007AFF]/30 transition-all duration-300 hover:scale-105"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Contacta
                  </Button>
                )}
                <Link href="/login">
                  <Button variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-900 font-semibold px-4 py-2 rounded-lg shadow-lg transition-all duration-300 hover:scale-105">
                    Iniciar Sesión
                  </Button>
                </Link>
              </div>
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center space-x-2">
              {registrationSettings?.publicRegistrationEnabled ? (
                <Link href="/request-code">
                  <Button size="sm" className="bg-gradient-to-r from-[#007AFF] to-blue-600 hover:from-[#0056CC] hover:to-blue-700 text-white font-semibold px-3 shadow-lg shadow-[#007AFF]/25 border-0 rounded-lg">
                    Registrarse
                  </Button>
                </Link>
              ) : (
                <Button 
                  size="sm" 
                  onClick={() => setIsContactFormOpen(true)}
                  className="bg-gradient-to-r from-[#007AFF] to-blue-600 hover:from-[#0056CC] hover:to-blue-700 text-white font-semibold px-3 shadow-lg shadow-[#007AFF]/25 border-0 rounded-lg"
                >
                  <Mail className="w-4 h-4" />
                </Button>
              )}
              <Link href="/login">
                <Button variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-900 font-semibold px-3 py-1.5 rounded-lg shadow-lg transition-all duration-300">
                  Entrar
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Floating WhatsApp Button - Mobile Only */}
      <a 
        href="https://wa.me/34614028600" 
        target="_blank" 
        rel="noopener noreferrer"
        className="md:hidden fixed bottom-6 right-6 z-50 inline-flex items-center justify-center w-16 h-16 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-full shadow-2xl shadow-[#25D366]/40 transition-all duration-300 hover:scale-110 active:scale-95"
        aria-label="Contactar por WhatsApp"
      >
        <FaWhatsapp className="w-8 h-8" />
      </a>

      {/* Hero Section - Static, no scroll effects */}
      <section 
        className="relative min-h-screen flex items-center justify-center pt-16"
        style={{ 
          backgroundImage: `url(${heroBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-slate-900/70" />
        
        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="space-y-8 lg:space-y-10">
            {/* Main Headline */}
            <div className="space-y-3">
              <h1 
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-white leading-[1.1] tracking-tight transition-all duration-1000 ease-out"
                style={{
                  opacity: isLoaded ? 1 : 0,
                  transform: isLoaded ? 'translateY(0)' : 'translateY(40px)',
                }}
              >
                Haz lo que te mueve.
              </h1>
              <p 
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#60B5FF] transition-all duration-1000 ease-out"
                style={{
                  opacity: isLoaded ? 1 : 0,
                  transform: isLoaded ? 'translateY(0)' : 'translateY(40px)',
                  transitionDelay: '150ms',
                }}
              >
                Déjanos la parte aburrida.
              </p>
            </div>

            {/* Subtext */}
            <p 
              className="text-lg md:text-xl lg:text-2xl text-white/90 max-w-2xl mx-auto leading-relaxed font-medium transition-all duration-1000 ease-out"
              style={{
                opacity: isLoaded ? 1 : 0,
                transform: isLoaded ? 'translateY(0)' : 'translateY(30px)',
                transitionDelay: '300ms',
              }}
            >
              La app de gestión empresarial en un clic
            </p>

            {/* Difficulty Slider */}
            {registrationSettings?.publicRegistrationEnabled && (
              <div 
                className="flex flex-col items-center gap-4 pt-4 transition-all duration-1000 ease-out"
                style={{
                  opacity: isLoaded ? 1 : 0,
                  transform: isLoaded ? 'translateY(0)' : 'translateY(30px)',
                  transitionDelay: '450ms',
                }}
              >
                <p className="text-white/70 text-sm font-medium">Selecciona nivel de dificultad</p>
                <DifficultySlider />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features Section - Apple Style Grid */}
      <section id="funciones" className="py-20 md:py-28 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 tracking-tight">
              Funciones modulares
            </h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto">
              Activa solo lo que necesitas. Sin paquetes, sin compromisos.
            </p>
          </div>

          {/* Features Grid - 4 columns on desktop */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {addons.map((addon) => {
              const IconComponent = addon.icon;
              return (
                <div 
                  key={addon.key}
                  className={`group rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-gray-200/50 border border-transparent hover:border-gray-100 ${
                    addon.isLocked ? 'bg-green-50 hover:bg-green-50' : 'bg-gray-50 hover:bg-white'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ${
                    addon.isLocked ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-[#007AFF] to-blue-600'
                  }`}>
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{addon.name}</h3>
                  <p className={`text-sm ${addon.isLocked ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                    {addon.isLocked ? 'Gratis - Incluido' : `€${addon.price}/mes`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {/* Pricing Section - Compact, fits in viewport */}
      <section id="precios" className="bg-gray-50 py-12 md:py-16 lg:py-20 flex items-center">
        <div className="max-w-5xl mx-auto px-6 w-full">
          {/* Header */}
          <div className="text-center mb-10 lg:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
              Sin planes. Paga solo lo que necesitas.
            </h2>
            <p className="text-base md:text-lg text-gray-500">
              Configura tu suscripción a medida
            </p>
          </div>
          
          {/* Calculator Layout - Two columns, same height */}
          <div className="grid lg:grid-cols-2 gap-6 items-stretch">
            {/* Left: Price Summary */}
            <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 flex flex-col">
              <div className="text-center">
                <p className="text-gray-500 text-sm mb-1">Tu plan mensual</p>
                <div className="flex items-baseline justify-center gap-1 mb-4">
                  <span className="text-6xl md:text-7xl font-black text-gray-900">€{monthlyTotal}</span>
                  <span className="text-lg text-gray-400">/mes</span>
                </div>
                
                {/* Dynamic summary - scrollable if many items */}
                <div className="max-h-28 overflow-y-auto mb-4 px-2">
                  {/* User counts first */}
                  <div className="flex flex-wrap justify-center gap-1.5 mb-2">
                    {userCounts.employees > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {userCounts.employees} Empleado{userCounts.employees !== 1 ? 's' : ''}
                      </span>
                    )}
                    {userCounts.managers > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {userCounts.managers} Manager{userCounts.managers !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {userCounts.admins} Admin{userCounts.admins !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* Selected addons below */}
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {addons.filter(a => selectedAddons.has(a.key) || a.isLocked).map((addon) => {
                      const IconComponent = addon.icon;
                      return (
                        <span 
                          key={addon.key}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            addon.isLocked 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          <IconComponent className="w-3 h-3" />
                          {addon.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
                
                {/* CTA */}
                {registrationSettings?.publicRegistrationEnabled ? (
                  <Link href="/request-code">
                    <Button className="w-full py-5 text-base font-bold bg-[#007AFF] hover:bg-[#0056CC]">
                      Prueba 7 días gratis
                    </Button>
                  </Link>
                ) : (
                  <Button 
                    onClick={() => setIsContactFormOpen(true)}
                    className="w-full py-5 text-base font-bold bg-[#007AFF] hover:bg-[#0056CC]"
                  >
                    Contactar
                  </Button>
                )}
                <p className="text-center text-xs text-gray-400 mt-2">Sin compromiso • Cancela cuando quieras</p>
              </div>
            </div>
            
            {/* Right: Feature Selector */}
            <div className="space-y-4">
              {/* Functions - scrollable */}
              <div className="bg-white rounded-xl p-4 border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">Funciones</h3>
                <div className="max-h-40 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-1.5">
                    {addons.map((addon) => {
                      const isSelected = selectedAddons.has(addon.key);
                      const IconComponent = addon.icon;
                      const isLocked = addon.isLocked;
                      return (
                        <button
                          key={addon.key}
                          onClick={() => toggleAddon(addon.key)}
                          disabled={isLocked}
                          className={`flex items-center gap-2 p-2.5 rounded-lg text-left transition-all ${
                            isLocked
                              ? 'bg-green-500 text-white cursor-default'
                              : isSelected 
                                ? 'bg-[#007AFF] text-white' 
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <IconComponent className={`w-4 h-4 ${isSelected || isLocked ? 'text-white' : 'text-gray-400'}`} />
                          <span className={`text-xs font-medium ${isSelected || isLocked ? 'text-white' : 'text-gray-900'}`}>
                            {addon.name}
                          </span>
                          {isLocked && (
                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded ml-auto">Gratis</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              {/* Users */}
              <div className="bg-white rounded-xl p-4 border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">Usuarios</h3>
                <div className="space-y-3">
                  {/* Employees */}
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900 text-sm">Empleados</p>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setUserCounts(prev => ({ ...prev, employees: Math.max(0, prev.employees - 1) }))}
                        className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-semibold text-gray-900 text-sm">{userCounts.employees}</span>
                      <button 
                        onClick={() => setUserCounts(prev => ({ ...prev, employees: prev.employees + 1 }))}
                        className="w-7 h-7 rounded-full bg-[#007AFF] hover:bg-[#0056CC] flex items-center justify-center text-white font-bold text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  
                  {/* Managers */}
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900 text-sm">Managers</p>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setUserCounts(prev => ({ ...prev, managers: Math.max(0, prev.managers - 1) }))}
                        className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-semibold text-gray-900 text-sm">{userCounts.managers}</span>
                      <button 
                        onClick={() => setUserCounts(prev => ({ ...prev, managers: prev.managers + 1 }))}
                        className="w-7 h-7 rounded-full bg-[#007AFF] hover:bg-[#0056CC] flex items-center justify-center text-white font-bold text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  
                  {/* Admins - minimum 1 required */}
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900 text-sm">Admins</p>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setUserCounts(prev => ({ ...prev, admins: Math.max(1, prev.admins - 1) }))}
                        disabled={userCounts.admins <= 1}
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
                          userCounts.admins <= 1 
                            ? 'bg-gray-50 text-gray-300 cursor-not-allowed' 
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                        }`}
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-semibold text-gray-900 text-sm">{userCounts.admins}</span>
                      <button 
                        onClick={() => setUserCounts(prev => ({ ...prev, admins: prev.admins + 1 }))}
                        className="w-7 h-7 rounded-full bg-[#007AFF] hover:bg-[#0056CC] flex items-center justify-center text-white font-bold text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Enhanced CTA Section */}
      <section className="py-32 md:py-40 bg-gradient-to-br from-[#007AFF] via-blue-600 to-indigo-700 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl transform translate-x-32 -translate-y-32"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl transform -translate-x-20 translate-y-20"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
        </div>
        
        <div className="max-w-6xl mx-auto px-6 lg:px-8 text-center relative z-10">
          {/* Header Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-6 py-3 mb-8">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-white font-semibold">Únete Ahora</span>
          </div>
          
          {/* Main Title */}
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
            Transforma tu empresa
            <span className="bg-gradient-to-r from-cyan-200 via-white to-blue-200 bg-clip-text text-transparent"> en minutos</span>
          </h2>
          
          {/* Description */}
          <p className="text-xl md:text-2xl text-blue-100 mb-12 max-w-4xl mx-auto leading-relaxed">
            No más horas perdidas enviando archivos, controlando horarios manualmente, 
            calculando vacaciones o realizando tareas repetitivas que te roban tiempo. 
            <br />
            <span className="text-white font-semibold">Oficaz automatiza lo tedioso para que te enfoques en lo importante.</span>
          </p>
          
          {/* Benefits Grid - Compact Visual Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-16 max-w-5xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mb-3 mx-auto">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-white font-semibold mb-1 text-sm">Setup Rápido</h3>
              <p className="text-blue-100 text-xs">5 minutos activo</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-3 mx-auto">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold mb-1 text-sm">Equipo Happy</h3>
              <p className="text-blue-100 text-xs">Procesos claros</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mb-3 mx-auto">
                <CalendarDays className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-white font-semibold mb-1 text-sm">Turnos Smart</h3>
              <p className="text-blue-100 text-xs">Drag & drop visual</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center mb-3 mx-auto">
                <TrendingUp className="w-5 h-5 text-orange-400" />
              </div>
              <h3 className="text-white font-semibold mb-1 text-sm">ROI Real</h3>
              <p className="text-blue-100 text-xs">Tiempo para crecer</p>
            </div>
          </div>
          
          {/* CTA Button */}
          {registrationSettings?.publicRegistrationEnabled && (
            <div className="mb-12">
              <Link href="/request-code">
                <button className="group relative bg-white text-[#007AFF] hover:bg-gray-50 font-bold text-xl px-12 py-5 rounded-2xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300">
                  <span className="relative z-10 flex items-center gap-3">
                    Empezar Gratis Ahora
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white to-gray-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </button>
              </Link>
            </div>
          )}
          
          {/* Trust Indicators */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-white/80">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              <span className="text-sm font-medium">Datos 100% seguros</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium">14 días gratis</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-medium">Sin tarjeta de crédito</span>
            </div>
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-6">
                <img 
                  src={oficazWhiteLogo} 
                  alt="Oficaz" 
                  className="h-8 w-auto"
                  loading="lazy"
                />
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
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Política de Privacidad</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Términos de Servicio</Link></li>
                <li><Link href="/cookies" className="hover:text-white transition-colors">Política de Cookies</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>Oficaz - Gestión empresarial inteligente para empresas que lo quieren fácil</p>
          </div>
        </div>
      </footer>
      {/* Contact Form Modal - Lazy loaded */}
      {isContactFormOpen && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-lg p-6">Cargando...</div></div>}>
          <ContactForm 
            isOpen={isContactFormOpen} 
            onClose={() => setIsContactFormOpen(false)} 
          />
        </Suspense>
      )}
    </div>
  );
}