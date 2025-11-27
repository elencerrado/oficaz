import { LucideIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface StatsCardProps {
  title: string;
  subtitle: string;
  value: number | string;
  color: 'yellow' | 'green' | 'blue' | 'purple' | 'orange' | 'red';
  icon?: LucideIcon;
  onClick?: () => void;
  className?: string;
  isActive?: boolean;
  isLoading?: boolean;
  index?: number;
}

const colorConfig = {
  yellow: {
    bg: 'bg-yellow-500',
    hover: 'hover:border-yellow-200 dark:hover:border-yellow-400',
    activeBorder: 'border-yellow-400 dark:border-yellow-300',
    activeBg: 'bg-yellow-50 dark:bg-yellow-900/20'
  },
  green: {
    bg: 'bg-green-500',
    hover: 'hover:border-green-200 dark:hover:border-green-400',
    activeBorder: 'border-green-400 dark:border-green-300',
    activeBg: 'bg-green-50 dark:bg-green-900/20'
  },
  blue: {
    bg: 'bg-blue-500',
    hover: 'hover:border-blue-200 dark:hover:border-blue-400',
    activeBorder: 'border-blue-400 dark:border-blue-300',
    activeBg: 'bg-blue-50 dark:bg-blue-900/20'
  },
  purple: {
    bg: 'bg-purple-500',
    hover: 'hover:border-purple-200 dark:hover:border-purple-400',
    activeBorder: 'border-purple-400 dark:border-purple-300',
    activeBg: 'bg-purple-50 dark:bg-purple-900/20'
  },
  orange: {
    bg: 'bg-orange-500',
    hover: 'hover:border-orange-200 dark:hover:border-orange-400',
    activeBorder: 'border-orange-400 dark:border-orange-300',
    activeBg: 'bg-orange-50 dark:bg-orange-900/20'
  },
  red: {
    bg: 'bg-red-500',
    hover: 'hover:border-red-200 dark:hover:border-red-400',
    activeBorder: 'border-red-400 dark:border-red-300',
    activeBg: 'bg-red-50 dark:bg-red-900/20'
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
    return '0';
  }
  
  return displayValue;
}

export default function StatsCard({ 
  title, 
  subtitle, 
  value, 
  color, 
  icon: Icon, 
  onClick,
  className = '',
  isActive = false,
  isLoading = false,
  index = 0
}: StatsCardProps) {
  const config = colorConfig[color];
  const animatedValue = useCountAnimation(value, isLoading, index * 100);
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) {
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`rounded-lg text-card-foreground cursor-pointer hover:shadow-lg transition-all duration-200 border-2 ${
        isActive 
          ? `${config.activeBorder} ${config.activeBg} shadow-md` 
          : `${config.hover}`
      } mb-4 ${className} bg-card shadow-sm ${isLoading ? `stats-wave-loading stats-wave-${index}` : ''}`}
      onClick={handleClick}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onClick) onClick();
        }
      }}
    >
      <div className="p-3 h-24 sm:h-20 flex flex-col items-center text-center overflow-hidden">
        {/* Layout móvil: ícono arriba, número en medio, texto abajo */}
        <div className="sm:hidden flex flex-col justify-between h-full py-1">
          <div className="flex justify-center">
            <div className={`w-5 h-5 ${config.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
              {Icon && <Icon className="w-2.5 h-2.5 text-white" />}
            </div>
          </div>
          <div className="flex justify-center">
            <span className="text-lg font-bold text-foreground">{animatedValue}</span>
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-[8px] font-medium text-muted-foreground leading-none">{title}</p>
          </div>
        </div>

        {/* Layout desktop: ícono + número horizontal */}
        <div className="hidden sm:flex items-center justify-center space-x-1.5 flex-grow">
          <div className={`w-6 h-6 ${config.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
            {Icon && <Icon className="w-3 h-3 text-white" />}
          </div>
          <span className="text-xl font-bold text-foreground">{animatedValue}</span>
        </div>

        <div className="hidden sm:flex flex-col items-center justify-center">
          <p className="text-xs font-medium text-muted-foreground leading-none">{title}</p>
          <p className="text-[10px] text-muted-foreground opacity-75 leading-none">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
