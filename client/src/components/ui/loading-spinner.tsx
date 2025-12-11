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
    xs: 16,
    sm: 20,
    md: 28,
    lg: 40,
    xl: 64
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
        r="39"
        fill="none"
        stroke="currentColor"
        strokeWidth="22"
      />
      <g className="animate-spin" style={{ transformOrigin: '50px 50px' }}>
        <circle
          cx="50"
          cy="18"
          r="11"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}

export default LoadingSpinner;
