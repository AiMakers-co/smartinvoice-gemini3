"use client";

import { useBrand } from "@/hooks/use-brand";
import { cn } from "@/lib/utils";

interface LoadingHexagonProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Brand-specific loading spinner using hexagonal shape
 */
export function LoadingHexagon({ size = "md", className }: LoadingHexagonProps) {
  const brand = useBrand();
  
  const sizeMap = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };
  
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div 
        className={cn(sizeMap[size], "animate-spin")}
        style={{
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          background: `conic-gradient(from 0deg, ${brand.colors.primary}, ${brand.colors.accent}, ${brand.colors.primary})`,
        }}
      />
    </div>
  );
}

