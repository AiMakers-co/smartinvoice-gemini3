# 🧠 Advanced Payment Matching Logic

> This document defines the sophisticated matching algorithm for linking bank transactions to invoices and bills.

---

## The Data We Have

### Invoice Data (Rich)
```typescript
{
  invoiceNumber: "INV-2024-003",
  customerName: "Acme Corporation",
  customerEmail: "billing@acme.com",
  
  // Amounts
  subtotal: 9500,
  taxAmount: 500,
  total: 10000,
  currency: "USD",
  
  // Dates (CRITICAL for matching)
  invoiceDate: "2024-01-15",    // When invoice was created
  dueDate: "2024-02-15",        // When payment expected
  
  // Payment terms
  paymentTerms: "Net 30",       // Or "50% deposit, 50% on delivery"
  
  // Tracking
  amountPaid: 0,
  amountRemaining: 10000,
  payments: []
}
```

### Transaction Data (Often Cryptic)
```typescript
{
  date: "2024-02-10",
  amount: 10000,
  type: "credit",
  description: "ACH CREDIT ACME CORP 02938473",  // Sometimes helpful
  // OR
  description: "STRIPE TRANSFER",                 // Not helpful at all
  reference: "TXN29384",
  balance: 45230
}
```

---

## The Challenge: Many Matching Scenarios

### Scenario 1: Perfect Match ✅
```
Invoice: INV-001, $5,000, to "Acme Corp", due Jan 15
Payment: Jan 14, +$5,000, "ACME CORP PAYMENT INV001"

Match signals:
✓ Exact amount
✓ Customer name in description
✓ Invoice number in description
✓ Date within expected window

Confidence: 95%+ → Auto-match
```

### Scenario 2: Cryptic Bank Description 🔍
```
Invoice: INV-002, $2,500, to "John Smith Consulting", due Feb 1
Payment: Feb 3, +$2,500, "ACH CREDIT 02938473"

Match signals:
✓ Exact amount
✗ No customer name
✗ No invoice reference
✓ Date makes sense (2 days after due)

Problem: Could match ANY $2,500 invoice!

Solution: 
- Check if $2,500 is unique in unpaid invoices
- Check date proximity to this specific invoice
- Check if this account typically receives payments from this client
- If ambiguous, present options to user
```

### Scenario 3: Payment Processor (Stripe/PayPal) 💳
```
Invoice: INV-003, $10,000, to "BigCorp", due Mar 15
Payment: Mar 15, +$9,710, "STRIPE TRANSFER"

Match signals:
✓ Amount is $10,000 - 2.9% = $9,710 ← Stripe fee pattern!
✓ Date on due date
✗ No customer name (Stripe batches payments)
? Need to check: which invoice was paid via Stripe that day?

Solution:
- Recognize Stripe fee pattern (2.9% + $0.30)
- Check for Stripe payment records if integrated
- Look at invoice notes for "paid via card"
- Match based on reverse-calculated original amount
```

### Scenario 4: One Payment, Multiple Invoices 📦
```
Invoice: INV-004, $1,000, to "RetailCo"
Invoice: INV-005, $2,000, to "RetailCo"  
Payment: +$3,000, "RETAILCO MONTHLY"

Match signals:
✓ $3,000 = $1,000 + $2,000 (sum of invoices to same customer)
✓ Customer name matches
✓ Both invoices unpaid

Solution:
- Detect sum combinations for same customer
- Allow user to allocate: "Split $3,000 → $1,000 to INV-004, $2,000 to INV-005"
```

### Scenario 5: One Invoice, Multiple Payments 💰
```
Invoice: INV-006, $50,000, terms: "50% deposit, 50% on delivery"
Payment 1: +$25,000, "STARTUPXYZ DEPOSIT" (Jan 1)
Payment 2: +$25,000, "STARTUPXYZ FINAL" (Feb 1)

Match signals:
✓ Each payment is exactly 50%
✓ Same customer
✓ Matches payment terms pattern

Solution:
- Track partial payments as array
- Update invoice: amountPaid = 25000, then 50000
- Show status: "Partial (50%)" → "Paid (100%)"
```

### Scenario 6: Payment Before Invoice (Deposit/Retainer) ⏰
```
Payment: Jan 1, +$10,000, "CLIENT RETAINER"
Invoice: INV-007, $10,000, created Jan 15

Match signals:
✓ Amount matches
✓ Customer name matches  
✗ Payment came BEFORE invoice date

Solution:
- Allow matching to future invoices (within reason)
- Flag as "Advance Payment / Deposit"
- Common for retainer/deposit business models
```

### Scenario 7: Rounding / Minor Differences 🔢
```
Invoice: INV-008, $1,000.00
Payment: +$1,000.50

Or:
Invoice: INV-009, $999.99
Payment: +$1,000.00

Solution:
- Allow small tolerance (< $1 or < 0.1%)
- Flag the difference for review
- Common with international transfers, rounding
```

### Scenario 8: Currency Conversion 💱
```
Invoice: INV-010, €5,000
Payment: +$5,450 USD

Solution:
- Check FX rate on payment date
- €5,000 × 1.09 = $5,450 ✓
- Match with "Currency conversion" note
```

### Scenario 9: Installment Payments 📅
```
Invoice: INV-011, $12,000, terms: "3 monthly installments"
Payment 1: +$4,000 (Jan)
Payment 2: +$4,000 (Feb)
Payment 3: +$4,000 (Mar)

Solution:
- Recognize $4,000 = $12,000 / 3
- Link all three payments to one invoice
- Track: 33% → 67% → 100% paid
```

