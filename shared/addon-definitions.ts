export interface AddonDefinition {
  key: string;
  name: string;
  description: string;
  shortDescription: string;
  isFreeFeature: boolean;
  monthlyPrice: number;
  icon: string;
}

export const ADDON_DEFINITIONS: AddonDefinition[] = [
  {
    key: 'employees',
    name: 'Gestión de Empleados',
    description: 'El corazón de tu equipo. Alta, baja, datos personales, roles y permisos. Todo centralizado para que tengas el control total de tu plantilla.',
    shortDescription: 'Tu plantilla organizada y siempre al día',
    isFreeFeature: true,
    monthlyPrice: 0,
    icon: 'Users',
  },
  {
    key: 'time_tracking',
    name: 'Control de Fichajes',
    description: 'El registro horario es obligatorio en España. Tus empleados fichan en dos toques desde el móvil y tú exportas PDF si viene una inspección. Que no te pillen en blanco.',
    shortDescription: 'Obligatorio por ley, pero aquí lo hacemos fácil y sin dramas',
    isFreeFeature: false,
    monthlyPrice: 3,
    icon: 'Clock',
  },
  {
    key: 'vacation',
    name: 'Gestión de Vacaciones',
    description: '¿Cuántos días me quedan? Que no te lo pregunten más. Cada empleado ve sus días, solicita fechas, y tú apruebas en un calendario compartido.',
    shortDescription: '¿Cuántos días me quedan? Que te dejen de dar la brasa',
    isFreeFeature: false,
    monthlyPrice: 3,
    icon: 'Calendar',
  },
  {
    key: 'schedules',
    name: 'Cuadrante de Horarios',
    description: 'Arrastra turnos, duplica semanas, y listo. Con OficazIA le dices "hazme el cuadrante" y te lo monta en segundos. Una maravilla.',
    shortDescription: 'Monta cuadrantes en minutos, no en horas de Excel',
    isFreeFeature: false,
    monthlyPrice: 3,
    icon: 'CalendarClock',
  },
  {
    key: 'messages',
    name: 'Mensajería Interna',
    description: '¿Harto de WhatsApp mezclando curro y memes? Aquí cada chat tiene su sitio. Comunicación profesional sin caos.',
    shortDescription: 'Tu equipo conectado sin grupos de WhatsApp locos',
    isFreeFeature: false,
    monthlyPrice: 5,
    icon: 'Mail',
  },
  {
    key: 'reminders',
    name: 'Recordatorios',
    description: 'Todos olvidamos cosas. Programa alertas para ti o tu equipo y recibe notificaciones push cuando más las necesitas.',
    shortDescription: 'Tu cerebro externo que nunca olvida nada',
    isFreeFeature: false,
    monthlyPrice: 5,
    icon: 'Bell',
  },
  {
    key: 'documents',
    name: 'Gestión Documental',
    description: 'Nóminas, contratos, certificados... todo en su sitio digital con firma digital. Tus empleados consultan sin preguntarte.',
    shortDescription: 'Todos tus papeles importantes, siempre a mano',
    isFreeFeature: false,
    monthlyPrice: 10,
    icon: 'FileText',
  },
  {
    key: 'work_reports',
    name: 'Partes de Trabajo',
    description: 'Tu equipo documenta cada trabajo desde el móvil: ubicación, fotos, tiempo y firma del cliente. PDFs profesionales que impresionan.',
    shortDescription: 'Documenta cada trabajo como un profesional',
    isFreeFeature: false,
    monthlyPrice: 8,
    icon: 'ClipboardList',
  },
  {
    key: 'ai_assistant',
    name: 'OficazIA',
    description: 'Dile "crea el horario de la semana" y lo hace en segundos. Un ayudante inteligente que nunca pide vacaciones.',
    shortDescription: 'Tu mano derecha que trabaja 24/7 sin quejarse',
    isFreeFeature: false,
    monthlyPrice: 15,
    icon: 'Sparkles',
  },
];

export const FREE_ADDONS = ADDON_DEFINITIONS.filter(a => a.isFreeFeature);
export const PAID_ADDONS = ADDON_DEFINITIONS.filter(a => !a.isFreeFeature);

export function getAddonByKey(key: string): AddonDefinition | undefined {
  return ADDON_DEFINITIONS.find(a => a.key === key);
}
