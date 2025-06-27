import { Link } from "wouter";
import { Cookie, Shield, Settings, BarChart3, Target, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';

export default function Cookies() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio
              </Button>
            </Link>
            <img src={oficazLogo} alt="Oficaz" className="h-10 w-auto" />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Title Section */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[#007AFF]/10 rounded-lg flex items-center justify-center">
            <Cookie className="w-6 h-6 text-[#007AFF]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Política de Cookies</h1>
            <p className="text-gray-500 mt-1">Última actualización: 26 de junio de 2025</p>
          </div>
        </div>
        <div className="prose prose-gray max-w-none">
          
          {/* Introducción */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">¿Qué son las cookies?</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas un sitio web. 
              Estas cookies permiten que el sitio web recuerde información sobre tu visita, como tus preferencias de idioma 
              y otra configuración. Esto puede facilitar tu próxima visita y hacer que el sitio sea más útil para ti.
            </p>
            <p className="text-gray-700 leading-relaxed">
              En Oficaz utilizamos cookies para mejorar tu experiencia de usuario, personalizar contenido, 
              analizar el tráfico web y para fines publicitarios.
            </p>
          </section>

          {/* Tipos de cookies */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Tipos de cookies que utilizamos</h2>
            
            {/* Cookies Necesarias */}
            <div className="bg-white rounded-lg border p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-green-500" />
                <h3 className="text-lg font-medium text-gray-900">Cookies Estrictamente Necesarias</h3>
              </div>
              <p className="text-gray-700 mb-4">
                Estas cookies son esenciales para que puedas navegar por el sitio web y usar sus funciones. 
                Sin estas cookies, no se pueden proporcionar los servicios que has solicitado.
              </p>
              <div className="bg-gray-50 rounded p-4">
                <h4 className="font-medium text-gray-900 mb-2">Ejemplos:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Cookies de autenticación de usuario</li>
                  <li>• Cookies de seguridad para prevenir ataques</li>
                  <li>• Cookies de sesión para mantener tu estado de login</li>
                  <li>• Cookies de carrito de compra</li>
                </ul>
              </div>
            </div>

            {/* Cookies Funcionales */}
            <div className="bg-white rounded-lg border p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Settings className="w-6 h-6 text-blue-500" />
                <h3 className="text-lg font-medium text-gray-900">Cookies Funcionales</h3>
              </div>
              <p className="text-gray-700 mb-4">
                Estas cookies permiten que el sitio web recuerde las elecciones que haces (como tu nombre de usuario, 
                idioma o la región en la que te encuentras) y proporcionan características mejoradas y más personales.
              </p>
              <div className="bg-gray-50 rounded p-4">
                <h4 className="font-medium text-gray-900 mb-2">Ejemplos:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Preferencias de idioma</li>
                  <li>• Configuración de tema (modo oscuro/claro)</li>
                  <li>• Preferencias de diseño personalizado</li>
                  <li>• Configuración de notificaciones</li>
                </ul>
              </div>
            </div>

            {/* Cookies de Análisis */}
            <div className="bg-white rounded-lg border p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-6 h-6 text-purple-500" />
                <h3 className="text-lg font-medium text-gray-900">Cookies de Análisis y Rendimiento</h3>
              </div>
              <p className="text-gray-700 mb-4">
                Estas cookies recopilan información sobre cómo los visitantes usan un sitio web, por ejemplo, 
                qué páginas visitan más a menudo y si reciben mensajes de error de las páginas web.
              </p>
              <div className="bg-gray-50 rounded p-4">
                <h4 className="font-medium text-gray-900 mb-2">Ejemplos:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Google Analytics para medir el tráfico del sitio</li>
                  <li>• Hotjar para análisis de comportamiento de usuario</li>
                  <li>• Cookies para detectar errores técnicos</li>
                  <li>• Métricas de rendimiento del sitio web</li>
                </ul>
              </div>
            </div>

            {/* Cookies de Marketing */}
            <div className="bg-white rounded-lg border p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <Target className="w-6 h-6 text-orange-500" />
                <h3 className="text-lg font-medium text-gray-900">Cookies de Marketing y Publicidad</h3>
              </div>
              <p className="text-gray-700 mb-4">
                Estas cookies se utilizan para hacer que los mensajes publicitarios sean más relevantes para ti y tus intereses. 
                También realizan funciones como evitar que el mismo anuncio reaparezca continuamente.
              </p>
              <div className="bg-gray-50 rounded p-4">
                <h4 className="font-medium text-gray-900 mb-2">Ejemplos:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Facebook Pixel para remarketing</li>
                  <li>• Google Ads para publicidad personalizada</li>
                  <li>• Cookies de redes sociales para compartir contenido</li>
                  <li>• Seguimiento de conversiones publicitarias</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Duración de las cookies */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Duración de las cookies</h2>
            <div className="bg-white rounded-lg border p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Cookies de Sesión</h3>
                  <p className="text-sm text-gray-600">
                    Se eliminan automáticamente cuando cierras tu navegador. 
                    Utilizadas principalmente para funciones de autenticación y seguridad.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Cookies Persistentes</h3>
                  <p className="text-sm text-gray-600">
                    Permanecen en tu dispositivo durante un período determinado o hasta que las elimines manualmente. 
                    Duración típica: entre 30 días y 2 años.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Gestión de cookies */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Cómo gestionar las cookies</h2>
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-medium text-gray-900 mb-4">Configuración en Oficaz</h3>
              <p className="text-gray-700 mb-4">
                Puedes gestionar tus preferencias de cookies en cualquier momento a través de nuestro banner de cookies 
                o accediendo a la configuración de tu cuenta una vez registrado.
              </p>
              
              <h3 className="font-medium text-gray-900 mb-4 mt-6">Configuración del navegador</h3>
              <p className="text-gray-700 mb-4">
                La mayoría de navegadores web aceptan cookies automáticamente, pero puedes modificar la configuración 
                para declinar cookies si lo prefieres. A continuación, te indicamos cómo hacerlo en los navegadores más populares:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 rounded p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Google Chrome</h4>
                  <p className="text-gray-600">
                    Configuración → Privacidad y seguridad → Cookies y otros datos de sitios
                  </p>
                </div>
                <div className="bg-gray-50 rounded p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Mozilla Firefox</h4>
                  <p className="text-gray-600">
                    Opciones → Privacidad y seguridad → Cookies y datos del sitio
                  </p>
                </div>
                <div className="bg-gray-50 rounded p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Safari</h4>
                  <p className="text-gray-600">
                    Preferencias → Privacidad → Gestionar datos de sitios web
                  </p>
                </div>
                <div className="bg-gray-50 rounded p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Microsoft Edge</h4>
                  <p className="text-gray-600">
                    Configuración → Privacidad, búsqueda y servicios → Cookies
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Cookies de terceros */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Cookies de terceros</h2>
            <div className="bg-white rounded-lg border p-6">
              <p className="text-gray-700 mb-4">
                Algunos de nuestros socios pueden establecer cookies en tu dispositivo cuando visitas nuestro sitio web. 
                Estas cookies de terceros están sujetas a las políticas de privacidad de sus respectivos propietarios:
              </p>
              <div className="space-y-3">
                <div className="border-l-4 border-[#007AFF] pl-4">
                  <h4 className="font-medium text-gray-900">Google Analytics</h4>
                  <p className="text-sm text-gray-600">
                    Política de privacidad: 
                    <a href="https://policies.google.com/privacy" className="text-[#007AFF] hover:underline ml-1" target="_blank" rel="noopener noreferrer">
                      https://policies.google.com/privacy
                    </a>
                  </p>
                </div>
                <div className="border-l-4 border-[#007AFF] pl-4">
                  <h4 className="font-medium text-gray-900">Stripe (Pagos)</h4>
                  <p className="text-sm text-gray-600">
                    Política de privacidad: 
                    <a href="https://stripe.com/privacy" className="text-[#007AFF] hover:underline ml-1" target="_blank" rel="noopener noreferrer">
                      https://stripe.com/privacy
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Base legal */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Base legal</h2>
            <div className="bg-white rounded-lg border p-6">
              <p className="text-gray-700 mb-4">
                El uso de cookies en nuestro sitio web se basa en las siguientes normativas:
              </p>
              <ul className="text-gray-700 space-y-2">
                <li>• <strong>Reglamento General de Protección de Datos (RGPD)</strong> - UE 2016/679</li>
                <li>• <strong>Ley Orgánica de Protección de Datos (LOPD)</strong> - España</li>
                <li>• <strong>Ley de Servicios de la Sociedad de la Información (LSSI)</strong> - España</li>
                <li>• <strong>Directiva ePrivacy</strong> - UE 2002/58/CE</li>
              </ul>
            </div>
          </section>

          {/* Contacto */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Contacto y ejercicio de derechos</h2>
            <div className="bg-white rounded-lg border p-6">
              <p className="text-gray-700 mb-4">
                Si tienes alguna pregunta sobre nuestra política de cookies o deseas ejercer tus derechos 
                relacionados con el tratamiento de datos personales, puedes contactarnos:
              </p>
              <div className="bg-gray-50 rounded p-4">
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Datos de contacto</h4>
                    <p className="text-gray-600">Email: privacidad@oficaz.com</p>
                    <p className="text-gray-600">Teléfono: +34 900 123 456</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Delegado de Protección de Datos</h4>
                    <p className="text-gray-600">Email: dpo@oficaz.com</p>
                    <p className="text-gray-600">Derechos: acceso, rectificación, supresión, portabilidad</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Actualizaciones */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Actualizaciones de esta política</h2>
            <div className="bg-white rounded-lg border p-6">
              <p className="text-gray-700">
                Nos reservamos el derecho de actualizar esta Política de Cookies en cualquier momento. 
                Las modificaciones entrarán en vigor desde su publicación en el sitio web. 
                Te recomendamos revisar periódicamente esta página para estar al tanto de cualquier cambio.
              </p>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}