### Scenario 10: Duplicate/Repeated Amounts 🔁
```
Invoice A: $500, to Customer X
Invoice B: $500, to Customer Y
Invoice C: $500, to Customer Z
Payment: +$500

Problem: Which invoice?

Solution:
- CANNOT match on amount alone when duplicates exist
- Must use other signals: name, date, reference
- If ambiguous: present all options to user
- Learn from user choice for future
```

---

## The Matching Algorithm

### Phase 1: Data Enrichment

Before matching, enrich transaction data:

```typescript
function enrichTransaction(tx: Transaction): EnrichedTransaction {
  return {
    ...tx,
    
    // Extract potential references from description
    extractedReferences: extractInvoiceNumbers(tx.description),
    // ["INV2024003", "PO12345"]
    
    // Extract potential names
    extractedNames: extractNames(tx.description),
    // ["ACME", "CORP"]
    
    // Detect payment processor
    paymentProcessor: detectProcessor(tx.description),
    // "stripe" | "paypal" | "wise" | null
    
    // Calculate fee-adjusted amounts
    possibleOriginalAmounts: calculateFeeReversals(tx.amount),
    // [10000, 10290.30] (if Stripe pattern detected)
  };
}
```

### Phase 2: Candidate Generation

Find ALL possible matches, don't filter yet:

```typescript
function findCandidates(tx: Transaction, documents: Document[]): Candidate[] {
  const candidates: Candidate[] = [];
  
  for (const doc of documents) {
    // Skip if wrong direction
    if (tx.type === "credit" && doc.type !== "invoice") continue;
    if (tx.type === "debit" && doc.type !== "bill") continue;
    
    // Skip if already fully paid
    if (doc.amountRemaining <= 0) continue;
    
    // Check if there's ANY possible connection
    const signals = analyzeMatch(tx, doc);
    
    if (signals.hasAnyConnection) {
      candidates.push({
        transaction: tx,
        document: doc,
        signals,
      });
    }
  }
  
  return candidates;
}
```

### Phase 3: Signal Analysis (The Core Logic)

```typescript
interface MatchSignals {
  // Reference matching
  referenceMatch: {
    found: boolean;
    type: "exact" | "partial" | "none";
    value?: string;
    score: number;  // 0-40
  };
  
  // Amount matching
  amountMatch: {
    type: "exact" | "fee_adjusted" | "partial" | "sum_match" | "none";
    difference: number;
    differencePercent: number;
    feePattern?: string;  // "stripe_2.9" | "paypal_2.9"
    score: number;  // 0-35
  };
  
  // Identity matching
  identityMatch: {
    nameFound: boolean;
    nameSimilarity: number;  // 0-1
    learnedPattern: boolean;  // From previous matches
    score: number;  // 0-25
  };
  
  // Time matching
  timeMatch: {
    daysFromInvoice: number;
    daysFromDue: number;
    withinExpectedWindow: boolean;
    beforeInvoice: boolean;  // Deposit scenario
    score: number;  // 0-20
  };
  
  // Context
  context: {
    isUniqueAmount: boolean;       // Is this amount unique among candidates?
    sameCustomerOtherInvoices: number;  // Other unpaid invoices from same customer
    historicalPattern: boolean;    // Matches learned behavior
    score: number;  // 0-10
  };
  
  // Totals
  totalScore: number;  // Sum of all scores
  maxPossibleScore: number;  // 130
  confidence: number;  // totalScore / maxPossibleScore * 100
  
  // Flags
  hasAnyConnection: boolean;
  requiresUserConfirmation: boolean;
  ambiguousWithOthers: boolean;
}
```

### Phase 4: Scoring Details

#### Reference Score (0-40 points)
```typescript
function scoreReference(tx: EnrichedTransaction, doc: Document): number {
  const docNumber = normalizeRef(doc.documentNumber);
  
  for (const ref of tx.extractedReferences) {
    if (normalizeRef(ref) === docNumber) {
      return 40;  // Exact match
    }
    if (docNumber.includes(ref) || ref.includes(docNumber)) {
      return 30;  // Partial match
    }
    if (levenshteinSimilarity(ref, docNumber) > 0.8) {
      return 25;  // Fuzzy match (typos)
    }
  }
  
  return 0;
}
```

#### Amount Score (0-35 points)
```typescript
function scoreAmount(tx: Transaction, doc: Document): AmountScore {
  const txAmount = Math.abs(tx.amount);
  const docAmount = doc.amountRemaining;  // What's still owed
  
  // Exact match
  if (Math.abs(txAmount - docAmount) < 0.01) {
    return { type: "exact", score: 35, difference: 0 };
  }
  
  // Check for fee-adjusted match (Stripe, PayPal, etc.)
  const feePatterns = [
    { name: "stripe", rate: 0.029, fixed: 0.30 },
    { name: "paypal", rate: 0.029, fixed: 0.30 },
    { name: "square", rate: 0.026, fixed: 0.10 },
  ];
  
  for (const fee of feePatterns) {
    const expectedAfterFee = docAmount * (1 - fee.rate) - fee.fixed;
    if (Math.abs(txAmount - expectedAfterFee) < 1) {
      return { 
        type: "fee_adjusted", 
        score: 30, 
        difference: docAmount - txAmount,
        feePattern: fee.name 
      };
    }
  }
  
  // Partial payment (tx is less than doc, and reasonable percentage)
  if (txAmount < docAmount && txAmount >= docAmount * 0.1) {
    const pct = txAmount / docAmount;
    // Common percentages: 50%, 33%, 25%
    const isCleanSplit = [0.5, 0.333, 0.25, 0.2].some(p => Math.abs(pct - p) < 0.02);
    return {
      type: "partial",
      score: isCleanSplit ? 25 : 15,
      difference: docAmount - txAmount,
      percentPaid: pct
    };
  }
  
  // Within tolerance (< 5% difference)
  const diffPct = Math.abs(txAmount - docAmount) / docAmount;
  if (diffPct < 0.05) {
    return {
      type: "approximate",
      score: 20,
      difference: txAmount - docAmount,
      differencePercent: diffPct
    };
  }
  
  return { type: "none", score: 0, difference: txAmount - docAmount };
}
```

