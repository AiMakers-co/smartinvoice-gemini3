# SmartInvoice — AI-Powered Financial Document Processing

> **Gemini 3 Hackathon Submission** | [Live Demo](https://www.smartinvoice.finance/) | [Demo Video](https://youtube.com/TODO)

SmartInvoice uses **Google Gemini 3 Flash** to extract, categorize, and reconcile financial documents. Upload any PDF, CSV, or scanned bank statement — get structured data in seconds.

**No login required** — click "Try Live Demo" to experience the full product instantly.

![SmartInvoice Dashboard](https://www.smartinvoice.finance/screenshots/10-dashboard.png)

---

## Gemini 3 Integration (~200 words)

SmartInvoice is built entirely on **Google Gemini 3 Flash** — every AI feature runs through the Gemini 3 API via the `@google/genai` SDK.

**Multimodal Document Processing**: We send PDF pages, scanned images, and spreadsheets directly to Gemini 3 Flash's vision capabilities. The model extracts transaction data, account details, dates, and balances from any bank format — no OCR pipeline needed. We use `responseMimeType: "application/json"` for reliable structured extraction.

**Configurable Thinking Levels**: We use Gemini 3's `thinkingConfig` with `ThinkingLevel.LOW` for fast document classification and `ThinkingLevel.HIGH` for complex reconciliation cases that require deep reasoning.

**Agentic Reconciliation with Function Calling**: Our reconciliation engine uses Gemini 3's native function calling with 8 custom tools (`searchTransactions`, `getLearnedPatterns`, `getFXRate`, etc.). The AI agent autonomously investigates uncertain matches — querying transaction history, identifying payment patterns, and explaining discrepancies like FX rate differences, partial payments, or bank fees.

**Real-time AI Reasoning UI**: The frontend streams Gemini's thinking process into a live terminal, showing users exactly how the AI analyzes their documents in real-time.

Gemini 3 is not a feature of SmartInvoice — it **is** SmartInvoice. Every document processed, every match investigated, and every insight generated runs through Gemini 3.

---

## What It Does

- **Multimodal Document Extraction**: PDFs, scanned images, Excel, CSV — Gemini 3 Flash handles them all
- **AI Document Classification**: Automatically identifies document type (bank statement, invoice, bill) with confidence scoring
- **Intelligent Transaction Parsing**: AI-generated parsing rules for any bank format
- **Agentic Reconciliation**: AI agent with function calling that investigates uncertain payment matches
- **Real-time AI Reasoning**: Live streaming of Gemini's thinking process in the UI
- **Conversational AI Assistant**: Natural language interface for document processing queries

---

## Gemini 3 Features Used

| Feature | Where Used | Details |
|---------|-----------|---------|
| **Multimodal Vision** | Document scanning, extraction | PDF, image, CSV, Excel → structured JSON |
| **Structured Output** | All AI functions | `responseMimeType: "application/json"` |
| **Thinking/Reasoning** | Classification, reconciliation | `ThinkingLevel.LOW` and `ThinkingLevel.HIGH` |
| **Function Calling** | Reconciliation agent | 8 custom tools for autonomous investigation |

### Code Examples

**Structured extraction with thinking:**
```typescript
const response = await ai.models.generateContent({
  model: "gemini-3-flash-preview",
  contents: [{ role: "user", parts: [
    { inlineData: { mimeType: "application/pdf", data: base64Pdf } },
    { text: prompt }
  ]}],
  config: {
    temperature: 0,
    responseMimeType: "application/json",
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  },
});
```

**Agentic reconciliation with function calling:**
```typescript
const toolDefinitions: FunctionDeclaration[] = [
  { name: "searchTransactions", description: "Search bank transactions matching criteria", parameters: { /* ... */ } },
  { name: "getLearnedPatterns", description: "Get AI-learned patterns for a vendor", parameters: { /* ... */ } },
  { name: "getFXRate", description: "Get foreign exchange rate between currencies", parameters: { /* ... */ } },
  // ... 8 tools total
];

const response = await ai.models.generateContent({
  model: "gemini-3-flash-preview",
  contents: conversationHistory,
  config: { tools: [{ functionDeclarations: toolDefinitions }] },
});
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Next.js 16 Frontend                        │
│            (React 19, Tailwind CSS, Firebase Auth)                │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │  Upload &    │  │  Dashboard & │  │  Reconciliation     │    │
│  │  AI Scanning │  │  Analytics   │  │  & Matching          │    │
│  └──────────────┘  └──────────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Firebase Cloud Functions (Node.js 20)            │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Document   │  │     AI      │  │    Reconciliation       │  │
│  │  Processing │  │  Assistant  │  │       Agent             │  │
│  │             │  │             │  │                         │  │
│  │ identify.ts │  │  chat.ts    │  │  ai-agent.ts            │  │
│  │ scan.ts     │  │             │  │  reconcile-engine.ts    │  │
│  │ extract.ts  │  │             │  │  pattern-memory.ts      │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         └────────────────┴──────────────────────┘                │
│                          │                                       │
│                          ▼                                       │
│         ┌────────────────────────────────────────┐               │
│         │        Google Gemini 3 Flash API        │               │
│         │  Multimodal · Structured Output ·       │               │
│         │  Function Calling · Thinking            │               │
│         └────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Cloud Firestore                            │
│      (Documents, Transactions, Patterns, Usage Tracking)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `functions/src/config/ai-models.ts` | Gemini 3 client setup, model configs, pricing |
| `functions/src/documents/identify-type.ts` | AI document classification with thinking |
| `functions/src/bank-statements/scan.ts` | Multimodal document scanning |
| `functions/src/bank-statements/extract-trigger.ts` | Full transaction extraction |
| `functions/src/ai-assistant/chat.ts` | Conversational AI for documents |
| `functions/src/reconciliation/ai-agent.ts` | Agentic matching with 8 tools |
| `functions/src/reconciliation/reconcile-engine.ts` | Three-tier reconciliation engine |
| `functions/src/reconciliation/pattern-memory.ts` | Learned vendor patterns |
| `src/components/upload/upload-drawer.tsx` | AI-first upload UX with live reasoning |

---

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, Framer Motion
- **Backend**: Firebase Cloud Functions (Node.js 20)
- **AI**: Google Gemini 3 Flash via `@google/genai` SDK
- **Database**: Cloud Firestore
- **Auth**: Firebase Authentication (anonymous auth for demo)
- **Storage**: Firebase Storage
- **Search**: Algolia (transaction full-text search)
- **Payments**: Stripe (billing integration)
- **Charts**: Recharts
- **UI Components**: Radix UI / shadcn/ui
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Spreadsheets**: xlsx (Excel parsing)

---

## Third-Party Integrations

Per hackathon rules, here are all third-party tools and services used:

| Integration | Purpose | License/Terms |
|-------------|---------|---------------|
| Google Gemini 3 API | Core AI engine | Google AI Terms of Service |
| Firebase (Auth, Firestore, Storage, Functions, Hosting) | Cloud infrastructure | Google Cloud Terms |
| Algolia | Transaction search | Algolia Terms of Service |
| Stripe | Payment processing | Stripe Terms of Service |
| Next.js | React framework | MIT License |
| Radix UI / shadcn/ui | UI components | MIT License |
| Recharts | Data visualization | MIT License |
| Framer Motion | Animations | MIT License |
| xlsx | Excel file parsing | Apache 2.0 License |
| Lucide React | Icons | ISC License |

---

## Live Demo

**Try it now**: [https://www.smartinvoice.finance/](https://www.smartinvoice.finance/)

- Click **"Try Live Demo"** — no account or login needed
- Full access to demo data with 5 bank accounts, 10 statements, and 1,000+ transactions
- Upload your own documents and watch Gemini 3 process them in real-time

---

## Local Development

```bash
# Install dependencies
npm install
cd functions && npm install

# Set up environment
cp .env.example .env.local
# Add your GEMINI_API_KEY from https://aistudio.google.com/

# Run development server
npm run dev
```

---

## Team

Built by [AiMakers](https://github.com/AiMakers-co) for the Google DeepMind Gemini 3 Hackathon.

## License

MIT License — See [LICENSE](LICENSE) for details.
