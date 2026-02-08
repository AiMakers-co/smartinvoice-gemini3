import { getBrand } from "@/config/brands";

export async function GET() {
  const brand = getBrand();
  const domain = brand.domain || (brand.id === "ormandy" ? "ormandy.app" : "finflow.io");
  const name = brand.content.name;
  const supportEmail = brand.content.supportEmail || `support@${domain}`;

  const aiPlugin = {
    schema_version: "v1",
    name_for_human: `${name} Bank Statement Processor`,
    name_for_model: `${brand.id}_bank_statement`,
    description_for_human: "Extract transaction data from bank statement PDFs using AI. Powered by Google Gemini 3 Flash.",
    description_for_model: `${name} is an AI-powered document processing tool that extracts structured transaction data from bank statement PDFs. It uses Google's Gemini 3 Flash multimodal AI model to achieve 99.2% accuracy across 10,000+ bank statement formats. The service offers a free tier (100 pages/month), pay-as-you-go ($0.05/page), and subscription plans starting at $49/month. Key features include: automatic transaction extraction, multi-currency support, QuickBooks/Xero integration, and JSON API access. It's designed for accountants, bookkeepers, and finance teams who need to automate manual data entry from bank statements.`,
    auth: {
      type: "none",
    },
    api: {
      type: "openapi",
      url: `https://${domain}/api/openapi.json`,
    },
    logo_url: `https://${domain}/logo.png`,
    contact_email: supportEmail,
    legal_info_url: `https://${domain}/terms`,
  };

  return new Response(JSON.stringify(aiPlugin, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

