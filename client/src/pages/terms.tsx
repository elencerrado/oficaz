import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';
import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';

export default function Terms() {
  usePageTitle('Términos de Servicio');
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
            <FileText className="w-6 h-6 text-[#007AFF]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Términos de Servicio</h1>
            <p className="text-gray-500 mt-1">Última actualización: 26 de junio de 2025</p>
          </div>
        </div>
        
        <div className="prose prose-lg max-w-none">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-blue-900 mb-2">Bienvenido a Oficaz</h2>
            <p className="text-blue-800">
              Estos términos regulan el uso de nuestra plataforma de gestión empresarial. 
              Al registrarte y usar Oficaz, aceptas estos términos en su totalidad.
            </p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Definiciones</h2>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li><strong>"Oficaz", "nosotros", "nos":</strong> Se refiere a Oficaz SL, empresa responsable de la plataforma</li>
            <li><strong>"Cliente", "usted":</strong> La empresa que contrata nuestros servicios</li>
            <li><strong>"Usuario":</strong> Cualquier persona autorizada a usar la plataforma</li>
            <li><strong>"Servicio":</strong> La plataforma SaaS de gestión empresarial Oficaz</li>
            <li><strong>"Datos":</strong> Toda información introducida, almacenada o procesada en la plataforma</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Aceptación de Términos</h2>
          
          <p className="mb-4">
            Al acceder, registrarse o usar Oficaz, el Cliente acepta estar legalmente vinculado por estos términos. 
            Si no está de acuerdo, no debe usar el servicio.
          </p>
          
          <p className="mb-4">
            Estos términos se aplican a todos los usuarios de su organización que accedan a la plataforma 
            bajo su cuenta corporativa.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Descripción del Servicio</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Funcionalidades principales</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Control de horarios y fichajes de empleados</li>
            <li>Gestión de vacaciones y permisos</li>
            <li>Almacenamiento y organización de documentos</li>
            <li>Comunicación interna empresarial</li>
            <li>Reportes y estadísticas</li>
            <li>Gestión de usuarios y permisos</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Disponibilidad</h3>
          <p className="mb-4">
            Nos comprometemos a mantener una disponibilidad del 99.9% mensual. 
            Las interrupciones planificadas se notificarán con 48 horas de antelación.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Planes y Facturación</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Planes de suscripción</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li><strong>Basic:</strong> Funcionalidades esenciales para equipos pequeños</li>
            <li><strong>Pro:</strong> Funcionalidades avanzadas para empresas en crecimiento</li>
            <li><strong>Master:</strong> Todas las funcionalidades para grandes organizaciones</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Facturación</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Los planes se facturan mensualmente por adelantado</li>
            <li>Los precios están expresados en euros (EUR) e incluyen IVA</li>
            <li>Los cambios de plan se aplican en el siguiente ciclo de facturación</li>
            <li>No se realizan reembolsos por periodos parciales</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Prueba gratuita</h3>
          <p className="mb-4">
            Ofrecemos 15 días de prueba gratuita con acceso completo a funcionalidades. 
            No se requiere tarjeta de crédito para iniciar la prueba.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Registro y Cuentas</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Requisitos de registro</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Proporcionar información precisa y actualizada de la empresa</li>
            <li>Verificar la dirección de email corporativo</li>
            <li>Designar un administrador principal responsable</li>
            <li>Aceptar estos términos y la política de privacidad</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Responsabilidades del Cliente</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Mantener la confidencialidad de credenciales de acceso</li>
            <li>Notificar inmediatamente cualquier uso no autorizado</li>
            <li>Gestionar adecuadamente los permisos de usuarios</li>
            <li>Mantener actualizada la información de contacto y facturación</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Uso Aceptable</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Usos permitidos</h3>
          <p className="mb-4">
            El Cliente puede usar Oficaz exclusivamente para gestión interna empresarial 
            y dentro de los límites de su plan contratado.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Usos prohibidos</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Actividades ilegales o que violen derechos de terceros</li>
            <li>Distribución de malware, virus o código malicioso</li>
            <li>Intentos de acceso no autorizado o ingeniería inversa</li>
            <li>Uso excesivo que afecte el rendimiento del servicio</li>
            <li>Reventa o sublicencia del servicio</li>
            <li>Almacenamiento de contenido ilegal o inapropiado</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Propiedad Intelectual</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Derechos de Oficaz</h3>
          <p className="mb-4">
            Oficaz retiene todos los derechos sobre la plataforma, incluyendo código fuente, 
            diseño, marcas comerciales y metodologías.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Derechos del Cliente</h3>
          <p className="mb-4">
            El Cliente retiene todos los derechos sobre sus datos. Oficaz no reclama 
            propiedad sobre la información que el Cliente almacena en la plataforma.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Privacidad y Datos</h2>
          
          <p className="mb-4">
            El tratamiento de datos personales se rige por nuestra Política de Privacidad 
            y el Acuerdo de Procesamiento de Datos (DPA), ambos parte integral de estos términos.
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Cumplimos estrictamente con RGPD y normativa española</li>
            <li>Los datos se procesan únicamente según instrucciones del Cliente</li>
            <li>Implementamos medidas técnicas y organizativas robustas</li>
            <li>Facilitamos el ejercicio de derechos de los interesados</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Limitaciones y Disponibilidad</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Límites por plan</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Número de usuarios según plan contratado</li>
            <li>Espacio de almacenamiento por empresa</li>
            <li>Límites de transferencia de datos mensual</li>
            <li>Funcionalidades específicas según nivel de plan</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Mantenimiento</h3>
          <p className="mb-4">
            Nos reservamos el derecho a realizar mantenimiento programado con notificación previa. 
            El mantenimiento de emergencia puede realizarse sin aviso previo.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Suspensión y Terminación</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Suspensión del servicio</h3>
          <p className="mb-4">
            Podemos suspender el acceso inmediatamente en caso de:
          </p>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Incumplimiento de estos términos</li>
            <li>Falta de pago tras 15 días de vencimiento</li>
            <li>Actividades que comprometan la seguridad</li>
            <li>Uso que exceda significativamente los límites del plan</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Terminación por el Cliente</h3>
          <p className="mb-4">
            El Cliente puede cancelar su suscripción en cualquier momento desde su panel de control. 
            La cancelación es efectiva al final del periodo de facturación actual.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Acceso a datos tras terminación</h3>
          <p className="mb-4">
            Tras la terminación, proporcionamos 30 días adicionales para exportar datos. 
            Posteriormente, los datos pueden ser eliminados permanentemente.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Limitaciones de Responsabilidad</h2>
          
          <p className="mb-4">
            En la máxima medida permitida por la ley:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>El servicio se proporciona "tal como está" sin garantías expresas o implícitas</li>
            <li>No garantizamos que el servicio esté libre de errores o interrupciones</li>
            <li>Nuestra responsabilidad total no excederá las tarifas pagadas en los 12 meses previos</li>
            <li>No somos responsables de daños indirectos, consecuenciales o punitivos</li>
            <li>El Cliente es responsable de mantener copias de seguridad de sus datos</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">12. Indemnización</h2>
          
          <p className="mb-4">
            El Cliente acepta indemnizar y eximir de responsabilidad a Oficaz por:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Uso del servicio que viole estos términos</li>
            <li>Infracción de derechos de terceros por contenido del Cliente</li>
            <li>Uso no autorizado de credenciales del Cliente</li>
            <li>Reclamaciones relacionadas con datos del Cliente</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">13. Modificaciones</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Cambios en el servicio</h3>
          <p className="mb-4">
            Nos reservamos el derecho a modificar, mejorar o discontinuar funcionalidades 
            con notificación previa de 30 días para cambios significativos.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Cambios en términos</h3>
          <p className="mb-4">
            Podemos actualizar estos términos ocasionalmente. Los cambios materiales 
            se notificarán por email con 30 días de antelación.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">14. Ley Aplicable y Jurisdicción</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Ley aplicable</h3>
          <p className="mb-4">
            Estos términos se rigen por la legislación española y europea aplicable.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Jurisdicción</h3>
          <p className="mb-4">
            Para la resolución de controversias, las partes se someten a la jurisdicción 
            de los tribunales de Madrid, España.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Arbitraje</h3>
          <p className="mb-4">
            Para empresas, las disputas que no se resuelvan por mediación se someterán a arbitraje 
            según el Reglamento de la Corte de Arbitraje de Madrid.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">15. Disposiciones Generales</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Integridad del acuerdo</h3>
          <p className="mb-4">
            Estos términos, junto con la Política de Privacidad y el DPA, constituyen 
            el acuerdo completo entre las partes.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Divisibilidad</h3>
          <p className="mb-4">
            Si alguna disposición de estos términos se considera inválida, 
            el resto del acuerdo permanecerá en pleno vigor.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Cesión</h3>
          <p className="mb-4">
            El Cliente no puede ceder este acuerdo sin nuestro consentimiento escrito. 
            Oficaz puede ceder este acuerdo en caso de fusión, adquisición o venta de activos.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">16. Contacto</h2>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Oficaz SL</h3>
            <p className="mb-2">CIF: B-12345678</p>
            <p className="mb-2">Dirección: Calle Innovación 123, 28001 Madrid, España</p>
            <p className="mb-2">Email: <strong>legal@oficaz.com</strong></p>
            <p className="mb-2">Teléfono: +34 900 123 456</p>
            <p className="mb-2">Soporte: <strong>soporte@oficaz.com</strong></p>
            <p>Web: www.oficaz.com</p>
          </div>

          <div className="border-t pt-8 mt-12">
            <p className="text-center text-gray-600">
              Al usar Oficaz, confirmas que has leído, entendido y aceptado estos Términos de Servicio 
              en su totalidad, así como nuestra Política de Privacidad.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}