#### Identity Score (0-25 points)
```typescript
function scoreIdentity(tx: EnrichedTransaction, doc: Document): number {
  const customerName = doc.customerName || doc.vendorName;
  const description = tx.description.toLowerCase();
  const customerLower = customerName.toLowerCase();
  
  // Exact name found
  if (description.includes(customerLower)) {
    return 25;
  }
  
  // Check extracted names against customer
  for (const name of tx.extractedNames) {
    const similarity = stringSimilarity(name, customerLower);
    if (similarity > 0.8) return 22;
    if (similarity > 0.6) return 15;
  }
  
  // Check learned patterns
  const pattern = await getVendorPattern(userId, customerName);
  if (pattern) {
    // Check if description matches known keywords
    for (const keyword of pattern.transactionKeywords) {
      if (description.includes(keyword.toLowerCase())) {
        return 20;  // Learned pattern match
      }
    }
    
    // Check payment processor
    if (pattern.paymentProcessor && 
        tx.paymentProcessor === pattern.paymentProcessor) {
      return 15;  // Same processor as historical payments
    }
  }
  
  return 0;
}
```

#### Time Score (0-20 points)
```typescript
function scoreTime(tx: Transaction, doc: Document): TimeScore {
  const txDate = tx.date.toDate();
  const invoiceDate = doc.documentDate?.toDate();
  const dueDate = doc.dueDate?.toDate();
  
  // Days from invoice creation
  const daysFromInvoice = Math.floor((txDate - invoiceDate) / (1000*60*60*24));
  
  // Days from due date
  const daysFromDue = dueDate 
    ? Math.floor((txDate - dueDate) / (1000*60*60*24))
    : null;
  
  let score = 0;
  
  // Payment before invoice (deposit scenario)
  if (daysFromInvoice < 0) {
    // Allow up to 30 days before invoice
    if (daysFromInvoice >= -30) {
      return { 
        score: 10, 
        beforeInvoice: true,
        note: "Advance payment / deposit"
      };
    }
    return { score: 0, beforeInvoice: true, tooEarly: true };
  }
  
  // Payment relative to due date
  if (daysFromDue !== null) {
    if (daysFromDue >= -3 && daysFromDue <= 3) {
      score = 20;  // Within 3 days of due date - perfect
    } else if (daysFromDue >= -7 && daysFromDue <= 7) {
      score = 15;  // Within a week
    } else if (daysFromDue >= -14 && daysFromDue <= 30) {
      score = 10;  // Reasonable window
    } else if (daysFromDue <= 60) {
      score = 5;   // Late but possible
    }
  } else {
    // No due date - use invoice date
    if (daysFromInvoice <= 7) score = 15;
    else if (daysFromInvoice <= 30) score = 10;
    else if (daysFromInvoice <= 60) score = 5;
  }
  
  return { 
    score, 
    daysFromInvoice, 
    daysFromDue,
    withinExpectedWindow: score >= 10
  };
}
```

#### Context Score (0-10 points)
```typescript
function scoreContext(
  tx: Transaction, 
  doc: Document, 
  allCandidates: Candidate[]
): number {
  let score = 0;
  
  // Is this amount unique among all candidates?
  const sameAmountCandidates = allCandidates.filter(c => 
    Math.abs(c.document.amountRemaining - doc.amountRemaining) < 0.01
  );
  if (sameAmountCandidates.length === 1) {
    score += 5;  // Unique amount - more confident
  } else {
    score -= 5;  // Ambiguous - less confident
  }
  
  // Does customer have pattern of this amount?
  const historicalPayments = await getCustomerPayments(doc.customerName);
  const typicalAmounts = historicalPayments.map(p => p.amount);
  if (typicalAmounts.includes(tx.amount)) {
    score += 3;  // Typical amount for this customer
  }
  
  // First-time customer?
  if (historicalPayments.length === 0) {
    score -= 2;  // Less historical data to work with
  }
  
  return Math.max(0, score);
}
```

### Phase 5: Decision Making

```typescript
function makeMatchDecision(candidates: ScoredCandidate[]): MatchDecision {
  // Sort by confidence
  const sorted = candidates.sort((a, b) => b.confidence - a.confidence);
  
  const best = sorted[0];
  const secondBest = sorted[1];
  
  // High confidence, clear winner
  if (best.confidence >= 85 && (!secondBest || best.confidence - secondBest.confidence > 20)) {
    return {
      action: "auto_match",
      match: best,
      reason: "High confidence with clear margin"
    };
  }
  
  // Good confidence, present for confirmation
  if (best.confidence >= 60) {
    return {
      action: "suggest",
      match: best,
      alternatives: sorted.slice(1, 4),
      reason: "Good confidence, user should confirm"
    };
  }
  
  // Multiple similar candidates
  if (secondBest && Math.abs(best.confidence - secondBest.confidence) < 10) {
    return {
      action: "present_options",
      options: sorted.slice(0, 5),
      reason: "Multiple similar matches, user must choose"
    };
  }
  
  // Low confidence
  if (best.confidence >= 40) {
    return {
      action: "suggest_with_warning",
      match: best,
      warning: "Low confidence - please verify",
      reason: "Weak match signals"
    };
  }
  
  // No good matches
  return {
    action: "no_match",
    reason: "No candidates meet minimum threshold"
  };
}
```

