import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  const config = {
    xs: { outerSize: 16, borderWidth: 3, innerSize: 3, gap: 2 },
    sm: { outerSize: 24, borderWidth: 4, innerSize: 4, gap: 3 },
    md: { outerSize: 36, borderWidth: 6, innerSize: 6, gap: 5 }, 
    lg: { outerSize: 70, borderWidth: 12, innerSize: 12, gap: 8 }
  };

  const currentConfig = config[size];

  return (
    <div className={cn("relative flex-shrink-0", className)} style={{ 
      width: `${currentConfig.outerSize}px`, 
      height: `${currentConfig.outerSize}px` 
    }}>
      <div 
        className="absolute inset-0 rounded-full border-[#007AFF] dark:border-white"
        style={{ borderWidth: `${currentConfig.borderWidth}px` }}
      />
      
      <div className="absolute inset-0 animate-spin">
        <div 
          className="absolute bg-[#007AFF] dark:bg-white rounded-full"
          style={{
            width: `${currentConfig.innerSize}px`,
            height: `${currentConfig.innerSize}px`,
            top: `${currentConfig.borderWidth}px`,
            left: '50%',
            transform: `translateX(-50%) translateY(${currentConfig.gap}px)`
          }}
        />
      </div>
    </div>
  );
}

export default LoadingSpinner;
