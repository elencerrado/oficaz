import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

// Import logo
import oficazLogo from "@assets/Imagotipo Oficaz_1750321812493.png";

// Official Oficaz logo component
const Logo = ({ isDark = false }: { isDark?: boolean }) => (
  <div className="flex items-center space-x-2">
    <img src={oficazLogo} alt="Oficaz" className="h-8 w-auto" />
  </div>
);

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Términos del Servicio</h1>
        
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <div className="text-sm text-gray-600 bg-blue-50 p-4 rounded-lg">
            <p><strong>Última actualización:</strong> 26 de junio de 2025</p>
            <p><strong>Fecha de entrada en vigor:</strong> 26 de junio de 2025</p>
          </div>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Información de la Empresa</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="font-semibold mb-3">Prestador del Servicio:</h3>
              <div className="space-y-1 text-gray-700">
                <p><strong>Razón Social:</strong> Oficaz Technology Solutions, S.L.</p>
                <p><strong>CIF:</strong> B-12345678</p>
                <p><strong>Domicilio Social:</strong> Calle Tecnología, 123, 28001 Madrid, España</p>
                <p><strong>Email:</strong> legal@oficaz.com</p>
                <p><strong>Teléfono:</strong> +34 900 123 456</p>
                <p><strong>Registro Mercantil:</strong> Madrid, Tomo 1234, Folio 567, Sección 8, Hoja M-123456</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Objeto y Aceptación</h2>
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                Los presentes términos regulan el uso de la plataforma SaaS <strong>Oficaz</strong>, un software de gestión 
                empresarial que permite el control horario, gestión de vacaciones, documentos y comunicación interna para empresas.
              </p>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <p className="text-yellow-800">
                  <strong>Importante:</strong> El uso de nuestros servicios implica la aceptación íntegra de estos términos. 
                  Si no está de acuerdo, no utilice la plataforma.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Descripción del Servicio</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Funcionalidades Principales:</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Control horario de empleados
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Gestión de solicitudes de vacaciones
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Almacenamiento y gestión de documentos
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Mensajería interna empresarial
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Generación de informes y reportes
                  </li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Planes Disponibles:</h3>
                <div className="space-y-2">
                  <div className="bg-gray-50 p-3 rounded">
                    <p><strong>Basic:</strong> €29/mes - Hasta 10 empleados</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded">
                    <p><strong>Pro:</strong> €59/mes - Hasta 25 empleados</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded">
                    <p><strong>Master:</strong> €149/mes - Hasta 100 empleados</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Registro y Cuenta de Usuario</h2>
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Requisitos para el Registro:</h3>
                <ul className="text-green-800 text-sm space-y-1">
                  <li>• Ser mayor de 18 años</li>
                  <li>• Proporcionar información veraz y actualizada</li>
                  <li>• Disponer de email válido para verificación</li>
                  <li>• Aceptar estos términos y la política de privacidad</li>
                </ul>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg">
                <h3 className="font-semibold text-red-900 mb-2">Responsabilidades del Usuario:</h3>
                <ul className="text-red-800 text-sm space-y-1">
                  <li>• Mantener la confidencialidad de sus credenciales</li>
                  <li>• Notificar inmediatamente cualquier uso no autorizado</li>
                  <li>• Utilizar el servicio de forma legal y ética</li>
                  <li>• No compartir cuentas entre múltiples personas</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Periodo de Prueba y Facturación</h2>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-900 mb-2">Periodo de Prueba</h3>
                  <ul className="text-blue-800 text-sm space-y-1">
                    <li>• 14 días gratuitos para todos los planes</li>
                    <li>• Acceso completo a todas las funcionalidades</li>
                    <li>• Sin compromiso de permanencia</li>
                    <li>• Cancelación automática si no se activa suscripción</li>
                  </ul>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-purple-900 mb-2">Facturación</h3>
                  <ul className="text-purple-800 text-sm space-y-1">
                    <li>• Facturación mensual adelantada</li>
                    <li>• Cargos automáticos el mismo día cada mes</li>
                    <li>• IVA incluido según normativa española</li>
                    <li>• Facturas disponibles en formato digital</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <h3 className="font-semibold text-yellow-900 mb-2">Política de Reembolsos</h3>
                <p className="text-yellow-800 text-sm">
                  No se realizan reembolsos por meses parciales. La cancelación es efectiva al final del periodo de facturación actual. 
                  Los datos permanecen accesibles durante 30 días adicionales para exportación.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Uso Aceptable</h2>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-medium text-green-700 mb-2">✅ Usos Permitidos</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Gestión legítima de empleados de su empresa</li>
                    <li>• Cumplimiento de normativas laborales españolas</li>
                    <li>• Almacenamiento de documentos empresariales</li>
                    <li>• Comunicación interna profesional</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-red-700 mb-2">❌ Usos Prohibidos</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Almacenar contenido ilegal o no autorizado</li>
                    <li>• Realizar ingeniería inversa del software</li>
                    <li>• Intentar acceder a datos de otras empresas</li>
                    <li>• Uso para actividades fraudulentas</li>
                    <li>• Reventa o sublicencia del servicio</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Propiedad Intelectual</h2>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Derechos de Oficaz</h3>
                <p className="text-blue-800 text-sm">
                  Oficaz es titular de todos los derechos de propiedad intelectual sobre la plataforma, incluyendo 
                  software, diseño, marca, contenido y metodologías. Queda prohibida cualquier reproducción no autorizada.
                </p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Sus Datos</h3>
                <p className="text-green-800 text-sm">
                  Usted mantiene todos los derechos sobre los datos que introduce en la plataforma. Oficaz no los utilizará 
                  para fines distintos a la prestación del servicio contratado.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Disponibilidad y Mantenimiento</h2>
            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl mb-2">⏱️</div>
                  <h3 className="font-semibold text-green-900">Disponibilidad</h3>
                  <p className="text-green-800 text-sm">99.5% uptime mensual garantizado</p>
                </div>
                
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl mb-2">🔧</div>
                  <h3 className="font-semibold text-blue-900">Mantenimiento</h3>
                  <p className="text-blue-800 text-sm">Programado fuera de horario laboral</p>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl mb-2">📞</div>
                  <h3 className="font-semibold text-purple-900">Soporte</h3>
                  <p className="text-purple-800 text-sm">Lunes a viernes 9:00-18:00 CET</p>
                </div>
              </div>
              
              <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                <p className="text-orange-800 text-sm">
                  <strong>Exclusiones:</strong> No garantizamos disponibilidad durante mantenimientos programados, 
                  fallos de terceros (proveedores de internet, hosting) o eventos de fuerza mayor.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Limitación de Responsabilidad</h2>
            <div className="space-y-4">
              <div className="bg-red-50 border-l-4 border-red-400 p-4">
                <h3 className="font-semibold text-red-900 mb-2">Límites de Responsabilidad</h3>
                <ul className="text-red-800 text-sm space-y-1">
                  <li>• Nuestra responsabilidad se limita al importe abonado en los últimos 12 meses</li>
                  <li>• No respondemos por daños indirectos, lucro cesante o pérdida de datos por mal uso</li>
                  <li>• El usuario es responsable de mantener copias de seguridad de sus datos</li>
                  <li>• No garantizamos resultados específicos en el cumplimiento normativo</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Recomendaciones</h3>
                <p className="text-blue-800 text-sm">
                  Recomendamos mantener registros adicionales y consultar con asesores legales para el cumplimiento 
                  de normativas específicas de su sector o localización.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Rescisión del Contrato</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900">Rescisión por el Cliente</h3>
                <ul className="text-gray-700 text-sm space-y-1">
                  <li>• Cancelación en cualquier momento desde el panel de usuario</li>
                  <li>• Efectiva al final del periodo de facturación</li>
                  <li>• Acceso a datos durante 30 días para exportación</li>
                  <li>• Eliminación definitiva tras periodo de gracia</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900">Rescisión por Oficaz</h3>
                <ul className="text-gray-700 text-sm space-y-1">
                  <li>• Incumplimiento grave de estos términos</li>
                  <li>• Impago durante más de 15 días</li>
                  <li>• Uso fraudulento o ilegal del servicio</li>
                  <li>• Preaviso de 30 días salvo incumplimiento grave</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Modificaciones</h2>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-yellow-800 text-sm mb-2">
                <strong>Cambios en los Términos:</strong> Nos reservamos el derecho a modificar estos términos. 
                Los cambios significativos se notificarán con 30 días de antelación por email.
              </p>
              <p className="text-yellow-800 text-sm">
                <strong>Cambios en el Servicio:</strong> Podemos añadir, modificar o eliminar funcionalidades con 
                previo aviso. Los cambios que reduzcan funcionalidades se notificarán con 60 días de antelación.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Ley Aplicable y Jurisdicción</h2>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Legislación Aplicable</h3>
                <p className="text-gray-700 text-sm">
                  Este contrato se rige por la legislación española. En caso de conflicto entre idiomas, 
                  prevalece la versión en español.
                </p>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Resolución de Disputas</h3>
                <div className="text-blue-800 text-sm space-y-2">
                  <p><strong>1. Mediación:</strong> Intentaremos resolver cualquier disputa mediante mediación</p>
                  <p><strong>2. Arbitraje:</strong> Si procede, sometimiento a arbitraje de consumo</p>
                  <p><strong>3. Jurisdicción:</strong> Tribunales de Madrid para disputas no resueltas</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Contacto</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Consultas Generales</h3>
                <p className="text-blue-800 text-sm mb-1">Email: soporte@oficaz.com</p>
                <p className="text-blue-800 text-sm">Teléfono: +34 900 123 456</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Asuntos Legales</h3>
                <p className="text-green-800 text-sm mb-1">Email: legal@oficaz.com</p>
                <p className="text-green-800 text-sm">Horario: L-V 9:00-18:00 CET</p>
              </div>
            </div>
          </section>

          <div className="bg-gray-100 p-6 rounded-lg mt-8">
            <h3 className="font-semibold text-gray-900 mb-2">Declaración Final</h3>
            <p className="text-gray-700 text-sm">
              Al utilizar Oficaz, confirma haber leído, entendido y aceptado estos términos del servicio en su totalidad. 
              Si tiene dudas sobre cualquier punto, contacte con nuestro equipo legal antes de proceder.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}