---

## Sum Matching (Multiple Documents to One Payment)

```typescript
function findSumMatches(
  tx: Transaction, 
  documents: Document[]
): SumMatchCandidate[] {
  const results: SumMatchCandidate[] = [];
  const txAmount = Math.abs(tx.amount);
  
  // Group documents by customer/vendor
  const byCustomer = groupBy(documents, d => d.customerName || d.vendorName);
  
  for (const [customer, docs] of Object.entries(byCustomer)) {
    // Only consider unpaid documents
    const unpaid = docs.filter(d => d.amountRemaining > 0);
    
    // Find combinations that sum to payment amount
    const combinations = findCombinations(
      unpaid.map(d => d.amountRemaining),
      txAmount,
      0.01  // tolerance
    );
    
    for (const combo of combinations) {
      results.push({
        transaction: tx,
        documents: combo.indices.map(i => unpaid[i]),
        totalAmount: combo.sum,
        difference: txAmount - combo.sum,
        customerName: customer,
        confidence: calculateSumConfidence(tx, combo, customer)
      });
    }
  }
  
  return results.sort((a, b) => b.confidence - a.confidence);
}

function findCombinations(
  amounts: number[], 
  target: number, 
  tolerance: number,
  maxItems: number = 5
): Combination[] {
  const results: Combination[] = [];
  
  function search(index: number, currentSum: number, indices: number[]) {
    // Found a match
    if (Math.abs(currentSum - target) <= tolerance) {
      results.push({ indices: [...indices], sum: currentSum });
      return;
    }
    
    // Stop conditions
    if (indices.length >= maxItems) return;
    if (currentSum > target + tolerance) return;
    if (index >= amounts.length) return;
    if (results.length >= 10) return;  // Limit results
    
    // Include this amount
    search(index + 1, currentSum + amounts[index], [...indices, index]);
    
    // Skip this amount
    search(index + 1, currentSum, indices);
  }
  
  search(0, 0, []);
  return results;
}
```

---

## Partial Payment Tracking

```typescript
interface PaymentAllocation {
  transactionId: string;
  transactionDate: Timestamp;
  transactionDescription: string;
  amount: number;           // Amount applied to this document
  allocatedAt: Timestamp;
  allocatedBy: string;
  confidence: number;
  method: "auto" | "ai_suggested" | "manual";
}

interface DocumentPaymentState {
  total: number;
  payments: PaymentAllocation[];
  amountPaid: number;       // Sum of payments[].amount
  amountRemaining: number;  // total - amountPaid
  paymentStatus: "unpaid" | "partial" | "paid" | "overpaid";
}

// When linking a payment
async function linkPayment(
  documentId: string,
  transactionId: string,
  amount: number,  // How much of this payment applies
  method: "auto" | "ai_suggested" | "manual"
) {
  const doc = await getDocument(documentId);
  const tx = await getTransaction(transactionId);
  
  // Create allocation
  const allocation: PaymentAllocation = {
    transactionId,
    transactionDate: tx.date,
    transactionDescription: tx.description,
    amount,
    allocatedAt: Timestamp.now(),
    allocatedBy: userId,
    confidence: 100,  // User confirmed
    method
  };
  
  // Update document
  const newAmountPaid = doc.amountPaid + amount;
  const newAmountRemaining = doc.total - newAmountPaid;
  
  let newStatus: PaymentStatus;
  if (newAmountRemaining <= 0.01) {
    newStatus = newAmountRemaining < -0.01 ? "overpaid" : "paid";
  } else if (newAmountPaid > 0) {
    newStatus = "partial";
  } else {
    newStatus = "unpaid";
  }
  
  await updateDocument(documentId, {
    payments: [...doc.payments, allocation],
    amountPaid: newAmountPaid,
    amountRemaining: Math.max(0, newAmountRemaining),
    paymentStatus: newStatus
  });
  
  // Update transaction
  await updateTransaction(transactionId, {
    reconciliationStatus: "matched",
    allocations: [...(tx.allocations || []), {
      documentId,
      documentType: doc.type,
      amount,
      allocatedAt: Timestamp.now()
    }]
  });
}
```

---

## User Flow for Ambiguous Matches

When AI can't determine the match automatically:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🤔 This payment could match multiple invoices                    │
│                                                                   │
│ Payment: +$500.00 • Feb 10 • "ACH CREDIT 29384"                 │
│                                                                   │
│ Which invoice is this for?                                       │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ INV-2024-001 • John Smith • $500.00 • Due Feb 5           │ │
│ │   65% match • Amount exact, date 5 days after due           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ INV-2024-008 • Jane Doe • $500.00 • Due Feb 12            │ │
│ │   60% match • Amount exact, date 2 days before due          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ None of these - search other invoices                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ Not an invoice payment - categorize as: [________▾]       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│                                        [Cancel] [Confirm Match]  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Learning from User Decisions

Every user confirmation teaches the system:

