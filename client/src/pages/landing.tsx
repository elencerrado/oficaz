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
  const [heroScrollProgress, setHeroScrollProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

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
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollTop = window.scrollY;
          setIsScrolled(scrollTop > 50);
          
          // Calculate hero scroll progress (0 to 1) based on viewport height
          const heroHeight = window.innerHeight;
          const progress = Math.min(scrollTop / (heroHeight * 0.6), 1);
          setHeroScrollProgress(progress);
          
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

      {/* Hero Section - New Design with Background Image and Scroll Effects */}
      <section className="relative min-h-screen flex items-center justify-center pt-16"
               style={{ minHeight: '100vh' }}>
        {/* Fixed Background Image */}
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-10"
          style={{ 
            backgroundImage: `url(${heroBackground})`,
            backgroundAttachment: 'fixed',
          }}
        />
        
        {/* Dark overlay that fades to white on scroll */}
        <div 
          className="fixed inset-0 -z-10 transition-colors duration-100"
          style={{ 
            backgroundColor: `rgba(15, 23, 42, ${0.7 * (1 - heroScrollProgress)})`,
          }}
        />
        
        {/* White overlay that appears on scroll */}
        <div 
          className="fixed inset-0 -z-10"
          style={{ 
            backgroundColor: `rgba(255, 255, 255, ${heroScrollProgress})`,
          }}
        />
        
        {/* Content that fades out on scroll */}
        <div 
          className="relative max-w-5xl mx-auto px-6 text-center transition-all duration-100"
          style={{
            opacity: 1 - heroScrollProgress * 1.5,
            transform: `translateY(${heroScrollProgress * -50}px) scale(${1 - heroScrollProgress * 0.1})`,
            pointerEvents: heroScrollProgress > 0.5 ? 'none' : 'auto',
          }}
        >
          {/* Main Content with staggered entrance animations */}
          <div className="space-y-8 lg:space-y-10">
            
            {/* Main Headline - First to animate */}
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

            {/* Subtext - Second to animate */}
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

            {/* Difficulty Slider - Third to animate */}
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
        
        {/* Scroll indicator */}
        <div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2 transition-all duration-500"
          style={{
            opacity: isLoaded && heroScrollProgress < 0.3 ? 1 : 0,
            transform: `translateY(${isLoaded ? 0 : 20}px)`,
            transitionDelay: '600ms',
          }}
        >
          <div className="flex flex-col items-center gap-2 text-white/50">
            <span className="text-xs font-medium">Scroll</span>
            <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
              <div className="w-1.5 h-3 bg-white/50 rounded-full animate-bounce" />
            </div>
          </div>
        </div>
      </section>
      {/* Unified Features Section - Apple Style */}
      <section id="funciones" className="bg-gradient-to-b from-white via-gray-50 to-white relative overflow-hidden">
        {/* Subtle Background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-br from-[#007AFF]/10 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-purple-500/10 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-24 md:py-32">
          {/* Hero Header */}
          <div className="text-center mb-20 md:mb-32">
            <div className="inline-flex items-center gap-2 bg-[#007AFF]/10 backdrop-blur-sm border border-[#007AFF]/20 rounded-full px-6 py-2.5 mb-6">
              <div className="w-2 h-2 bg-[#007AFF] rounded-full animate-pulse"></div>
              <span className="text-[#007AFF] font-semibold text-sm">Funcionalidades</span>
            </div>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold text-gray-900 mb-6 tracking-tight leading-none">
              Todo lo que necesitas,
              <br />
              <span className="bg-gradient-to-r from-[#007AFF] via-blue-500 to-cyan-400 bg-clip-text text-transparent">nada que sobre</span>
            </h2>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Descubre cómo cada función está diseñada para <span className="text-gray-900 font-semibold">simplificar tu trabajo</span>
            </p>
          </div>

          {/* BASIC PLAN FEATURES */}
          <div className="mb-24 md:mb-32">
            <div className="flex items-center gap-3 mb-16">
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg">
                PLAN BASIC
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-green-500/20 to-transparent"></div>
            </div>
            
            {/* 1. Control Horario - Image Left */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-32">
              <div className="order-2 lg:order-1">
                <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-6">
                  <Clock className="w-4 h-4 text-green-600" />
                  <span className="text-green-700 font-semibold text-sm">Plan Basic</span>
                </div>
                <h3 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                  Control horario
                  <span className="block text-[#007AFF]">en tiempo real</span>
                </h3>
                <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                  Sigue el tiempo de trabajo al instante con barras visuales intuitivas. Registra fichajes y descansos sin complicaciones.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">Visualizacion en directo</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">Gestión de ausencias</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">Reportes automaticos de horas trabajadas</span>
                  </li>
                </ul>
              </div>
              <div className="order-1 lg:order-2">
                <div className="relative bg-white rounded-3xl p-6 lg:p-8 shadow-2xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Fichajes</h4>
                      <p className="text-sm text-blue-500 font-medium">Control horario</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Hoy</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-blue-600 font-bold">7h 45m</span>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        </div>
                      </div>
                      <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div className="absolute inset-0 bg-blue-500 rounded-lg" style={{ width: '82%' }}></div>
                        <div className="absolute top-1 bottom-1 bg-orange-400 rounded-md animate-pulse" style={{ left: '77%', width: '4%' }}></div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>09:00</span>
                        <span className="text-orange-600 font-medium">En descanso</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-4 justify-center">
                    <button className="w-32 h-32 rounded-full bg-[#007AFF] hover:bg-[#0056CC] text-white text-xl font-bold shadow-lg transition-all duration-300">
                      SALIR
                    </button>
                    <button className="w-32 h-32 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xl font-bold shadow-lg transition-all duration-300">
                      <span className="whitespace-pre-line leading-tight">Finalizar{'\n'}Descanso</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Gestión de Vacaciones - Image Right */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-32">
              <div className="order-1">
                <div className="relative bg-white rounded-3xl p-6 lg:p-8 shadow-2xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Vacaciones</h4>
                      <p className="text-sm text-blue-500 font-medium">Control automático</p>
                    </div>
                  </div>
                  <div className="text-center p-6 bg-blue-50/50 rounded-2xl border border-blue-100 mb-4">
                    <div className="text-xl font-bold text-blue-600 mb-2">Juan Pérez</div>
                    <div className="text-sm text-gray-500 mb-4">Balance 2024</div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-800">12</div>
                        <div className="text-sm text-red-600">Usados</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-800">18</div>
                        <div className="text-sm text-green-600">Disponibles</div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-lg h-8">
                      <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-8 rounded-lg w-[40%]"></div>
                    </div>
                    <div className="text-sm text-gray-500 mt-2">40% utilizados</div>
                  </div>
                  <button className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-3 rounded-xl text-sm font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all">
                    Nueva Solicitud
                  </button>
                </div>
              </div>
              <div className="order-2">
                <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-6">
                  <Calendar className="w-4 h-4 text-green-600" />
                  <span className="text-green-700 font-semibold text-sm">Plan Basic</span>
                </div>
                <h3 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                  Vacaciones
                  <span className="block text-[#007AFF]">sin papeleos</span>
                </h3>
                <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                  Solicita vacaciones digitalmente con aprobación instantánea. Consulta el balance en tiempo real y planifica tu descanso sin complicaciones.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">Solicitudes digitales instantáneas</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">Días restantes en tiempo real</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">Gestión de días extra</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* 3. Cuadrante - Image Left */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-40">
              <div className="order-2 lg:order-1">
                <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-6">
                  <CalendarDays className="w-4 h-4 text-green-600" />
                  <span className="text-green-700 font-semibold text-sm">Plan Basic</span>
                </div>
                <h3 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                  Cuadrante
                  <span className="block text-[#007AFF]">drag & drop</span>
                </h3>
                <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                  Planifica turnos visualmente arrastrando y soltando. Gestiona toda la semana de un vistazo con turnos partidos y duplicación inteligente.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">Planificación visual drag & drop</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">Turnos partidos y personalizados</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700">Duplicación de semanas</span>
                  </li>
                </ul>
              </div>
              <div className="order-1 lg:order-2">
                <div className="relative bg-white rounded-3xl p-6 lg:p-8 shadow-2xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl flex items-center justify-center shadow-lg">
                      <CalendarDays className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Cuadrantes</h4>
                      <p className="text-sm text-purple-500 font-medium">Planificación</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-1 text-xs font-medium mb-3">
                    <div></div>
                    <div className="text-center text-gray-500">L</div>
                    <div className="text-center text-gray-500">M</div>
                    <div className="text-center text-gray-500">X</div>
                    <div className="text-center text-gray-500">J</div>
                    <div className="text-center text-gray-500">V</div>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-1 items-stretch h-24">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                          M
                        </div>
                      </div>
                      <div className="bg-blue-500 rounded text-white flex flex-col items-center justify-center text-xs font-medium">
                        <span className="text-[10px] opacity-75 mb-0.5">Comida</span>
                        <span className="font-bold">12-17h</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex-1 bg-green-500 rounded text-white flex flex-col items-center justify-center text-xs">
                          <span className="text-[9px] opacity-75">Comida</span>
                          <span className="font-medium">13-17h</span>
                        </div>
                        <div className="flex-1 bg-orange-500 rounded text-white flex flex-col items-center justify-center text-xs">
                          <span className="text-[9px] opacity-75">Cena</span>
                          <span className="font-medium">20-24h</span>
                        </div>
                      </div>
                      <div className="bg-blue-500 rounded text-white flex flex-col items-center justify-center text-xs font-medium">
                        <span className="text-[10px] opacity-75 mb-0.5">Comida</span>
                        <span className="font-bold">12-17h</span>
                      </div>
                      <div className="bg-gray-100 rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                        <span className="text-gray-400">+</span>
                      </div>
                      <div className="bg-gray-100 rounded"></div>
                    </div>
                    <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-1 items-stretch h-24">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                          C
                        </div>
                      </div>
                      <div className="bg-green-500 rounded text-white flex flex-col items-center justify-center text-xs font-medium">
                        <span className="text-[10px] opacity-75 mb-0.5">Cena</span>
                        <span className="font-bold">19-1h</span>
                      </div>
                      <div className="bg-orange-500 rounded text-white flex flex-col items-center justify-center text-xs font-medium">
                        <span className="text-[10px] opacity-75 mb-0.5">Cierre</span>
                        <span className="font-bold">23-2h</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex-1 bg-blue-500 rounded text-white flex flex-col items-center justify-center text-xs">
                          <span className="text-[9px] opacity-75">Apertura</span>
                          <span className="font-medium">9-13h</span>
                        </div>
                        <div className="flex-1 bg-green-500 rounded text-white flex flex-col items-center justify-center text-xs">
                          <span className="text-[9px] opacity-75">Comida</span>
                          <span className="font-medium">13-17h</span>
                        </div>
                      </div>
                      <div className="bg-green-500 rounded text-white flex flex-col items-center justify-center text-xs font-medium">
                        <span className="text-[10px] opacity-75 mb-0.5">Cena</span>
                        <span className="font-bold">19-1h</span>
                      </div>
                      <div className="bg-gray-100 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PRO PLAN FEATURES */}
          <div className="mb-24 md:mb-32">
            <div className="flex items-center gap-3 mb-16">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg">
                PLAN PRO
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-purple-500/20 to-transparent"></div>
            </div>

            {/* 4. Documentos - Image Right */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-32">
              <div className="order-1">
                <div className="relative bg-white rounded-3xl p-6 lg:p-8 shadow-2xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Documentos</h4>
                      <p className="text-sm text-amber-500 font-medium">Auto-distribución</p>
                    </div>
                  </div>
                  <div className="border-2 border-dashed border-amber-300 rounded-2xl p-8 bg-amber-50/30 hover:bg-amber-50/50 transition-colors mb-4 flex flex-col justify-center min-h-[160px]">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <FileText className="w-6 h-6 text-amber-600" />
                      </div>
                      <p className="text-base font-medium text-gray-700 mb-1">Arrastra documentos aquí</p>
                      <p className="text-sm text-gray-500">Distribución automática</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-lg bg-muted flex-shrink-0">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-sm text-foreground truncate">
                            Nómina_Marzo_2025.pdf
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                              ✓ Firmada
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-lg bg-muted flex-shrink-0">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-sm text-foreground truncate">
                            Contrato_2025.pdf
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300">
                              Pendiente firma
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-2">
                <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-6">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span className="text-purple-700 font-semibold text-sm">Plan Pro</span>
                </div>
                <h3 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                  Documentos
                  <span className="block text-[#007AFF]">inteligentes</span>
                </h3>
                <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                  Sube documentos masivamente. Detección automática y distribución instantánea a cada empleado.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">Detección automática de empleados</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">Distribución instantánea</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">Categorización inteligente</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* 5. Mensajes - Image Left */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-32">
              <div className="order-2 lg:order-1">
                <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-6">
                  <MessageSquare className="w-4 h-4 text-purple-600" />
                  <span className="text-purple-700 font-semibold text-sm">Plan Pro</span>
                </div>
                <h3 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                  Mensajería
                  <span className="block text-[#007AFF]">interna</span>
                </h3>
                <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                  Comunicación directa con empleados. Mensajes individuales y circulares a todo el equipo.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">Mensajes individuales</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">Circulares a todo el equipo</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">Historial completo</span>
                  </li>
                </ul>
              </div>
              <div className="order-1 lg:order-2">
                <div className="relative bg-white rounded-3xl p-6 lg:p-8 shadow-2xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Mensajes</h4>
                      <p className="text-sm text-indigo-500 font-medium">Chat empresarial</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                          JR
                        </div>
                        <span className="text-sm font-medium text-gray-700">Juan Ramírez</span>
                        <span className="text-xs text-gray-400 ml-auto">9:30</span>
                      </div>
                      <p className="text-sm text-gray-600">¿A qué hora es la reunión de mañana?</p>
                    </div>
                    <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                          MP
                        </div>
                        <span className="text-sm font-medium text-gray-700">Marta Pérez</span>
                        <span className="text-xs text-gray-400 ml-auto">8:45</span>
                      </div>
                      <p className="text-sm text-gray-600">Buenos días equipo! 👋</p>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-3 rounded-xl text-sm font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all">
                      Individual
                    </button>
                    <button className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm font-semibold hover:bg-gray-300 transition-all">
                      Circular
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Recordatorios - Image Right */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-40">
              <div className="order-1">
                <div className="relative bg-white rounded-3xl p-6 lg:p-8 shadow-2xl border border-gray-100">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                      <Bell className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">Recordatorios</h4>
                      <p className="text-sm text-teal-500 font-medium">Tareas automáticas</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Revisar nóminas</span>
                        <span className="text-sm text-teal-600 font-bold">14:00</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-500">Pendiente</span>
                      </div>
                    </div>
                    <div className="p-4 bg-green-50/50 rounded-xl border border-green-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Llamar cliente</span>
                        <span className="text-sm text-gray-600 font-bold">10:30</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="text-sm text-green-600">Completado</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-4 py-3 rounded-xl text-sm font-semibold hover:from-teal-600 hover:to-cyan-600 transition-all">
                      Crear
                    </button>
                    <button className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm font-semibold hover:bg-gray-300 transition-all">
                      Ver todos
                    </button>
                  </div>
                </div>
              </div>
              <div className="order-2">
                <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 mb-6">
                  <Bell className="w-4 h-4 text-purple-600" />
                  <span className="text-purple-700 font-semibold text-sm">Plan Pro</span>
                </div>
                <h3 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                  Recordatorios
                  <span className="block text-[#007AFF]">personalizados</span>
                </h3>
                <p className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
                  Programa tareas automáticas con recordatorios inteligentes. Asigna responsables y haz seguimiento del progreso en tiempo real.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">Notificaciones automáticas</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">Asignación de responsables</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-gray-700">Seguimiento de progreso</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* PRO+ Section - Customization */}
          <div className="relative mb-24">
            <div className="text-center max-w-5xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-full px-6 py-2.5 mb-8">
                <Settings className="w-5 h-5 text-purple-600" />
                <span className="text-purple-700 font-semibold">Plan Pro - Sin límites</span>
              </div>
              <h3 className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-8 leading-tight">
                ¿Necesitas más?
                <br />
                <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">Personalízalo todo</span>
              </h3>
              <p className="text-xl md:text-2xl text-gray-600 mb-12 leading-relaxed max-w-4xl mx-auto">
                El Plan Pro te permite añadir funciones personalizadas según tus necesidades específicas
              </p>
              
              <div className="grid md:grid-cols-3 gap-6 mb-12">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-2xl p-8">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                    <TrendingUp className="w-7 h-7 text-white" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-3">Informes avanzados</h4>
                  <p className="text-gray-600">Crea reportes personalizados con los datos que realmente necesitas</p>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-2xl p-8">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                    <CreditCard className="w-7 h-7 text-white" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-3">Gestión de gastos</h4>
                  <p className="text-gray-600">Control completo de gastos empresariales y reembolsos</p>
                </div>
                
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-8">
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-3">Y mucho más</h4>
                  <p className="text-gray-600">Integraciones, API personalizada, módulos a medida...</p>
                </div>
              </div>
              
              <p className="text-lg text-gray-600">
                <span className="font-semibold text-gray-900">¿Tienes una necesidad específica?</span> Cuéntanos y lo hacemos realidad
              </p>
            </div>
          </div>

          {/* CTA */}
          {registrationSettings?.publicRegistrationEnabled && (
            <div className="text-center">
              <Link href="/request-code">
                <Button size="lg" className="bg-gradient-to-r from-[#007AFF] via-blue-500 to-cyan-500 hover:from-[#0056CC] hover:via-blue-600 hover:to-cyan-600 text-white px-14 py-7 text-xl font-bold shadow-2xl shadow-[#007AFF]/25 border-0 rounded-2xl transform hover:scale-105 transition-all duration-300">
                  Comenzar Prueba Gratis
                  <ArrowRight className="w-6 h-6 ml-3" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>
      {/* Pricing Section - Nuevo Modelo Oficaz */}
      <section id="precios" className="py-24 md:py-32 bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 relative overflow-hidden">
        {/* Modern Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-30"
               style={{
                 backgroundImage: `radial-gradient(circle at 20% 20%, #007AFF20 0%, transparent 50%), 
                                  radial-gradient(circle at 80% 80%, #8B5CF620 0%, transparent 50%),
                                  linear-gradient(135deg, #1F293700 0%, #1F293720 100%)`
               }}></div>
          <div className="absolute top-10 right-10 w-96 h-96 bg-gradient-to-r from-[#007AFF]/10 to-cyan-400/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-80 h-80 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          {/* Header */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-6 py-3 mb-8">
              <div className="w-2 h-2 bg-[#007AFF] rounded-full animate-pulse"></div>
              <span className="text-white font-semibold">Plan Oficaz</span>
            </div>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
              Un plan,
              <span className="bg-gradient-to-r from-[#007AFF] via-cyan-400 to-blue-300 bg-clip-text text-transparent"> sin límites</span>
            </h2>
            <p className="text-xl md:text-2xl text-white/80 max-w-4xl mx-auto leading-relaxed">
              Paga solo por lo que necesitas. <span className="text-white font-semibold">Añade funcionalidades según crezcas.</span>
            </p>
          </div>
          
          {/* Main Pricing Card + Add-ons Grid */}
          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Plan Principal */}
            <div className="relative group">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-20">
                <div className="bg-gradient-to-r from-[#007AFF] to-cyan-500 text-white px-6 py-2 rounded-full font-bold text-sm shadow-2xl">
                  ⭐ Todo Incluido
                </div>
              </div>
              
              <div className="relative backdrop-blur-xl rounded-3xl p-8 border transition-all duration-700 group-hover:scale-105 group-hover:-translate-y-2 h-full flex flex-col bg-white/20 border-[#007AFF]/50 shadow-2xl shadow-[#007AFF]/25">
                <div className="text-center mb-8">
                  <h3 className="text-3xl font-bold text-white mb-3">Plan Oficaz</h3>
                  <p className="text-white/70 mb-6">Todo lo que necesitas para gestionar tu empresa</p>
                  <div className="mb-6 flex flex-col items-center">
                    <span className="text-5xl md:text-6xl font-black text-white">€39</span>
                    <span className="text-white/70 text-lg">/mes</span>
                  </div>
                </div>
                
                <ul className="space-y-4 mb-8 flex-grow">
                  {['Panel de control completo', 'Gestión de empleados', 'Control de fichajes', 'Gestión de vacaciones', 'Cuadrante de trabajo', 'Tienda de add-ons', '1 Admin + 1 Manager + 10 Empleados'].map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      </div>
                      <span className="text-white/90 font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <div className="mt-auto">
                  {registrationSettings?.publicRegistrationEnabled ? (
                    <Link href="/request-code">
                      <button className="w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all duration-300 bg-gradient-to-r from-[#007AFF] to-cyan-500 hover:from-[#0056CC] hover:to-cyan-600 text-white shadow-2xl shadow-[#007AFF]/30 hover:scale-105">
                        Empezar Prueba Gratis
                      </button>
                    </Link>
                  ) : (
                    <button 
                      onClick={() => setIsContactFormOpen(true)}
                      className="w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all duration-300 bg-gradient-to-r from-[#007AFF] to-cyan-500 hover:from-[#0056CC] hover:to-cyan-600 text-white shadow-2xl shadow-[#007AFF]/30 hover:scale-105">
                      Contacta
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Add-ons y Usuarios */}
            <div className="space-y-6">
              {/* Add-ons Card */}
              <div className="backdrop-blur-xl rounded-3xl p-6 border bg-white/10 border-white/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-[#007AFF]/20 rounded-lg flex items-center justify-center">
                    <Zap className="w-4 h-4 text-[#007AFF]" />
                  </div>
                  <h4 className="text-xl font-bold text-white">Add-ons Disponibles</h4>
                </div>
                <div className="space-y-3">
                  {[
                    { name: 'Mensajería', price: 9, desc: 'Comunicación interna' },
                    { name: 'Recordatorios', price: 6, desc: 'Alertas programadas' },
                    { name: 'Documentos', price: 15, desc: 'Gestión de archivos' },
                    { name: 'Partes de Trabajo', price: 12, desc: 'Reportes de trabajo' },
                    { name: 'Asistente IA', price: 25, desc: 'Automatización inteligente' },
                  ].map((addon, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                      <div>
                        <p className="font-medium text-white">{addon.name}</p>
                        <p className="text-xs text-white/50">{addon.desc}</p>
                      </div>
                      <span className="text-sm font-semibold text-[#007AFF]">+€{addon.price}/mes</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Usuarios Adicionales Card */}
              <div className="backdrop-blur-xl rounded-3xl p-6 border bg-white/10 border-white/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-purple-400" />
                  </div>
                  <h4 className="text-xl font-bold text-white">Usuarios Adicionales</h4>
                </div>
                <div className="space-y-2">
                  {[
                    { role: 'Empleado', price: 2 },
                    { role: 'Manager', price: 6 },
                    { role: 'Admin', price: 12 },
                  ].map((user, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                      <p className="font-medium text-white">{user.role}</p>
                      <span className="text-sm font-semibold text-purple-400">+€{user.price}/mes</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/40 mt-3">*Más allá de los usuarios incluidos en el plan base</p>
              </div>
            </div>
          </div>
          
          {/* Bottom Section */}
          <div className="text-center mt-16">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 max-w-4xl mx-auto">
              <p className="text-white/90 text-lg">
                <span className="font-bold text-white">14 días de prueba gratuita</span> • Sin tarjeta de crédito • Cancela cuando quieras
              </p>
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