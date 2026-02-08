import type { Metadata } from "next";
import PricingContent from "./PricingContent";

// ============================================
// SEO METADATA
// ============================================

const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND === "ormandy" ? "Ormandy" : "SmartInvoice";
const BRAND_DOMAIN = process.env.NEXT_PUBLIC_BRAND === "ormandy" ? "ormandy.app" : "smartinvoice.finance";

export const metadata: Metadata = {
  title: "Pricing - AI Bank Statement Processing Plans",
  description: `${BRAND_NAME} pricing: 2-week free trial with 5 documents & 50 pages. Pro at $49/mo for 2,000 pages ($0.025/page). Pay-as-you-go from $0.05/page. 60-90% cheaper than Nanonets, Veryfi, Rossum. Gemini 3 Flash AI powered.`,
  keywords: [
    "bank statement extraction pricing",
    "document processing cost",
    "OCR pricing comparison",
    "Nanonets alternative",
    "Veryfi alternative", 
    "Rossum alternative",
    "cheap bank statement OCR",
    "AI document processing price",
    "bank reconciliation software pricing",
  ],
  alternates: {
    canonical: `https://${BRAND_DOMAIN}/pricing`,
  },
  openGraph: {
    title: `Pricing | ${BRAND_NAME}`,
    description: `2-week free trial with 5 documents & 50 pages. Pro plans from $49/mo. 60-90% cheaper than competitors.`,
    url: `https://${BRAND_DOMAIN}/pricing`,
    type: "website",
  },
};

// ============================================
// JSON-LD STRUCTURED DATA
// ============================================

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: `${BRAND_NAME} Pricing`,
  description: "AI-powered bank statement extraction pricing plans",
  mainEntity: {
    "@type": "Product",
    name: `${BRAND_NAME} Bank Statement Processing`,
    description: "AI-powered bank statement data extraction using Gemini 3 Flash",
    brand: {
      "@type": "Brand",
      name: BRAND_NAME,
    },
    offers: [
      {
        "@type": "Offer",
        name: "Free Trial",
        price: "0",
        priceCurrency: "USD",
        description: "2-week free trial with 5 documents and 50 pages",
        eligibleQuantity: {
          "@type": "QuantitativeValue",
          value: 50,
          unitText: "pages",
        },
      },
      {
        "@type": "Offer",
        name: "Pay-as-you-go",
        price: "0.05",
        priceCurrency: "USD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "0.05",
          priceCurrency: "USD",
          unitText: "page",
        },
        description: "No subscription, pay per page",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "39",
        priceCurrency: "USD",
        billingDuration: "P1M",
        description: "2,000 pages included, $0.04/page overage",
        eligibleQuantity: {
          "@type": "QuantitativeValue",
          value: 2000,
          unitText: "pages/month",
        },
      },
      {
        "@type": "Offer",
        name: "Team",
        price: "79",
        priceCurrency: "USD",
        billingDuration: "P1M",
        description: "4,000 pages included, $0.035/page overage",
        eligibleQuantity: {
          "@type": "QuantitativeValue",
          value: 4000,
          unitText: "pages/month",
        },
      },
      {
        "@type": "Offer",
        name: "Business",
        price: "149",
        priceCurrency: "USD",
        billingDuration: "P1M",
        description: "7,000 pages included, $0.03/page overage",
        eligibleQuantity: {
          "@type": "QuantitativeValue",
          value: 7000,
          unitText: "pages/month",
        },
      },
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      reviewCount: "127",
      bestRating: "5",
    },
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does pricing compare to competitors?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our Pro tier works out to approximately $0.025 per page, compared to $0.16-$0.45 per page from alternatives like Veryfi, Nanonets, or Rossum. We achieve this through efficient use of Gemini 3 Flash AI rather than legacy OCR technology.",
      },
    },
    {
      "@type": "Question",
      name: "What counts as a page?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "One page equals one side of a document. A 3-page PDF bank statement counts as 3 pages. Multi-page statements are common, so our Pro tier's 2,000 pages typically covers 300-500 statements per month.",
      },
    },
    {
      "@type": "Question",
      name: "Is there a free trial?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! Our 2-week free trial includes 5 documents and 50 pages to process—no credit card required. This gives you enough to fully test our AI extraction on your real bank statements before committing.",
      },
    },
    {
      "@type": "Question",
      name: "What is the accuracy rate?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We achieve 99.2% accuracy on standard bank statements using Google's Gemini 3 Flash AI. If accuracy falls below 99% for your documents, contact support—we stand behind our quality.",
      },
    },
    {
      "@type": "Question",
      name: "Can I cancel anytime?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. No contracts, no cancellation fees. You can cancel or downgrade your plan at any time from your account settings.",
      },
    },
  ],
};

// ============================================
// PAGE COMPONENT
// ============================================

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <PricingContent />
    </>
  );
}
