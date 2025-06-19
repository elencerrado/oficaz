import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { LayoutDashboard, Clock, Calendar, FileText, Mail, Users, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import oficazLogo from '@/assets/oficaz-logo.png';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const { user, company, logout } = useAuth();

  const { data: unreadCount } = useQuery({
    queryKey: ['/api/messages/unread-count'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const companyAlias = company?.companyAlias || 'test';
  
  const navigation = [
    { name: 'Panel Principal', href: `/${companyAlias}/dashboard`, icon: LayoutDashboard },
    { name: 'Control de Tiempo', href: `/${companyAlias}/time-tracking`, icon: Clock },
    { name: 'Solicitudes de Vacaciones', href: `/${companyAlias}/vacation-requests`, icon: Calendar },
    { name: 'Documentos', href: `/${companyAlias}/documents`, icon: FileText },
    { name: 'Mensajes', href: `/${companyAlias}/messages`, icon: Mail, badge: unreadCount },
    ...(user?.role === 'admin' || user?.role === 'manager' ? [
      { name: 'Empleados', href: `/${companyAlias}/employees`, icon: Users }
    ] : []),
    { name: 'Configuración', href: `/${companyAlias}/settings`, icon: Settings },
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
      <nav className={`
        fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-30 transform transition-transform duration-300 flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Fixed Company header */}
        <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center space-x-3">
            <img 
              src={oficazLogo} 
              alt="Oficaz" 
              className="h-6 w-auto"
            />
            <div>
              <h2 className="text-sm font-medium text-gray-900">
                {company?.name || 'Oficaz'}
              </h2>
            </div>
          </div>
        </div>
        
        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
          <div className="p-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                
                return (
                  <li key={item.name}>
                    <Link href={item.href}>
                      <button
                        className={`
                          w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-left
                          ${isActive 
                            ? 'bg-blue-50 text-oficaz-primary' 
                            : 'text-gray-700 hover:bg-gray-100'
                          }
                        `}
                        onClick={handleLinkClick}
                      >
                        <Icon size={20} />
                        <span>{item.name}</span>
                        {typeof item.badge === 'number' && item.badge > 0 && (
                          <span className="bg-oficaz-error text-white text-xs px-2 py-1 rounded-full ml-auto">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        

      </nav>
    </>
  );
}
