import { getBrand } from "@/config/brands";

export async function GET() {
  const brand = getBrand();
  const domain = brand.domain || (brand.id === "ormandy" ? "ormandy.app" : "smartinvoice.finance");
  const name = brand.content.name;
  const supportEmail = brand.content.supportEmail || `support@${domain}`;

  const llmsTxt = `# ${name} - AI Bank Statement Processing

> ${name} is an AI-powered bank statement processing platform that extracts transaction data from PDF bank statements using Google's Gemini 3 Flash model.

## What We Do

${name} automatically extracts structured data from bank statements:
- Transaction dates, descriptions, amounts
- Account numbers and bank names
- Running balances and statement periods
- Multi-currency support

## Technology

- **AI Model**: Google Gemini 3 Flash (multimodal vision AI)
- **Accuracy**: 99.2% on standard bank statement formats
- **Formats Supported**: 10,000+ bank statement templates
- **Processing Speed**: Under 2 seconds per page

## Pricing

- **Free Trial**: 2-week trial with 5 documents and 50 pages, no credit card required
- **Pay-as-you-go**: $0.05 per page, no subscription
- **Pro**: $49/month for 2,000 pages ($0.025/page effective)
- **Team**: $99/month for 4,000 pages
- **Business**: $179/month for 7,000 pages
- **Enterprise**: Custom pricing for 30,000+ pages

## Integrations

- QuickBooks Online
- Xero
- CSV/Excel export
- JSON API

## Security & Compliance

- SOC 2 Type II compliant
- GDPR compliant
- AES-256 encryption at rest
- TLS 1.3 in transit
- Data deleted after processing (configurable)

## Target Users

- Accountants and bookkeepers
- Small business owners
- Finance teams
- Mortgage brokers and lenders
- Anyone who manually enters bank statement data

## Key Differentiator

We use Gemini 3 Flash instead of legacy OCR, achieving the same accuracy at 1/10th the cost. This allows us to offer pricing 60-90% lower than competitors like Nanonets, Veryfi, or Rossum.

## Contact

- Website: https://${domain}
- Email: ${supportEmail}
- Documentation: https://${domain}/docs

## API

REST API available for programmatic access. See /docs/api for documentation.

Example:
\`\`\`
POST /api/v1/extract
Content-Type: multipart/form-data
Authorization: Bearer {api_key}

{file: bank-statement.pdf}
\`\`\`

Returns structured JSON with transactions, dates, amounts, and metadata.
`;

  return new Response(llmsTxt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

