# SmartInvoice Brand Assets - Generation Plan

Based on: **abstract-wordmark-horizontal.png** (Geometric hexagonal SI icon + wordmark)

---

## 📦 CORE LOGO ASSETS

### Primary Logos
- [x] `logo-horizontal.png` - Full wordmark (icon + text) - 2000x500px
- [ ] `logo-icon-only.png` - Just the hexagonal SI icon - 1024x1024px
- [ ] `logo-vertical.png` - Icon stacked above text - 800x1000px
- [ ] `logo-icon-text-vertical.png` - Icon on top, text below, centered

### Logo Variations (Color)
- [ ] `logo-horizontal-white.png` - White version for dark backgrounds
- [ ] `logo-icon-white.png` - White icon only
- [ ] `logo-horizontal-dark.png` - Dark navy version
- [ ] `logo-horizontal-monotone-teal.png` - All teal, no amber accent
- [ ] `logo-horizontal-reversed.png` - Amber primary, teal accent

---

## 🌐 WEB & FAVICON ASSETS

### Favicons
- [ ] `favicon.ico` - Multi-size ICO (16x16, 32x32, 48x48)
- [ ] `favicon-16x16.png` - Tiny icon
- [ ] `favicon-32x32.png` - Small icon
- [ ] `favicon-96x96.png` - Standard icon

### Apple/iOS
- [ ] `apple-touch-icon.png` - 180x180px (rounded corners handled by iOS)
- [ ] `apple-touch-icon-precomposed.png` - 180x180px

### Android/PWA
- [ ] `android-chrome-192x192.png` - Standard Android icon
- [ ] `android-chrome-512x512.png` - High-res Android icon
- [ ] `maskable-icon.png` - 512x512px with safe zone for masking

### Web App Manifest
- [ ] Update `manifest.json` with new icons

---

## 📱 SOCIAL MEDIA ASSETS

### Open Graph / Facebook
- [ ] `og-image.png` - 1200x630px - Main share image with logo + tagline
- [ ] `og-image-generic.png` - 1200x630px - Logo centered, minimal

### Twitter
- [ ] `twitter-card.png` - 1200x675px (16:9) - Logo + tagline
- [ ] `twitter-profile.png` - 400x400px - Just icon for profile pic

### LinkedIn
- [ ] `linkedin-banner.png` - 1584x396px - Cover image with wordmark
- [ ] `linkedin-profile.png` - 400x400px - Icon only

### Instagram (if needed)
- [ ] `instagram-profile.png` - 320x320px - Icon only
- [ ] `instagram-post.png` - 1080x1080px - Square brand post template

---

## 📧 EMAIL & COMMUNICATION

### Email Assets
- [ ] `email-header.png` - 600x150px - Horizontal logo for email headers
- [ ] `email-footer-logo.png` - 150x150px - Small icon for footer
- [ ] `email-signature-logo.png` - 100x25px - Tiny wordmark for signatures

---

## 🎨 MARKETING & PRINT

### Business Materials
- [ ] `business-card-logo.png` - High-res for print (300 DPI)
- [ ] `letterhead-logo.png` - Top left corner format
- [ ] `invoice-template-logo.png` - For actual invoices (meta!)

### Presentation
- [ ] `slide-logo-light.png` - Light slides, top left corner
- [ ] `slide-logo-dark.png` - Dark slides, top left corner
- [ ] `slide-title-logo.png` - Large, centered for title slides

---

## 🖥️ DASHBOARD & APP UI

### Loading States
- [ ] `loading-spinner-icon.png` - Icon rotating animation frames
- [ ] `loading-logo-pulse.png` - Pulsing logo animation frames

### Empty States
- [ ] `empty-state-icon.png` - 200x200px - Icon for "no data" states
- [ ] `error-state-icon.png` - 200x200px - Subdued icon for errors

### Hero/Background
- [ ] `hero-background-pattern.png` - Subtle pattern based on logo geometry
- [ ] `hero-logo-large.png` - Large logo for hero sections (transparent)

---

## 📐 VECTOR FORMATS (If Possible)

- [ ] `logo.svg` - Scalable vector (ideal, if we can extract/recreate)
- [ ] `icon.svg` - Icon only vector

---

## 🎯 PRIORITY ORDER

### **PHASE 1: Essential (Do Now)**
1. Icon only (1024x1024) - for favicons
2. Favicon package (16, 32, 180, 192, 512)
3. OG image (1200x630) - for social sharing
4. Logo white version - for dark backgrounds
5. Update manifest.json

### **PHASE 2: Important (Next)**
6. Vertical logo
7. Email header
8. Twitter card
9. Logo dark version
10. Loading spinner

### **PHASE 3: Nice to Have**
11. LinkedIn banner
12. Business materials
13. Print assets
14. Animation frames

---

## 🚀 GENERATION STRATEGY

1. **Extract icon from wordmark** - Crop/isolate the hexagonal SI
2. **Generate variations** - Use Gemini 3 Pro to create color/size variants
3. **Create favicons** - Use ImageMagick to resize icon to all sizes
4. **Generate contextual assets** - OG images, email headers, etc.
5. **Update code** - Point all brand configs to new assets
6. **Set environment** - `NEXT_PUBLIC_BRAND=smartinvoice`
7. **Test** - Verify all pages show SmartInvoice branding

---

**Ready to proceed?** Let me know and I'll start with Phase 1!