```typescript
async function learnFromMatch(
  transaction: Transaction,
  document: Document,
  wasCorrect: boolean
) {
  if (!wasCorrect) return;  // Don't learn from rejections yet
  
  const customerName = document.customerName || document.vendorName;
  
  // Update vendor pattern
  await updateVendorPattern(userId, customerName, {
    // Add new keywords from this transaction
    transactionKeywords: extractKeywords(transaction.description),
    
    // Update typical payment timing
    typicalPaymentDelay: daysFromInvoice,
    
    // Note payment processor if detected
    paymentProcessor: detectProcessor(transaction.description),
    
    // Update amount patterns
    typicalAmounts: transaction.amount,
    
    // Increment confidence
    matchCount: increment(1),
    confidence: recalculateConfidence()
  });
}
```

---

## Summary: Priority Order for Matching

1. **Reference Match** - Invoice # in transaction description (strongest signal)
2. **Identity + Amount** - Customer name AND amount match
3. **Amount + Time** - Unique amount within expected payment window
4. **Learned Pattern** - Historical payment behavior matches
5. **Amount Only** - Last resort, only if unique

**Never auto-match on amount alone if duplicates exist!**

---

## Configuration Thresholds

```typescript
const MATCHING_CONFIG = {
  // Score thresholds
  AUTO_MATCH_THRESHOLD: 85,      // Auto-confirm without user
  SUGGEST_THRESHOLD: 60,         // Show as suggestion
  MINIMUM_THRESHOLD: 40,         // Don't show below this
  
  // Amount tolerances
  EXACT_MATCH_TOLERANCE: 0.01,   // $0.01 difference OK
  FEE_DETECTION_TOLERANCE: 1.00, // $1 tolerance for fee patterns
  PARTIAL_MINIMUM_PERCENT: 0.10, // At least 10% of invoice
  
  // Time windows
  ADVANCE_PAYMENT_MAX_DAYS: 30,  // Allow payments up to 30 days before invoice
  LATE_PAYMENT_MAX_DAYS: 90,     // Consider payments up to 90 days late
  
  // Combination limits
  MAX_INVOICES_PER_PAYMENT: 10,  // Max invoices one payment can cover
  MAX_PAYMENTS_PER_INVOICE: 20,  // Max payments one invoice can receive
};
```

---

## 🤖 AI-Powered Match Search

When the rule-based algorithm is uncertain, we use AI to reason about potential matches.

### When to Use AI

| Scenario | Trigger AI? |
|----------|------------|
| No candidates above 60% confidence | ✅ Yes |
| Multiple candidates within 10% of each other | ✅ Yes |
| User clicks "Find Match" on unmatched item | ✅ Yes |
| Large amount with no obvious match | ✅ Yes |
| High confidence single match | ❌ No (rules are enough) |

### AI Match Search Function

```typescript
interface AIMatchRequest {
  // The item we're trying to match
  item: Transaction | Document;
  itemType: "transaction" | "invoice" | "bill";
  
  // Context for AI
  candidates: Candidate[];           // Rule-based candidates (if any)
  recentMatches: MatchHistory[];     // Last 20 matches for context
  vendorPatterns: VendorPattern[];   // Learned patterns
  
  // User query (if searching)
  userQuery?: string;  // "Find the payment for this invoice"
}

interface AIMatchResponse {
  suggestions: AIMatchSuggestion[];
  reasoning: string;                 // AI's explanation
  confidence: number;                // AI's overall confidence
  needsMoreInfo?: string;            // "Can you tell me the customer name?"
}

interface AIMatchSuggestion {
  documentId?: string;
  transactionId?: string;
  confidence: number;
  reason: string;                    // Human-readable explanation
  matchType: "exact" | "partial" | "fee_adjusted" | "split" | "deposit";
  allocation?: number;               // If partial, how much to allocate
}
```

### AI Prompt Design

```typescript
const AI_MATCH_PROMPT = `
You are a financial reconciliation expert. Your job is to find the best match 
between bank transactions and invoices/bills.

## Context
User ID: {userId}
Business type: {businessType}
Typical payment methods: {paymentMethods}

## The Item to Match
{itemDetails}

## Candidate Documents/Transactions
{candidatesList}

## Learned Patterns
These patterns have been learned from previous confirmed matches:
{learnedPatterns}

## Recent Match History
{recentMatchHistory}

## Your Task
1. Analyze the item and candidates
2. Consider ALL possible explanations:
   - Direct match (same amount, same party)
   - Fee-adjusted match (Stripe, PayPal, bank fees)
   - Partial payment (deposit, installment)
   - Combined payment (multiple documents)
   - Currency conversion
   - Timing (early payment, late payment, deposit)

3. Rank the candidates by likelihood
4. Explain your reasoning clearly
5. If uncertain, say so and explain what additional info would help

## Output Format
Return JSON:
{
  "suggestions": [
    {
      "documentId": "xxx" | null,
      "transactionId": "xxx" | null,
      "confidence": 0-100,
      "reason": "Clear explanation of why this matches",
      "matchType": "exact" | "partial" | "fee_adjusted" | "split" | "deposit",
      "allocation": 1000  // Only if partial
    }
  ],
  "reasoning": "Overall analysis explanation",
  "confidence": 0-100,
  "needsMoreInfo": null | "What info would help"
}
`;
```

### AI Search Implementation

```typescript
async function aiMatchSearch(request: AIMatchRequest): Promise<AIMatchResponse> {
  const { item, itemType, candidates, recentMatches, vendorPatterns } = request;
  
  // Build context for AI
  const context = {
    itemDetails: formatItemForAI(item, itemType),
    candidatesList: formatCandidatesForAI(candidates),
    learnedPatterns: formatPatternsForAI(vendorPatterns),
    recentMatchHistory: formatHistoryForAI(recentMatches),
  };
  
  // Call Gemini
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  const prompt = AI_MATCH_PROMPT
    .replace("{itemDetails}", context.itemDetails)
    .replace("{candidatesList}", context.candidatesList)
    .replace("{learnedPatterns}", context.learnedPatterns)
    .replace("{recentMatchHistory}", context.recentMatchHistory);
  
  const result = await model.generateContent(prompt);
  const response = JSON.parse(result.response.text());
  
  // Log for debugging & learning
  await logAIMatchAttempt(request, response);
  
  return response;
}

function formatItemForAI(item: Transaction | Document, type: string): string {
  if (type === "transaction") {
    const tx = item as Transaction;
    return `
