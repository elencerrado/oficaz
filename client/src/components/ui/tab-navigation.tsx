import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
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
    <div className={`mb-6 ${className}`}>
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-1 relative">
        {/* Sliding indicator */}
        <div 
          className="absolute top-1 bottom-1 bg-white dark:bg-gray-900 rounded-lg shadow-sm transition-all duration-300 ease-in-out border border-gray-200 dark:border-gray-700"
          style={{
            left: `${(activeIndex * 100) / tabs.length}%`,
            width: `${100 / tabs.length}%`,
            transform: 'translateX(0.25rem)',
            right: 'auto',
            marginLeft: '0',
            marginRight: '0.25rem'
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
              <tab.icon className="h-4 w-4 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="truncate">
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">
                  {tab.label === 'Timeline de Vacaciones' ? 'Timeline' :
                   tab.label === 'Empleados de Vacaciones' ? 'Empleados' :
                   tab.label === 'Días Festivos' ? 'Festivos' :
                   tab.label === 'Mi Perfil' ? 'Perfil' :
                   tab.label === 'Explorador' ? 'Archivos' :
                   tab.label === 'Subir Documentos' ? 'Subir' :
                   tab.label === 'Solicitudes' ? 'Solicitudes' :
                   tab.label === 'Políticas' ? 'Políticas' :
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