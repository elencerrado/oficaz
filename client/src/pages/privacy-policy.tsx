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

export default function PrivacyPolicy() {
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
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Política de Privacidad</h1>
        
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <div className="text-sm text-gray-600 bg-blue-50 p-4 rounded-lg">
            <p><strong>Última actualización:</strong> 26 de junio de 2025</p>
            <p><strong>Fecha de entrada en vigor:</strong> 26 de junio de 2025</p>
          </div>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Información General</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              En cumplimiento del Reglamento General de Protección de Datos (RGPD) y la Ley Orgánica 3/2018 de 
              Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD), Oficaz se compromete 
              a proteger la privacidad de sus usuarios.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Responsable del Tratamiento:</h3>
              <p>Oficaz Technology Solutions, S.L.</p>
              <p>CIF: B-12345678</p>
              <p>Dirección: Calle Tecnología, 123, 28001 Madrid, España</p>
              <p>Email: privacidad@oficaz.com</p>
              <p>Teléfono: +34 900 123 456</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Datos que Recopilamos</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">2.1 Datos de Registro</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Nombre y apellidos</li>
                  <li>Dirección de correo electrónico</li>
                  <li>DNI/NIE</li>
                  <li>Teléfono de contacto</li>
                  <li>Datos de la empresa (nombre, CIF, dirección fiscal)</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">2.2 Datos de Uso</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Registros de tiempo de trabajo</li>
                  <li>Solicitudes de vacaciones</li>
                  <li>Documentos laborales subidos</li>
                  <li>Mensajes internos de la empresa</li>
                  <li>Dirección IP y datos de navegación</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">2.3 Datos de Pago</h3>
                <p className="text-gray-700">
                  Los datos de pago son procesados por nuestros proveedores certificados (Stripe) y no son 
                  almacenados en nuestros servidores. Solo conservamos el identificador de suscripción.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Finalidades del Tratamiento</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900">Prestación del Servicio</h3>
                <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                  <li>Gestión de usuarios y accesos</li>
                  <li>Control horario de empleados</li>
                  <li>Gestión de vacaciones</li>
                  <li>Almacenamiento de documentos</li>
                  <li>Comunicación interna</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900">Administración</h3>
                <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                  <li>Facturación y cobros</li>
                  <li>Soporte técnico</li>
                  <li>Cumplimiento legal</li>
                  <li>Mejora del servicio</li>
                  <li>Prevención de fraudes</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Base Legal</h2>
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-gray-900">Ejecución del Contrato (Art. 6.1.b RGPD)</h3>
                <p className="text-gray-700 text-sm">Para la prestación del servicio de gestión empresarial contratado.</p>
              </div>
              
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-gray-900">Interés Legítimo (Art. 6.1.f RGPD)</h3>
                <p className="text-gray-700 text-sm">Para la mejora del servicio, seguridad y prevención de fraudes.</p>
              </div>
              
              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="font-semibold text-gray-900">Obligación Legal (Art. 6.1.c RGPD)</h3>
                <p className="text-gray-700 text-sm">Para cumplir con obligaciones fiscales y laborales.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Conservación de Datos</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left">Tipo de Dato</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Período de Conservación</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">Datos de cuenta activa</td>
                    <td className="border border-gray-300 px-4 py-2">Mientras dure la relación contractual</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2">Registros horarios</td>
                    <td className="border border-gray-300 px-4 py-2">4 años (normativa laboral)</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">Datos fiscales</td>
                    <td className="border border-gray-300 px-4 py-2">6 años (normativa fiscal)</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2">Logs de acceso</td>
                    <td className="border border-gray-300 px-4 py-2">12 meses</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Sus Derechos</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Derechos de Acceso y Portabilidad</h3>
                <p className="text-blue-800 text-sm">Puede solicitar una copia de sus datos personales en formato estructurado.</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Derecho de Rectificación</h3>
                <p className="text-green-800 text-sm">Puede corregir datos inexactos o incompletos.</p>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="font-semibold text-yellow-900 mb-2">Derecho de Supresión</h3>
                <p className="text-yellow-800 text-sm">Puede solicitar la eliminación de sus datos bajo ciertas condiciones.</p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-900 mb-2">Derecho de Oposición</h3>
                <p className="text-purple-800 text-sm">Puede oponerse al tratamiento basado en interés legítimo.</p>
              </div>
            </div>
            
            <div className="mt-4 bg-gray-100 p-4 rounded-lg">
              <p className="text-gray-700 text-sm">
                <strong>Para ejercer sus derechos:</strong> Envíe un email a <strong>privacidad@oficaz.com</strong> con 
                copia de su DNI/NIE. Responderemos en un plazo máximo de 30 días.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Seguridad</h2>
            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl mb-2">🔒</div>
                  <h3 className="font-semibold text-blue-900">Cifrado SSL/TLS</h3>
                  <p className="text-blue-800 text-sm">Todas las comunicaciones están cifradas</p>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl mb-2">🛡️</div>
                  <h3 className="font-semibold text-green-900">Servidores Seguros</h3>
                  <p className="text-green-800 text-sm">Infraestructura en centros de datos certificados</p>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl mb-2">👥</div>
                  <h3 className="font-semibold text-purple-900">Acceso Restringido</h3>
                  <p className="text-purple-800 text-sm">Solo personal autorizado accede a los datos</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Cookies</h2>
            <p className="text-gray-700 mb-4">
              Utilizamos cookies técnicas necesarias para el funcionamiento del servicio y cookies de análisis 
              para mejorar la experiencia de usuario. Puede gestionar sus preferencias en la configuración de su navegador.
            </p>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-orange-800 text-sm">
                <strong>Nota:</strong> Las cookies técnicas no pueden desactivarse ya que son esenciales para el funcionamiento del servicio.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Transferencias Internacionales</h2>
            <p className="text-gray-700 mb-4">
              Sus datos se procesan principalmente en servidores ubicados en la Unión Europea. Cualquier transferencia 
              fuera del EEE se realiza con las garantías adecuadas (cláusulas contractuales tipo, decisiones de adecuación).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Modificaciones</h2>
            <p className="text-gray-700 mb-4">
              Nos reservamos el derecho a modificar esta política de privacidad. Los cambios significativos se 
              comunicarán con al menos 30 días de antelación por email.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Contacto y Reclamaciones</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Contacto Directo</h3>
                <p className="text-blue-800 text-sm mb-2">Email: privacidad@oficaz.com</p>
                <p className="text-blue-800 text-sm">Teléfono: +34 900 123 456</p>
              </div>
              
              <div className="bg-red-50 p-4 rounded-lg">
                <h3 className="font-semibold text-red-900 mb-2">Autoridad de Control</h3>
                <p className="text-red-800 text-sm mb-1">Agencia Española de Protección de Datos</p>
                <p className="text-red-800 text-sm">www.aepd.es</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}