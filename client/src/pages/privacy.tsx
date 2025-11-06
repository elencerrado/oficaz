import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';
import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';

export default function Privacy() {
  usePageTitle('Política de Privacidad');
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
            <Shield className="w-6 h-6 text-[#007AFF]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Política de Privacidad</h1>
            <p className="text-gray-500 mt-1">Última actualización: 26 de junio de 2025</p>
          </div>
        </div>
        
        <div className="prose prose-lg max-w-none">
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
            <li>CIF/NIF y datos fiscales</li>
            <li>Dirección de facturación y contacto</li>
            <li>Email de facturación y datos de contacto</li>
            <li>Sector de actividad y tamaño de empresa</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Información de empleados</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Nombre completo y DNI/NIE</li>
            <li>Email corporativo y personal (opcional)</li>
            <li>Teléfono de contacto</li>
            <li>Cargo y fecha de incorporación</li>
            <li>Datos de registro de tiempo y fichajes</li>
            <li>Solicitudes de vacaciones y permisos</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Información técnica</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Dirección IP y datos de conexión</li>
            <li>Tipo de navegador y sistema operativo</li>
            <li>Datos de uso de la plataforma</li>
            <li>Logs de acceso y seguridad</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Cómo utilizamos tu información</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Provisión del servicio</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Gestión de usuarios y permisos</li>
            <li>Control de horarios y fichajes</li>
            <li>Gestión de vacaciones y permisos</li>
            <li>Almacenamiento y organización de documentos</li>
            <li>Comunicación interna de la empresa</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Administración y facturación</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Procesamiento de pagos y facturación</li>
            <li>Gestión de suscripciones y planes</li>
            <li>Soporte técnico y atención al cliente</li>
            <li>Cumplimiento de obligaciones legales</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Mejora del servicio</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Análisis de uso y rendimiento</li>
            <li>Desarrollo de nuevas funcionalidades</li>
            <li>Prevención de fraude y seguridad</li>
            <li>Optimización de la experiencia de usuario</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Base legal para el tratamiento</h2>
          
          <p className="mb-4">
            El tratamiento de tus datos personales se basa en las siguientes bases legales del RGPD:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-2">
            <li><strong>Ejecución contractual (Art. 6.1.b RGPD):</strong> Para proporcionar el servicio contratado</li>
            <li><strong>Interés legítimo (Art. 6.1.f RGPD):</strong> Para mejora del servicio y prevención de fraude</li>
            <li><strong>Cumplimiento legal (Art. 6.1.c RGPD):</strong> Para cumplir obligaciones fiscales y laborales</li>
            <li><strong>Consentimiento (Art. 6.1.a RGPD):</strong> Para marketing directo cuando aplique</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Compartir información con terceros</h2>
          
          <p className="mb-4">
            No vendemos, alquilamos ni compartimos tu información personal con terceros para fines comerciales. 
            Únicamente compartimos datos cuando es necesario para:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Procesamiento de pagos (proveedores de pago seguros)</li>
            <li>Servicios de infraestructura cloud (servidores seguros)</li>
            <li>Cumplimiento de requerimientos legales</li>
            <li>Protección de derechos y seguridad</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Seguridad de los datos</h2>
          
          <p className="mb-4">
            Implementamos medidas técnicas y organizativas apropiadas para proteger tus datos:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Cifrado SSL/TLS para transmisión de datos</li>
            <li>Cifrado de datos en reposo</li>
            <li>Control de acceso basado en roles</li>
            <li>Autenticación de dos factores</li>
            <li>Copias de seguridad regulares</li>
            <li>Monitorización de seguridad 24/7</li>
            <li>Auditorías de seguridad periódicas</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Retención de datos</h2>
          
          <p className="mb-4">
            Conservamos tu información personal durante el tiempo necesario para:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li><strong>Datos de empleados activos:</strong> Mientras dure la relación contractual</li>
            <li><strong>Datos de facturación:</strong> 10 años (obligación legal)</li>
            <li><strong>Registros de fichajes:</strong> 4 años (normativa laboral)</li>
            <li><strong>Datos de marketing:</strong> Hasta revocación del consentimiento</li>
            <li><strong>Logs de seguridad:</strong> 2 años</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Tus derechos</h2>
          
          <p className="mb-4">
            Bajo el RGPD, tienes derecho a:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-2">
            <li><strong>Acceso:</strong> Solicitar información sobre qué datos tenemos de ti</li>
            <li><strong>Rectificación:</strong> Corregir datos inexactos o incompletos</li>
            <li><strong>Supresión:</strong> Solicitar la eliminación de tus datos ("derecho al olvido")</li>
            <li><strong>Limitación:</strong> Restringir el procesamiento de tus datos</li>
            <li><strong>Portabilidad:</strong> Recibir tus datos en formato estructurado</li>
            <li><strong>Oposición:</strong> Oponerte al procesamiento basado en interés legítimo</li>
            <li><strong>Revocación:</strong> Retirar el consentimiento en cualquier momento</li>
          </ul>

          <p className="mb-4">
            Para ejercer estos derechos, contacta con nosotros en: <strong>privacidad@oficaz.com</strong>
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Transferencias internacionales</h2>
          
          <p className="mb-4">
            Tus datos se procesan principalmente en servidores ubicados en la Unión Europea. 
            En caso de transferencias fuera del EEE, garantizamos nivel de protección adecuado mediante:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Decisiones de adecuación de la Comisión Europea</li>
            <li>Cláusulas contractuales tipo aprobadas</li>
            <li>Certificaciones de privacidad reconocidas</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Menores de edad</h2>
          
          <p className="mb-4">
            Nuestro servicio está dirigido exclusivamente a empresas y empleados mayores de 16 años. 
            No recopilamos intencionalmente datos de menores de esta edad.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Cambios en esta política</h2>
          
          <p className="mb-4">
            Podemos actualizar esta política ocasionalmente. Te notificaremos cambios significativos por email 
            y mediante aviso en la plataforma con al menos 30 días de antelación.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Contacto</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Responsable del Tratamiento</h3>
            <p className="mb-2"><strong>Oficaz SL</strong></p>
            <p className="mb-2">CIF: B12345678</p>
            <p className="mb-2">Dirección: Calle Innovación 123, 28001 Madrid</p>
            <p className="mb-2">Email: privacidad@oficaz.com</p>
            <p>Teléfono: +34 900 123 456</p>
          </div>

          <div className="bg-blue-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Delegado de Protección de Datos (DPO)</h3>
            <p className="mb-2">Email: dpo@oficaz.com</p>
            <p>Puedes contactar directamente con nuestro DPO para cualquier consulta sobre protección de datos.</p>
          </div>

          <div className="bg-yellow-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-yellow-900 mb-3">Autoridad de Control</h3>
            <p className="mb-2">Si consideras que tus derechos han sido vulnerados, puedes presentar reclamación ante:</p>
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
      </main>
    </div>
  );
}