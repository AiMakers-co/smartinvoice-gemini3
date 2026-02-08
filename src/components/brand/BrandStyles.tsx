"use client";

import { useBrand } from "@/hooks/use-brand";

// ============================================
// BRAND STYLES COMPONENT
// Injects CSS variables based on brand config
// ============================================

export function BrandStyles() {
  const brand = useBrand();
  
  // Generate CSS variables from brand colors
  const cssVariables = `
    :root {
      /* Brand Primary */
      --brand-primary: ${brand.colors.primary};
      --brand-primary-dark: ${brand.colors.primaryDark};
      --brand-primary-light: ${brand.colors.primaryLight};
      --brand-primary-foreground: ${brand.colors.primaryForeground};
      
      /* Brand Accent */
      --brand-accent: ${brand.colors.accent};
      --brand-accent-foreground: ${brand.colors.accentForeground};
      
      /* Sidebar */
      --brand-sidebar: ${brand.colors.sidebar};
      --brand-sidebar-foreground: ${brand.colors.sidebarForeground};
      --brand-sidebar-hover: ${brand.colors.sidebarHover};
      --brand-sidebar-active: ${brand.colors.sidebarActive};
      
      /* Login */
      --brand-login-gradient-start: ${brand.colors.loginGradientStart || brand.colors.primary};
      --brand-login-gradient-end: ${brand.colors.loginGradientEnd || "#ffffff"};
      --brand-login-mosaic: ${brand.colors.loginMosaicColor || brand.colors.primary};
      
      /* Override semantic colors */
      --color-primary: ${brand.colors.primary};
      --color-primary-foreground: ${brand.colors.primaryForeground};
      --color-ring: ${brand.colors.primary};
      --color-sidebar: ${brand.colors.sidebar};
      --color-sidebar-foreground: ${brand.colors.sidebarForeground};
      --color-sidebar-hover: ${brand.colors.sidebarHover};
      --color-sidebar-active: ${brand.colors.sidebarActive};
    }
    
    /* Brand-specific utility classes */
    .brand-bg-primary { background-color: ${brand.colors.primary}; }
    .brand-bg-primary-dark { background-color: ${brand.colors.primaryDark}; }
    .brand-bg-primary-light { background-color: ${brand.colors.primaryLight}; }
    .brand-bg-sidebar { background-color: ${brand.colors.sidebar}; }
    
    .brand-text-primary { color: ${brand.colors.primary}; }
    .brand-text-primary-dark { color: ${brand.colors.primaryDark}; }
    .brand-text-primary-light { color: ${brand.colors.primaryLight}; }
    
    .brand-border-primary { border-color: ${brand.colors.primary}; }
    
    /* Active nav item */
    .brand-nav-active {
      background-color: ${brand.colors.sidebarActive};
      color: ${brand.colors.primaryForeground};
    }
  `;
  
  return <style dangerouslySetInnerHTML={{ __html: cssVariables }} />;
}

