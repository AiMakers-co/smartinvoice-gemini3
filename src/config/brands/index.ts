import type { BrandConfig } from "./types";
import { ormandyBrand } from "./ormandy";
import { smartinvoiceBrand } from "./smartinvoice";

// ============================================
// BRAND REGISTRY
// Add new brands here
// ============================================

const brands: Record<string, BrandConfig> = {
  ormandy: ormandyBrand,
  smartinvoice: smartinvoiceBrand,
  // Alias for backwards compatibility
  finflow: smartinvoiceBrand,
};

// ============================================
// BRAND LOADER
// ============================================

/**
 * Get the current brand based on environment variable
 * Set NEXT_PUBLIC_BRAND in your .env file
 * 
 * Example:
 *   NEXT_PUBLIC_BRAND=ormandy      -> Client's version
 *   NEXT_PUBLIC_BRAND=smartinvoice -> Your product (smartinvoice.finance)
 */
export function getBrandId(): string {
  return process.env.NEXT_PUBLIC_BRAND || "ormandy";
}

export function getBrand(): BrandConfig {
  const brandId = getBrandId();
  const brand = brands[brandId];
  
  if (!brand) {
    console.warn(`Brand "${brandId}" not found, falling back to ormandy`);
    return brands.ormandy;
  }
  
  return brand;
}

/**
 * Get all available brands (useful for admin/dev tools)
 */
export function getAllBrands(): BrandConfig[] {
  return Object.values(brands);
}

/**
 * Check if a brand exists
 */
export function brandExists(brandId: string): boolean {
  return brandId in brands;
}

// Export the current brand as a singleton for easy access
export const brand = getBrand();

// Re-export types
export type { BrandConfig, BrandColors, BrandAssets, BrandContent, BrandFeatures } from "./types";
