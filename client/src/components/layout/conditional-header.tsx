import { useSidebarState } from '@/hooks/use-sidebar-state';
import { usePageHeader } from './page-header';

export function ConditionalHeader() {
  const { shouldShowHeader } = useSidebarState();
  const { header } = usePageHeader();

  // Only show header when sidebar state says we should (mobile with closed sidebar)
  if (!shouldShowHeader || header.visible === false) {
    return null;
  }

  // Fallback titles by pathname for pages not yet migrated
  const getFallbackTitle = () => {
    const path = window.location.pathname;
    const titleMap: Record<string, { title: string; subtitle: string }> = {
      '/messages': { title: 'Mensajes', subtitle: 'Comunicación interna de la empresa' },
      '/reminders': { title: 'Recordatorios', subtitle: 'Gestiona recordatorios y tareas' },
      '/employees-simple': { title: 'Empleados', subtitle: 'Gestión de empleados' },
      '/settings': { title: 'Configuración', subtitle: 'Configuración de la empresa' },
      '/notifications': { title: 'Notificaciones', subtitle: 'Centro de notificaciones' },
      '/employees': { title: 'Empleados', subtitle: 'Gestión de empleados' },
    };

    // Also check for company alias routes like /companyName/mensajes
    const aliasMatch = path.match(/^\/[^\/]+\/(mensajes|recordatorios|empleados|configuracion)$/);
    if (aliasMatch) {
      const page = aliasMatch[1];
      const aliasMap: Record<string, { title: string; subtitle: string }> = {
        'mensajes': { title: 'Mensajes', subtitle: 'Comunicación interna de la empresa' },
        'recordatorios': { title: 'Recordatorios', subtitle: 'Gestiona recordatorios y tareas' },
        'empleados': { title: 'Empleados', subtitle: 'Gestión de empleados' },
        'configuracion': { title: 'Configuración', subtitle: 'Configuración de la empresa' },
      };
      return aliasMap[page];
    }

    return titleMap[path];
  };

  const fallback = getFallbackTitle();
  const title = header.title || fallback?.title;
  const subtitle = header.subtitle || fallback?.subtitle;

  if (!title) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              {subtitle}
            </p>
          )}
        </div>
        {header.actions && (
          <div className="flex items-center space-x-2">
            {header.actions}
          </div>
        )}
      </div>
    </div>
  );
}