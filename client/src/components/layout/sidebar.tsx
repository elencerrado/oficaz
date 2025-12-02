import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { useDemoBanner } from '@/hooks/use-demo-banner';
import { LayoutDashboard, Clock, Calendar, CalendarClock, FileText, Mail, Bell, Users, Settings, LogOut, ClipboardList, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { useQuery } from '@tanstack/react-query';
import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user, company, subscription, logout } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const { showBanner, bannerHeight } = useDemoBanner();
  
  const shouldShowLogo = company?.logoUrl && hasAccess('logoUpload');

  const { data: unreadCount } = useQuery({
    queryKey: ['/api/messages/unread-count'],
    refetchInterval: 30000,
  });

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
    ...((hasAccess('reports') || hasAccess('work_reports')) && 
       (user?.role === 'admin' || user?.role === 'manager' || 
        user?.workReportMode === 'manual' || user?.workReportMode === 'both') ? [
      { 
        name: 'Partes de Trabajo', 
        href: `/${companyAlias}/partes-trabajo`, 
        icon: ClipboardList,
        feature: 'work_reports' as const
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
    ...(user?.role === 'admin' ? [
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
          top: showBanner ? `${bannerHeight}px` : '0px',
          height: showBanner ? `calc(100vh - ${bannerHeight}px)` : '100vh',
          backgroundColor: 'hsl(var(--sidebar-background))',
          marginTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)'
        }}
      >
        <div className="h-16 bg-sidebar flex-shrink-0" style={{ backgroundColor: 'hsl(var(--sidebar-background))' }} />
        
        <div 
          className="flex-1 overflow-y-auto flex flex-col bg-sidebar"
          style={{
            backgroundColor: 'hsl(var(--sidebar-background))'
          }}
        >
          <div className="flex-1 p-4 bg-sidebar">
            <div className="h-full flex flex-col justify-start space-y-1"
                 style={{ 
                   gap: 'clamp(0.3rem, 1.2vh, 0.8rem)'
                 }}>
              {navigation.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                const isFeatureRestricted = item.feature && !hasAccess(item.feature);
                
                return (
                  <div key={item.name}>
                    <Link href={item.href}>
                      <button
                        className={`
                          w-full flex items-center space-x-3 rounded-lg transition-colors text-left
                          ${isActive 
                            ? 'bg-primary/10 text-primary' 
                            : isFeatureRestricted
                              ? 'text-muted-foreground hover:bg-muted/50 opacity-60'
                              : 'text-sidebar-foreground hover:bg-muted'
                          }
                        `}
                        style={{
                          padding: 'clamp(0.75rem, 1.5vh, 1rem) 1rem',
                          minHeight: 'clamp(2.5rem, 5vh, 3.5rem)'
                        }}
                        onClick={handleLinkClick}
                      >
                        <Icon size={20} className={isFeatureRestricted ? 'opacity-50' : ''} />
                        <span className={isFeatureRestricted ? 'opacity-75' : ''}>{item.name}</span>
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
          <div className="px-4 py-4">
            <div className="flex items-center justify-center gap-2">
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
                              relative p-3 rounded-xl transition-all duration-200 ease-out
                              ${isActive 
                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105' 
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/80 hover:scale-105'
                              }
                            `}
                            onClick={handleLinkClick}
                            data-testid={`footer-${item.name.toLowerCase()}`}
                          >
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
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
