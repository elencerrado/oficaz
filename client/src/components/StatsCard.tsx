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
  isActive?: boolean;
}

const colorConfig = {
  yellow: {
    bg: 'bg-yellow-500',
    hover: 'hover:border-yellow-200',
    activeBorder: 'border-yellow-400',
    activeBg: 'bg-yellow-50'
  },
  green: {
    bg: 'bg-green-500',
    hover: 'hover:border-green-200',
    activeBorder: 'border-green-400',
    activeBg: 'bg-green-50'
  },
  blue: {
    bg: 'bg-blue-500',
    hover: 'hover:border-blue-200',
    activeBorder: 'border-blue-400',
    activeBg: 'bg-blue-50'
  },
  purple: {
    bg: 'bg-purple-500',
    hover: 'hover:border-purple-200',
    activeBorder: 'border-purple-400',
    activeBg: 'bg-purple-50'
  },
  orange: {
    bg: 'bg-orange-500',
    hover: 'hover:border-orange-200',
    activeBorder: 'border-orange-400',
    activeBg: 'bg-orange-50'
  },
  red: {
    bg: 'bg-red-500',
    hover: 'hover:border-red-200',
    activeBorder: 'border-red-400',
    activeBg: 'bg-red-50'
  }
};

export default function StatsCard({ 
  title, 
  subtitle, 
  value, 
  color, 
  icon: Icon, 
  onClick,
  className = '',
  isActive = false
}: StatsCardProps) {
  const config = colorConfig[color];
  
  return (
    <Card 
      className={`cursor-pointer hover:shadow-lg transition-all duration-200 border-2 ${
        isActive 
          ? `${config.activeBorder} ${config.activeBg} shadow-md` 
          : `${config.hover}`
      } mb-4 ${className}`}
      onClick={onClick}
    >
      <CardContent className="p-3 h-20 flex flex-col justify-between items-center text-center overflow-hidden">
        {/* Layout vertical unificado: icono + número arriba, texto abajo */}
        <div className="flex items-center justify-center space-x-1.5">
          <div className={`w-5 h-5 md:w-6 md:h-6 ${config.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
            {Icon && <Icon className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" />}
          </div>
          <span className="text-base md:text-lg font-bold text-gray-900">{value}</span>
        </div>
        <div className="flex flex-col items-center justify-center">
          <p className="text-[10px] md:text-xs font-medium text-gray-600 leading-none">{title}</p>
          <p className="text-[9px] md:text-[10px] text-gray-500 leading-none">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}