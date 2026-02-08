# Devpost Submission — Ready to Paste

## Project Name
SmartInvoice — AI-Powered Financial Document Processing

## Tagline
Upload any bank statement. Gemini 3 extracts, categorizes, and reconciles it in seconds.

## Links
- **Live Demo**: https://www.smartinvoice.finance/
- **Public Repo**: https://github.com/AiMakers-co/smartinvoice-gemini3
- **Demo Video**: https://youtube.com/TODO

---

## Gemini Integration Write-up (~200 words)

SmartInvoice is built entirely on Google Gemini 3 Flash — every AI feature runs through the Gemini 3 API via the @google/genai SDK.

**Multimodal Document Processing**: We send PDF pages, scanned images, and spreadsheets directly to Gemini 3 Flash's vision capabilities. The model extracts transaction data, account details, dates, and balances from any bank format — no OCR pipeline needed. We use responseMimeType: "application/json" for reliable structured extraction.

**Configurable Thinking Levels**: We use Gemini 3's thinkingConfig with ThinkingLevel.LOW for fast document classification and ThinkingLevel.HIGH for complex reconciliation cases requiring deep reasoning.

**Agentic Reconciliation with Function Calling**: Our reconciliation engine uses Gemini 3's native function calling with 8 custom tools (searchTransactions, getLearnedPatterns, getFXRate, etc.). The AI agent autonomously investigates uncertain matches — querying transaction history, identifying payment patterns, and explaining discrepancies like FX rate differences or partial payments.

**Real-time AI Reasoning UI**: The frontend streams Gemini's thinking process into a live terminal, showing users exactly how the AI analyzes their documents.

Gemini 3 is not a feature of SmartInvoice — it IS SmartInvoice.

---

## Third-Party Integrations (paste into submission)

- Google Gemini 3 Flash API (@google/genai SDK) — Core AI engine
- Firebase (Auth, Firestore, Storage, Functions, Hosting) — Cloud infrastructure
- Algolia — Transaction full-text search
- Stripe — Payment/billing integration
- Next.js 16, React 19 — Frontend framework
- Radix UI / shadcn/ui — UI components (MIT)
- Recharts — Data visualization (MIT)
- Framer Motion — Animations (MIT)
- xlsx — Excel file parsing (Apache 2.0)
- Tailwind CSS 4 — Styling (MIT)
