import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Scale } from 'lucide-react';
import { usePageTitle } from '@/hooks/use-page-title';
import { useScrollToTop } from '@/hooks/use-scroll-to-top';
import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';

export default function LegalNotice() {
  usePageTitle('Aviso Legal');
  useScrollToTop();
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b">
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
            <Scale className="w-6 h-6 text-[#007AFF]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Aviso Legal</h1>
            <p className="text-gray-500 mt-1">Última actualización: 16 de enero de 2026</p>
          </div>
        </div>
        
        <div className="prose prose-lg max-w-none">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-blue-900 mb-2">Información Legal</h2>
            <p className="text-blue-800">
              En cumplimiento de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información 
              y del Comercio Electrónico (LSSI-CE), se facilita la siguiente información legal sobre 
              la titularidad de este sitio web.
            </p>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Datos del Responsable</h2>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="space-y-2">
              <p><strong>Titular:</strong> José Ángel García Márquez</p>
              <p><strong>DNI:</strong> 09055639X</p>
              <p><strong>Actividad:</strong> Desarrollo y comercialización de software de gestión empresarial (SaaS)</p>
              <p><strong>Domicilio:</strong> Avd. Clara Campoamor 4, Blq. 7 5º4, 21920 San Juan de Aznalfarache (Sevilla), España</p>
              <p><strong>Email:</strong> soy@oficaz.es</p>
              <p><strong>Teléfono:</strong> +34 614 028 600</p>
              <p><strong>Sitio web:</strong> www.oficaz.es</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Objeto</h2>
          
          <p className="mb-4">
            El presente aviso legal regula el uso del sitio web <strong>www.oficaz.es</strong> (en adelante, el "Sitio Web"), 
            del que es titular José Ángel García Márquez.
          </p>

          <p className="mb-4">
            El acceso y uso del Sitio Web atribuye la condición de usuario (en adelante, el "Usuario") e implica 
            la aceptación plena y sin reservas de todas y cada una de las disposiciones incluidas en este 
            Aviso Legal.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Condiciones de Acceso y Uso</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">3.1. Carácter gratuito</h3>
          <p className="mb-4">
            El acceso y navegación en el Sitio Web es gratuito, sin perjuicio de que algunos servicios 
            están sujetos a un modelo de suscripción de pago (modelo SaaS).
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">3.2. Registro de usuarios</h3>
          <p className="mb-4">
            Con carácter general, la prestación de servicios no exige la previa suscripción o registro del Usuario. 
            No obstante, para utilizar determinadas funcionalidades es necesario:
          </p>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Registrarse como empresa cliente</li>
            <li>Proporcionar datos personales de forma veraz, exacta y completa</li>
            <li>Mantener actualizados los datos facilitados</li>
            <li>Aceptar la Política de Privacidad y los Términos de Servicio</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">3.3. Uso adecuado</h3>
          <p className="mb-4">El Usuario se compromete a utilizar el Sitio Web y los servicios de conformidad con:</p>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>La ley vigente en España</li>
            <li>El presente Aviso Legal</li>
            <li>Los Términos de Servicio</li>
            <li>La moral, buenas costumbres y orden público</li>
          </ul>

          <p className="mb-4">En particular, el Usuario se compromete a no:</p>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Utilizar los servicios con fines ilícitos o prohibidos</li>
            <li>Provocar daños en los sistemas del titular o de terceros</li>
            <li>Realizar actividades que puedan dañar la imagen, derechos e intereses del titular o terceros</li>
            <li>Acceder a áreas restringidas de los sistemas informáticos del titular o de terceros</li>
            <li>Introducir virus, código malicioso o cualquier sistema que pueda causar alteraciones</li>
          </ul>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Propiedad Intelectual e Industrial</h2>
          
          <p className="mb-4">
            Todos los contenidos del Sitio Web (textos, fotografías, gráficos, imágenes, iconos, tecnología, 
            software, diseño gráfico, código fuente) así como los signos distintivos (marcas, nombres comerciales) 
            son propiedad de José Ángel García Márquez o de terceros que han autorizado su uso, 
            y están protegidos por derechos de propiedad intelectual e industrial.
          </p>

          <p className="mb-4">
            La marca <strong>"Oficaz"</strong> es propiedad de José Ángel García Márquez.
          </p>

          <p className="mb-4">
            Queda prohibida la reproducción, distribución, comunicación pública y transformación total o parcial 
            de los contenidos del Sitio Web sin la autorización expresa y por escrito del titular.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Exclusión de Garantías y Responsabilidad</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">5.1. Contenidos</h3>
          <p className="mb-4">
            El titular no garantiza la licitud, fiabilidad, utilidad, veracidad o exactitud de los datos 
            o informaciones aportadas por los usuarios a través de los formularios de contacto o registro.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">5.2. Disponibilidad</h3>
          <p className="mb-4">
            El titular no garantiza la disponibilidad y continuidad del funcionamiento del Sitio Web ni de 
            los servicios. No obstante, se realizarán los mejores esfuerzos para mantener un nivel de 
            servicio óptimo (uptime mínimo del 99.5% según SLA).
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">5.3. Enlaces externos</h3>
          <p className="mb-4">
            El Sitio Web puede contener enlaces a sitios web de terceros. El titular no asume responsabilidad 
            alguna por el contenido, exactitud o servicios que puedan ofrecerse en dichos sitios externos.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Protección de Datos Personales</h2>
          
          <p className="mb-4">
            El tratamiento de datos personales de los usuarios se realiza conforme a lo establecido en:
          </p>
          <ul className="list-disc ml-6 mb-4 space-y-1">
            <li>Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo de 27 de abril de 2016 (RGPD)</li>
            <li>Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales</li>
          </ul>

          <p className="mb-4">
            Para más información, consulta nuestra{' '}
            <Link href="/politica-privacidad" className="text-blue-600 hover:underline">Política de Privacidad</Link>.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Política de Cookies</h2>
          
          <p className="mb-4">
            Este Sitio Web utiliza cookies para mejorar la experiencia del usuario, analizar el tráfico web 
            y ofrecer servicios personalizados. El usuario puede configurar su navegador para rechazar 
            las cookies si lo desea.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Legislación Aplicable y Jurisdicción</h2>
          
          <p className="mb-4">
            Las presentes condiciones se rigen por la legislación española vigente.
          </p>

          <p className="mb-4">
            Para la resolución de cualquier controversia o conflicto que pueda surgir con motivo de la visita 
            al Sitio Web o del uso de los servicios que en él se puedan ofertar, el titular y el Usuario 
            acuerdan someterse expresamente a los Juzgados y Tribunales de Sevilla (España), con renuncia 
            expresa a cualquier otro fuero que pudiera corresponderles.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Modificaciones</h2>
          
          <p className="mb-4">
            El titular se reserva el derecho de modificar en cualquier momento el contenido del Sitio Web, 
            así como las condiciones de uso del mismo. Los usuarios siempre dispondrán de este Aviso Legal 
            en un sitio visible, libremente accesible.
          </p>

          <p className="mb-4">
            Cualquier modificación será notificada con al menos 15 días de antelación a través del correo 
            electrónico registrado o mediante aviso destacado en la plataforma.
          </p>

          <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Contacto</h2>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos de Contacto</h3>
            <p className="mb-2"><strong>José Ángel García Márquez</strong></p>
            <p className="mb-2">DNI: 09055639X</p>
            <p className="mb-2">Email: soy@oficaz.es</p>
            <p className="mb-2">Teléfono: +34 614 028 600</p>
            <p>Dirección: Avd. Clara Campoamor 4, Blq. 7 5º4, 21920 San Juan de Aznalfarache (Sevilla), España</p>
          </div>

          <div className="border-t pt-8 mt-12">
            <p className="text-center text-gray-600">
              Este Aviso Legal cumple con la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad 
              de la Información y del Comercio Electrónico (LSSI-CE).
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
