import { MetadataRoute } from 'next'

const DOMAIN = process.env.NEXT_PUBLIC_BRAND === "ormandy" 
  ? "https://ormandy.app" 
  : "https://smartinvoice.finance";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  
  // Marketing pages - high priority, frequent updates
  const marketingPages = [
    { url: '', priority: 1.0, changeFrequency: 'weekly' as const },
    { url: '/features', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: '/pricing', priority: 0.9, changeFrequency: 'weekly' as const },
    { url: '/about', priority: 0.7, changeFrequency: 'monthly' as const },
    { url: '/contact', priority: 0.6, changeFrequency: 'monthly' as const },
    { url: '/blog', priority: 0.8, changeFrequency: 'daily' as const },
    { url: '/changelog', priority: 0.6, changeFrequency: 'weekly' as const },
    { url: '/roadmap', priority: 0.5, changeFrequency: 'monthly' as const },
  ];

  // Legal/compliance pages - lower priority, rare updates
  const legalPages = [
    { url: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
    { url: '/terms', priority: 0.3, changeFrequency: 'yearly' as const },
    { url: '/cookies', priority: 0.2, changeFrequency: 'yearly' as const },
    { url: '/security', priority: 0.4, changeFrequency: 'monthly' as const },
    { url: '/gdpr', priority: 0.3, changeFrequency: 'yearly' as const },
  ];

  return [
    ...marketingPages.map(page => ({
      url: `${DOMAIN}${page.url}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...legalPages.map(page => ({
      url: `${DOMAIN}${page.url}`,
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
  ];
}

