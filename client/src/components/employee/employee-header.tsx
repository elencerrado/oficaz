import { Button } from '@/components/ui/button';
import { Sun, Moon, Monitor, LogOut } from 'lucide-react';

export interface EmployeeHeaderProps {
  userName: string;
  userRole: string;
  userEmail: string;
  currentTheme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  onLogout: () => void;
}

export function EmployeeHeader({
  userName,
  userRole,
  userEmail,
  currentTheme,
  onThemeChange,
  onLogout,
}: EmployeeHeaderProps) {
  const themeOptions = [
    { icon: Sun, label: 'Claro', value: 'light' as const },
    { icon: Monitor, label: 'Sistema', value: 'system' as const },
    { icon: Moon, label: 'Oscuro', value: 'dark' as const },
  ];

  return (
    <div className="flex justify-between items-center py-2 px-4 border-b border-gray-200 dark:border-gray-700 mb-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">{userName}</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {userRole} • {userEmail}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <div className="flex gap-1 p-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
          {themeOptions.map(({ icon: Icon, label, value }) => (
            <button
              type="button"
              key={value}
              onClick={() => onThemeChange(value)}
              className={`p-2 rounded transition-colors ${
                currentTheme === value
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <Button
          type="button"
          onClick={onLogout}
          variant="ghost"
          size="sm"
          className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
