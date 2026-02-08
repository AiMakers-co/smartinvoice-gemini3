import type { Metadata } from "next";

// Brand-aware metadata - uses env var to switch between brands
const IS_ORMANDY = process.env.NEXT_PUBLIC_BRAND === "ormandy";

const BRAND = IS_ORMANDY ? {
  name: "Ormandy",
  domain: "ormandy.app",
  tagline: "AI-Powered Accounting",
  description: "Streamline your accounting with AI-powered bank statement processing, invoice management, and financial insights.",
  twitter: "@ormandy_app",
  supportEmail: "support@ormandy.ai",
} : {
  name: "SmartInvoice",
  domain: "smartinvoice.finance",
  tagline: "AI-Powered Bank Statement Processing",
  description: "Extract bank statement data in seconds with Gemini 3 Flash AI. 99.2% accuracy, 10,000+ bank formats. Free tier available.",
  twitter: "@smartinvoice_",
  supportEmail: "hello@smartinvoice.finance",
};

export const baseMetadata: Metadata = {
  metadataBase: new URL(`https://${BRAND.domain}`),
  title: {
    default: `${BRAND.name} - ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.description,
  keywords: [
    "bank statement extraction",
    "AI document processing",
    "Gemini 3 Flash",
    "PDF to CSV converter",
    "bank reconciliation software",
    "financial automation",
    "OCR bank statements",
    "transaction extraction",
    "accountant software",
    "bookkeeping automation",
  ],
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  publisher: BRAND.name,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `https://${BRAND.domain}`,
    siteName: BRAND.name,
    title: `${BRAND.name} - ${BRAND.tagline}`,
    description: BRAND.description,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${BRAND.name} - AI Bank Statement Processing`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} - ${BRAND.tagline}`,
    description: BRAND.description,
    images: ["/og-image.png"],
    creator: BRAND.twitter,
  },
  alternates: {
    canonical: `https://${BRAND.domain}`,
  },
  verification: {
    // Add these when you have them
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
  },
};

// Page-specific metadata
export const pageMetadata = {
  home: {
    title: `${BRAND.name} - AI Bank Statement Extraction | Gemini 3 Flash Powered`,
    description: "Extract bank statement data in seconds with Gemini 3 Flash AI. 99.2% accuracy, 10,000+ bank formats. Free tier available. Trusted by 1000+ accountants.",
    alternates: { canonical: `https://${BRAND.domain}` },
  },
  pricing: {
    title: "Pricing",
    description: "Simple, transparent pricing. 2-week free trial with 5 documents & 50 pages. Pro plans from $49/mo with 2,000 pages included. Pay-as-you-go available.",
    alternates: { canonical: `https://${BRAND.domain}/pricing` },
  },
  features: {
    title: "Features",
    description: "Gemini 3 Flash AI extraction, 10,000+ bank formats, auto-categorization, and enterprise security.",
    alternates: { canonical: `https://${BRAND.domain}/features` },
  },
  about: {
    title: "About Us",
    description: `Learn about ${BRAND.name}'s mission to automate financial document processing with AI. Founded by accountants, built for accountants.`,
    alternates: { canonical: `https://${BRAND.domain}/about` },
  },
  contact: {
    title: "Contact Us",
    description: `Get in touch with ${BRAND.name}. We're here to help with questions about AI bank statement processing.`,
    alternates: { canonical: `https://${BRAND.domain}/contact` },
  },
  privacy: {
    title: "Privacy Policy",
    description: `${BRAND.name}'s privacy policy. Learn how we collect, use, and protect your data. GDPR and CCPA compliant.`,
    alternates: { canonical: `https://${BRAND.domain}/privacy` },
  },
  terms: {
    title: "Terms of Service",
    description: `${BRAND.name}'s terms of service. Read our terms and conditions for using our AI bank statement processing platform.`,
    alternates: { canonical: `https://${BRAND.domain}/terms` },
  },
  cookies: {
    title: "Cookie Policy",
    description: `${BRAND.name}'s cookie policy. Learn about the cookies we use and how to manage your preferences.`,
    alternates: { canonical: `https://${BRAND.domain}/cookies` },
  },
  security: {
    title: "Security",
    description: `${BRAND.name}'s security practices. SOC 2 Type II compliant, AES-256 encryption, GDPR ready. Enterprise-grade protection.`,
    alternates: { canonical: `https://${BRAND.domain}/security` },
  },
  gdpr: {
    title: "GDPR Compliance",
    description: `${BRAND.name}'s GDPR compliance. Learn about your data rights and how we protect EU user data.`,
    alternates: { canonical: `https://${BRAND.domain}/gdpr` },
  },
  changelog: {
    title: "Changelog",
    description: `${BRAND.name} product updates, new features, and improvements. Stay up to date with our latest releases.`,
    alternates: { canonical: `https://${BRAND.domain}/changelog` },
  },
  roadmap: {
    title: "Product Roadmap",
    description: `See what's coming next at ${BRAND.name}. Vote on features and help shape the future of AI document processing.`,
    alternates: { canonical: `https://${BRAND.domain}/roadmap` },
  },
  blog: {
    title: "Blog",
    description: `${BRAND.name} blog. Tips, tutorials, and insights on AI document processing, accounting automation, and financial workflows.`,
    alternates: { canonical: `https://${BRAND.domain}/blog` },
  },
};

// JSON-LD structured data
export const structuredData = {
  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.name,
    url: `https://${BRAND.domain}`,
    logo: `https://${BRAND.domain}/logo.png`,
    sameAs: [
      `https://twitter.com/${BRAND.twitter.replace("@", "")}`,
      `https://linkedin.com/company/${BRAND.name.toLowerCase()}`,
    ],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "",
      contactType: "customer service",
      email: BRAND.supportEmail,
    },
  },
  software: {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: BRAND.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "2-week free trial with 5 documents and 50 pages",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      reviewCount: "127",
    },
  },
  faq: {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is Gemini 3 Flash?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Gemini 3 Flash is Google's latest multimodal AI model, optimized for speed and accuracy in document understanding. We use it to extract data from bank statements with 99.2% accuracy.",
        },
      },
      {
        "@type": "Question",
        name: "How accurate is the extraction?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Our Gemini 3 Flash-powered extraction achieves 99.2% accuracy across 10,000+ bank statement formats.",
        },
      },
      {
        "@type": "Question",
        name: "Is there a free trial?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes! Our 2-week free trial includes 5 documents and 50 pages to process—no credit card required.",
        },
      },
    ],
  },
};
