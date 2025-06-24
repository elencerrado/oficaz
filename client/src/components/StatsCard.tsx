import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  subtitle: string;
  value: number;
  color: 'yellow' | 'green' | 'blue' | 'purple' | 'orange' | 'red';
  icon?: LucideIcon;
  onClick?: () => void;
  className?: string;
}

const colorConfig = {
  yellow: {
    bg: 'bg-yellow-500',
    hover: 'hover:border-yellow-200'
  },
  green: {
    bg: 'bg-green-500',
    hover: 'hover:border-green-200'
  },
  blue: {
    bg: 'bg-blue-500',
    hover: 'hover:border-blue-200'
  },
  purple: {
    bg: 'bg-purple-500',
    hover: 'hover:border-purple-200'
  },
  orange: {
    bg: 'bg-orange-500',
    hover: 'hover:border-orange-200'
  },
  red: {
    bg: 'bg-red-500',
    hover: 'hover:border-red-200'
  }
};

export default function StatsCard({ 
  title, 
  subtitle, 
  value, 
  color, 
  icon: Icon, 
  onClick,
  className = ''
}: StatsCardProps) {
  const config = colorConfig[color];
  
  return (
    <Card 
      className={`cursor-pointer hover:shadow-lg transition-all duration-200 border-2 ${config.hover} ${className}`}
      onClick={onClick}
    >
      <CardContent className="p-4 md:min-h-[80px]">
        {/* Desktop: Layout vertical con icono + número arriba, texto abajo */}
        <div className="hidden md:flex md:flex-col md:space-y-2">
          {/* Primera fila: Icono + Número */}
          <div className="flex items-center space-x-2">
            <div className={`w-5 h-5 ${config.bg} rounded-md flex items-center justify-center flex-shrink-0`}>
              {Icon && <Icon className="w-3 h-3 text-white" />}
            </div>
            <span className="text-lg font-bold text-gray-900">{value}</span>
          </div>
          
          {/* Segunda fila: Texto descriptivo */}
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-gray-600">{title}</p>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>

        {/* Mobile: Layout centrado simplificado igual que vacaciones */}
        <div className="md:hidden text-center">
          <div className="flex items-center justify-center space-x-1 mb-1">
            <div className={`w-4 h-4 ${config.bg} rounded flex items-center justify-center`}>
              {Icon && <Icon className="w-2 h-2 text-white" />}
            </div>
            <span className="text-xs font-bold text-gray-900">{value}</span>
          </div>
          <p className="text-[10px] font-medium text-gray-600 leading-tight">{title.length > 8 ? title.substring(0, 6) + '.' : title}</p>
        </div>
      </CardContent>
    </Card>
  );
}