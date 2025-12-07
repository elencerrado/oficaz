import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function TabNavigation({ tabs, activeTab, onTabChange, className = "" }: TabNavigationProps) {
  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
  
  return (
    <div className={`mb-3 ${className}`}>
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 relative">
        {/* Sliding indicator */}
        <div 
          className="absolute top-1 bottom-1 bg-white dark:bg-gray-900 rounded-md shadow-sm transition-all duration-300 ease-in-out border border-gray-200 dark:border-gray-700"
          style={{
            left: `calc(${(activeIndex * 100) / tabs.length}% + 4px)`,
            width: `calc(${100 / tabs.length}% - 8px)`
          }}
        />
        
        {/* Tab buttons */}
        <nav className="relative flex">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 py-3 px-2 sm:px-4 font-medium text-xs sm:text-sm transition-colors duration-200 relative z-10 flex items-center justify-center ${
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="relative">
                <tab.icon className="h-4 w-4 flex-shrink-0" />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </div>
              <span className="truncate ml-1 sm:ml-2">
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">
                  {tab.label === 'Días Festivos' ? 'Festivos' :
                   tab.label === 'Mi Perfil' ? 'Perfil' :
                   tab.label === 'Mi Cuenta' ? 'Cuenta' :
                   tab.label === 'Subir Documentos' ? 'Subir' :
                   tab.label === 'Pedir Documentos' ? 'Pedir' :
                   tab.label === 'Archivos' ? 'Archivos' :
                   tab.label === 'Configuración' ? 'Config' :
                   tab.label}
                </span>
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}