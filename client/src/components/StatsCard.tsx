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
        {/* Desktop: Layout horizontal con icono + número + texto en línea */}
        <div className="hidden md:flex md:items-center md:space-x-3">
          <div className={`w-8 h-8 ${config.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
            {Icon && <Icon className="w-4 h-4 text-white" />}
          </div>
          <span className="text-2xl font-bold text-gray-900">{value}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>

        {/* Mobile: Layout centrado simplificado igual que vacaciones */}
        <div className="md:hidden text-center">
          <div className="flex items-center justify-center space-x-1 mb-1">
            <div className={`w-4 h-4 ${config.bg} rounded-full flex items-center justify-center`}>
              {Icon && <Icon className="w-2 h-2 text-white" />}
            </div>
            <span className="text-xs font-bold text-gray-900">{value}</span>
          </div>
          <p className="text-[10px] font-medium text-gray-600 leading-tight">{subtitle.length > 8 ? subtitle.substring(0, 6) + '.' : subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}