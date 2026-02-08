"use client";

import { cn } from "@/lib/utils";
import { useBrand } from "@/hooks/use-brand";
import { ReactNode } from "react";

interface HexagonalCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "primary" | "accent";
  hover?: boolean;
}

/**
 * Hexagonal-styled card component
 * Uses clip-path for hexagonal appearance with brand colors
 */
export function HexagonalCard({ 
  children, 
  className,
  variant = "default",
  hover = true,
}: HexagonalCardProps) {
  const brand = useBrand();
  
  const getColors = () => {
    switch (variant) {
      case "primary":
        return {
          bg: brand.colors.primary + "15",
          border: brand.colors.primary,
        };
      case "accent":
        return {
          bg: brand.colors.accent + "15",
          border: brand.colors.accent,
        };
      default:
        return {
          bg: "white",
          border: "#e2e8f0",
        };
    }
  };
  
  const colors = getColors();
  
  return (
    <div 
      className={cn(
        "relative p-6 rounded-2xl transition-all duration-300",
        hover && "hover:shadow-xl hover:-translate-y-1",
        className
      )}
      style={{
        backgroundColor: colors.bg,
        border: `2px solid ${colors.border}`,
      }}
    >
      {/* Hexagonal accent in corner */}
      <div 
        className="absolute top-4 right-4 w-8 h-8 opacity-10"
        style={{
          backgroundColor: colors.border,
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        }}
      />
      
      {children}
    </div>
  );
}

