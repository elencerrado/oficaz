import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, 
  BarChart3, 
  Building2, 
  Settings, 
  Mail, 
  Crown,
  LogOut,
  Send,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';

interface SuperAdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SuperAdminSidebar({ isOpen, onClose }: SuperAdminSidebarProps) {
  const [location] = useLocation();
  
  const navigation = [
    { 
      name: 'Dashboard', 
      href: '/super-admin/dashboard', 
      icon: LayoutDashboard
    },
    { 
      name: 'Métricas', 
      href: '/super-admin/metrics', 
      icon: BarChart3
    },
    { 
      name: 'Empresas', 
      href: '/super-admin/companies', 
      icon: Building2
    },
    { 
      name: 'Planes', 
      href: '/super-admin/plans', 
      icon: Settings
    },
    { 
      name: 'Invitaciones', 
      href: '/super-admin/invitations', 
      icon: Mail
    },
    { 
      name: 'Promociones', 
      href: '/super-admin/promo-codes', 
      icon: Crown
    },
    { 
      name: 'Marketing', 
      href: '/super-admin/marketing', 
      icon: Send
    },
    { 
      name: 'Métricas Web', 
      href: '/super-admin/landing-metrics', 
      icon: TrendingUp
    },
  ];

  const handleLinkClick = () => {
    onClose();
  };

  const handleLogout = () => {
    localStorage.removeItem('superAdminToken');
    window.location.href = '/super-admin';
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
          fixed left-0 w-64 bg-gradient-to-b from-gray-900 via-blue-900 to-purple-900 shadow-lg z-30 transform transition-transform duration-300 flex flex-col border-r border-white/10
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        `}
        style={{
          top: 0,
          height: '100vh',
        }}
      >
        {/* Logo / Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex flex-col items-center gap-3">
            <img 
              src={oficazLogo} 
              alt="Oficaz" 
              className="h-10 w-auto dark:brightness-0 dark:invert"
            />
            <h2 className="text-white font-bold text-lg">Super Admin</h2>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              
              return (
                <li key={item.name}>
                  <Link 
                    href={item.href}
                    onClick={handleLinkClick}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                      ${isActive 
                        ? 'bg-white/20 text-white shadow-lg' 
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Logout Button */}
        <div className="p-4 border-t border-white/10">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Cerrar Sesión
          </Button>
        </div>
      </nav>
    </>
  );
}
