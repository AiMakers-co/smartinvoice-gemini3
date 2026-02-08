import type { BrandConfig } from "./types";

// ============================================
// SMARTINVOICE BRAND CONFIGURATION
// Your own product - smartinvoice.finance
// ============================================

export const smartinvoiceBrand: BrandConfig = {
  id: "smartinvoice",
  domain: "smartinvoice.finance",
  
  colors: {
    // Modern teal/cyan primary
    primary: "#0891B2",
    primaryDark: "#0E7490",
    primaryLight: "#22D3EE",
    primaryForeground: "#ffffff",
    
    // Warm amber accent
    accent: "#F59E0B",
    accentForeground: "#1a1a1a",
    
    // Deep navy sidebar
    sidebar: "#0F172A",
    sidebarForeground: "#E2E8F0",
    sidebarHover: "#1E293B",
    sidebarActive: "#0891B2",
    
    // Login page - gradient blues
    loginGradientStart: "#0F172A",
    loginGradientEnd: "#1E293B",
    loginMosaicColor: "#0891B2",
  },
  
  assets: {
    logoComponent: "custom",
    logoUrl: "/branding/smartinvoice-color.png",
    logoUrlWhite: "/branding/smartinvoice-white.png",
    logoIcon: "/branding/logo-icon-only.png",
    logoText: "SmartInvoice",
    faviconUrl: "/favicon.ico",
  },
  
  content: {
    name: "SmartInvoice",
    tagline: "AI-Powered Bank Statement Processing",
    shortName: "SI",
    
    // SEO optimized
    metaTitle: "SmartInvoice - AI Bank Statement Extraction | Gemini 3 Flash Powered",
    metaDescription: "Extract bank statement data in seconds with Gemini 3 Flash AI. 99.2% accuracy, 10,000+ bank formats. Free tier available. Trusted by 1000+ accountants.",
    metaKeywords: "bank statement extraction, AI document processing, Gemini 3 Flash, PDF to CSV, bank reconciliation, QuickBooks integration, Xero sync, financial automation, OCR bank statements",
    
    companyName: "SmartInvoice Ltd",
    copyrightYear: "2026",
    termsUrl: "/terms",
    privacyUrl: "/privacy",
    supportUrl: "/contact",
    supportEmail: "hello@smartinvoice.finance",
    
    // Social proof
    heroStats: {
      accuracy: "99.2%",
      banks: "10,000+",
      pageSpeed: "< 2 sec",
      users: "1,000+",
    },
    
    labels: {
      dashboard: "Overview",
      accounts: "Accounts",
      transactions: "Activity",
      statements: "Statements",
      invoices: "Bills & Invoices",
    },
  },
  
  features: {
    enableInvoices: true,
    enableTeam: true,
    enableAIAssistant: true,
    enableDarkMode: true,
    enableMultiCurrency: true,
    enableExport: true,
    maxTeamMembers: 10,
    maxAccounts: 20,
    maxStatementsPerMonth: 100,
  },
  
  cssPrefix: "smartinvoice",
};

