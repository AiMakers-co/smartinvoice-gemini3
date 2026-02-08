# 🚀 Reconciliation System Implementation Plan

> Step-by-step plan to integrate advanced payment matching into SmartInvoice

---

## Current State Assessment

### ✅ What We Have

| Component | Status | Location |
|-----------|--------|----------|
| Bank statement upload | ✅ Working | `upload-drawer.tsx` |
| Transaction extraction | ✅ Working | `bank-statements/extract-trigger.ts` |
| Bill upload | ✅ Working | `upload-drawer.tsx` → `bills` collection |
| Invoice upload | ✅ Working | `upload-drawer.tsx` → `invoices` collection |
| Basic reconciliation page | ⚠️ Broken | `reconciliation/page.tsx` (queries wrong collections) |
| Basic matching algorithm | ⚠️ Incomplete | `reconciliation/index.ts` (invoices only, wrong direction) |
| AI agent | ⚠️ Exists | `reconciliation/ai-agent.ts` (not integrated) |
| Vendor patterns | ⚠️ Exists | `reconciliation/pattern-memory.ts` (not used) |

### ❌ What's Missing

- Bills not included in matching
- Wrong direction logic (invoices should match credits, not debits)
- Transaction-centric view (start from transaction, find document)
- Split payment allocation
- Learning feedback loop connected to UI
- Proper match confirmation flow
- Categorization for non-document transactions

---

## Implementation Phases

### Phase 1: Data Model & Backend Foundation (3-4 days)

### Phase 2: Core Matching Engine (4-5 days)

### Phase 3: Frontend - Transaction View (3-4 days)

### Phase 4: Frontend - Document View (2-3 days)

### Phase 5: AI Integration & Learning (3-4 days)

### Phase 6: Dashboard & Polish (2-3 days)

**Total: ~18-23 days**

---

## Phase 1: Data Model & Backend Foundation

### 1.1 Update Transaction Schema

**File:** `src/types/index.ts`

```typescript
// ADD to Transaction interface
interface Transaction {
  // ...existing fields
  
  // NEW: Reconciliation fields
  reconciliationStatus: "unmatched" | "suggested" | "matched" | "categorized";
  
  // If matched to document(s)
  matchedDocumentId?: string;
  matchedDocumentType?: "bill" | "invoice";
  matchedDocumentNumber?: string;
  matchedAt?: Timestamp;
  matchedBy?: string;
  matchConfidence?: number;
  matchMethod?: "auto" | "ai_suggested" | "manual";
  
  // If split across multiple documents
  allocations?: PaymentAllocation[];
  
  // If categorized (not a document payment)
  category?: string;
  categoryConfirmedAt?: Timestamp;
}

interface PaymentAllocation {
  documentId: string;
  documentType: "bill" | "invoice";
  documentNumber: string;
  amount: number;
  allocatedAt: Timestamp;
}
```

**Task:** Update Firestore indexes for new query patterns

### 1.2 Update Bill/Invoice Schema

**File:** `src/types/index.ts` and `src/types/documents.ts`

```typescript
// UPDATE Bill and Invoice interfaces
interface PaymentTracking {
  // Payment status
  paymentStatus: "unpaid" | "partial" | "paid" | "overpaid";
  amountPaid: number;
  amountRemaining: number;
  
  // Linked transactions
  payments: LinkedPayment[];
}

interface LinkedPayment {
  transactionId: string;
  transactionDate: Timestamp;
  transactionDescription: string;
  amount: number;  // How much of this payment applies
  linkedAt: Timestamp;
  linkedBy: string;
  confidence: number;
  method: "auto" | "ai_suggested" | "manual";
}
```

### 1.3 Create Match Records Collection

**New Collection:** `reconciliation_matches`

