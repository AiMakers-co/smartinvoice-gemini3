import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

// SEO Metadata - Brand-aware
const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND === "ormandy" ? "Ormandy" : "SmartInvoice";
const BRAND_DOMAIN = process.env.NEXT_PUBLIC_BRAND === "ormandy" ? "ormandy.app" : "smartinvoice.finance";
const BRAND_TAGLINE = "AI-Powered Bank Statement Processing";

export const metadata: Metadata = {
  metadataBase: new URL(`https://${BRAND_DOMAIN}`),
  title: {
    default: `${BRAND_NAME} - ${BRAND_TAGLINE} | Gemini 3 Flash`,
    template: `%s | ${BRAND_NAME}`,
  },
  description: `Extract bank statement data in seconds with Gemini 3 Flash AI. 99.2% accuracy, 10,000+ bank formats. Free tier available. Trusted by 1000+ accountants.`,
  keywords: [
    "bank statement extraction",
    "AI document processing", 
    "Gemini 3 Flash",
    "PDF to CSV converter",
    "bank reconciliation software",
    "QuickBooks integration",
    "Xero sync",
    "financial automation",
    "OCR bank statements",
    "transaction extraction",
    "accountant software",
    "bookkeeping automation",
  ],
  authors: [{ name: BRAND_NAME }],
  creator: BRAND_NAME,
  publisher: BRAND_NAME,
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
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `https://${BRAND_DOMAIN}`,
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
    description: `Extract bank statement data in seconds with Gemini 3 Flash AI. 99.2% accuracy, 10,000+ bank formats.`,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME} - AI Bank Statement Processing`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
    description: `Extract bank statement data in seconds with Gemini 3 Flash AI. 99.2% accuracy.`,
    images: ["/og-image.png"],
    creator: "@smartinvoice_",
  },
  alternates: {
    canonical: `https://${BRAND_DOMAIN}`,
  },
  manifest: "/manifest.json",
};

// JSON-LD Structured Data
const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: BRAND_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: `AI-powered bank statement extraction using Gemini 3 Flash. Extract transactions from PDFs in seconds.`,
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
    bestRating: "5",
  },
  featureList: [
    "Gemini 3 Flash AI extraction",
    "99.2% accuracy",
    "10,000+ bank formats",
    "QuickBooks integration",
    "Xero integration",
    "SOC 2 Type II compliant",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="theme-compact" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className={`${outfit.variable} font-sans`}>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
