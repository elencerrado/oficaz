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

// Import screenshots
import mainScreenImg from "@assets/Main Screen - Empleado_1750328650633.jpg";
import fichajesImg from "@assets/Fichajes - Empleado_1750329669169.jpg";
import usuarioImg from "@assets/Usuario - Empleado_1750333758244.jpg";

// Simple inline logo to avoid image loading
const Logo = () => (
  <div className="flex items-center space-x-2">
    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
      <div className="w-4 h-2 bg-white rounded"></div>
    </div>
    <span className="text-xl font-bold text-gray-900">Oficaz</span>
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
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Oficaz no es para las empresas que lo quieren
            <span className="text-blue-600 block">todo, sino para las que lo quieren fácil</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Gestiona tu equipo, tiempo y documentos en una plataforma simple y efectiva.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="px-8 py-3">
                Prueba gratis 14 días
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="px-8 py-3">
                Ver demo
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Sin tarjeta de crédito • Configuración en 2 minutos
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

      {/* Why Choose */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Por qué elegir Oficaz
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Sin curva de aprendizaje</h3>
              <p className="text-gray-600 text-sm">Tu equipo lo domina en minutos</p>
            </div>
            <div>
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Configuración automática</h3>
              <p className="text-gray-600 text-sm">Políticas españolas preconfiguradas</p>
            </div>
            <div>
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Soporte en español</h3>
              <p className="text-gray-600 text-sm">Ayuda cuando la necesites</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Precios simples y transparentes
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white border rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Basic</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">€29<span className="text-base text-gray-500">/mes</span></div>
              <p className="text-gray-600 text-sm mb-4">Hasta 10 empleados</p>
              <Button variant="outline" className="w-full">Elegir plan</Button>
            </div>
            <div className="bg-blue-600 text-white rounded-lg p-6 text-center relative">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-medium">Más popular</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Pro</h3>
              <div className="text-3xl font-bold mb-4">€59<span className="text-base opacity-70">/mes</span></div>
              <p className="opacity-90 text-sm mb-4">Hasta 25 empleados</p>
              <Button className="w-full bg-white text-blue-600 hover:bg-gray-100">Elegir plan</Button>
            </div>
            <div className="bg-white border rounded-lg p-6 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Master</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">€149<span className="text-base text-gray-500">/mes</span></div>
              <p className="text-gray-600 text-sm mb-4">Hasta 100 empleados</p>
              <Button variant="outline" className="w-full">Elegir plan</Button>
            </div>
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
      <footer className="bg-gray-900 text-gray-300 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <Logo />
          <p className="mt-4 text-gray-400">
            © 2025 Oficaz. La gestión empresarial simple que funciona.
          </p>
        </div>
      </footer>
    </div>
  );
}