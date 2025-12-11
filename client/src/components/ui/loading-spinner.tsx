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

  // Configuración: gordito pero con espacio para girar libremente
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
      {/* Círculo contorno fijo - azul primario en modo claro, blanco en modo oscuro */}
      <div 
        className="absolute inset-0 rounded-full border-[#007AFF] dark:border-white"
        style={{ borderWidth: `${currentConfig.borderWidth}px` }}
      ></div>
      
      {/* Círculo relleno giratorio interno - gira en órbita completa */}
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