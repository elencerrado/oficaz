import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Oficaz
              </Button>
            </Link>
            
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-[#007AFF] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Oficaz</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-12">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Política de Privacidad</h1>
          
          <p className="text-gray-600 mb-8">
            <strong>Última actualización:</strong> 26 de junio de 2025
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-blue-900 mb-2">En resumen</h2>
            <p className="text-blue-800">
              En Oficaz respetamos tu privacidad y la de tu empresa. Recopilamos únicamente los datos necesarios 
              para proporcionar nuestro servicio de gestión empresarial, utilizamos medidas de seguridad robustas 
              y nunca vendemos tu información a terceros.
            </p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Información que recopilamos</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Información de la empresa</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Nombre comercial y razón social</li>
            <li>CIF/NIF de la empresa</li>
            <li>Dirección fiscal y provincia</li>
            <li>Email de facturación y contacto</li>
            <li>Información de contacto del administrador</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Información de empleados</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Datos personales: nombre completo, DNI/NIE</li>
            <li>Información de contacto: email personal y corporativo, teléfono</li>
            <li>Datos laborales: cargo, fecha de incorporación, salario (opcional)</li>
            <li>Registros de tiempo: fichajes, horas trabajadas</li>
            <li>Solicitudes de vacaciones y su estado</li>
            <li>Documentos laborales subidos a la plataforma</li>
            <li>Mensajes internos de la empresa</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Información técnica</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Dirección IP y datos de conexión</li>
            <li>Información del navegador y dispositivo</li>
            <li>Cookies técnicas y de sesión</li>
            <li>Logs de seguridad y auditoría</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Cómo utilizamos tu información</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Prestación del servicio</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Gestión de empleados y control de tiempo</li>
            <li>Procesamiento de solicitudes de vacaciones</li>
            <li>Almacenamiento y gestión de documentos laborales</li>
            <li>Facilitación de la comunicación interna</li>
            <li>Generación de reportes y estadísticas</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Mejora del servicio</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Análisis de uso para optimizar la plataforma</li>
            <li>Detección y prevención de problemas técnicos</li>
            <li>Desarrollo de nuevas funcionalidades</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Comunicación</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Notificaciones del servicio y actualizaciones importantes</li>
            <li>Soporte técnico y atención al cliente</li>
            <li>Información sobre nuevas funcionalidades (opcional)</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Base legal del tratamiento</h2>
          
          <p className="mb-4">
            Procesamos tus datos personales basándonos en:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li><strong>Ejecución contractual:</strong> Para proporcionar el servicio acordado</li>
            <li><strong>Interés legítimo:</strong> Para mejorar el servicio y prevenir fraudes</li>
            <li><strong>Consentimiento:</strong> Para comunicaciones de marketing (opcional)</li>
            <li><strong>Obligación legal:</strong> Para cumplir con requisitos fiscales y laborales</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Compartir información con terceros</h2>
          
          <p className="mb-4">
            <strong>No vendemos ni alquilamos tu información personal a terceros.</strong> Únicamente compartimos datos en estas situaciones:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li><strong>Proveedores de servicios:</strong> Hosting, procesamiento de pagos, análisis (con acuerdos de confidencialidad)</li>
            <li><strong>Obligaciones legales:</strong> Cuando sea requerido por autoridades competentes</li>
            <li><strong>Protección de derechos:</strong> Para proteger nuestros derechos legales o los de nuestros usuarios</li>
            <li><strong>Consentimiento expreso:</strong> Con tu autorización explícita para casos específicos</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Seguridad de los datos</h2>
          
          <p className="mb-4">
            Implementamos medidas de seguridad técnicas y organizativas apropiadas:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Encriptación SSL/TLS para todas las comunicaciones</li>
            <li>Cifrado de datos sensibles en la base de datos</li>
            <li>Autenticación multifactor para accesos administrativos</li>
            <li>Copias de seguridad regulares y automáticas</li>
            <li>Monitorización de seguridad 24/7</li>
            <li>Formación regular del personal en protección de datos</li>
            <li>Auditorías de seguridad periódicas</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Retención de datos</h2>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li><strong>Datos de empleados activos:</strong> Durante la vigencia del contrato laboral</li>
            <li><strong>Registros de tiempo:</strong> 4 años (requisito legal)</li>
            <li><strong>Documentos laborales:</strong> Según normativa laboral española</li>
            <li><strong>Datos de facturación:</strong> 6 años (obligación fiscal)</li>
            <li><strong>Logs de seguridad:</strong> 2 años máximo</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Tus derechos bajo el RGPD</h2>
          
          <p className="mb-4">
            Como ciudadano de la UE, tienes derecho a:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li><strong>Acceso:</strong> Conocer qué datos tenemos sobre ti</li>
            <li><strong>Rectificación:</strong> Corregir datos inexactos o incompletos</li>
            <li><strong>Supresión:</strong> Solicitar la eliminación de tus datos</li>
            <li><strong>Limitación:</strong> Restringir el procesamiento de tus datos</li>
            <li><strong>Portabilidad:</strong> Recibir tus datos en formato legible</li>
            <li><strong>Oposición:</strong> Oponerte al procesamiento de tus datos</li>
            <li><strong>Retirada de consentimiento:</strong> Revocar el consentimiento dado</li>
          </ul>

          <p className="mb-4">
            Para ejercer estos derechos, contacta con nosotros en: <strong>privacidad@oficaz.com</strong>
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Transferencias internacionales</h2>
          
          <p className="mb-4">
            Todos nuestros servidores están ubicados en la Unión Europea. Si utilizamos proveedores fuera de la UE, 
            nos aseguramos de que cumplan con las decisiones de adecuación de la Comisión Europea o implementamos 
            salvaguardias apropiadas como las Cláusulas Contractuales Tipo.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Cookies y tecnologías similares</h2>
          
          <p className="mb-4">
            Utilizamos cookies esenciales para el funcionamiento del servicio:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li><strong>Cookies de sesión:</strong> Para mantener tu sesión activa</li>
            <li><strong>Cookies de seguridad:</strong> Para prevenir ataques y fraudes</li>
            <li><strong>Cookies de preferencias:</strong> Para recordar tus configuraciones</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Menores de edad</h2>
          
          <p className="mb-4">
            Nuestro servicio está dirigido exclusivamente a empresas y empleados mayores de 16 años. 
            No recopilamos intencionalmente información de menores de 16 años.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Actualizaciones de esta política</h2>
          
          <p className="mb-4">
            Podemos actualizar esta política ocasionalmente. Te notificaremos cambios significativos por email 
            y dentro de la plataforma. La fecha de última actualización aparece al inicio de este documento.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">12. Contacto</h2>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Responsable del tratamiento</h3>
            <p className="mb-2"><strong>Oficaz SL</strong></p>
            <p className="mb-2">CIF: B-12345678</p>
            <p className="mb-2">Dirección: Calle Innovación 123, 28001 Madrid, España</p>
            <p className="mb-2">Email: <strong>privacidad@oficaz.com</strong></p>
            <p className="mb-2">Teléfono: +34 900 123 456</p>
            
            <h4 className="text-md font-semibold text-gray-900 mt-4 mb-2">Delegado de Protección de Datos</h4>
            <p>Email: <strong>dpo@oficaz.com</strong></p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">13. Autoridad de control</h2>
          
          <p className="mb-4">
            Si consideras que el tratamiento de tus datos no se ajusta a la normativa, puedes presentar una reclamación ante:
          </p>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
            <p className="mb-2"><strong>Agencia Española de Protección de Datos (AEPD)</strong></p>
            <p className="mb-2">C/ Jorge Juan, 6, 28001 Madrid</p>
            <p className="mb-2">Teléfono: 901 100 099 / 912 663 517</p>
            <p>Web: www.aepd.es</p>
          </div>

          <div className="border-t pt-8 mt-12">
            <p className="text-center text-gray-600">
              Esta Política de Privacidad cumple con el Reglamento General de Protección de Datos (RGPD) 
              y la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}