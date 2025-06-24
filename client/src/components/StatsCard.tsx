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
      <CardContent className="p-6 flex items-center justify-center min-h-[100px]">
        <div className="flex items-center space-x-4 w-full">
          <div className={`w-12 h-12 ${config.bg} rounded-lg shadow-sm flex items-center justify-center flex-shrink-0`}>
            <span className="text-xl font-bold text-white">{value}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}