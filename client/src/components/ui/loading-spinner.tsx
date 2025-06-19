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

  // Proporción armónica: el grosor del borde y el punto central deben ser proporcionales
  const config = {
    sm: { borderWidth: 6, dotSize: 6 },
    md: { borderWidth: 8, dotSize: 8 }, 
    lg: { borderWidth: 12, dotSize: 12 }
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      {/* Outer ring - grosor proporcional */}
      <div 
        className="absolute inset-0 rounded-full border-white/80"
        style={{ borderWidth: `${config[size].borderWidth}px` }}
      ></div>
      
      {/* Rotating inner dot - mismo grosor que el borde */}
      <div className="absolute inset-0 animate-spin">
        <div 
          className="absolute bg-gray-800 rounded-full"
          style={{
            width: `${config[size].dotSize}px`,
            height: `${config[size].dotSize}px`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) translateY(-130%)'
          }}
        ></div>
      </div>
    </div>
  );
}

export default LoadingSpinner;