import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
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
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Términos de Servicio</h1>
          
          <p className="text-gray-600 mb-8">
            <strong>Última actualización:</strong> 26 de junio de 2025
          </p>

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
            <li><strong>"Usuario":</strong> Cualquier persona que accede a la plataforma (administradores, managers, empleados)</li>
            <li><strong>"Plataforma" o "Servicio":</strong> El software de gestión empresarial Oficaz</li>
            <li><strong>"Datos del Cliente":</strong> Toda la información introducida por el Cliente en la plataforma</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Aceptación de los Términos</h2>
          
          <p className="mb-4">
            Al crear una cuenta en Oficaz, el Cliente confirma que:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Tiene capacidad legal para contratar en nombre de su empresa</li>
            <li>Ha leído y acepta estos Términos de Servicio</li>
            <li>Ha leído y acepta nuestra Política de Privacidad</li>
            <li>Proporcionará información veraz y actualizada</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Descripción del Servicio</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Oficaz es una plataforma SaaS que incluye:</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Sistema de control de tiempo y fichajes</li>
            <li>Gestión de solicitudes de vacaciones</li>
            <li>Almacenamiento y gestión de documentos laborales</li>
            <li>Sistema de mensajería interna</li>
            <li>Gestión de empleados y roles</li>
            <li>Generación de reportes y estadísticas</li>
            <li>Funcionalidades adicionales según el plan contratado</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Disponibilidad del servicio</h3>
          <p className="mb-4">
            Nos comprometemos a mantener una disponibilidad del 99.5% anual, excluyendo mantenimientos programados 
            que serán notificados con al menos 48 horas de antelación.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Planes y Facturación</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Planes disponibles</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li><strong>Basic:</strong> €29/mes - Hasta 15 empleados, funcionalidades básicas</li>
            <li><strong>Pro:</strong> €59/mes - Hasta 50 empleados, funcionalidades avanzadas</li>
            <li><strong>Master:</strong> €149/mes - Empleados ilimitados, todas las funcionalidades</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Periodo de prueba</h3>
          <p className="mb-4">
            Ofrecemos 30 días de prueba gratuita para nuevos clientes. Durante este periodo, 
            tendrás acceso completo a las funcionalidades de tu plan elegido.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Facturación y pagos</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>La facturación es mensual y se realiza por adelantado</li>
            <li>Los precios incluyen IVA cuando sea aplicable</li>
            <li>Los pagos se procesan automáticamente en la fecha de renovación</li>
            <li>Aceptamos tarjetas de crédito, débito y transferencias bancarias</li>
            <li>Los precios pueden modificarse con 30 días de antelación</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Retrasos en el pago</h3>
          <p className="mb-4">
            En caso de impago, el servicio se suspenderá tras 7 días de gracia. 
            Los datos se conservarán durante 30 días adicionales para permitir la reactivación.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Uso Aceptable</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">El Cliente se compromete a:</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Usar el servicio únicamente para fines legales y empresariales</li>
            <li>Mantener la confidencialidad de sus credenciales de acceso</li>
            <li>Proporcionar información veraz y actualizada</li>
            <li>Respetar los derechos de propiedad intelectual</li>
            <li>Cumplir con la normativa laboral y de protección de datos</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Está prohibido:</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Intentar acceder a sistemas o datos de otros clientes</li>
            <li>Realizar ingeniería inversa del software</li>
            <li>Usar el servicio para actividades ilegales o fraudulentas</li>
            <li>Sobrecargar intencionalmente los servidores</li>
            <li>Compartir cuentas entre múltiples empresas</li>
            <li>Revender o sublicenciar el servicio sin autorización</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Propiedad Intelectual</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Propiedad de Oficaz</h3>
          <p className="mb-4">
            Oficaz y todo su contenido (software, diseño, textos, logos) son propiedad exclusiva de Oficaz SL 
            y están protegidos por derechos de autor y otras leyes de propiedad intelectual.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Datos del Cliente</h3>
          <p className="mb-4">
            Los datos que el Cliente introduce en la plataforma siguen siendo de su propiedad. 
            Oficaz actúa únicamente como procesador de datos según las instrucciones del Cliente.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Licencia de uso</h3>
          <p className="mb-4">
            Concedemos al Cliente una licencia no exclusiva, no transferible y revocable para usar 
            la plataforma durante la vigencia del contrato, según los términos aquí establecidos.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Protección de Datos y Privacidad</h2>
          
          <p className="mb-4">
            El tratamiento de datos personales se rige por nuestra Política de Privacidad y por el Acuerdo de Procesamiento de Datos (DPA) que se considera parte integral de estos términos.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Compromisos de Oficaz</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Cumplir con el RGPD y normativa española de protección de datos</li>
            <li>Implementar medidas de seguridad técnicas y organizativas apropiadas</li>
            <li>Procesar datos únicamente según las instrucciones del Cliente</li>
            <li>Notificar brechas de seguridad en un plazo de 72 horas</li>
            <li>Facilitar el ejercicio de derechos de los interesados</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Limitaciones y Responsabilidad</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Limitaciones del servicio</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>El servicio se proporciona "tal como es"</li>
            <li>No garantizamos que el servicio esté libre de errores</li>
            <li>No somos responsables de interrupciones causadas por terceros</li>
            <li>Los límites de cada plan son estrictamente aplicables</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Limitación de responsabilidad</h3>
          <p className="mb-4">
            Nuestra responsabilidad total hacia el Cliente, bajo cualquier circunstancia, 
            no excederá el importe pagado por el Cliente en los 12 meses anteriores al evento que originó la reclamación.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Exención de garantías</h3>
          <p className="mb-4">
            No garantizamos que el servicio cumplirá con todos los requisitos específicos del Cliente 
            o que será compatible con todos los sistemas de terceros.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Soporte Técnico</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Canales de soporte</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li><strong>Email:</strong> soporte@oficaz.com</li>
            <li><strong>Chat en vivo:</strong> Disponible en la plataforma durante horario comercial</li>
            <li><strong>Base de conocimiento:</strong> Documentación y tutoriales en línea</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Tiempos de respuesta</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li><strong>Plan Basic:</strong> 48 horas en días laborables</li>
            <li><strong>Plan Pro:</strong> 24 horas en días laborables</li>
            <li><strong>Plan Master:</strong> 4 horas, soporte 24/7</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Terminación del Servicio</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Terminación por el Cliente</h3>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>El Cliente puede cancelar en cualquier momento sin penalización</li>
            <li>La cancelación es efectiva al final del periodo de facturación actual</li>
            <li>No se realizan reembolsos por periodos no utilizados</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Terminación por Oficaz</h3>
          <p className="mb-4">
            Podemos terminar el servicio inmediatamente en caso de:
          </p>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Incumplimiento material de estos términos</li>
            <li>Impago continuado tras el periodo de gracia</li>
            <li>Uso fraudulento o ilegal del servicio</li>
            <li>Actividades que pongan en riesgo la seguridad del sistema</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Recuperación de datos</h3>
          <p className="mb-4">
            Tras la terminación, el Cliente tiene 30 días para exportar sus datos. 
            Pasado este periodo, los datos serán eliminados permanentemente.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Modificaciones de los Términos</h2>
          
          <p className="mb-4">
            Podemos modificar estos términos ocasionalmente. Los cambios significativos serán notificados 
            con al menos 30 días de antelación por email y mediante aviso en la plataforma.
          </p>
          
          <p className="mb-4">
            El uso continuado del servicio tras la entrada en vigor de las modificaciones 
            constituye la aceptación de los nuevos términos.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">12. Fuerza Mayor</h2>
          
          <p className="mb-4">
            No seremos responsables por retrasos o incumplimientos causados por circunstancias 
            fuera de nuestro control razonable, incluyendo pero no limitado a:
          </p>
          
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Desastres naturales</li>
            <li>Actos de guerra o terrorismo</li>
            <li>Fallos en infraestructuras de terceros</li>
            <li>Cambios en leyes o regulaciones</li>
            <li>Pandemias o emergencias sanitarias</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">13. Ley Aplicable y Jurisdicción</h2>
          
          <p className="mb-4">
            Estos términos se rigen por la legislación española. Cualquier disputa se resolverá 
            en los tribunales de Madrid, España, salvo que el Cliente sea un consumidor, 
            en cuyo caso se aplicarán las normas de protección al consumidor.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">14. Resolución de Conflictos</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Mediación</h3>
          <p className="mb-4">
            Antes de iniciar cualquier acción legal, las partes intentarán resolver las disputas 
            mediante mediación a través de un mediador acreditado.
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
      </div>
    </div>
  );
}