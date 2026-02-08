# SmartInvoice Architecture

## System Overview

SmartInvoice is a full-stack application that uses Google Gemini 3 Flash for intelligent financial document processing.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                 CLIENT LAYER                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                          Next.js 16 + React 19                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │   Dashboard  │  │   Upload     │  │  Reconcile   │  │  AI Chat   │  │  │
│  │  │    Pages     │  │   Drawer     │  │    Panel     │  │  Sidebar   │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ HTTPS / Firebase SDK
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              FIREBASE LAYER                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Authentication │  │  Cloud Storage  │  │      Cloud Functions        │  │
│  │                 │  │                 │  │                             │  │
│  │  - Email/Pass   │  │  - PDF uploads  │  │  ┌─────────────────────┐   │  │
│  │  - Google SSO   │  │  - CSV uploads  │  │  │   Document Module   │   │  │
│  │                 │  │  - Images       │  │  │   - scanDocument    │   │  │
│  │                 │  │                 │  │  │   - extractData     │   │  │
│  │                 │  │                 │  │  └─────────────────────┘   │  │
│  │                 │  │                 │  │  ┌─────────────────────┐   │  │
│  │                 │  │                 │  │  │   AI Assistant      │   │  │
│  │                 │  │                 │  │  │   - chat            │   │  │
│  │                 │  │                 │  │  │   - reconcileChat   │   │  │
│  │                 │  │                 │  │  └─────────────────────┘   │  │
│  │                 │  │                 │  │  ┌─────────────────────┐   │  │
│  │                 │  │                 │  │  │   Recon Agent       │   │  │
│  │                 │  │                 │  │  │   - investigate     │   │  │
│  │                 │  │                 │  │  │   - batchInvestigate│   │  │
│  │                 │  │                 │  │  └─────────────────────┘   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ API Calls
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                              GEMINI 3 LAYER                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                     Google AI Studio API                                │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │  │
│  │  │    Multimodal    │  │   Structured     │  │   Function Calling   │  │  │
│  │  │    Vision        │  │   JSON Output    │  │   (Tool Use)         │  │  │
│  │  │                  │  │                  │  │                      │  │  │
│  │  │  - PDF parsing   │  │  - Transaction   │  │  - searchTransactions│  │  │
│  │  │  - Image OCR     │  │    extraction    │  │  - findCombinations  │  │  │
│  │  │  - Table detect  │  │  - Account info  │  │  - getFXRate         │  │  │
│  │  │                  │  │  - Categories    │  │  - getVendorHistory  │  │  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ Read/Write
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                               DATA LAYER                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                        Cloud Firestore                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │    users     │  │  bank_accts  │  │ transactions │  │  invoices  │  │  │
│  │  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├────────────┤  │  │
│  │  │ - profile    │  │ - bankName   │  │ - date       │  │ - vendor   │  │  │
│  │  │ - settings   │  │ - accountNum │  │ - amount     │  │ - total    │  │  │
│  │  │ - usage      │  │ - balance    │  │ - type       │  │ - status   │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │  │
│  │  │  templates   │  │   patterns   │  │   ai_usage   │                  │  │
│  │  ├──────────────┤  ├──────────────┤  ├──────────────┤                  │  │
│  │  │ - bankName   │  │ - vendorName │  │ - tokens     │                  │  │
│  │  │ - rules      │  │ - keywords   │  │ - cost       │                  │  │
│  │  │ - fields     │  │ - delays     │  │ - timestamp  │                  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Gemini 3 Integration Details

### Document Processing Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │────▶│    Scan     │────▶│   Extract   │────▶│    Save     │
│  Document   │     │  (Phase 1)  │     │  (Phase 2)  │     │   to DB     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Gemini 3   │     │  Gemini 3   │
                    │   Flash     │     │   Flash     │
                    │             │     │             │
                    │ - Detect    │     │ - Extract   │
                    │   bank      │     │   all txns  │
                    │ - Preview   │     │ - Categorize│
                    │   5 txns    │     │ - Validate  │
                    └─────────────┘     └─────────────┘
```

### Agentic Reconciliation Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                    AI Reconciliation Agent                            │
│                                                                       │
│  ┌─────────────┐                                                     │
│  │   Invoice   │──┐                                                  │
│  │  (unmatched)│  │                                                  │
│  └─────────────┘  │     ┌──────────────────────────────────────┐    │
│                   ├────▶│         Gemini 3 Flash               │    │
│  ┌─────────────┐  │     │       (with Function Calling)        │    │
│  │ Transaction │  │     │                                      │    │
│  │  (suspect)  │──┘     │  System: "You are a reconciliation   │    │
│  └─────────────┘        │          expert. Use tools to        │    │
│                         │          investigate..."              │    │
│                         └──────────────┬───────────────────────┘    │
│                                        │                             │
│                                        ▼                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     Available Tools                          │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │    │
│  │  │ searchTxns      │  │ findInvoiceCombo│  │ getFXRate   │  │    │
│  │  │ searchInvoices  │  │ findPaymentCombo│  │ getHistory  │  │    │
│  │  │ searchCredits   │  │ getPatterns     │  │             │  │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                        │                             │
│                                        ▼                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                     Agent Output                             │    │
│  │  - status: "match_found" | "explanation_found" | ...        │    │
│  │  - confidence: 0-100                                         │    │
│  │  - explanation: "The $50 difference is a wire transfer fee" │    │
│  │  - suggestedAction: "confirm_match"                          │    │
│  │  - reasoning: ["Called getPatterns...", "Found..."]         │    │
│  └─────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Two-Phase Extraction
- **Phase 1 (Scan)**: Quick preview — detect bank, account, show 5 sample transactions
- **Phase 2 (Extract)**: Full extraction after user confirms account
- **Why**: Reduces API costs, faster user feedback, fewer errors

### 2. AI-Generated Parsing Rules for CSVs
- Gemini analyzes CSV structure and generates parsing rules
- Rules are saved per bank for reuse
- Subsequent uploads use rules without AI (fast + free)

### 3. Pattern Memory for Reconciliation
- System learns vendor payment patterns (delays, processors, aliases)
- Agent uses learned patterns to improve matching
- Patterns update automatically from confirmed matches

### 4. Usage Tracking & Cost Control
- Every AI call records tokens used
- Cost calculated per model tier
- User-facing usage dashboard
- Rate limiting for free tier

## Technology Choices

| Component | Technology | Why |
|-----------|------------|-----|
| AI Model | Gemini 3 Flash | Best price/performance, multimodal, function calling |
| Frontend | Next.js 16 | App Router, React Server Components, fast |
| Backend | Firebase Functions | Serverless, scales to zero, Firebase integration |
| Database | Cloud Firestore | Real-time, flexible schema, Firebase integration |
| Auth | Firebase Auth | Easy SSO, secure, Firebase integration |
| Payments | Stripe | Industry standard, usage-based billing |

## Security Considerations

- API keys stored in Firebase Secrets Manager
- All user data scoped by `userId` in Firestore rules
- PDFs processed in memory, not stored permanently
- No PII in logs
- SOC 2 Type II compliant infrastructure (Firebase/GCP)
