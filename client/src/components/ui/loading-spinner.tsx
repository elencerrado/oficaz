import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8", 
    lg: "w-12 h-12"
  };

  // Configuración: más espacio para que el círculo gire libremente
  const config = {
    sm: { outerSize: 32, borderWidth: 4, innerSize: 4, gap: 6 },
    md: { outerSize: 40, borderWidth: 5, innerSize: 5, gap: 7.5 }, 
    lg: { outerSize: 56, borderWidth: 7, innerSize: 7, gap: 10.5 }
  };

  const currentConfig = config[size];

  return (
    <div className={cn("relative", className)} style={{ 
      width: `${currentConfig.outerSize}px`, 
      height: `${currentConfig.outerSize}px` 
    }}>
      {/* Círculo contorno fijo - blanco en fondo oscuro, oscuro en fondo claro */}
      <div 
        className="absolute inset-0 rounded-full border-white dark:border-gray-800"
        style={{ borderWidth: `${currentConfig.borderWidth}px` }}
      ></div>
      
      {/* Círculo relleno giratorio interno - gira en órbita completa */}
      <div className="absolute inset-0 animate-spin">
        <div 
          className="absolute bg-white dark:bg-gray-800 rounded-full"
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