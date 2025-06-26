import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Clock, 
  Users, 
  FileText, 
  MessageSquare, 
  ArrowRight,
  CheckCircle
} from "lucide-react";

// Import screenshots and logo
import mainScreenImg from "@assets/Main Screen - Empleado_1750328650633.jpg";
import fichajesImg from "@assets/Fichajes - Empleado_1750329669169.jpg";
import usuarioImg from "@assets/Usuario - Empleado_1750333758244.jpg";
import oficazLogo from "@assets/Imagotipo Oficaz_1750321812493.png";

// Official Oficaz logo component
const Logo = ({ isDark = false }: { isDark?: boolean }) => (
  <div className="flex items-center">
    <img 
      src={oficazLogo} 
      alt="Oficaz" 
      className={`h-8 w-auto ${isDark ? 'brightness-0 invert' : ''}`}
    />
  </div>
);

export default function LandingMinimal() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Logo />
          <Link href="/login">
            <Button>Acceder</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-5xl mx-auto text-center">
          <div className="mb-6">
            <span className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              ✨ La gestión empresarial que realmente funciona
            </span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Oficaz no es para las empresas que lo quieren
            <span className="text-blue-600 block">todo, sino para las que lo quieren fácil</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Controla horarios, gestiona vacaciones, organiza documentos y comunícate con tu equipo. 
            Todo desde una plataforma tan simple que la dominarás en 5 minutos.
          </p>
          
          {/* Value proposition */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8 max-w-2xl mx-auto">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">2 min</div>
                <div className="text-sm text-gray-600">para configurar</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">0€</div>
                <div className="text-sm text-gray-600">primeros 14 días</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">24/7</div>
                <div className="text-sm text-gray-600">soporte español</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="px-8 py-4 text-lg bg-blue-600 hover:bg-blue-700">
                Empieza gratis ahora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="px-8 py-4 text-lg">
                Ver cómo funciona
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Sin tarjeta de crédito • Cancela cuando quieras • Datos 100% seguros
          </p>
        </div>
      </section>

      {/* App Preview */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Así de simple es Oficaz
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Interfaz intuitiva diseñada para que cualquier empleado pueda usarla desde el primer día
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-gray-100 rounded-lg p-4 mb-4">
                <img 
                  src={mainScreenImg} 
                  alt="Dashboard principal de Oficaz" 
                  className="w-full h-auto rounded-lg shadow-md"
                />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Dashboard Principal</h3>
              <p className="text-gray-600 text-sm">Vista general con acceso rápido a todas las funciones</p>
            </div>
            
            <div className="text-center">
              <div className="bg-gray-100 rounded-lg p-4 mb-4">
                <img 
                  src={fichajesImg} 
                  alt="Sistema de fichajes de Oficaz" 
                  className="w-full h-auto rounded-lg shadow-md"
                />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Control Horario</h3>
              <p className="text-gray-600 text-sm">Fichar entrada y salida con un solo toque</p>
            </div>
            
            <div className="text-center">
              <div className="bg-gray-100 rounded-lg p-4 mb-4">
                <img 
                  src={usuarioImg} 
                  alt="Perfil de usuario en Oficaz" 
                  className="w-full h-auto rounded-lg shadow-md"
                />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Perfil Personal</h3>
              <p className="text-gray-600 text-sm">Información personal y estadísticas de trabajo</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Todo lo que necesitas en una sola plataforma
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Control Horario</h3>
              <p className="text-gray-600 text-sm">Fichajes simples desde móvil o web</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Vacaciones</h3>
              <p className="text-gray-600 text-sm">Gestión automática según normativa española</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Documentos</h3>
              <p className="text-gray-600 text-sm">Organiza nóminas, contratos y más</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Comunicación</h3>
              <p className="text-gray-600 text-sm">Mensajería interna para tu equipo</p>
            </div>
          </div>
        </div>
      </section>

      {/* Problems We Solve */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Los problemas que resolvemos cada día
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Deja de perder tiempo con Excel, WhatsApp y papeles. Oficaz centraliza todo lo que necesitas para gestionar tu equipo.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="space-y-8">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-red-600 font-bold text-lg">❌</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Fichas por WhatsApp?</h3>
                    <p className="text-gray-600">Mensajes perdidos, horarios confusos, imposible hacer informes. Un caos total.</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-red-600 font-bold text-lg">❌</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Excel para las vacaciones?</h3>
                    <p className="text-gray-600">Cálculos manuales, errores constantes, empleados sin saber cuántos días les quedan.</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-red-600 font-bold text-lg">❌</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Documentos por email?</h3>
                    <p className="text-gray-600">Archivos perdidos, versiones desactualizadas, búsquedas eternas en la bandeja de entrada.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-6">Con Oficaz es diferente:</h3>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-300 flex-shrink-0" />
                    <span className="text-lg">Fichajes desde el móvil en 1 segundo</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-300 flex-shrink-0" />
                    <span className="text-lg">Vacaciones calculadas automáticamente</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-300 flex-shrink-0" />
                    <span className="text-lg">Documentos organizados y accesibles</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-300 flex-shrink-0" />
                    <span className="text-lg">Comunicación clara con tu equipo</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-300 flex-shrink-0" />
                    <span className="text-lg">Informes automáticos para Inspección</span>
                  </div>
                </div>
                
                <div className="mt-8 p-4 bg-white/10 rounded-lg">
                  <p className="text-sm font-medium">
                    "Antes perdía 3 horas a la semana controlando horarios. Ahora todo es automático."
                  </p>
                  <p className="text-xs mt-2 opacity-80">— María, Directora de RRHH</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Precios transparentes, sin sorpresas
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Elige el plan que mejor se adapte a tu empresa. Todos incluyen soporte completo en español y actualizaciones automáticas.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Basic Plan */}
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 text-center hover:border-blue-300 transition-colors">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Basic</h3>
              <div className="text-4xl font-bold text-gray-900 mb-4">
                €29<span className="text-lg text-gray-500 font-normal">/mes</span>
              </div>
              <p className="text-gray-600 mb-6">Perfecto para empresas pequeñas</p>
              
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Hasta 10 empleados</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Control horario completo</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Gestión de vacaciones</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Soporte por email</span>
                </li>
              </ul>
              
              <Link href="/register">
                <Button variant="outline" className="w-full">Empezar gratis</Button>
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-blue-600 text-white rounded-2xl p-8 text-center relative transform scale-105">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <span className="bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium">Más popular</span>
              </div>
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <div className="text-4xl font-bold mb-4">
                €59<span className="text-lg opacity-80 font-normal">/mes</span>
              </div>
              <p className="opacity-90 mb-6">Para empresas en crecimiento</p>
              
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-300 flex-shrink-0" />
                  <span>Hasta 25 empleados</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-300 flex-shrink-0" />
                  <span>Todo lo del plan Basic</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-300 flex-shrink-0" />
                  <span>Gestión de documentos</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-300 flex-shrink-0" />
                  <span>Mensajería interna</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-300 flex-shrink-0" />
                  <span>Reportes avanzados</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-300 flex-shrink-0" />
                  <span>Soporte prioritario</span>
                </li>
              </ul>
              
              <Link href="/register">
                <Button className="w-full bg-white text-blue-600 hover:bg-gray-100">Empezar gratis</Button>
              </Link>
            </div>

            {/* Master Plan */}
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 text-center hover:border-blue-300 transition-colors">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Master</h3>
              <div className="text-4xl font-bold text-gray-900 mb-4">
                €149<span className="text-lg text-gray-500 font-normal">/mes</span>
              </div>
              <p className="text-gray-600 mb-6">Para empresas grandes</p>
              
              <ul className="text-left space-y-3 mb-8">
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Hasta 100 empleados</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Todo lo del plan Pro</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">API personalizada</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Integración avanzada</span>
                </li>
                <li className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-gray-700">Manager dedicado</span>
                </li>
              </ul>
              
              <Link href="/register">
                <Button variant="outline" className="w-full">Empezar gratis</Button>
              </Link>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4">
              Todos los planes incluyen 14 días de prueba gratuita. Sin permanencia, cancela cuando quieras.
            </p>
            <p className="text-sm text-gray-500">
              ¿Necesitas más de 100 empleados? <a href="#" className="text-blue-600 hover:underline">Contacta con nosotros</a> para un plan personalizado.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Comienza hoy mismo
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Configura Oficaz en menos de 2 minutos y empieza a gestionar tu equipo de forma eficiente.
          </p>
          <Link href="/register">
            <Button size="lg" className="px-8 py-3">
              Prueba gratis 14 días
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <Logo isDark={true} />
              <p className="mt-4 text-gray-400">
                La gestión empresarial simple que funciona.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Producto</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Funciones</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Precios</a></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Demo</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Sobre nosotros</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contacto</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-white mb-4">Soporte</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Ayuda</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentación</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-8 pt-8 text-center">
            <p className="text-gray-400 text-sm">
              © 2025 Oficaz. Todos los derechos reservados. | 
              <a href="#" className="hover:text-white ml-1">Política de Privacidad</a> | 
              <a href="#" className="hover:text-white ml-1">Términos de Servicio</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}