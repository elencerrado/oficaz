import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  subtitle: string;
  value: number | string;
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
      className={`cursor-pointer hover:shadow-lg transition-all duration-200 border-2 ${config.hover} mb-4 ${className}`}
      onClick={onClick}
    >
      <CardContent className="p-3 h-16 flex flex-col items-center justify-center text-center">
        {/* Layout vertical unificado: icono + número arriba, texto abajo */}
        <div className="flex items-center justify-center space-x-1.5 mb-0.5">
          <div className={`w-5 h-5 md:w-6 md:h-6 ${config.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
            {Icon && <Icon className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" />}
          </div>
          <span className="text-base md:text-lg font-bold text-gray-900">{value}</span>
        </div>
        <div className="min-h-0">
          <p className="text-[10px] md:text-xs font-medium text-gray-600 leading-tight">{title}</p>
          <p className="text-[9px] md:text-[10px] text-gray-500 leading-tight">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}