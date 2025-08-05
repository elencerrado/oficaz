import { memo } from 'react';
import { cn } from "@/lib/utils";

interface PerformanceSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Componente optimizado de spinner usando CSS puro
export const PerformanceSpinner = memo(function PerformanceSpinner({ 
  size = 'md', 
  className 
}: PerformanceSpinnerProps) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3'
  };

  return (
    <div 
      className={cn(
        "animate-spin rounded-full border-blue-500 border-t-transparent",
        sizeClasses[size],
        className
      )}
    />
  );
});