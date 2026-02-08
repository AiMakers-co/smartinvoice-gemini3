"use client";

import { createContext, useContext, type ReactNode } from "react";
import { brand as defaultBrand, type BrandConfig } from "@/config/brands";

// ============================================
// BRAND CONTEXT
// Provides brand configuration throughout the app
// ============================================

const BrandContext = createContext<BrandConfig>(defaultBrand);

export function BrandProvider({ 
  children,
  brandOverride 
}: { 
  children: ReactNode;
  brandOverride?: BrandConfig;
}) {
  const activeBrand = brandOverride || defaultBrand;
  
  return (
    <BrandContext.Provider value={activeBrand}>
      {children}
    </BrandContext.Provider>
  );
}

/**
 * Hook to access brand configuration
 * 
 * Usage:
 *   const brand = useBrand();
 *   <h1>{brand.content.name}</h1>
 *   <div style={{ color: brand.colors.primary }}>Styled</div>
 */
export function useBrand(): BrandConfig {
  return useContext(BrandContext);
}

/**
 * Helper to check if a feature is enabled
 * 
 * Usage:
 *   const { isEnabled } = useBrandFeature("enableInvoices");
 */
export function useBrandFeature(feature: keyof BrandConfig["features"]) {
  const brand = useBrand();
  return {
    isEnabled: brand.features[feature] ?? false,
    value: brand.features[feature],
  };
}

