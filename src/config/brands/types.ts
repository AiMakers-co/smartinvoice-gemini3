// ============================================
// WHITE-LABEL BRAND CONFIGURATION TYPES
// ============================================

export interface BrandColors {
  // Primary brand color
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryForeground: string;
  
  // Secondary/accent
  accent: string;
  accentForeground: string;
  
  // Sidebar
  sidebar: string;
  sidebarForeground: string;
  sidebarHover: string;
  sidebarActive: string;
  
  // Backgrounds (optional overrides)
  background?: string;
  foreground?: string;
  card?: string;
  cardForeground?: string;
  muted?: string;
  mutedForeground?: string;
  border?: string;
  
  // Login page specific
  loginGradientStart?: string;
  loginGradientEnd?: string;
  loginMosaicColor?: string;
}

export interface BrandAssets {
  // Logo can be a URL or a React component name
  logoUrl?: string;
  logoUrlWhite?: string; // White version for dark backgrounds
  logoIcon?: string; // Icon-only version
  logoComponent?: "circle" | "square" | "text-only" | "custom";
  logoText?: string;
  faviconUrl?: string;
  
  // Optional background patterns/images
  loginBackgroundUrl?: string;
  dashboardBackgroundUrl?: string;
}

export interface BrandContent {
  // Company/Product info
  name: string;
  tagline: string;
  shortName?: string; // For mobile/collapsed views
  
  // SEO & Meta
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  
  // Legal
  companyName: string;
  copyrightYear?: string;
  termsUrl?: string;
  privacyUrl?: string;
  supportUrl?: string;
  supportEmail?: string;
  
  // Social proof stats
  heroStats?: {
    accuracy?: string;
    banks?: string;
    pageSpeed?: string;
    users?: string;
  };
  
  // Feature labels (for customization)
  labels?: {
    dashboard?: string;
    accounts?: string;
    transactions?: string;
    statements?: string;
    invoices?: string;
  };
}

export interface BrandFirebase {
  projectId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface BrandFeatures {
  // Toggle features on/off per brand
  enableInvoices?: boolean;
  enableTeam?: boolean;
  enableAIAssistant?: boolean;
  enableDarkMode?: boolean;
  enableMultiCurrency?: boolean;
  enableExport?: boolean;
  
  // Limits
  maxTeamMembers?: number;
  maxAccounts?: number;
  maxStatementsPerMonth?: number;
}

export interface BrandConfig {
  id: string;
  colors: BrandColors;
  assets: BrandAssets;
  content: BrandContent;
  firebase?: BrandFirebase; // Optional - can use env vars instead
  features: BrandFeatures;
  
  // Domain for SEO/canonical URLs
  domain?: string;
  
  // Custom CSS class prefix (for brand-specific styles)
  cssPrefix?: string;
}