TRANSACTION TO MATCH:
- Date: ${tx.date.toDate().toISOString().split('T')[0]}
- Amount: ${tx.currency || 'USD'} ${Math.abs(tx.amount).toFixed(2)}
- Type: ${tx.type} (${tx.type === 'credit' ? 'money IN' : 'money OUT'})
- Description: "${tx.description}"
- Reference: ${tx.reference || 'none'}
- Account: ${tx.accountId}
    `;
  } else {
    const doc = item as Document;
    return `
${type.toUpperCase()} TO MATCH:
- Number: ${doc.documentNumber}
- ${doc.customerName ? `Customer: ${doc.customerName}` : `Vendor: ${doc.vendorName}`}
- Amount: ${doc.currency} ${doc.total.toFixed(2)}
- Amount Remaining: ${doc.currency} ${doc.amountRemaining.toFixed(2)}
- Invoice Date: ${doc.documentDate?.toDate().toISOString().split('T')[0]}
- Due Date: ${doc.dueDate?.toDate().toISOString().split('T')[0] || 'not set'}
- Status: ${doc.paymentStatus}
- Existing Payments: ${doc.payments?.length || 0}
    `;
  }
}
```

---

## 🎯 Presenting Options to Users

### Match Suggestion Card

```
┌─────────────────────────────────────────────────────────────────┐
│ 🤖 AI found a likely match                                       │
│                                                                   │
│ Transaction: +$9,710.00 • Jan 15 • "STRIPE TRANSFER"            │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📄 Invoice INV-2024-003                            92% ✓    │ │
│ │    Acme Corporation • $10,000.00                            │ │
│ │                                                              │ │
│ │    💡 Why this match:                                       │ │
│ │    • Amount $9,710 = $10,000 - 2.9% Stripe fee             │ │
│ │    • Acme typically pays via Stripe                         │ │
│ │    • Payment date matches expected window                   │ │
│ │                                                              │ │
│ │    [✅ Confirm Match]  [👁️ View Invoice]                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ Other possibilities:                                              │
│ • INV-2024-007 to Beta Corp ($9,700) - 45%                      │
│                                                                   │
│ [🔍 Search All] [📁 Not an Invoice - Categorize]                │
└─────────────────────────────────────────────────────────────────┘
```

### Multiple Options View

```
┌─────────────────────────────────────────────────────────────────┐
│ 🤔 Multiple possible matches                                     │
│                                                                   │
│ Transaction: +$500.00 • Feb 10 • "ACH CREDIT 29384"             │
│                                                                   │
│ Select the correct match:                                        │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ INV-2024-001 • John Smith Consulting              65%    │ │
│ │   $500.00 • Due Feb 5 • 5 days late                         │ │
│ │   "Amount exact, timing reasonable"                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ INV-2024-008 • Jane Doe Design                    62%    │ │
│ │   $500.00 • Due Feb 12 • 2 days early                       │ │
│ │   "Amount exact, early payment"                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ INV-2024-012 • Bob's Agency                       58%    │ │
│ │   $500.00 • Due Feb 20 • 10 days early                      │ │
│ │   "Amount exact, very early payment"                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ○ None of these                                             │ │
│ │   [🔍 Search for another invoice]                           │ │
│ │   [📁 Categorize as: ____________]                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│                                              [Confirm Selection] │
└─────────────────────────────────────────────────────────────────┘
```

### Split Payment Dialog

```
┌─────────────────────────────────────────────────────────────────┐
│ 💰 Split payment across multiple invoices                        │
│                                                                   │
│ Payment: +$3,000.00 • "RETAILCO PAYMENT"                        │
│                                                                   │
│ AI suggests this covers 2 invoices to RetailCo:                 │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☑️ INV-2024-004 • RetailCo                                  │ │
│ │    Invoice total: $1,000.00                                  │ │
│ │    Allocate: [$1,000.00_____]  ← Full amount                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ☑️ INV-2024-005 • RetailCo                                  │ │
│ │    Invoice total: $2,000.00                                  │ │
│ │    Allocate: [$2,000.00_____]  ← Full amount                │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ───────────────────────────────────────────────────────────────  │
│ Payment amount:        $3,000.00                                 │
│ Total allocated:       $3,000.00                                 │
│ Remaining:             $0.00 ✓                                   │
│                                                                   │
│                              [Cancel] [Confirm Split Allocation] │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📚 Learning System

### What We Learn From Each Match

```typescript
interface MatchLearning {
  // The match that was confirmed
  transactionId: string;
  documentId: string;
  documentType: "invoice" | "bill";
  
  // Match details
  transactionAmount: number;
  documentAmount: number;
  amountDifference: number;
  daysBetweenInvoiceAndPayment: number;
  
  // Signals that led to match
  hadReferenceMatch: boolean;
  hadNameMatch: boolean;
  hadExactAmount: boolean;
  wasFeesDeducted: boolean;
  feePercentage?: number;
  wasPartialPayment: boolean;
  wasSplitPayment: boolean;
  
