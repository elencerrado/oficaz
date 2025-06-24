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
      <CardContent className="p-6 min-h-[100px]">
        <div className="flex flex-col space-y-3">
          {/* Primera fila: Icono + Número */}
          <div className="flex items-center space-x-2">
            <div className={`w-6 h-6 ${config.bg} rounded-md flex items-center justify-center flex-shrink-0`}>
              {Icon && <Icon className="w-3 h-3 text-white" />}
            </div>
            <span className="text-xl font-bold text-gray-900">{value}</span>
          </div>
          
          {/* Segunda fila: Texto descriptivo */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}