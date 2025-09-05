import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  CreditCard
} from 'lucide-react';

import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';

export default function Landing() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);

  // Defer API calls until after critical content renders
  const [shouldLoadData, setShouldLoadData] = useState(false);
  
  useEffect(() => {
    // Defer data loading to prevent blocking initial render
    const timer = setTimeout(() => setShouldLoadData(true), 100);
    return () => clearTimeout(timer);
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

  // Get dynamic pricing from database - defer after initial render
  const { data: subscriptionPlans } = useQuery({
    queryKey: ['/api/public/subscription-plans'],
    queryFn: async () => {
      const response = await fetch('/api/public/subscription-plans');
      return response.json();
    },
    enabled: shouldLoadData, // Only execute after initial render
    staleTime: 1000 * 60 * 60, // 60 minutes - much longer cache
    gcTime: 1000 * 60 * 60 * 4, // 4 hours garbage collection time
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
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
      icon: Settings,
      title: "Y mucho más",
      description: "Recordatorios personalizados, reportes avanzados, integraciones y configuración flexible"
    }
  ];

  // Combine static plan data with dynamic pricing and user limits
  const getPlansWithDynamicPricing = () => {
    // Merge static data with dynamic pricing and user limits
    if (!subscriptionPlans || !Array.isArray(subscriptionPlans)) {
      return [
        {
          name: "Basic",
          description: "Perfecto para pequeñas empresas",
          features: [
            "Hasta ... empleados",
            "Control de tiempo básico",
            "Gestión de vacaciones",
            "Mensajería interna",
            "Soporte por email"
          ],
          popular: false,
          price: "..."
        },
        {
          name: "Pro",
          description: "Ideal para empresas en crecimiento",
          features: [
            "Hasta ... empleados",
            "Todas las funciones Basic",
            "Gestión de documentos",
            "Reportes avanzados",
            "Logos personalizados",
            "Soporte prioritario"
          ],
          popular: true,
          price: "..."
        },
        {
          name: "Master",
          description: "Para grandes organizaciones",
          features: [
            "Empleados ilimitados",
            "Todas las funciones Pro",
            "Integraciones avanzadas",
            "Personalización completa",
            "Soporte 24/7",
            "Gerente de cuenta dedicado"
          ],
          popular: false,
          price: "..."
        }
      ];
    }
    
    const getFeatureDisplayName = (featureKey: string) => {
      const featureNames: { [key: string]: string } = {
        // Core features - these keys come from the database
        time: "Control de tiempo",
        timeTracking: "Control de tiempo", 
        vacation: "Gestión de vacaciones",
        messages: "Mensajería interna",
        documents: "Gestión de documentos",
        notifications: "Notificaciones",
        reminders: "Recordatorios personalizados",
        logoUpload: "Logos personalizados",
        reports: "Reportes avanzados",
        analytics: "Análisis de datos",
        customization: "Personalización avanzada",
        timeEditingPermissions: "Edición de horarios",
        employee_time_edit: "Edición de fichajes",
        employee_time_edit_permission: "Permisos de edición",
        api: "API personalizada"
      };
      return featureNames[featureKey] || featureKey;
    };

    const getAdditionalFeatures = (planKey: string) => {
      const additionalFeatures: { [key: string]: string[] } = {
        basic: ["Soporte por email"],
        pro: ["Soporte prioritario"],
        master: ["Soporte 24/7", "Funcionalidades personalizadas"]
      };
      return additionalFeatures[planKey] || [];
    };

    const staticPlansDescriptions: { [key: string]: string } = {
      basic: "Perfecto para pequeñas empresas",
      pro: "Ideal para empresas en crecimiento",
      master: "Para grandes organizaciones"
    };

    const popularPlans: { [key: string]: boolean } = {
      basic: false,
      pro: true,
      master: false
    };
    
    return subscriptionPlans.map((dbPlan: any) => {
      const planKey = dbPlan.name.toLowerCase();
      const userLimit = dbPlan.maxUsers 
        ? `Hasta ${dbPlan.maxUsers} empleados`
        : "Empleados ilimitados";
      
      // Generate features from database configuration
      const dynamicFeatures = [];
      
      // Add user limit first
      dynamicFeatures.push(userLimit);
      
      // Define the order of features - modify this array to change the order
      const featureOrder = [
        'time',
        'vacation', 
        'messages',
        'documents',
        'notifications',
        'reminders',
        'logoUpload',
        'reports',
        'employee_time_edit',
        'employee_time_edit_permission'
      ];
      
      // Add features based on what's enabled in the database, respecting the order
      if (dbPlan.features) {
        // First add features in the defined order
        featureOrder.forEach(featureKey => {
          if (dbPlan.features[featureKey]) {
            const displayName = getFeatureDisplayName(featureKey);
            dynamicFeatures.push(displayName);
          }
        });
        
        // Then add any remaining features not in the order (for future features)
        Object.entries(dbPlan.features).forEach(([featureKey, isEnabled]) => {
          if (isEnabled && !featureOrder.includes(featureKey)) {
            const displayName = getFeatureDisplayName(featureKey);
            dynamicFeatures.push(displayName);
          }
        });
      }
      
      // Add plan-specific additional features
      const additionalFeatures = getAdditionalFeatures(planKey);
      dynamicFeatures.push(...additionalFeatures);
      
      return {
        name: dbPlan.displayName || dbPlan.name,
        description: staticPlansDescriptions[planKey] || dbPlan.name,
        features: dynamicFeatures,
        popular: popularPlans[planKey] || false,
        price: Number(dbPlan.monthlyPrice).toFixed(2)
      };
    });
  };

  const plans = getPlansWithDynamicPricing();

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
        paddingTop: `calc(16px + env(safe-area-inset-top, 0px))`,
        paddingBottom: '16px'
      }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img src={oficazLogo} alt="Oficaz" className="h-10 w-auto" loading="eager" />
            </div>
            
            <nav className="hidden md:flex items-center justify-between flex-1 ml-8">
              <div className="flex items-center space-x-8">
                <a href="#funciones" className="text-gray-700 hover:text-gray-900 transition-colors font-medium">Funciones</a>
                <a href="#precios" className="text-gray-700 hover:text-gray-900 transition-colors font-medium">Precios</a>
              </div>
              
              <div className="flex items-center space-x-3">
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
                  <Button variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-900 font-medium px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-sm">
                    Iniciar Sesión
                  </Button>
                </Link>
              </div>
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center space-x-3">
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
                <Button variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-900 font-medium px-3 py-1.5 rounded-lg transition-all duration-200">
                  Entrar
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>
      {/* Hero Section - Responsive Height */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-gray-900 min-h-screen flex items-center justify-center py-20 lg:py-24 pt-16"
               style={{ minHeight: '100vh' }}>
        {/* Optimized 3D Background - Simple geometric shapes */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-15">
            <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: '2000px' }}>
              <div 
                className="hero-icons-grid" 
                style={{ 
                  transform: 'rotateX(25deg) rotateY(-15deg)',
                  transformStyle: 'preserve-3d'
                }}
              >
                {/* Simple geometric shapes - high impact, zero JS weight */}
                <div className="hero-icon hero-shape-circle" style={{ transform: 'translateZ(60px)' }}></div>
                <div className="hero-icon hero-shape-square" style={{ transform: 'translateZ(45px)' }}></div>
                <div className="hero-icon hero-shape-diamond" style={{ transform: 'translateZ(75px)' }}></div>
                <div className="hero-icon hero-shape-hexagon" style={{ transform: 'translateZ(30px)' }}></div>
                
                <div className="hero-icon hero-shape-triangle" style={{ transform: 'translateZ(50px)' }}></div>
                <div className="hero-icon hero-shape-star" style={{ transform: 'translateZ(65px)' }}></div>
                <div className="hero-icon hero-shape-oval" style={{ transform: 'translateZ(35px)' }}></div>
                <div className="hero-icon hero-shape-cross" style={{ transform: 'translateZ(80px)' }}></div>
                
                <div className="hero-icon hero-shape-rhombus" style={{ transform: 'translateZ(40px)' }}></div>
                <div className="hero-icon hero-shape-octagon" style={{ transform: 'translateZ(70px)' }}></div>
                <div className="hero-icon hero-shape-heart" style={{ transform: 'translateZ(55px)' }}></div>
                <div className="hero-icon hero-shape-arrow" style={{ transform: 'translateZ(85px)' }}></div>
              </div>
            </div>
          </div>
          {/* Enhanced radial fade overlay for text readability */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(circle at center, rgba(0,0,0,0.75) 15%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.15) 85%)'
          }}></div>
        </div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/20 to-gray-900/40"></div>
        

        
        {/* Subtle Light Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 right-1/3 w-32 h-32 bg-[#007AFF]/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-20 left-1/3 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl"></div>
        </div>
        
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          {/* Main Content */}
          <div className="space-y-4 lg:space-y-6">
            
            {/* Compact Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white/90 text-sm font-medium">Gestión empresarial inteligente</span>
            </div>
            
            {/* Responsive Heading */}
            <div className="space-y-2 lg:space-y-3">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-tight">
                Para empresas que lo quieren
                <span className="block bg-gradient-to-r from-[#007AFF] to-cyan-400 bg-clip-text text-transparent">
                  fácil
                </span>
              </h1>
              <p className="text-base md:text-lg lg:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed px-4">
                Diseñada para ser la plataforma <span className="text-white font-semibold">más intuitiva</span> del mercado
              </p>
            </div>

            {/* Responsive CTA Button */}
            {registrationSettings?.publicRegistrationEnabled && (
              <div className="flex justify-center pt-2 lg:pt-4">
                <Link href="/request-code">
                  <Button size="lg" className="bg-gradient-to-r from-[#007AFF] to-blue-600 hover:from-[#0056CC] hover:to-blue-700 text-white px-6 lg:px-8 py-3 lg:py-4 text-base lg:text-lg font-semibold shadow-xl shadow-[#007AFF]/25 border-0 rounded-xl">
                    Empezar Gratis
                    <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            )}

            {/* Responsive Trust Indicators */}
            <div className="pt-2 lg:pt-4">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-slate-400 text-xs sm:text-sm">
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
          </div>
        </div>
      </section>
      {/* Features Section - Full Viewport Height */}
      <section id="funciones" className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 relative overflow-hidden flex items-center py-8 md:py-12">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#007AFF]/10 via-transparent to-purple-500/10"></div>
          <div className="absolute top-20 right-20 w-96 h-96 bg-[#007AFF]/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-80 h-80 bg-cyan-400/5 rounded-full blur-3xl"></div>
        </div>

        <div className="w-full max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          {/* Header - Más compacto */}
          <div className="text-center mb-16 md:mb-20">
            <div className="inline-flex items-center gap-2 bg-[#007AFF]/10 backdrop-blur-sm border border-[#007AFF]/20 rounded-full px-6 py-3 mb-8">
              <div className="w-2 h-2 bg-[#007AFF] rounded-full animate-pulse"></div>
              <span className="text-[#007AFF] font-semibold">Funcionalidades Principales</span>
            </div>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 tracking-tight">
              Todo en una
              <span className="bg-gradient-to-r from-[#007AFF] via-blue-500 to-cyan-400 bg-clip-text text-transparent"> plataforma</span>
            </h2>
            <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              Diseñada para empresas que buscan <span className="text-gray-900 font-semibold">eficiencia sin complicaciones</span>
            </p>
          </div>
          
          {/* Features Grid - Altura uniforme y más compacto */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="group relative h-full"
              >
                {/* Feature Card con altura fija */}
                <div className="relative bg-white rounded-2xl p-4 lg:p-6 shadow-lg shadow-gray-900/5 border border-gray-100/50 hover:shadow-2xl hover:shadow-[#007AFF]/10 hover:border-[#007AFF]/20 transition-all duration-500 hover:scale-105 hover:-translate-y-1 backdrop-blur-xl h-full flex flex-col">
                  {/* Icon Container - Más pequeño */}
                  <div className="relative mb-4">
                    <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-[#007AFF] to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-[#007AFF]/25 group-hover:shadow-xl group-hover:shadow-[#007AFF]/30 transition-all duration-500">
                      <feature.icon className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
                    </div>
                    {/* Glow Effect */}
                    <div className="absolute inset-0 w-12 h-12 lg:w-16 lg:h-16 bg-[#007AFF]/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  </div>
                  
                  {/* Content - Flex para distribución uniforme */}
                  <div className="flex-1 flex flex-col">
                    <h3 className="text-lg lg:text-xl font-bold text-gray-900 group-hover:text-[#007AFF] transition-colors duration-300 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed text-sm lg:text-base flex-1">
                      {feature.description}
                    </p>
                  </div>

                  {/* Hover Indicator */}
                  <div className="absolute top-3 right-3 w-2 h-2 bg-[#007AFF] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  
                  {/* Background Gradient on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#007AFF]/5 via-transparent to-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>
              </div>
            ))}
          </div>


        </div>


      </section>
      {/* Interface Preview Section */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 relative overflow-hidden">
        {/* Modern Background Pattern */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-0 left-0 w-full h-full" 
               style={{
                 backgroundImage: `radial-gradient(circle at 25% 25%, #007AFF15 0%, transparent 50%), 
                                  radial-gradient(circle at 75% 75%, #8B5CF615 0%, transparent 50%),
                                  linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)`
               }}></div>
          <div className="absolute top-10 right-10 w-96 h-96 bg-gradient-to-r from-[#007AFF]/5 to-cyan-400/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-80 h-80 bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Header */}
          <div className="text-center mb-16 md:mb-20">
            <div className="inline-flex items-center gap-2 bg-[#007AFF]/10 backdrop-blur-sm border border-[#007AFF]/20 rounded-full px-6 py-3 mb-8">
              <div className="w-2 h-2 bg-[#007AFF] rounded-full animate-pulse"></div>
              <span className="text-[#007AFF] font-semibold">Interface en Acción</span>
            </div>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 tracking-tight">
              Diseño
              <span className="bg-gradient-to-r from-[#007AFF] via-blue-500 to-cyan-400 bg-clip-text text-transparent"> intuitivo</span>
            </h2>
            <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              Cada elemento pensado para <span className="text-gray-900 font-semibold">máxima productividad</span>
            </p>
          </div>
          
          {/* Interactive Dashboard Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            
            {/* Employee Dashboard Preview */}
            <div className="group relative">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-xl shadow-gray-900/5 border border-gray-200/50 hover:shadow-2xl hover:shadow-[#007AFF]/10 transition-all duration-700 hover:scale-[1.02] hover:-translate-y-2">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#007AFF] to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-[#007AFF]/25">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 group-hover:text-[#007AFF] transition-colors">Panel de Empleados</h3>
                    <p className="text-[#007AFF] font-medium">Vista en tiempo real</p>
                  </div>
                </div>
                
                {/* Employee Status List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        JR
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">Juan Ramírez</div>
                        <div className="text-sm text-gray-500">Empleado</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                      <span className="text-sm text-orange-600 font-medium">En descanso</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        MP
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">Marta Pérez</div>
                        <div className="text-sm text-gray-500">Manager</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-600 font-medium">Trabajando</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        CL
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">Carmen López</div>
                        <div className="text-sm text-gray-500">Administradora</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-600 font-medium">Trabajando</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        AS
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">Ana Sánchez</div>
                        <div className="text-sm text-gray-500">Empleada</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      <span className="text-sm text-blue-600 font-medium">De vacaciones</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Time Tracking Preview */}
            <div className="group relative">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-xl shadow-gray-900/5 border border-gray-200/50 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-700 hover:scale-[1.02] hover:-translate-y-2">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                    <Clock className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 group-hover:text-emerald-500 transition-colors">Control de Fichajes</h3>
                    <p className="text-emerald-500 font-medium">Automático y preciso</p>
                  </div>
                </div>
                
                {/* Mock Time Entries */}
                <div className="space-y-3">
                  <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Hoy, 26 Junio</span>
                      <span className="text-sm text-emerald-600 font-medium">8h 32m</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>Entrada: 09:00</span>
                      <span>Salida: 17:32</span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Ayer, 25 Junio</span>
                      <span className="text-sm text-gray-600 font-medium">8h 00m</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>Entrada: 09:15</span>
                      <span>Salida: 17:15</span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">24 Junio</span>
                      <span className="text-sm text-gray-600 font-medium">7h 45m</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>Entrada: 09:30</span>
                      <span>Salida: 17:15</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 flex gap-3">
                  <button className="flex-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white px-4 py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-green-600 transition-all duration-300 shadow-lg">
                    Fichar Entrada
                  </button>
                  <button className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all duration-300">
                    Descanso
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Second Row - Vacation and Documents */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mt-16 lg:mt-20">
            
            {/* Vacation Management Preview */}
            <div className="group relative">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-xl shadow-gray-900/5 border border-gray-200/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-700 hover:scale-[1.02] hover:-translate-y-2">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <Calendar className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 group-hover:text-blue-500 transition-colors">Gestión de Vacaciones</h3>
                    <p className="text-blue-500 font-medium">Control visual y automático</p>
                  </div>
                </div>
                
                {/* Vacation Progress Bars */}
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Juan Ramírez - Días disponibles</span>
                      <span className="text-sm text-blue-600 font-medium">18/30</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full w-[60%]"></div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-green-50/50 rounded-xl border border-green-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Marta Pérez - Días disponibles</span>
                      <span className="text-sm text-green-600 font-medium">25/30</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full w-[83%]"></div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Ana Sánchez - Días disponibles</span>
                      <span className="text-sm text-orange-600 font-medium">8/30</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-gradient-to-r from-orange-500 to-orange-600 h-3 rounded-full w-[27%]"></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 flex gap-3">
                  <button className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-3 rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 shadow-lg">
                    Nueva Solicitud
                  </button>
                  <button className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all duration-300">
                    Ver Calendario
                  </button>
                </div>
              </div>
            </div>

            {/* Document Management Preview */}
            <div className="group relative">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-xl shadow-gray-900/5 border border-gray-200/50 hover:shadow-2xl hover:shadow-amber-500/10 transition-all duration-700 hover:scale-[1.02] hover:-translate-y-2">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 group-hover:text-amber-500 transition-colors">Documentos Inteligentes</h3>
                    <p className="text-amber-500 font-medium">Arrastra y distribuye automático</p>
                  </div>
                </div>
                
                {/* Drag & Drop Area */}
                <div className="border-2 border-dashed border-amber-300 rounded-xl p-6 bg-amber-50/30 hover:bg-amber-50/50 transition-colors mb-4">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-6 h-6 text-amber-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Arrastra nóminas aquí</p>
                    <p className="text-xs text-gray-500">Se envían automáticamente a cada empleado</p>
                  </div>
                </div>
                
                {/* Document Distribution Status */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg border border-green-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-sm text-gray-700">Nómina Junio → Juan Ramírez</span>
                    </div>
                    <span className="text-xs text-green-600 font-medium">Enviado</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg border border-green-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-sm text-gray-700">Nómina Junio → Marta Pérez</span>
                    </div>
                    <span className="text-xs text-green-600 font-medium">Enviado</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-gray-700">Nómina Junio → Ana Sánchez</span>
                    </div>
                    <span className="text-xs text-amber-600 font-medium">Enviando...</span>
                  </div>
                </div>
              </div>
            </div>

          </div>



          {/* CTA */}
          {registrationSettings?.publicRegistrationEnabled && (
            <div className="text-center mt-16 md:mt-20">
              <Link href="/request-code">
                <Button size="lg" className="bg-gradient-to-r from-[#007AFF] via-blue-500 to-cyan-500 hover:from-[#0056CC] hover:via-blue-600 hover:to-cyan-600 text-white px-12 py-6 text-xl font-bold shadow-2xl shadow-[#007AFF]/25 border-0 rounded-2xl transform hover:scale-105 transition-all duration-300">
                  Comenzar Prueba Gratis
                  <ArrowRight className="w-6 h-6 ml-3" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </section>
      {/* Pricing Section */}
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
              <span className="text-white font-semibold">Planes Oficaz</span>
            </div>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
              Precios que
              <span className="bg-gradient-to-r from-[#007AFF] via-cyan-400 to-blue-300 bg-clip-text text-transparent"> convencen</span>
            </h2>
            <p className="text-xl md:text-2xl text-white/80 max-w-4xl mx-auto leading-relaxed">
              Transparentes, justos y <span className="text-white font-semibold">sin sorpresas</span>
            </p>
          </div>
          
          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <div key={index} className={`relative group ${plan.popular ? 'scale-105' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-20">
                    <div className="bg-gradient-to-r from-[#007AFF] to-cyan-500 text-white px-6 py-2 rounded-full font-bold text-sm shadow-2xl">
                      ⭐ Más Elegido
                    </div>
                  </div>
                )}
                
                <div className={`relative backdrop-blur-xl rounded-3xl p-8 border transition-all duration-700 group-hover:scale-105 group-hover:-translate-y-2 h-full flex flex-col ${
                  plan.popular 
                    ? 'bg-white/20 border-[#007AFF]/50 shadow-2xl shadow-[#007AFF]/25' 
                    : 'bg-white/10 border-white/20 hover:bg-white/15 shadow-xl'
                }`}>
                  
                  {/* Plan Header */}
                  <div className="text-center mb-8">
                    <h3 className="text-3xl font-bold text-white mb-3">{plan.name}</h3>
                    <p className="text-white/70 mb-6">{plan.description}</p>
                    <div className="mb-6 flex flex-col items-center">
                      <span className="text-4xl md:text-5xl font-black text-white">€{plan.price}</span>
                      <span className="text-white/70 text-lg">/mes</span>
                    </div>
                  </div>
                  
                  {/* Features */}
                  <ul className="space-y-4 mb-8 flex-grow">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        </div>
                        <span className="text-white/90 font-medium">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {/* CTA Button */}
                  <div className="mt-auto">
                    {(registrationSettings?.publicRegistrationEnabled && plan.name !== 'Master') ? (
                      <Link href="/request-code">
                        <button className={`w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all duration-300 ${
                          plan.popular
                            ? 'bg-gradient-to-r from-[#007AFF] to-cyan-500 hover:from-[#0056CC] hover:to-cyan-600 text-white shadow-2xl shadow-[#007AFF]/30 hover:scale-105'
                            : 'bg-white/10 hover:bg-white/20 text-white border border-white/30 hover:border-white/50 backdrop-blur-sm'
                        }`}>
                          Empezar Gratis
                        </button>
                      </Link>
                    ) : (
                      <button 
                        onClick={() => setIsContactFormOpen(true)}
                        className={`w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all duration-300 ${
                          plan.popular || plan.name === 'Master'
                            ? 'bg-gradient-to-r from-[#007AFF] to-cyan-500 hover:from-[#0056CC] hover:to-cyan-600 text-white shadow-2xl shadow-[#007AFF]/30 hover:scale-105'
                            : 'bg-gradient-to-r from-[#007AFF] to-cyan-500 hover:from-[#0056CC] hover:to-cyan-600 text-white shadow-2xl shadow-[#007AFF]/30 hover:scale-105'
                        }`}>
                        {plan.name === 'Master' ? 'Contactar' : 'Contacta'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
          
          {/* Benefits Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-16 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Configuración Instantánea</h3>
              <p className="text-blue-100 text-sm">Tu empresa funcionando en menos de 5 minutos</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Equipo Productivo</h3>
              <p className="text-blue-100 text-sm">Empleados felices con procesos claros</p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Crecimiento Real</h3>
              <p className="text-blue-100 text-sm">Más tiempo para hacer crecer tu negocio</p>
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