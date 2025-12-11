import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "blue" | "white" | "auto";
}

export function LoadingSpinner({ 
  className, 
  size = "md",
  variant = "auto"
}: LoadingSpinnerProps) {
  const sizeMap = {
    xs: 12,
    sm: 16,
    md: 24,
    lg: 36,
    xl: 56
  };

  const pixelSize = sizeMap[size];
  
  const colorClass = variant === "auto" 
    ? "text-[#007AFF] dark:text-white" 
    : variant === "blue" 
      ? "text-[#007AFF]" 
      : "text-white";

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 100 100"
      className={cn(colorClass, className)}
    >
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
      />
      <g style={{ transformOrigin: '50px 50px', animation: 'spin 1s linear infinite' }}>
        <circle
          cx="50"
          cy="18"
          r="8"
          fill="currentColor"
        />
      </g>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
}

export default LoadingSpinner;