  // AI involvement
  wasAISuggested: boolean;
  aiConfidence?: number;
  userSelectedFromOptions: boolean;
  optionRank?: number;  // 1 = first option, 2 = second, etc.
  
  // Context
  customerOrVendor: string;
  paymentProcessor?: string;
  transactionKeywords: string[];
  
  // Outcome
  wasCorrect: boolean;  // Did user later unmatch this?
  confirmedAt: Timestamp;
  confirmedBy: string;
}
```

### Learning Aggregation

```typescript
interface VendorLearning {
  vendorName: string;
  userId: string;
  
  // Aggregated from all matches
  totalMatches: number;
  
  // Payment patterns
  typicalPaymentDelayDays: number;      // Average days after invoice
  paymentDelayStdDev: number;           // Variance in timing
  paymentDelayRange: { min: number; max: number };
  
  // Amount patterns
  typicalAmounts: number[];             // Common amounts
  averageAmount: number;
  usesRoundNumbers: boolean;            // $1000, $5000, etc.
  
  // Fee patterns
  feesTypicallyDeducted: boolean;
  typicalFeePercentage?: number;
  feeProcessor?: string;               // "stripe", "paypal"
  
  // Payment method patterns
  paymentProcessors: string[];         // ["stripe", "ach"]
  preferredProcessor?: string;         // Most common
  
  // Description patterns
  transactionKeywords: string[];       // Words that appear in their payments
  keywordFrequency: Record<string, number>;
  
  // Installment patterns
  usesInstallments: boolean;
  typicalInstallmentCount?: number;
  installmentPercentages?: number[];   // [50, 50] or [33, 33, 34]
  
  // Aliases
  knownAliases: string[];              // "ACME", "ACME CORP", "ACME INC"
  
