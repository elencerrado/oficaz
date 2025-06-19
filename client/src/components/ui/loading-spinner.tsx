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

  const borderClasses = {
    sm: "border-2",
    md: "border-2",
    lg: "border-[3px]"
  };

  const dotSizeClasses = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-4 h-4"
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      {/* Outer ring - white/light colored */}
      <div className={cn(
        "absolute inset-0 rounded-full border-white/80",
        borderClasses[size]
      )}></div>
      
      {/* Rotating inner dot - dark */}
      <div className="absolute inset-0 animate-spin">
        <div className={cn(
          "absolute bg-gray-800 rounded-full",
          dotSizeClasses[size]
        )} style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) translateY(-120%)'
        }}></div>
      </div>
    </div>
  );
}

export default LoadingSpinner;