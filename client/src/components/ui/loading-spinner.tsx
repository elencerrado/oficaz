import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "button";
}

export function LoadingSpinner({ className, size = "md", variant = "default" }: LoadingSpinnerProps) {
  if (variant === "button") {
    const buttonSizes = {
      sm: "w-3 h-3 border-[2px]",
      md: "w-4 h-4 border-2",
      lg: "w-5 h-5 border-2"
    };
    
    return (
      <div 
        className={cn(
          "rounded-full animate-spin border-current border-t-transparent",
          buttonSizes[size],
          className
        )}
      />
    );
  }

  const config = {
    sm: { outerSize: 28, borderWidth: 5, innerSize: 5, gap: 4 },
    md: { outerSize: 36, borderWidth: 6, innerSize: 6, gap: 6 }, 
    lg: { outerSize: 70, borderWidth: 13, innerSize: 18, gap: 5 }
  };

  const currentConfig = config[size];

  return (
    <div className={cn("relative", className)} style={{ 
      width: `${currentConfig.outerSize}px`, 
      height: `${currentConfig.outerSize}px` 
    }}>
      <div 
        className="absolute inset-0 rounded-full border-[#007AFF] dark:border-white"
        style={{ borderWidth: `${currentConfig.borderWidth}px` }}
      ></div>
      
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
        ></div>
      </div>
    </div>
  );
}

export default LoadingSpinner;
