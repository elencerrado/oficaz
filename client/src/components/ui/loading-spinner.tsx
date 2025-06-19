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

  // Configuración: grosor del contorno = diámetro del círculo interno
  const config = {
    sm: { outerSize: 24, borderWidth: 6, innerSize: 6, gap: 3 },
    md: { outerSize: 32, borderWidth: 8, innerSize: 8, gap: 4 }, 
    lg: { outerSize: 48, borderWidth: 12, innerSize: 12, gap: 6 }
  };

  const currentConfig = config[size];

  return (
    <div className={cn("relative", className)} style={{ 
      width: `${currentConfig.outerSize}px`, 
      height: `${currentConfig.outerSize}px` 
    }}>
      {/* Círculo contorno fijo */}
      <div 
        className="absolute inset-0 rounded-full border-current"
        style={{ borderWidth: `${currentConfig.borderWidth}px` }}
      ></div>
      
      {/* Círculo relleno giratorio interno */}
      <div className="absolute inset-0 animate-spin">
        <div 
          className="absolute bg-current rounded-full"
          style={{
            width: `${currentConfig.innerSize}px`,
            height: `${currentConfig.innerSize}px`,
            top: `${currentConfig.borderWidth + currentConfig.gap}px`,
            left: '50%',
            transform: 'translateX(-50%)'
          }}
        ></div>
      </div>
    </div>
  );
}

export default LoadingSpinner;