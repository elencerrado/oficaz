import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { useDemoBanner } from '@/hooks/use-demo-banner';
import { useEmployeeViewMode } from '@/hooks/use-employee-view-mode';
import { LayoutDashboard, Clock, Calendar, CalendarClock, FileText, Mail, Bell, Users, Settings, LogOut, ClipboardList, Store, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { useQuery } from '@tanstack/react-query';
import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';

const featureToAddonKey: Record<string, string> = {
  timeTracking: 'time_tracking',
  vacation: 'vacation',
  schedules: 'schedules',
  documents: 'documents',
  messages: 'messages',
  reminders: 'reminders',
  work_reports: 'work_reports',
  reports: 'work_reports',
  ai_assistant: 'ai_assistant',
  inventory: 'inventory',
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user, company, subscription, logout } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const { showBanner, bannerHeight } = useDemoBanner();
  const { isEmployeeViewMode } = useEmployeeViewMode();
  
  const shouldShowLogo = company?.logoUrl && hasAccess('logoUpload');

  const { data: unreadCount } = useQuery({
    queryKey: ['/api/messages/unread-count'],
    staleTime: 60000, // Cache for 1 minute - WebSocket handles real-time updates
  });

  const { data: managerPermissionsData } = useQuery<{ managerPermissions: { visibleFeatures?: string[]; canBuyRemoveFeatures?: boolean; canBuyRemoveUsers?: boolean } }>({
    queryKey: ['/api/settings/manager-permissions'],
    enabled: user?.role === 'manager',
  });

  const canAccessStore = user?.role === 'admin' || 
    (user?.role === 'manager' && (
      managerPermissionsData?.managerPermissions?.canBuyRemoveFeatures || 
      managerPermissionsData?.managerPermissions?.canBuyRemoveUsers
    ));

  // Features that are ALWAYS visible for managers (not configurable)
  const alwaysVisibleForManagers = ['messages', 'reminders'];
  
  const isFeatureVisibleForManager = (featureKey: string | undefined): boolean => {
    // Managers can always see sidebar items - access level is controlled within each page
    // This allows managers with "Solo lectura" (read-only) access to see pages
    // The actual permission checking happens in the page components via useFeatureCheck hooks
    return true;
  };

  const companyAlias = company?.companyAlias || 'test';
  
  const navigation = [
    { 
      name: 'Panel Principal', 
      href: `/${companyAlias}/inicio`, 
      icon: LayoutDashboard
    },
    ...(user?.role === 'admin' || user?.role === 'manager' ? [
      { 
        name: 'Fichajes', 
        href: `/${companyAlias}/fichajes`, 
        icon: Clock,
        feature: 'timeTracking' as const
      }
    ] : [
      { 
        name: 'Control de Tiempo', 
        href: `/${companyAlias}/horas`, 
        icon: Clock,
        feature: 'timeTracking' as const
      }
    ]),
    { 
      name: 'Vacaciones', 
      href: `/${companyAlias}/vacaciones`, 
      icon: Calendar,
      feature: 'vacation' as const
    },
    ...(user?.role === 'admin' || user?.role === 'manager' ? [
      { 
        name: 'Cuadrante', 
        href: `/${companyAlias}/cuadrante`, 
        icon: CalendarClock,
        feature: 'schedules' as const
      }
    ] : []),
    { 
      name: 'Documentos', 
      href: `/${companyAlias}/documentos`, 
      icon: FileText,
      feature: 'documents' as const
    },
    { 
      name: 'Mensajes', 
      href: `/${companyAlias}/mensajes`, 
      icon: Mail, 
      badge: unreadCount,
      feature: 'messages' as const
    },
    { 
      name: 'Recordatorios', 
      href: `/${companyAlias}/recordatorios`, 
      icon: Bell,
      feature: 'reminders' as const
    },
    ...((hasAccess('reports', { bypassManagerRestrictions: true }) || hasAccess('work_reports', { bypassManagerRestrictions: true })) && 
       (user?.role === 'admin' || user?.role === 'manager' || 
        user?.workReportMode === 'manual' || user?.workReportMode === 'both') ? [
      { 
        name: 'Partes de Trabajo', 
        href: `/${companyAlias}/partes-trabajo`, 
        icon: ClipboardList,
        feature: 'work_reports' as const
      }
    ] : []),
    ...((user?.role === 'admin' || user?.role === 'manager') && hasAccess('inventory', { bypassManagerRestrictions: true }) ? [
      { 
        name: 'Inventario', 
        href: `/${companyAlias}/inventario`, 
        icon: Package,
        feature: 'inventory' as const
      }
    ] : []),
  ];

  const footerItems = [
    ...(user?.role === 'admin' || user?.role === 'manager' ? [
      { 
        name: 'Empleados', 
        href: `/${companyAlias}/empleados`, 
        icon: Users
      }
    ] : []),
    { 
      name: 'Configuración', 
      href: `/${companyAlias}/configuracion`, 
      icon: Settings
    },
    ...(canAccessStore ? [
      { 
        name: 'Tienda', 
        href: `/${companyAlias}/tienda`, 
        icon: Store
      }
    ] : []),
  ];

  const handleLinkClick = () => {
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <nav 
        className={`
          fixed left-0 w-64 bg-sidebar shadow-lg z-30 transform transition-transform duration-300 flex flex-col border-r border-border
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        `}
        style={{
          top: showBanner ? `calc(${bannerHeight}px + env(safe-area-inset-top, 0px))` : 'env(safe-area-inset-top, 0px)',
          bottom: '0px',
          backgroundColor: 'hsl(var(--sidebar-background))',
          paddingLeft: 'env(safe-area-inset-left, 0px)'
        }}
      >
        <div className="h-16 bg-sidebar flex-shrink-0" style={{ backgroundColor: 'hsl(var(--sidebar-background))' }} />
        
        <div 
          className="flex-1 overflow-y-auto bg-sidebar min-h-0"
          style={{
            backgroundColor: 'hsl(var(--sidebar-background))'
          }}
        >
          <div className="p-4 bg-sidebar">
            <div className="flex flex-col justify-start space-y-1"
                 style={{ 
                   gap: 'clamp(0.3rem, 1.2vh, 0.8rem)'
                 }}>
              {navigation
                .filter((item) => !item.feature || hasAccess(item.feature, { bypassManagerRestrictions: true }))
                .map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                
                return (
                  <div key={item.name}>
                    <Link href={item.href}>
                      <button
                        className={`
                          w-full flex items-center space-x-3 rounded-lg transition-colors text-left
                          ${isActive 
                            ? 'bg-primary/10 text-primary' 
                            : 'text-sidebar-foreground hover:bg-muted'
                          }
                        `}
                        style={{
                          padding: 'clamp(0.75rem, 1.5vh, 1rem) 1rem',
                          minHeight: 'clamp(2.5rem, 5vh, 3.5rem)'
                        }}
                        onClick={handleLinkClick}
                      >
                        <Icon size={20} />
                        <span>{item.name}</span>
                        {typeof item.badge === 'number' && item.badge > 0 && (
                          <span className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded-full ml-auto">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <div 
          className="flex-shrink-0 border-t border-border/50"
          style={{ 
            backgroundColor: 'hsl(var(--sidebar-background))',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)'
          }}
        >
          <div className="px-2 py-4">
            <div className="flex items-center justify-evenly w-full">
              <TooltipProvider delayDuration={100}>
                {footerItems.map((item) => {
                  const isActive = location === item.href;
                  const Icon = item.icon;
                  
                  return (
                    <Tooltip key={item.name}>
                      <TooltipTrigger asChild>
                        <Link href={item.href}>
                          <button
                            className={`
                              relative p-2.5 rounded-xl transition-all duration-200 ease-out flex-shrink-0
                              ${isActive 
                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105' 
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/80 hover:scale-105'
                              }
                            `}
                            onClick={handleLinkClick}
                            data-testid={`footer-${item.name.toLowerCase()}`}
                          >
                            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            {isActive && (
                              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-foreground rounded-full" />
                            )}
                          </button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="font-medium">
                        {item.name}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </TooltipProvider>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