  // Confidence
  learningConfidence: number;          // Higher with more data points
  lastMatchAt: Timestamp;
  lastUpdatedAt: Timestamp;
}
```

### Learning Pipeline

```typescript
async function learnFromConfirmedMatch(
  match: ConfirmedMatch,
  wasManual: boolean
): Promise<void> {
  
  // 1. Record the raw match learning
  await db.collection("match_learnings").add({
    ...extractLearningData(match),
    wasManual,
    recordedAt: Timestamp.now()
  });
  
  // 2. Update vendor-specific patterns
  const vendorName = match.document.customerName || match.document.vendorName;
  const existingPattern = await getVendorPattern(userId, vendorName);
  
  if (existingPattern) {
    await updateVendorPattern(existingPattern.id, {
      // Update averages with new data point
      totalMatches: existingPattern.totalMatches + 1,
      
      // Recalculate timing patterns
      typicalPaymentDelayDays: recalculateAverage(
        existingPattern.typicalPaymentDelayDays,
        existingPattern.totalMatches,
        match.daysBetweenInvoiceAndPayment
      ),
      
      // Add new keywords
      transactionKeywords: mergeKeywords(
        existingPattern.transactionKeywords,
        extractKeywords(match.transaction.description)
      ),
      
      // Update fee patterns
      ...(match.wasFeesDeducted && {
        feesTypicallyDeducted: true,
        typicalFeePercentage: match.feePercentage
      }),
      
      // Update processor patterns
      paymentProcessors: addUniqueValue(
        existingPattern.paymentProcessors,
        match.paymentProcessor
      ),
      
      // Update aliases
      knownAliases: addUniqueValue(
        existingPattern.knownAliases,
        extractNameFromDescription(match.transaction.description)
      ),
      
      // Bump confidence
      learningConfidence: Math.min(100, existingPattern.learningConfidence + (wasManual ? 5 : 2)),
      
      lastMatchAt: Timestamp.now(),
      lastUpdatedAt: Timestamp.now()
    });
  } else {
    // Create new pattern
    await createVendorPattern({
      vendorName,
      userId,
      totalMatches: 1,
      typicalPaymentDelayDays: match.daysBetweenInvoiceAndPayment,
      transactionKeywords: extractKeywords(match.transaction.description),
      feesTypicallyDeducted: match.wasFeesDeducted,
      typicalFeePercentage: match.feePercentage,
      paymentProcessors: match.paymentProcessor ? [match.paymentProcessor] : [],
      knownAliases: [extractNameFromDescription(match.transaction.description)].filter(Boolean),
      learningConfidence: wasManual ? 50 : 30,  // Manual = more trustworthy
      lastMatchAt: Timestamp.now(),
      createdAt: Timestamp.now()
    });
  }
  
  // 3. Update global patterns (across all users, anonymized)
  await updateGlobalPatterns(match);
  
  // 4. If AI was involved, log feedback for model improvement
  if (match.wasAISuggested) {
    await logAIFeedback({
      aiSuggestionId: match.aiSuggestionId,
      wasAccepted: true,
      wasFirstOption: match.optionRank === 1,
      actualMatch: match,
      timestamp: Timestamp.now()
    });
  }
}
```

### Negative Learning (When User Rejects)

```typescript
async function learnFromRejection(
  suggestion: MatchSuggestion,
  reason: RejectionReason
): Promise<void> {
  
  // Record the rejection
  await db.collection("match_rejections").add({
    transactionId: suggestion.transactionId,
    documentId: suggestion.documentId,
    suggestedConfidence: suggestion.confidence,
    rejectionReason: reason,
    // What the user said was wrong:
    // - "wrong_customer"
    // - "wrong_amount" 
    // - "wrong_date"
    // - "already_paid"
    // - "not_related"
    rejectedAt: Timestamp.now(),
    rejectedBy: userId
  });
  
  // Adjust patterns to avoid this mistake
  if (reason === "wrong_customer") {
    // This transaction description does NOT match this vendor
    const vendorName = suggestion.document.customerName || suggestion.document.vendorName;
    await addNegativeKeywords(
      vendorName,
      extractKeywords(suggestion.transaction.description)
    );
  }
  
  // If AI suggested this, log negative feedback
  if (suggestion.wasAISuggested) {
    await logAIFeedback({
      aiSuggestionId: suggestion.aiSuggestionId,
      wasAccepted: false,
      rejectionReason: reason,
      timestamp: Timestamp.now()
    });
  }
}
```

### Using Learned Patterns in Matching

```typescript
async function scoreWithLearnedPatterns(
  tx: Transaction,
  doc: Document,
  pattern: VendorLearning | null
): number {
  if (!pattern) return 0;
  
  let score = 0;
  const reasons: string[] = [];
  
  // 1. Check transaction keywords
  const txKeywords = extractKeywords(tx.description.toLowerCase());
  const matchedKeywords = txKeywords.filter(kw => 
    pattern.transactionKeywords.includes(kw)
  );
  
  if (matchedKeywords.length > 0) {
    score += Math.min(15, matchedKeywords.length * 5);
    reasons.push(`Matches learned keywords: ${matchedKeywords.join(", ")}`);
  }
  
  // 2. Check payment processor
  const detectedProcessor = detectPaymentProcessor(tx.description);
  if (detectedProcessor && pattern.paymentProcessors.includes(detectedProcessor)) {
    score += 10;
    reasons.push(`Matches typical payment method: ${detectedProcessor}`);
  }
  
  // 3. Check timing pattern
  const daysAfterInvoice = daysBetween(doc.documentDate, tx.date);
  const expectedDays = pattern.typicalPaymentDelayDays;
  const tolerance = pattern.paymentDelayStdDev * 2 || 7;
  
  if (Math.abs(daysAfterInvoice - expectedDays) <= tolerance) {
    score += 10;
    reasons.push(`Payment timing matches pattern (typically ${expectedDays} days)`);
  }
  
  // 4. Check amount pattern
  if (pattern.typicalAmounts.includes(tx.amount)) {
    score += 5;
    reasons.push(`Amount matches typical pattern`);
  }
  
  // 5. Check fee pattern
  if (pattern.feesTypicallyDeducted && pattern.typicalFeePercentage) {
    const expectedAmount = doc.amountRemaining * (1 - pattern.typicalFeePercentage / 100);
    if (Math.abs(tx.amount - expectedAmount) < 1) {
      score += 15;
      reasons.push(`Amount matches after ${pattern.typicalFeePercentage}% fee deduction`);
    }
  }
  
  // 6. Check aliases
  const descLower = tx.description.toLowerCase();
  for (const alias of pattern.knownAliases) {
    if (descLower.includes(alias.toLowerCase())) {
      score += 10;
      reasons.push(`Known alias "${alias}" found in description`);
      break;
    }
  }
  
  // Boost based on pattern confidence
  const confidenceMultiplier = pattern.learningConfidence / 100;
  score = Math.round(score * (0.5 + 0.5 * confidenceMultiplier));
  
  return { score, reasons };
}
```

---

## 📊 Learning Analytics Dashboard

Track how well the system is learning:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🧠 MATCHING INTELLIGENCE                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Overall Accuracy                                                 │
│ ████████████████████░░░░ 87%                                    │
│                                                                   │
│ AI Suggestion Acceptance Rate                                    │
│ █████████████████░░░░░░░ 72%                                    │
│                                                                   │
│ First-Option Acceptance Rate                                     │
│ ██████████████████████░░ 91%                                    │
│ (When AI suggests, how often is the first option correct?)      │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│ Learned Patterns: 47 vendors                                     │
│                                                                   │
│ Top Learned Vendors:                                             │
│ • Acme Corp - 98% confidence (23 matches)                       │
│   Keywords: "acme", "stripe"                                     │
│   Typical: Pays 5 days early via Stripe                         │
│                                                                   │
│ • Austen Creations - 85% confidence (15 matches)                │
│   Keywords: "austen", "ach"                                      │
│   Typical: Pays on due date via ACH                             │
│                                                                   │
│ • Office Supplies Inc - 60% confidence (5 matches)              │
│   Keywords: "office", "supplies"                                 │
│   Still learning...                                              │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│ Recent Improvements:                                             │
│ • Learned that "RetailCo" also appears as "RETAIL CO INC"       │
│ • Detected BigCorp now pays via PayPal (was Stripe)             │
│ • Updated typical payment delay for Acme: 5 → 3 days            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Continuous Improvement Loop

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Rule-Based │     │  AI Search   │     │    User      │
│   Matching   │────▶│  (Gemini)    │────▶│  Decision    │
└──────────────┘     └──────────────┘     └──────────────┘
       ▲                                         │
       │                                         │
       │         ┌──────────────┐               │
       │         │   Learning   │               │
       └─────────│    System    │◀──────────────┘
                 └──────────────┘
                        │
                        ▼
                 ┌──────────────┐
                 │   Updated    │
                 │   Patterns   │
                 └──────────────┘
```

1. **Rule-based matching** tries first (fast, cheap)
2. **AI search** kicks in when rules are uncertain
3. **User decides** which match is correct
4. **Learning system** records the decision
5. **Patterns update** to improve future matching
6. **Rules get smarter** over time

### The Goal: Less AI Over Time

As patterns are learned, the system should:
- Use AI less frequently (rules become more accurate)
- Need fewer user confirmations (auto-match rate increases)
- Handle new vendors quickly (transfer learning from similar vendors)
