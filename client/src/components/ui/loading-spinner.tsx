import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  const config = {
    xs: { outerSize: 16, borderWidth: 3, innerSize: 5, gap: 1 },
    sm: { outerSize: 24, borderWidth: 4, innerSize: 7, gap: 1 },
    md: { outerSize: 36, borderWidth: 6, innerSize: 10, gap: 2 }, 
    lg: { outerSize: 70, borderWidth: 12, innerSize: 18, gap: 3 }
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
