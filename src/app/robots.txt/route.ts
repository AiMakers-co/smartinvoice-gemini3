import { getBrand } from "@/config/brands";

export async function GET() {
  const brand = getBrand();
  const domain = brand.domain || (brand.id === "ormandy" ? "ormandy.app" : "smartinvoice.finance");

  const robotsTxt = `# ${brand.content.name} - AI Bank Statement Processing
# https://${domain}

# Allow all standard crawlers
User-agent: *
Allow: /

# Allow AI/LLM crawlers specifically
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Anthropic-AI
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Bytespider
Allow: /

# Disallow private routes
Disallow: /admin/
Disallow: /api/
Disallow: /dashboard/
Disallow: /accounts/
Disallow: /transactions/
Disallow: /statements/
Disallow: /settings/
Disallow: /upload/
Disallow: /login
Disallow: /invoices/

# Sitemaps
Sitemap: https://${domain}/sitemap.xml

# LLM-specific content
# See /llms.txt for AI-readable site summary
`;

  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

