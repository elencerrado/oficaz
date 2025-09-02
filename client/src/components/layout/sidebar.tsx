import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { useDemoBanner } from '@/hooks/use-demo-banner';
import { LayoutDashboard, Clock, Calendar, FileText, Mail, Bell, Users, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';


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
  
  // Lógica inteligente: mostrar logo solo si tiene logo Y función habilitada
  const shouldShowLogo = company?.logoUrl && hasAccess('logoUpload');

  const { data: unreadCount } = useQuery({
    queryKey: ['/api/messages/unread-count'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const companyAlias = company?.companyAlias || 'test';
  
  const navigation = [
    { 
      name: 'Panel Principal', 
      href: `/${companyAlias}/inicio`, 
      icon: LayoutDashboard,
      feature: 'timeTracking' as const
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
    ...(user?.role === 'admin' || user?.role === 'manager' ? [
      { 
        name: 'Empleados', 
        href: `/${companyAlias}/empleados`, 
        icon: Users,
        feature: 'timeTracking' as const
      }
    ] : []),
    { 
      name: 'Configuración', 
      href: `/${companyAlias}/configuracion`, 
      icon: Settings
      // Configuración siempre disponible - no requiere verificación de features
    },
  ];

  const handleLinkClick = () => {
    onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <nav 
        className={`
          fixed left-0 w-64 bg-sidebar shadow-lg z-30 transform transition-transform duration-300 flex flex-col border-r border-border
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        `}
        style={{
          top: showBanner ? `${bannerHeight}px` : '0',
          height: showBanner ? `calc(100vh - ${bannerHeight}px)` : '100vh',
          backgroundColor: 'hsl(var(--sidebar-background))'
        }}
      >
        {/* Fixed Company header */}
        <div className="p-4 border-b border-border bg-sidebar flex-shrink-0">
          <div className="flex items-center space-x-3">
            {/* Mostrar logo solo si tiene logo Y función habilitada en super admin */}
            {shouldShowLogo ? (
              <img 
                src={company.logoUrl || ''} 
                alt={company.name} 
                className="h-6 w-auto object-contain flex-shrink-0"
              />
            ) : (
              <img 
                src={oficazLogo} 
                alt="Oficaz" 
                className="h-6 w-auto flex-shrink-0 dark:brightness-0 dark:invert"
              />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-medium text-foreground truncate">
                {shouldShowLogo ? company.name : (company?.name || 'Oficaz')}
              </h2>
            </div>
          </div>
        </div>
        
        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-500 flex flex-col bg-sidebar">
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
        

      </nav>
    </>
  );
}
