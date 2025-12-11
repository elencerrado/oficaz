import { cn } from "@/lib/utils";

interface OficazLoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "blue" | "white" | "auto";
}

export function OficazLoader({ 
  className, 
  size = "md", 
  variant = "auto" 
}: OficazLoaderProps) {
  const sizeMap = {
    sm: 24,
    md: 36,
    lg: 56,
    xl: 80
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
      className={cn("animate-spin", colorClass, className)}
      style={{ animationDuration: "1s" }}
    >
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
      />
      <circle
        cx="50"
        cy="18"
        r="8"
        fill="currentColor"
      />
    </svg>
  );
}

export default OficazLoader;
