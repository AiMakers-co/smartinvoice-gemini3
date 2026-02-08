# SmartInvoice Cloud Functions

> **Note**: This directory contains documentation of our Firebase Cloud Functions architecture. 
> The full implementation is proprietary and not included in this public repository.

## Overview

SmartInvoice uses Firebase Cloud Functions to handle AI-powered document processing. All AI operations run server-side for security and to leverage Gemini 3's full capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloud Functions (Node.js 20)                  │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   Document       │  │   AI Assistant   │  │  Reconcile   │  │
│  │   Processing     │  │                  │  │  Agent       │  │
│  │                  │  │                  │  │              │  │
│  │  • scanDocument  │  │  • chat          │  │ • investigate│  │
│  │  • extractData   │  │  • reconcileChat │  │ • batchMatch │  │
│  │  • parseCSV      │  │                  │  │              │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │
│           │                     │                    │          │
│           └─────────────────────┴────────────────────┘          │
│                                 │                               │
│                                 ▼                               │
│           ┌─────────────────────────────────────────┐           │
│           │         Gemini 3 Flash API              │           │
│           │                                         │           │
│           │  • Multimodal (PDF, images, Excel)      │           │
│           │  • Structured JSON output               │           │
│           │  • Function calling (8 tools)           │           │
│           │  • Temperature 0 for determinism        │           │
│           └─────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Gemini 3 Integration

### Model Configuration

We use Gemini 3 Flash as our primary model for its balance of speed, cost, and multimodal capabilities.

```typescript
// Example configuration (see src/config/ai-models.ts for full implementation)
const GEMINI_MODELS = {
  "gemini-3-flash": "gemini-3-flash-preview",
  "gemini-3-pro": "gemini-3-pro-preview",
};

const MODEL_PRICING = {
  "gemini-3-flash": { input: 0.50, output: 3.00, costPerPage: 0.01 },
};
```

### Key Capabilities Used

| Capability | How We Use It |
|------------|---------------|
| **Multimodal Vision** | Extract text/tables from PDFs, scanned documents, photos |
| **Structured Output** | `responseMimeType: "application/json"` for reliable parsing |
| **Function Calling** | Agentic reconciliation with 8 database query tools |
| **Low Temperature** | `temperature: 0` for deterministic extraction |

## Function Modules

### 1. Document Processing (`scanDocument`, `extractData`)

**Purpose**: Extract structured transaction data from any bank statement format.

**Gemini 3 Features Used**:
- Multimodal input (PDF pages as images)
- Structured JSON output schema
- Zero-temperature for consistency

**Flow**:
1. User uploads PDF/CSV/Excel
2. Function sends document to Gemini 3 Flash
3. AI extracts: bank name, account number, transactions, balances
4. Structured data saved to Firestore

### 2. AI Assistant (`chat`, `reconcileChat`)

**Purpose**: Conversational interface for document review and corrections.

**Gemini 3 Features Used**:
- Multi-turn conversation with context
- Document-aware responses
- Action suggestions (JSON-formatted)

### 3. Reconciliation Agent (`investigateMatch`)

**Purpose**: Autonomous agent that investigates uncertain invoice-to-transaction matches.

**Gemini 3 Features Used**:
- **Function Calling** with 8 tools:
  - `searchTransactions` - Query bank transactions
  - `searchInvoices` - Query invoices
  - `findInvoiceCombination` - Find invoices summing to payment
  - `findPaymentCombination` - Find payments summing to invoice
  - `getFXRate` - Get exchange rates for currency mismatches
  - `searchCreditNotes` - Find refunds/credits
  - `getVendorHistory` - Historical payment patterns
  - `getLearnedPatterns` - AI-learned vendor behaviors

**Agent Loop**:
```
1. Receive uncertain match (invoice + suspected transaction)
2. Call getLearnedPatterns for vendor history
3. Use tools to investigate discrepancy
4. Reason through possibilities (FX, fees, partial payments)
5. Return verdict with confidence score and explanation
```

## Why Server-Side?

- **Security**: API keys never exposed to client
- **Multimodal**: Direct PDF/image processing without client-side conversion
- **Cost Control**: Usage tracking and rate limiting
- **Reliability**: Retry logic for API failures

## Live Demo

See these functions in action: **https://www.smartinvoice.finance/**

Upload any bank statement and watch Gemini 3 extract the data in seconds.
