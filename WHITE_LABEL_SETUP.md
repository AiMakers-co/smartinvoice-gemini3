# White-Label Setup Guide

This application supports multiple branded versions from a single codebase. Each brand can have its own colors, logos, content, and even separate Firebase projects.

## Quick Start

### 1. Choose Your Brand

Set the brand in your environment:

```bash
# .env.local or .env
NEXT_PUBLIC_BRAND=ormandy    # Client's version
# or
NEXT_PUBLIC_BRAND=finflow    # Your product
```

### 2. Run the App

```bash
npm run dev
```

The entire UI will automatically use the selected brand's colors, logo, and content.

---

## Adding a New Brand

### Step 1: Create Brand Config

Create a new file at `src/config/brands/yourbrand.ts`:

```typescript
import type { BrandConfig } from "./types";

export const yourbrandBrand: BrandConfig = {
  id: "yourbrand",
  
  colors: {
    primary: "#YOUR_PRIMARY_COLOR",
    primaryDark: "#DARKER_SHADE",
    primaryLight: "#LIGHTER_SHADE",
    primaryForeground: "#ffffff",
    
    accent: "#ACCENT_COLOR",
    accentForeground: "#1a1a1a",
    
    sidebar: "#SIDEBAR_BG",
    sidebarForeground: "#SIDEBAR_TEXT",
    sidebarHover: "#SIDEBAR_HOVER",
    sidebarActive: "#YOUR_PRIMARY_COLOR",
    
    loginGradientStart: "#GRADIENT_TOP",
    loginGradientEnd: "#GRADIENT_BOTTOM",
    loginMosaicColor: "#MOSAIC_COLOR",
  },
  
  assets: {
    logoComponent: "circle", // "circle" | "square" | "text-only" | "custom"
    logoText: "YourBrand",
    // logoUrl: "/brands/yourbrand/logo.svg", // For custom logos
  },
  
  content: {
    name: "YourBrand",
    tagline: "Your Tagline Here",
    shortName: "YB",
    companyName: "Your Company Inc.",
    copyrightYear: "2025",
    supportEmail: "support@yourbrand.com",
  },
  
  features: {
    enableInvoices: true,
    enableTeam: true,
    enableAIAssistant: true,
    enableDarkMode: true,
    maxTeamMembers: 10,
    maxAccounts: 20,
  },
};
```

### Step 2: Register the Brand

In `src/config/brands/index.ts`, add your brand:

```typescript
import { yourbrandBrand } from "./yourbrand";

const brands: Record<string, BrandConfig> = {
  ormandy: ormandyBrand,
  finflow: finflowBrand,
  yourbrand: yourbrandBrand,  // Add here
};
```

### Step 3: Set Environment

```bash
NEXT_PUBLIC_BRAND=yourbrand
```

---

## Brand Configuration Options

### Colors

| Property | Description |
|----------|-------------|
| `primary` | Main brand color (buttons, links, highlights) |
| `primaryDark` | Darker shade for hover states |
| `primaryLight` | Lighter shade for backgrounds |
| `primaryForeground` | Text color on primary backgrounds |
| `accent` | Secondary accent color |
| `sidebar` | Sidebar background color |
| `sidebarActive` | Active nav item background |
| `loginGradientStart/End` | Login page gradient colors |

### Logo Options

| Type | Description |
|------|-------------|
| `circle` | Circular logo with dot (Ormandy style) |
| `square` | Square logo with initials |
| `text-only` | Text-only logo |
| `custom` | Custom logo from URL |

### Features Toggles

| Feature | Description |
|---------|-------------|
| `enableInvoices` | Show/hide invoice management |
| `enableTeam` | Show/hide team management |
| `enableAIAssistant` | Enable/disable AI sidebar |
| `enableDarkMode` | Allow dark mode toggle |
| `maxTeamMembers` | Team member limit |
| `maxAccounts` | Bank account limit |

---

## Multi-Firebase Setup

For completely separate data per brand, create separate Firebase projects:

### 1. Create New Firebase Project

```bash
firebase projects:create yourbrand-prod
```

### 2. Set Environment Variables

```bash
# .env.yourbrand (or in your deployment config)
NEXT_PUBLIC_BRAND=yourbrand
NEXT_PUBLIC_FIREBASE_PROJECT_ID=yourbrand-prod
NEXT_PUBLIC_FIREBASE_API_KEY=your-new-api-key
# ... other Firebase config
```

### 3. Deploy Functions

```bash
cd functions
firebase use yourbrand-prod
firebase deploy --only functions
```

---

## Deployment Options

### Option A: Same Hosting, Different Domains

Deploy to same Firebase project but use different domains:

- `app.ormandy.ai` → `NEXT_PUBLIC_BRAND=ormandy`
- `app.finflow.io` → `NEXT_PUBLIC_BRAND=finflow`

### Option B: Separate Projects (Recommended for Production)

Each brand gets its own Firebase project:

```bash
# Deploy Ormandy
NEXT_PUBLIC_BRAND=ormandy npm run build
firebase use ormandy-prod
firebase deploy

# Deploy FinFlow  
NEXT_PUBLIC_BRAND=finflow npm run build
firebase use finflow-prod
firebase deploy
```

### Option C: Vercel/Netlify

Set environment variables per deployment:

```yaml
# vercel.json
{
  "env": {
    "NEXT_PUBLIC_BRAND": "finflow"
  }
}
```

---

## Using Brand in Components

```typescript
import { useBrand } from "@/hooks/use-brand";

function MyComponent() {
  const brand = useBrand();
  
  return (
    <div>
      <h1>Welcome to {brand.content.name}</h1>
      <button style={{ backgroundColor: brand.colors.primary }}>
        Get Started
      </button>
      
      {brand.features.enableInvoices && (
        <InvoiceSection />
      )}
    </div>
  );
}
```

---

## Directory Structure

```
src/
├── config/
│   └── brands/
│       ├── index.ts       # Brand loader & registry
│       ├── types.ts       # TypeScript types
│       ├── ormandy.ts     # Ormandy config
│       └── finflow.ts     # FinFlow config
├── components/
│   └── brand/
│       ├── BrandLogo.tsx  # Dynamic logo component
│       └── BrandStyles.tsx # CSS variable injector
├── hooks/
│   └── use-brand.tsx      # Brand context & hooks
```

---

## Checklist for New Brand

- [ ] Create brand config file
- [ ] Register in index.ts
- [ ] Add logo assets (if custom)
- [ ] Set environment variable
- [ ] Create Firebase project (if separate)
- [ ] Deploy functions to new project
- [ ] Configure custom domain
- [ ] Update SEO metadata
- [ ] Test all features

