import type { BrandConfig } from "./types";

// ============================================
// ORMANDY BRAND CONFIGURATION
// Client: Ormandy Accounting
// ============================================

export const ormandyBrand: BrandConfig = {
  id: "ormandy",
  domain: "ormandy.app",
  
  colors: {
    // Ormandy's signature red
    primary: "#E31B54",
    primaryDark: "#C41848",
    primaryLight: "#F43F6E",
    primaryForeground: "#ffffff",
    
    // Soft coral accent
    accent: "#FBD5C4",
    accentForeground: "#1a1a1a",
    
    // Dark sidebar
    sidebar: "#1e293b",
    sidebarForeground: "#f8fafc",
    sidebarHover: "#334155",
    sidebarActive: "#E31B54",
    
    // Login page
    loginGradientStart: "#b8c9d4",
    loginGradientEnd: "#ffffff",
    loginMosaicColor: "#a8bcc8",
  },
  
  assets: {
    logoComponent: "circle",
    logoText: "ORMANDY",
    faviconUrl: "/favicon.ico",
  },
  
  content: {
    name: "Ormandy",
    tagline: "AI-Powered Accounting",
    shortName: "O",
    
    metaTitle: "Ormandy - AI-Powered Accounting Platform",
    metaDescription: "Streamline your accounting with AI-powered bank statement processing, invoice management, and financial insights.",
    
    companyName: "Ormandy",
    copyrightYear: "2026",
    termsUrl: "/terms",
    privacyUrl: "/privacy",
    supportUrl: "/support",
    supportEmail: "support@ormandy.ai",
    
    labels: {
      dashboard: "Dashboard",
      accounts: "Bank Accounts",
      transactions: "Transactions",
      statements: "Statements",
      invoices: "Invoices",
    },
  },
  
  features: {
    enableInvoices: true,
    enableTeam: true,
    enableAIAssistant: true,
    enableDarkMode: true,
    enableMultiCurrency: true,
    enableExport: true,
    maxTeamMembers: 25,
    maxAccounts: 50,
    maxStatementsPerMonth: 500,
  },
  
  cssPrefix: "ormandy",
};