```typescript
interface ReconciliationMatch {
  id: string;
  userId: string;
  
  // Transaction side
  transactionId: string;
  transactionDate: Timestamp;
  transactionAmount: number;
  transactionDescription: string;
  transactionType: "credit" | "debit";
  accountId: string;
  
  // Document side
  documentId: string;
  documentType: "bill" | "invoice";
  documentNumber: string;
  documentAmount: number;
  counterpartyName: string;  // Customer or Vendor
  
  // Match details
  matchType: "exact" | "partial" | "fee_adjusted" | "split";
  allocationAmount: number;  // If split, how much allocated
  confidence: number;
  matchMethod: "auto" | "ai_suggested" | "manual";
  
  // AI details (if applicable)
  aiSuggestionId?: string;
  aiReasoning?: string;
  
  // Status
  status: "pending" | "confirmed" | "rejected";
  confirmedAt?: Timestamp;
  confirmedBy?: string;
  rejectedAt?: Timestamp;
  rejectedBy?: string;
  rejectionReason?: string;
  
  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 1.4 Update Backend Functions

**File:** `functions/src/reconciliation/index.ts`

Tasks:
- [ ] Add `getUnmatchedTransactions()` - Get transactions needing matching
- [ ] Update `getReconciliationSuggestions()` to query BOTH `bills` AND `invoices`
- [ ] Fix direction logic: credits → invoices, debits → bills
- [ ] Add `confirmMatch()` - Link transaction to document (updates both)
- [ ] Add `confirmSplitMatch()` - Link transaction to multiple documents
- [ ] Add `categorizeTransaction()` - Mark as non-document
- [ ] Add `unmatch()` - Undo a match
- [ ] Add `getReconciliationStats()` - Dashboard data

### 1.5 Firestore Indexes

**File:** `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "reconciliationStatus", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "bills",
      "queryScope": "COLLECTION", 
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "paymentStatus", "order": "ASCENDING" },
        { "fieldPath": "amountRemaining", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "invoices",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "paymentStatus", "order": "ASCENDING" },
        { "fieldPath": "amountRemaining", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Phase 2: Core Matching Engine

### 2.1 Matching Algorithm

**New File:** `functions/src/reconciliation/matcher.ts`

```typescript
// Core matching logic from MATCHING-LOGIC.md
export async function findMatchCandidates(
  transaction: Transaction,
  userId: string
): Promise<MatchCandidate[]>

export async function scoreMatch(
  transaction: Transaction,
  document: Document
): Promise<MatchScore>

export async function findSumMatches(
  transaction: Transaction,
  documents: Document[]
): Promise<SumMatchCandidate[]>
```

### 2.2 Fee Pattern Detection

**New File:** `functions/src/reconciliation/fee-patterns.ts`

```typescript
// Detect Stripe, PayPal, etc. fee patterns
export function detectFeePattern(
  transactionAmount: number,
  documentAmount: number
): FeePattern | null

export function reverseCalculateOriginalAmount(
  receivedAmount: number,
  feePattern: string
): number
```

### 2.3 Keyword Extraction

**New File:** `functions/src/reconciliation/keywords.ts`

```typescript
// Extract meaningful keywords from transaction descriptions
export function extractKeywords(description: string): string[]
export function extractInvoiceNumbers(description: string): string[]
export function extractNames(description: string): string[]
export function detectPaymentProcessor(description: string): string | null
```

### 2.4 Batch Matching

**File:** `functions/src/reconciliation/index.ts`

```typescript
// Run matching on all unmatched transactions
export const runBatchMatching = onCall(async (request) => {
  // Get all unmatched transactions
  // Run matcher on each
  // Create suggestions above threshold
  // Return stats
});
```

---

## Phase 3: Frontend - Transaction View

### 3.1 New Reconciliation Page

**Replace:** `src/app/(dashboard)/reconciliation/page.tsx`

Main layout:
```
┌─────────────────────────────────────────────────────────────────┐
│ Match Rate Bar: 67% ████████████░░░░░░ 89/133 transactions     │
├─────────────────────────────────────────────────────────────────┤
│ [All] [Unmatched (44)] [Suggested (12)] [Matched (89)]         │
├─────────────────────────────────────────────────────────────────┤
│ AI Search: [___________________________________________] 🔍    │
├─────────────────────────────────────────────────────────────────┤
│ Transaction List (scrollable)                                   │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ +$5,568.80 • Jan 15 • "STRIPE TRANSFER"                     ││
│ │ 💡 Suggested: INV-15998 to Acme Corp (92%)                  ││
│ │ [✅ Confirm] [🔍 Other Options] [📁 Categorize]             ││
│ └─────────────────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ -$2,399.25 • Jan 12 • "ACH AUSTEN CREATIONS"               ││
│ │ 💡 Suggested: Bill April Office Expenses (88%)              ││
│ │ [✅ Confirm] [🔍 Other Options] [📁 Categorize]             ││
│ └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Transaction Card Component

**New File:** `src/components/reconciliation/transaction-card.tsx`

States:
- Unmatched (needs attention)
- Suggested (AI has recommendation)
- Multiple options (ambiguous)
- Matched (done)
- Categorized (not a document)

### 3.3 Match Confirmation Dialog

**New File:** `src/components/reconciliation/confirm-match-dialog.tsx`

- Shows transaction details
- Shows matched document details
- AI reasoning explanation
- Confirm / Reject buttons

### 3.4 Multiple Options Dialog

**New File:** `src/components/reconciliation/match-options-dialog.tsx`

- Radio button list of candidates
- Confidence scores
- "None of these" option
- Search for different document

### 3.5 Split Payment Dialog

**New File:** `src/components/reconciliation/split-payment-dialog.tsx`

- Checkbox list of documents (same customer/vendor)
- Amount allocation inputs
- Running total validation

### 3.6 Category Picker

**New File:** `src/components/reconciliation/category-picker.tsx`

Categories:
- Bank Fees
- Transfers
- Subscriptions
- Interest
- Refunds
- Other (custom)

---

## Phase 4: Frontend - Document View

### 4.1 Update Bills Page

**File:** `src/app/(dashboard)/payables/bills/page.tsx`

Add columns:
- Payment Status (Unpaid / Partial / Paid)
- Amount Paid
- Amount Remaining
- Click row → see payment history

### 4.2 Update Invoices Page

**File:** `src/app/(dashboard)/receivables/invoices/page.tsx`

Same updates as bills page.

### 4.3 Bill/Invoice Detail - Payment Tab

**Update:** `src/app/(dashboard)/payables/bills/[billId]/page.tsx`
**Update:** `src/app/(dashboard)/receivables/invoices/[invoiceId]/page.tsx`

Add section:
```
┌─────────────────────────────────────────────────────────────────┐
│ 💰 PAYMENT HISTORY                                               │
├─────────────────────────────────────────────────────────────────┤
│ Total: $10,000.00                                                │
│ Paid: $7,500.00                                                  │
│ Remaining: $2,500.00                                             │
│                                                                   │
│ Payments:                                                        │
│ • Jan 15: $5,000.00 - "STRIPE TRANSFER" ✓                       │
│ • Jan 22: $2,500.00 - "ACH ACME CORP" ✓                         │
│                                                                   │
│ [🔍 Find Remaining Payment]                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 Find Payment Dialog

**New File:** `src/components/reconciliation/find-payment-dialog.tsx`

- Start from document, find matching transaction
- Uses same matching engine
- "Link Payment" action

---

## Phase 5: AI Integration & Learning

### 5.1 AI Match Search Function

**Update:** `functions/src/reconciliation/ai-agent.ts`

- Implement `aiMatchSearch()` from MATCHING-LOGIC.md
- Proper prompt engineering
- JSON response parsing
- Error handling

### 5.2 Learning Functions

**Update:** `functions/src/reconciliation/pattern-memory.ts`

- Implement `learnFromConfirmedMatch()`
- Implement `learnFromRejection()`
- Vendor pattern aggregation
- Keyword extraction

### 5.3 Connect Learning to UI

**Frontend actions that trigger learning:**
- Confirm match → `learnFromConfirmedMatch()`
- Reject suggestion → `learnFromRejection()`
- Manual match → `learnFromConfirmedMatch()` (higher weight)

### 5.4 Use Patterns in Matching

**Update:** `functions/src/reconciliation/matcher.ts`

- Load vendor patterns during matching
- Apply learned keyword matching
- Apply learned timing patterns
- Apply learned fee patterns

---

## Phase 6: Dashboard & Polish

### 6.1 Reconciliation Dashboard

**New File:** `src/components/reconciliation/dashboard.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 RECONCILIATION OVERVIEW                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Match Rate        Receivables        Payables                    │
│ ████████░░ 87%    12 invoices       23 bills                    │
│                   10 paid ✓          20 paid ✓                   │
│                   2 outstanding      3 outstanding               │
│                                                                   │
│ ⚠️ ACTION NEEDED                                                 │
│ • 17 transactions unmatched                                      │
│ • 8 AI suggestions waiting                                       │
│ • 2 invoices overdue                                             │
│                                                                   │
│ [Start Matching →]                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Match Rate Progress Bar

**New File:** `src/components/reconciliation/match-rate-bar.tsx`

- Visual progress indicator
- Gamification element
- Celebration at 100%

### 6.3 AI Learning Stats

**New File:** `src/components/reconciliation/learning-stats.tsx`

- Number of learned vendors
- Accuracy rate
- Recent improvements

### 6.4 Quick Actions

- Bulk confirm high-confidence suggestions
- Keyboard shortcuts (J/K to navigate, Enter to confirm)

---

## Implementation Checklist

### Phase 1: Data Model & Backend Foundation ✅ COMPLETE (Jan 30, 2026)
- [x] 1.1 Update Transaction type definition
- [x] 1.2 Update Bill/Invoice type definitions  
- [x] 1.3 Create ReconciliationMatch type
- [x] 1.4.1 Add `getUnmatchedItems()` function
- [x] 1.4.2 Update `getSuggestionsForTransaction()` to include bills
- [x] 1.4.3 Fix direction logic in matching (credits→invoices, debits→bills)
- [x] 1.4.4 Add `confirmMatchV2()` function
- [ ] 1.4.5 Add `confirmSplitMatch()` function (deferred to Phase 3)
- [x] 1.4.6 Add `categorizeTransactionV2()` function
- [x] 1.4.7 Add `unmatchTransactionV2()` function
- [x] 1.4.8 Add `getReconciliationStatsV2()` function
- [x] 1.5 Add Firestore indexes
- [x] Deploy functions

### Phase 2: Core Matching Engine ✅ COMPLETE (Jan 30, 2026)

#### 2.1 Rule-Based Pre-filtering (`matcher.ts`)
- [x] 5-signal scoring (Reference, Amount, Identity, Time, Context)
- [x] Fee pattern detection (Stripe 2.9%, PayPal, Square, Wise)
- [x] Basic keyword/invoice number extraction

#### 2.2 AI-POWERED MATCHING (`aiMatchTransaction`) ✅ NEW!
- [x] **Gemini 3 Flash** analyzes each transaction
- [x] **No hardcoded FX rates** - AI calculates conversions based on context
- [x] **Flexible matching** - AI can find partial payments, combined invoices, etc.
- [x] **Explains its reasoning** - Shows WHY it matched something
- [x] Deployed to Cloud Functions

**AI Matching Approach:**
1. Gather ALL unpaid bills/invoices
2. Get recent transaction patterns
3. Send everything to Gemini with context
4. AI returns matches with confidence and explanations

**Example prompt the AI receives:**
```
Transaction: 4,451.44 ANG debit, ref: INV-EXP102025
Bills: [INV-EXP102025: $2,458 USD, INV-15997: $6,568.80 USD, ...]

Your task: Find the best match. If currencies differ, calculate FX.
```

**Tested (Jan 30, 2026):**
- Transaction `LoxQHrqm` (4,451.44 ANG) should match bill `INV-EXP102025` ($2,458 USD)
- AI calculates: 4,451.44 ANG × 0.56 = $2,492.81 USD (1.4% diff)
- Reference "INV-EXP102025" matches exactly!

### Phase 3: Frontend - Transaction View
- [ ] 3.1 Rebuild reconciliation page layout
- [ ] 3.2 Create transaction-card component
- [ ] 3.3 Create confirm-match-dialog
- [ ] 3.4 Create match-options-dialog
- [ ] 3.5 Create split-payment-dialog
- [ ] 3.6 Create category-picker
- [ ] Wire up to backend functions
- [ ] Test full flow

### Phase 4: Frontend - Document View
- [ ] 4.1 Update bills page with payment columns
- [ ] 4.2 Update invoices page with payment columns
- [ ] 4.3 Add payment history tab to detail pages
- [ ] 4.4 Create find-payment-dialog
- [ ] Test document → transaction flow

### Phase 5: AI Integration & Learning
- [ ] 5.1 Implement `aiMatchSearch()` 
- [ ] 5.2 Implement learning functions
- [ ] 5.3 Connect UI to learning triggers
- [ ] 5.4 Apply patterns in matcher
- [ ] Test AI fallback scenarios

### Phase 6: Dashboard & Polish
- [ ] 6.1 Build reconciliation dashboard
- [ ] 6.2 Add match rate progress bar
- [ ] 6.3 Add learning stats display
- [ ] 6.4 Add quick actions & keyboard shortcuts
- [ ] Final testing & polish

---

## Migration Strategy

### For Existing Data

```typescript
// One-time migration script
async function migrateExistingData() {
  // 1. Update all existing transactions
  // Set reconciliationStatus = "unmatched" if no matchedDocumentId
  // Set reconciliationStatus = "matched" if has matchedDocumentId
  
  // 2. Update all existing bills
  // Set paymentStatus = "unpaid" if amountPaid = 0
  // Set paymentStatus = "paid" if amountPaid >= total
  // Set amountRemaining = total - amountPaid
  
  // 3. Update all existing invoices
  // Same as bills
  
  // 4. Run batch matching on all unmatched transactions
  // Generate initial suggestions
}
```

---

## Testing Plan

### Unit Tests
- Matching score calculations
- Fee pattern detection
- Keyword extraction
- Amount tolerance checks

### Integration Tests
- Full match confirmation flow
- Split payment allocation
- Unmatch and rematch

### E2E Tests
- Upload statement → see transactions
- Confirm AI suggestion
- Manually match transaction
- Categorize transaction

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Matching accuracy too low | Start with manual confirm always, tune thresholds |
| AI costs too high | Cache suggestions, only call AI when needed |
| Learning takes too long | Seed with common patterns |
| Split payments complex | Start with single-document matches only |

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Match rate after 1 week | 70%+ |
| AI suggestion accuracy | 80%+ |
| First-option acceptance | 85%+ |
| Time to reconcile (per session) | < 10 minutes |
| Auto-match rate (no user input) | 50%+ |

---

## Recommended Starting Point

**Start with Phase 1.4.2 and 1.4.3** - Fix the backend to include bills and correct the direction logic. This unblocks everything else and has highest impact.

Then build frontend incrementally, testing each component before moving on.
