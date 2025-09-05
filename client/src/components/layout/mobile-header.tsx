import { useState, useEffect } from 'react';
import { Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { useFeatureCheck } from '@/hooks/use-feature-check';
import { useDemoBanner } from '@/hooks/use-demo-banner';
import oficazLogo from '@assets/oficaz logo_1750516757063.png';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const { user, company, logout } = useAuth();
  const { hasAccess } = useFeatureCheck();
  const { showBanner } = useDemoBanner();
  
  // Lógica inteligente: mostrar logo solo si tiene logo Y función habilitada
  const shouldShowLogo = company?.logoUrl && hasAccess('logoUpload');
  
  // Calcular posición del header dinámicamente
  const headerTopClass = showBanner ? 'top-[60px]' : 'top-0'; // Exactamente debajo del banner de 60px
  
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${dayName}, ${day} de ${month} de ${year} | ${hours}:${minutes}`;
  };

  const formatDateMobile = (date: Date) => {
    const daysShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const monthsShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    const dayName = daysShort[date.getDay()];
    const day = date.getDate();
    const monthName = monthsShort[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${dayName}, ${day} ${monthName} ${year} | ${hours}:${minutes}`;
  };

  return (
    <header 
      className={`fixed ${headerTopClass} left-0 right-0 z-40 bg-background shadow-sm border-b border-border px-4 py-3 grid grid-cols-3 items-center`}
      style={{
        top: showBanner ? '60px' : '0px',
        // Sin paddingTop adicional porque el html padding ya maneja el safe-area
        marginTop: showBanner ? '0px' : 'env(safe-area-inset-top, 0px)' // Margin para separar del notch
      }}
      >
      {/* Left Section */}
      <div className="flex items-center justify-start">
        <Button variant="ghost" size="sm" onClick={onMenuClick} className="lg:hidden">
          <Menu className="text-foreground" size={20} />
        </Button>
        {/* Mostrar logo solo si tiene logo Y función habilitada en super admin */}
        {shouldShowLogo && company.logoUrl ? (
          <img 
            src={company.logoUrl} 
            alt={company.name} 
            className="h-6 lg:h-8 w-auto ml-2 lg:ml-0 object-contain"
          />
        ) : (
          <h1 className="text-sm font-medium text-foreground ml-2 lg:ml-0 lg:text-lg lg:font-semibold truncate">
            {company?.name || 'Oficaz'}
          </h1>
        )}
      </div>
      
      {/* Center Section - Logo */}
      <div className="flex justify-center">
        <img 
          src={oficazLogo} 
          alt="Oficaz" 
          className="h-4 w-auto lg:h-6 dark:brightness-0 dark:invert"
        />
      </div>
      
      {/* Right Section */}
      <div className="flex items-center justify-end space-x-2 lg:space-x-4">
        {/* Date and Time - Only desktop */}
        <div className="text-sm text-muted-foreground font-medium hidden md:block">
          {formatDate(currentTime)}
        </div>
        
        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 lg:h-10 lg:w-10 rounded-lg">
              <UserAvatar fullName={user?.fullName || ''} size="sm" userId={user?.id} profilePicture={user?.profilePicture} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <div className="flex flex-col space-y-1 p-2">
              <p className="text-sm font-medium text-foreground">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground">{user?.companyEmail}</p>
              <p className="text-xs text-muted-foreground opacity-75 capitalize">{user?.role}</p>
            </div>
            <DropdownMenuItem onClick={logout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
