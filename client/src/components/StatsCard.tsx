import { LucideIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface StatsCardProps {
  label?: string;
  title?: string;
  subtitle?: string;
  value: number | string;
  color: 'yellow' | 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'amber' | 'emerald' | 'cyan' | 'pink' | 'indigo';
  icon: LucideIcon;
  onClick?: () => void;
  onDoubleClick?: () => void;
  className?: string;
  isActive?: boolean;
  isLoading?: boolean;
  index?: number;
  'data-testid'?: string;
}

const colorConfig = {
  yellow: {
    iconBg: 'bg-yellow-100 dark:bg-yellow-900',
    iconText: 'text-yellow-600 dark:text-yellow-400',
    activeBorder: 'border-yellow-400 dark:border-yellow-500',
  },
  amber: {
    iconBg: 'bg-amber-100 dark:bg-amber-900',
    iconText: 'text-amber-600 dark:text-amber-400',
    activeBorder: 'border-amber-400 dark:border-amber-500',
  },
  green: {
    iconBg: 'bg-green-100 dark:bg-green-900',
    iconText: 'text-green-600 dark:text-green-400',
    activeBorder: 'border-green-400 dark:border-green-500',
  },
  emerald: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-900',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    activeBorder: 'border-emerald-400 dark:border-emerald-500',
  },
  blue: {
    iconBg: 'bg-blue-100 dark:bg-blue-900',
    iconText: 'text-blue-600 dark:text-blue-400',
    activeBorder: 'border-blue-400 dark:border-blue-500',
  },
  cyan: {
    iconBg: 'bg-cyan-100 dark:bg-cyan-900',
    iconText: 'text-cyan-600 dark:text-cyan-400',
    activeBorder: 'border-cyan-400 dark:border-cyan-500',
  },
  purple: {
    iconBg: 'bg-purple-100 dark:bg-purple-900',
    iconText: 'text-purple-600 dark:text-purple-400',
    activeBorder: 'border-purple-400 dark:border-purple-500',
  },
  indigo: {
    iconBg: 'bg-indigo-100 dark:bg-indigo-900',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    activeBorder: 'border-indigo-400 dark:border-indigo-500',
  },
  pink: {
    iconBg: 'bg-pink-100 dark:bg-pink-900',
    iconText: 'text-pink-600 dark:text-pink-400',
    activeBorder: 'border-pink-400 dark:border-pink-500',
  },
  orange: {
    iconBg: 'bg-orange-100 dark:bg-orange-900',
    iconText: 'text-orange-600 dark:text-orange-400',
    activeBorder: 'border-orange-400 dark:border-orange-500',
  },
  red: {
    iconBg: 'bg-red-100 dark:bg-red-900',
    iconText: 'text-red-600 dark:text-red-400',
    activeBorder: 'border-red-400 dark:border-red-500',
  }
};

function useCountAnimation(targetValue: number | string, isLoading: boolean, delay: number = 0) {
  const [displayValue, setDisplayValue] = useState<string>(String(targetValue));
  const wasLoading = useRef(isLoading);
  const hasAnimated = useRef(false);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (wasLoading.current && !isLoading && !hasAnimated.current) {
      hasAnimated.current = true;
      const valueStr = String(targetValue);
      const numericMatch = valueStr.match(/^([\d.]+)/);
      
      if (numericMatch) {
        const targetNum = parseFloat(numericMatch[1]);
        const suffix = valueStr.slice(numericMatch[1].length);
        const hasDecimal = numericMatch[1].includes('.');
        const duration = 600;
        const startTime = performance.now() + delay;
        
        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          
          if (elapsed < 0) {
            setDisplayValue('0' + suffix);
            animationRef.current = requestAnimationFrame(animate);
            return;
          }
          
          const progress = Math.min(elapsed / duration, 1);
          const easeOut = 1 - Math.pow(1 - progress, 3);
          const currentNum = targetNum * easeOut;
          
          if (hasDecimal) {
            setDisplayValue(currentNum.toFixed(1) + suffix);
          } else {
            setDisplayValue(Math.round(currentNum) + suffix);
          }
          
          if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
          } else {
            setDisplayValue(valueStr);
          }
        };
        
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(valueStr);
      }
    } else if (!isLoading && !wasLoading.current) {
      setDisplayValue(String(targetValue));
    }
    
    wasLoading.current = isLoading;
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, isLoading, delay]);

  if (isLoading) {
    return '-';
  }
  
  return displayValue;
}

export default function StatsCard({ 
  label,
  title,
  subtitle,
  value, 
  color, 
  icon: Icon, 
  onClick,
  onDoubleClick,
  className = '',
  isActive = false,
  isLoading = false,
  index = 0,
  'data-testid': dataTestId,
}: StatsCardProps) {
  const config = colorConfig[color];
  const animatedValue = useCountAnimation(value, isLoading, index * 100);
  const displayLabel = label || title || '';

  return (
    <Card 
      className={`dark:bg-gray-800 cursor-pointer transition-all duration-200 hover:shadow-md border ${
        isActive ? config.activeBorder : 'border-gray-200 dark:border-gray-700'
      } ${isLoading ? `stats-wave-loading stats-wave-${index}` : ''} ${className}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      data-testid={dataTestId}
    >
      <CardContent className="p-2 md:pt-4 md:pb-3 md:px-4">
        {/* Mobile: vertical compact layout */}
        <div className="flex flex-col items-center text-center md:hidden">
          <div className={`p-1 ${config.iconBg} rounded-md mb-1 ${isLoading ? 'opacity-50' : ''}`}>
            <Icon className={`h-3 w-3 ${config.iconText}`} />
          </div>
          <p className={`text-sm font-bold dark:text-white leading-tight ${isLoading ? 'opacity-50' : ''}`}>{animatedValue}</p>
          <p className={`text-[8px] text-gray-500 dark:text-gray-400 leading-tight ${isLoading ? 'opacity-50' : ''}`}>{displayLabel}</p>
        </div>
        {/* Desktop: horizontal layout */}
        <div className="hidden md:flex items-center gap-3">
          <div className={`p-2 ${config.iconBg} rounded-lg ${isLoading ? 'opacity-50' : ''}`}>
            <Icon className={`h-5 w-5 ${config.iconText}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-2xl font-bold dark:text-white ${isLoading ? 'opacity-50' : ''}`}>{animatedValue}</p>
            <p className={`text-xs text-gray-500 dark:text-gray-400 truncate ${isLoading ? 'opacity-50' : ''}`}>{displayLabel}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatsCardGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function StatsCardGrid({ children, columns = 4, className = '' }: StatsCardGridProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-1 md:gap-4 mb-3 ${className}`}>
      {children}
    </div>
  );
}
