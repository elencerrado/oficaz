import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Building, LayoutDashboard, Clock, Calendar, FileText, Mail, Users, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';

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

  const navigation = [
    { name: 'Panel Principal', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Control de Tiempo', href: '/time-tracking', icon: Clock },
    { name: 'Solicitudes de Vacaciones', href: '/vacation-requests', icon: Calendar },
    { name: 'Documentos', href: '/documents', icon: FileText },
    { name: 'Mensajes', href: '/messages', icon: Mail, badge: unreadCount },
    ...(user?.role === 'admin' || user?.role === 'manager' ? [
      { name: 'Empleados', href: '/employees', icon: Users }
    ] : []),
    { name: 'Configuración', href: '/settings', icon: Settings },
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
        fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-30 transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        {/* Company header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-oficaz-primary rounded-lg flex items-center justify-center">
              <Building className="text-white text-lg" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {company?.name || 'Oficaz'}
              </h2>
              <p className="text-sm text-gray-500 capitalize">
                {user?.role} Dashboard
              </p>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="p-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              
              return (
                <li key={item.name}>
                  <Link href={item.href}>
                    <a
                      className={`
                        flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
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
                    </a>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        
        {/* User section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 px-4 py-3">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-gray-300 text-gray-600">
                {user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {user?.fullName}
              </p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-gray-400 hover:text-gray-600"
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>
      </nav>
    </>
  );
}
