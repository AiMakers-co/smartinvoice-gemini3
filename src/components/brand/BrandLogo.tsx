"use client";

import { useBrand } from "@/hooks/use-brand";
import { cn } from "@/lib/utils";

// ============================================
// BRAND LOGO COMPONENT
// Renders the appropriate logo based on brand config
// ============================================

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
  collapsed?: boolean;
  variant?: "default" | "white" | "dark";
}

export function BrandLogo({ 
  size = "md", 
  showText = true,
  className,
  collapsed = false,
  variant = "default",
}: BrandLogoProps) {
  const brand = useBrand();
  
  const sizeMap = {
    sm: { icon: "h-8 w-8", dot: "h-2 w-2", text: "text-sm" },
    md: { icon: "h-10 w-10", dot: "h-2.5 w-2.5", text: "text-base" },
    lg: { icon: "h-12 w-12", dot: "h-3.5 w-3.5", text: "text-xl" },
  };
  
  const sizes = sizeMap[size];
  
  // Circle logo (Ormandy style)
  if (brand.assets.logoComponent === "circle") {
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        <div 
          className={cn(sizes.icon, "rounded-full flex items-center justify-center flex-shrink-0")}
          style={{ backgroundColor: brand.colors.primary }}
        >
          <div 
            className={cn(sizes.dot, "rounded-full")}
            style={{ backgroundColor: brand.colors.primaryForeground }}
          />
        </div>
        {showText && !collapsed && (
          <span className={cn(sizes.text, "font-bold tracking-tight")}>
            {brand.assets.logoText || brand.content.name.toUpperCase()}
          </span>
        )}
      </div>
    );
  }
  
  // Square logo (FinFlow style)
  if (brand.assets.logoComponent === "square") {
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        <div 
          className={cn(sizes.icon, "rounded-lg flex items-center justify-center flex-shrink-0")}
          style={{ backgroundColor: brand.colors.primary }}
        >
          <span 
            className="font-bold text-xs"
            style={{ color: brand.colors.primaryForeground }}
          >
            {brand.content.shortName || brand.content.name.charAt(0)}
          </span>
        </div>
        {showText && !collapsed && (
          <span className={cn(sizes.text, "font-bold tracking-tight")}>
            {brand.assets.logoText || brand.content.name}
          </span>
        )}
      </div>
    );
  }
  
  // Text only
  if (brand.assets.logoComponent === "text-only") {
    return (
      <div className={cn("flex items-center", className)}>
        <span 
          className={cn(sizes.text, "font-bold tracking-tight")}
          style={{ color: brand.colors.primary }}
        >
          {brand.assets.logoText || brand.content.name}
        </span>
      </div>
    );
  }
  
  // Custom logo URL (full horizontal wordmark)
  if (brand.assets.logoUrl) {
    // Determine which logo to use based on variant
    let logoSrc = brand.assets.logoUrl;
    if (variant === "white" && (brand.assets as any).logoUrlWhite) {
      logoSrc = (brand.assets as any).logoUrlWhite;
    } else if (variant === "dark" && (brand.assets as any).logoUrlDark) {
      logoSrc = (brand.assets as any).logoUrlDark;
    }
    
    // If collapsed, show clipped start of logo (the "S" icon part)
    if (collapsed) {
      return (
        <div className={cn("flex items-center overflow-hidden", className)} style={{ width: "40px" }}>
          <img 
            src={logoSrc} 
            alt={brand.content.name}
            className="h-10 w-auto object-contain object-left flex-shrink-0"
          />
        </div>
      );
    }
    
    // Full horizontal wordmark
    return (
      <div className={cn("flex items-center", className)}>
        <img 
          src={logoSrc} 
          alt={brand.content.name}
          className="h-10 w-auto object-contain flex-shrink-0"
        />
      </div>
    );
  }
  
  // Fallback to text
  return (
    <div className={cn("flex items-center", className)}>
      <span className={cn(sizes.text, "font-bold tracking-tight")}>
        {brand.content.name}
      </span>
    </div>
  );
}

