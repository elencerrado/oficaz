import { useMemo } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Sun, Monitor, Moon, LogOut, User as UserIcon, Shield } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/hooks/use-auth';
import { useEmployeeViewMode } from '@/hooks/use-employee-view-mode';
import { useTheme } from '@/lib/theme-provider';

interface EmployeeTopBarProps {
  homeHref?: string;
}

// Compact top bar reused across employee pages
export function EmployeeTopBar({ homeHref }: EmployeeTopBarProps) {
  const { user, company, logout } = useAuth();
  const { isEmployeeViewMode, disableEmployeeView } = useEmployeeViewMode();
  const { theme, setTheme } = useTheme();

  const companyAlias = company?.companyAlias || (company as any)?.alias || 'inicio';
  const computedHomeHref = homeHref || `/${companyAlias}/inicio`;

  const employeeName = user?.fullName || 'Empleado';
  const companyName = company?.name || 'Mi Empresa';

  const themeIndicatorLeft = useMemo(() => {
    if (theme === 'light') return '2px';
    if (theme === 'system') return 'calc(33.333% + 2px)';
    return 'calc(66.666% + 2px)';
  }, [theme]);

  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-4 h-16 gap-3">
      {/* Back icon only */}
      <Link
        href={computedHomeHref}
        className="text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-300 transition"
        aria-label="Volver"
      >
        <ArrowLeft className="h-6 w-6" strokeWidth={2.5} />
      </Link>

      <div className="flex-1" />

      {/* Avatar + menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex items-center gap-2 px-1 py-1 text-right hover:text-gray-700 dark:hover:text-gray-200 transition">
            <div className="flex flex-col items-end text-right max-w-[140px] leading-tight">
              <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{companyName}</span>
              <span className="text-xs text-gray-600 dark:text-white/70 truncate">{employeeName}</span>
            </div>
            <UserAvatar fullName={employeeName} size="sm" userId={user?.id} profilePicture={user?.profilePicture} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 bg-white dark:bg-white/10 backdrop-blur-xl border border-gray-200 dark:border-white/20 text-gray-900 dark:text-white" align="end" forceMount>
          <div className="flex flex-col space-y-1 p-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{employeeName}</p>
            <p className="text-xs text-gray-600 dark:text-white/70 truncate">{user?.companyEmail || user?.personalEmail || 'Sin email'}</p>
            <p className="text-xs text-gray-500 dark:text-white/60 capitalize">{user?.role || 'empleado'}</p>
          </div>

          <div className="px-3 pb-3">
            <div className="relative bg-white dark:bg-white/10 rounded-full p-1 border border-gray-200 dark:border-white/20">
              <div
                className="absolute top-1 bottom-1 bg-gray-200 dark:bg-white/30 rounded-full transition-all duration-200 shadow-sm"
                style={{ width: 'calc(33.333% - 4px)', left: themeIndicatorLeft }}
              />
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex-1 flex items-center justify-center p-2 rounded-full transition-colors z-10 ${
                    theme === 'light'
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-400 hover:text-gray-600 dark:text-white/50 dark:hover:text-white/80'
                  }`}
                  aria-label="Modo claro"
                >
                  <Sun className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  className={`flex-1 flex items-center justify-center p-2 rounded-full transition-colors z-10 ${
                    theme === 'system'
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-400 hover:text-gray-600 dark:text-white/50 dark:hover:text-white/80'
                  }`}
                  aria-label="Modo sistema"
                >
                  <Monitor className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex-1 flex items-center justify-center p-2 rounded-full transition-colors z-10 ${
                    theme === 'dark'
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-400 hover:text-gray-600 dark:text-white/50 dark:hover:text-white/80'
                  }`}
                  aria-label="Modo oscuro"
                >
                  <Moon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <DropdownMenuItem
            onClick={() => {
              const urlParts = window.location.pathname.split('/').filter((part: string) => part.length > 0);
              const currentCompanyAlias = urlParts[0] || companyAlias;
              window.location.href = `/${currentCompanyAlias}/usuario`;
            }}
            className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 cursor-pointer"
          >
            <UserIcon className="mr-2 h-4 w-4" />
            Mi Perfil
          </DropdownMenuItem>

          {isEmployeeViewMode && (
            <DropdownMenuItem
              onClick={disableEmployeeView}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/20 cursor-pointer"
              data-testid="return-to-manager-mode"
            >
              <Shield className="mr-2 h-4 w-4" />
              Volver a Modo Admin
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => logout()}
            className="text-gray-900 dark:text-white hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/20 cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
