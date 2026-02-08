/**
 * Advanced Payment Matching Engine
 * 
 * Matches bank transactions to bills and invoices with:
 * - Correct direction logic (credits → invoices, debits → bills)
 * - Amount matching with fee detection
 * - CROSS-CURRENCY MATCHING with FX rate conversion
 * - Name/vendor fuzzy matching
 * - Invoice/bill number extraction
 * - Date proximity scoring
 * - Learned patterns integration
 */

import { Timestamp } from "firebase-admin/firestore";
import { stringSimilarity } from "./pattern-memory";

// ============================================
// FX RATE HANDLING
// ============================================

// Fallback rates when API unavailable (updated periodically)
// These are approximate mid-market rates as of 2024
const FALLBACK_FX_RATES: Record<string, Record<string, number>> = {
  // Major currencies
  USD: { EUR: 0.92, GBP: 0.79, CAD: 1.36, AUD: 1.53, CHF: 0.88, JPY: 149.5, MXN: 17.2, BRL: 4.97, ANG: 1.79, AWG: 1.79, XCG: 1.79, BBD: 2.0, TTD: 6.8, JMD: 156.0 },
  EUR: { USD: 1.09, GBP: 0.86, CAD: 1.48, AUD: 1.66, CHF: 0.96, JPY: 163.0 },
  GBP: { USD: 1.27, EUR: 1.16, CAD: 1.72, AUD: 1.93 },
  
  // Caribbean currencies (pegged to USD at ~1.79)
  ANG: { USD: 0.56, EUR: 0.51, GBP: 0.44, AWG: 1.0, XCG: 1.0 },  // Antillean Guilder
  AWG: { USD: 0.56, EUR: 0.51, GBP: 0.44, ANG: 1.0, XCG: 1.0 },  // Aruban Florin
  XCG: { USD: 0.56, EUR: 0.51, GBP: 0.44, ANG: 1.0, AWG: 1.0 },  // Curaçao Guilder (same as ANG)
  
  // Other Caribbean
  BBD: { USD: 0.50, EUR: 0.46 },  // Barbados Dollar (pegged 2:1 to USD)
  BSD: { USD: 1.0, EUR: 0.92 },   // Bahamas Dollar (pegged 1:1 to USD)
  JMD: { USD: 0.0064, EUR: 0.0059 }, // Jamaican Dollar
  TTD: { USD: 0.15, EUR: 0.14 },  // Trinidad & Tobago Dollar
  XCD: { USD: 0.37, EUR: 0.34 },  // East Caribbean Dollar
  
  // Other major
  CAD: { USD: 0.74, EUR: 0.68, GBP: 0.58 },
  AUD: { USD: 0.65, EUR: 0.60, GBP: 0.52 },
  CHF: { USD: 1.14, EUR: 1.04 },
  JPY: { USD: 0.0067, EUR: 0.0061 },
  MXN: { USD: 0.058, EUR: 0.053 },
  BRL: { USD: 0.20, EUR: 0.18 },
};

// Currencies that are pegged or closely related (treat as same for matching)
const PEGGED_CURRENCIES: Record<string, string[]> = {
  USD: ["AWG", "ANG", "XCG", "BSD", "BBD", "BZD", "BMD", "KYD", "XCD", "PAB"],
  EUR: ["XOF", "XAF", "CFP"],
  ANG: ["XCG", "AWG"],  // Caribbean guilders are interchangeable
  XCG: ["ANG", "AWG"],
  AWG: ["ANG", "XCG"],
};

export function getFXRate(fromCurrency: string, toCurrency: string): number | null {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  
  if (from === to) return 1;
  
  // Check direct rate
  if (FALLBACK_FX_RATES[from]?.[to]) {
    return FALLBACK_FX_RATES[from][to];
  }
  
  // Try inverse
  if (FALLBACK_FX_RATES[to]?.[from]) {
    return 1 / FALLBACK_FX_RATES[to][from];
  }
  
  // Try via USD
  if (from !== "USD" && to !== "USD") {
    const fromToUSD = FALLBACK_FX_RATES[from]?.["USD"] || (FALLBACK_FX_RATES["USD"]?.[from] ? 1/FALLBACK_FX_RATES["USD"][from] : null);
    const usdToTo = FALLBACK_FX_RATES["USD"]?.[to] || (FALLBACK_FX_RATES[to]?.["USD"] ? 1/FALLBACK_FX_RATES[to]["USD"] : null);
    
    if (fromToUSD && usdToTo) {
      return fromToUSD * usdToTo;
    }
  }
  
  return null;
}

export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number | null {
  const rate = getFXRate(fromCurrency, toCurrency);
  if (rate === null) return null;
  return amount * rate;
}

export function currenciesMatch(currency1: string, currency2: string): boolean {
  const c1 = currency1?.toUpperCase() || "USD";
  const c2 = currency2?.toUpperCase() || "USD";
  
  if (c1 === c2) return true;
  
  // Check if pegged
  for (const [base, pegged] of Object.entries(PEGGED_CURRENCIES)) {
    if ((c1 === base && pegged.includes(c2)) || (c2 === base && pegged.includes(c1))) {
      return true; // Treat as same currency
    }
  }
  
  return false;
}

// ============================================
// TYPES
// ============================================

export interface Document {
  id: string;
  userId: string;
  documentType: "bill" | "invoice";
  documentNumber: string;
  counterpartyName: string;  // vendorName for bills, customerName for invoices
  documentDate: Timestamp;
  dueDate?: Timestamp;
  total: number;
  amountRemaining: number;
  currency: string;
  paymentStatus: string;
  reconciliationStatus: string;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  date: Timestamp;
  description: string;
  amount: number;
  type: "debit" | "credit";
  currency?: string;
  reconciliationStatus?: string;
  matchedDocumentId?: string;
}

export interface MatchCandidate {
  document: Document;
  transaction: Transaction;
  score: number;
  confidence: number;
  matchType: "exact" | "partial" | "fee_adjusted" | "split";
  reasons: string[];
  warnings: string[];
  signals: MatchSignals;
}

export interface MatchSignals {
  referenceScore: number;
  amountScore: number;
  identityScore: number;
  timeScore: number;
  contextScore: number;
  
  referenceFound?: string;
  amountDifference: number;
  amountDifferencePercent: number;
  feePatternDetected?: string;
  originalAmountBeforeFees?: number;
  nameSimilarity: number;
  daysFromDocument: number;
  daysFromDue?: number;
  
  // FX conversion info
  crossCurrency: boolean;
  transactionCurrency?: string;
  documentCurrency?: string;
  fxRateUsed?: number;
  convertedAmount?: number;
}

// ============================================
// FEE PATTERNS
// ============================================

interface FeePattern {
  name: string;
  rate: number;      // Percentage (0.029 = 2.9%)
  fixed: number;     // Fixed fee
  keywords: string[];
}

const FEE_PATTERNS: FeePattern[] = [
  { name: "stripe", rate: 0.029, fixed: 0.30, keywords: ["stripe"] },
  { name: "paypal", rate: 0.029, fixed: 0.30, keywords: ["paypal", "pp"] },
  { name: "square", rate: 0.026, fixed: 0.10, keywords: ["square", "sq"] },
  { name: "wise", rate: 0.01, fixed: 0, keywords: ["wise", "transferwise"] },
  { name: "card_3pct", rate: 0.03, fixed: 0, keywords: ["card", "visa", "mastercard", "amex"] },
];

// ============================================
// KEYWORD EXTRACTION
// ============================================

const COMMON_WORDS = new Set([
  "payment", "transfer", "credit", "debit", "invoice", "bill", "fee",
  "inc", "corp", "llc", "ltd", "co", "company", "limited", "services",
  "the", "a", "an", "and", "or", "for", "from", "to", "of", "in", "on",
  "ref", "reference", "ach", "wire", "bank", "account", "number",
]);

export function extractKeywords(description: string): string[] {
  return description
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !COMMON_WORDS.has(word))
    .slice(0, 10);
}

export function extractInvoiceNumbers(description: string): string[] {
  const patterns = [
    /\b(inv[-.#]?\d+)\b/gi,
    /\b(invoice[-.#]?\d+)\b/gi,
    /\b(#\d{4,})\b/gi,
    /\b(\d{6,})\b/g,  // Long numbers might be invoice numbers
  ];
  
  const results: string[] = [];
  for (const pattern of patterns) {
    const matches = description.match(pattern);
    if (matches) {
      results.push(...matches.map(m => m.replace(/[^\w\d]/g, "").toLowerCase()));
    }
  }
  
  return [...new Set(results)];
}

export function detectPaymentProcessor(description: string): string | null {
  const descLower = description.toLowerCase();
  
  for (const pattern of FEE_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (descLower.includes(keyword)) {
        return pattern.name;
      }
    }
  }
  
  return null;
}

// ============================================
// AMOUNT MATCHING
// ============================================

interface AmountMatchResult {
  score: number;
  matchType: "exact" | "partial" | "fee_adjusted" | "fx_converted" | "none";
  difference: number;
  differencePercent: number;
  feePattern?: string;
  originalAmountBeforeFees?: number;
  reason?: string;
  // FX info
  fxRateUsed?: number;
  convertedAmount?: number;
}

export function scoreAmount(
  transactionAmount: number,
  documentAmount: number,
  transactionCurrency?: string,
  documentCurrency?: string
): AmountMatchResult {
  const txAmt = Math.abs(transactionAmount);
  const docAmt = Math.abs(documentAmount);
  const txCur = transactionCurrency?.toUpperCase() || "USD";
  const docCur = documentCurrency?.toUpperCase() || "USD";
  
  // Check if we need FX conversion
  const needsFXConversion = txCur !== docCur && !currenciesMatch(txCur, docCur);
  
  let effectiveTxAmt = txAmt;
  let fxRate: number | undefined;
  let convertedAmt: number | undefined;
  
  if (needsFXConversion) {
    // Convert transaction amount to document currency for comparison
    const rate = getFXRate(txCur, docCur);
    if (rate) {
      fxRate = rate;
      convertedAmt = txAmt * rate;
      effectiveTxAmt = convertedAmt;
    } else {
      // Can't convert - return low score but don't exclude entirely
      return {
        score: 5,
        matchType: "none",
        difference: Math.abs(txAmt - docAmt),
        differencePercent: 1,
        reason: `Different currencies (${txCur}/${docCur}) - no FX rate available`,
      };
    }
  }
  
  const diff = Math.abs(effectiveTxAmt - docAmt);
  const diffPct = docAmt > 0 ? diff / docAmt : 1;
  
  // Exact match (same currency or after FX conversion)
  if (diff < 0.01) {
    return {
      score: needsFXConversion ? 32 : 35,  // Slightly lower for FX matches
      matchType: needsFXConversion ? "fx_converted" : "exact",
      difference: 0,
      differencePercent: 0,
      reason: needsFXConversion 
        ? `Exact match after FX conversion (${txCur}→${docCur} @ ${fxRate?.toFixed(4)})`
        : "Exact amount match",
      fxRateUsed: fxRate,
      convertedAmount: convertedAmt,
    };
  }
  
  // Within 0.5% - likely rounding (more tolerance for FX: 2%)
  const roundingTolerance = needsFXConversion ? 0.02 : 0.005;
  if (diffPct < roundingTolerance) {
    return {
      score: needsFXConversion ? 28 : 32,
      matchType: needsFXConversion ? "fx_converted" : "exact",
      difference: diff,
      differencePercent: diffPct,
      reason: needsFXConversion
        ? `FX converted match within ${(roundingTolerance*100).toFixed(0)}% (${txCur} ${txAmt.toFixed(2)} → ${docCur} ${convertedAmt?.toFixed(2)})`
        : `Amount within 0.5% (${diff.toFixed(2)} difference)`,
      fxRateUsed: fxRate,
      convertedAmount: convertedAmt,
    };
  }
  
  // Within 5% - good for FX with rate variance
  if (needsFXConversion && diffPct < 0.05) {
    return {
      score: 22,
      matchType: "fx_converted",
      difference: diff,
      differencePercent: diffPct,
      reason: `FX match within 5% tolerance (rate variance) - ${txCur} ${txAmt.toFixed(2)} ≈ ${docCur} ${convertedAmt?.toFixed(2)}`,
      fxRateUsed: fxRate,
      convertedAmount: convertedAmt,
    };
  }
  
  // Check for fee patterns (using effective amount after FX)
  for (const feePattern of FEE_PATTERNS) {
    const expectedAfterFee = docAmt * (1 - feePattern.rate) - feePattern.fixed;
    if (Math.abs(effectiveTxAmt - expectedAfterFee) < 1) {
      return {
        score: needsFXConversion ? 26 : 30,
        matchType: "fee_adjusted",
        difference: docAmt - effectiveTxAmt,
        differencePercent: feePattern.rate,
        feePattern: feePattern.name,
        originalAmountBeforeFees: docAmt,
        reason: needsFXConversion
          ? `FX + ${feePattern.name} fee match (${txCur}→${docCur}, -${(feePattern.rate * 100).toFixed(1)}%)`
          : `Amount matches after ${(feePattern.rate * 100).toFixed(1)}% ${feePattern.name} fee`,
        fxRateUsed: fxRate,
        convertedAmount: convertedAmt,
      };
    }
  }
  
  // Within 1% (same currency only - FX handled above)
  if (!needsFXConversion && diffPct < 0.01) {
    return {
      score: 28,
      matchType: "exact",
      difference: diff,
      differencePercent: diffPct,
      reason: `Amount within 1% (${diff.toFixed(2)} difference)`,
    };
  }
  
  // Within 5% - might be fees or adjustments
  if (!needsFXConversion && diffPct < 0.05) {
    return {
      score: 20,
      matchType: "partial",
      difference: diff,
      differencePercent: diffPct,
      reason: `Amount within 5% (${diff.toFixed(2)} difference, may include fees)`,
    };
  }
  
  // Within 10% for FX (rate fluctuation)
  if (needsFXConversion && diffPct < 0.10) {
    return {
      score: 15,
      matchType: "fx_converted",
      difference: diff,
      differencePercent: diffPct,
      reason: `FX match within 10% (rate fluctuation) - ${txCur} ${txAmt.toFixed(2)} ≈ ${docCur} ${convertedAmt?.toFixed(2)}`,
      fxRateUsed: fxRate,
      convertedAmount: convertedAmt,
    };
  }
  
  // Partial payment (50% - 95% of amount) - use effective amount
  if (effectiveTxAmt < docAmt && effectiveTxAmt >= docAmt * 0.5) {
    const pct = effectiveTxAmt / docAmt;
    // Check for clean splits
    const isCleanSplit = [0.5, 0.333, 0.25, 0.2].some(p => Math.abs(pct - p) < 0.02);
    return {
      score: isCleanSplit ? 20 : 12,
      matchType: "partial",
      difference: docAmt - effectiveTxAmt,
      differencePercent: 1 - pct,
      reason: needsFXConversion
        ? `Partial FX payment (${(pct * 100).toFixed(0)}%) - ${txCur} ${txAmt.toFixed(2)} → ${docCur} ${convertedAmt?.toFixed(2)}`
        : (isCleanSplit 
          ? `Partial payment (${(pct * 100).toFixed(0)}% - likely installment)`
          : `Partial payment (${(pct * 100).toFixed(0)}%)`),
      fxRateUsed: fxRate,
      convertedAmount: convertedAmt,
    };
  }
  
  // Small partial (10-50%)
  if (effectiveTxAmt < docAmt && effectiveTxAmt >= docAmt * 0.1) {
    return {
      score: 8,
      matchType: "partial",
      difference: docAmt - effectiveTxAmt,
      differencePercent: 1 - (effectiveTxAmt / docAmt),
      reason: needsFXConversion
        ? `Small partial FX payment (${((effectiveTxAmt / docAmt) * 100).toFixed(0)}%)`
        : `Small partial payment (${((effectiveTxAmt / docAmt) * 100).toFixed(0)}%)`,
      fxRateUsed: fxRate,
      convertedAmount: convertedAmt,
    };
  }
  
  // Overpayment
  if (effectiveTxAmt > docAmt && effectiveTxAmt <= docAmt * 1.1) {
    return {
      score: 15,
      matchType: needsFXConversion ? "fx_converted" : "exact",
      difference: effectiveTxAmt - docAmt,
      differencePercent: (effectiveTxAmt - docAmt) / docAmt,
      reason: needsFXConversion
        ? `FX overpayment (${(effectiveTxAmt - docAmt).toFixed(2)} ${docCur} extra)`
        : `Slight overpayment (${(effectiveTxAmt - docAmt).toFixed(2)} extra)`,
      fxRateUsed: fxRate,
      convertedAmount: convertedAmt,
    };
  }
  
  return {
    score: 0,
    matchType: "none",
    difference: diff,
    differencePercent: diffPct,
    fxRateUsed: fxRate,
    convertedAmount: convertedAmt,
  };
}

// ============================================
// IDENTITY MATCHING
// ============================================

export function scoreIdentity(
  transactionDescription: string,
  counterpartyName: string
): { score: number; similarity: number; reason?: string } {
  const descLower = transactionDescription.toLowerCase();
  const nameLower = counterpartyName.toLowerCase();
  
  // Exact name found in description
  if (descLower.includes(nameLower)) {
    return { score: 25, similarity: 1, reason: "Exact name found in transaction" };
  }
  
  // Check each word of the name
  const nameWords = nameLower
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 2 && !COMMON_WORDS.has(w));
  
  const descWords = descLower
    .replace(/[^\w\s]/g, "")
    .split(/\s+/);
  
  // Count how many significant name words appear in description
  let matchedWords = 0;
  for (const nameWord of nameWords) {
    for (const descWord of descWords) {
      if (nameWord === descWord) {
        matchedWords++;
        break;
      }
      if (stringSimilarity(nameWord, descWord) >= 0.85) {
        matchedWords += 0.8;
        break;
      }
    }
  }
  
  if (nameWords.length > 0) {
    const ratio = matchedWords / nameWords.length;
    
    if (ratio >= 0.8) {
      return { score: 22, similarity: ratio, reason: `Strong name match (${matchedWords.toFixed(0)}/${nameWords.length} words)` };
    }
    if (ratio >= 0.5) {
      return { score: 15, similarity: ratio, reason: `Partial name match (${matchedWords.toFixed(0)}/${nameWords.length} words)` };
    }
    if (ratio > 0) {
      return { score: 8, similarity: ratio, reason: `Weak name match (${matchedWords.toFixed(0)}/${nameWords.length} words)` };
    }
  }
  
  // Overall fuzzy match
  const overallSimilarity = stringSimilarity(descLower, nameLower);
  if (overallSimilarity >= 0.6) {
    return { score: 10, similarity: overallSimilarity, reason: `Fuzzy name match (${(overallSimilarity * 100).toFixed(0)}% similar)` };
  }
  
  return { score: 0, similarity: 0 };
}

// ============================================
// REFERENCE MATCHING
// ============================================

export function scoreReference(
  transactionDescription: string,
  documentNumber: string
): { score: number; found?: string; reason?: string } {
  if (!documentNumber || documentNumber === "Unknown") {
    return { score: 0 };
  }
  
  const docNumClean = documentNumber.replace(/[^\w\d]/g, "").toLowerCase();
  const descClean = transactionDescription.replace(/[^\w\d]/g, "").toLowerCase();
  
  // Exact document number found
  if (descClean.includes(docNumClean)) {
    return { score: 40, found: documentNumber, reason: `Document number "${documentNumber}" found in transaction` };
  }
  
  // Check last 6+ characters (often invoice suffix is in description)
  if (docNumClean.length >= 6) {
    const suffix = docNumClean.slice(-6);
    if (descClean.includes(suffix)) {
      return { score: 25, found: suffix, reason: `Document number suffix "${suffix}" found in transaction` };
    }
  }
  
  // Extract numbers from transaction and compare
  const extractedRefs = extractInvoiceNumbers(transactionDescription);
  for (const ref of extractedRefs) {
    if (ref === docNumClean) {
      return { score: 35, found: ref, reason: `Reference "${ref}" matches document number` };
    }
    if (docNumClean.includes(ref) || ref.includes(docNumClean)) {
      return { score: 20, found: ref, reason: `Reference "${ref}" partially matches document number` };
    }
  }
  
  return { score: 0 };
}

// ============================================
// TIME MATCHING
// ============================================

export function scoreTime(
  transactionDate: Timestamp,
  documentDate: Timestamp,
  dueDate?: Timestamp
): { score: number; daysFromDoc: number; daysFromDue?: number; reason?: string } {
  const txDate = transactionDate.toDate();
  const docDate = documentDate.toDate();
  
  const daysFromDoc = Math.floor((txDate.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24));
  
  let daysFromDue: number | undefined;
  if (dueDate) {
    const due = dueDate.toDate();
    daysFromDue = Math.floor((txDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  // Payment before document (advance/deposit)
  if (daysFromDoc < 0) {
    if (daysFromDoc >= -30) {
      return { 
        score: 8, 
        daysFromDoc, 
        daysFromDue,
        reason: "Advance payment (before document date)" 
      };
    }
    return { score: 0, daysFromDoc, daysFromDue, reason: "Payment too early" };
  }
  
  // Use due date if available
  if (daysFromDue !== undefined) {
    if (Math.abs(daysFromDue) <= 3) {
      return { 
        score: 20, 
        daysFromDoc, 
        daysFromDue,
        reason: "Payment within 3 days of due date" 
      };
    }
    if (Math.abs(daysFromDue) <= 7) {
      return { 
        score: 15, 
        daysFromDoc, 
        daysFromDue,
        reason: "Payment within 1 week of due date" 
      };
    }
    if (daysFromDue <= 30) {
      return { 
        score: 10, 
        daysFromDoc, 
        daysFromDue,
        reason: "Payment within 30 days of due date" 
      };
    }
    if (daysFromDue <= 60) {
      return { 
        score: 5, 
        daysFromDoc, 
        daysFromDue,
        reason: "Payment within 60 days of due date" 
      };
    }
  }
  
  // Fall back to document date
  if (daysFromDoc <= 7) {
    return { score: 15, daysFromDoc, daysFromDue, reason: "Payment within 1 week of document" };
  }
  if (daysFromDoc <= 30) {
    return { score: 10, daysFromDoc, daysFromDue, reason: "Payment within 30 days" };
  }
  if (daysFromDoc <= 60) {
    return { score: 5, daysFromDoc, daysFromDue, reason: "Payment within 60 days" };
  }
  if (daysFromDoc <= 90) {
    return { score: 2, daysFromDoc, daysFromDue, reason: "Payment within 90 days" };
  }
  
  return { score: 0, daysFromDoc, daysFromDue, reason: "Payment too late" };
}

// ============================================
// MAIN MATCHING FUNCTION
// ============================================

export function calculateMatch(
  transaction: Transaction,
  document: Document,
  allTransactionAmounts?: number[]
): MatchCandidate {
  const reasons: string[] = [];
  const warnings: string[] = [];
  
  // Direction check - this is critical!
  // Credits (money in) should match invoices (money we're owed)
  // Debits (money out) should match bills (money we owe)
  const expectedDirection = document.documentType === "invoice" ? "credit" : "debit";
  
  if (transaction.type !== expectedDirection) {
    // Wrong direction - significant penalty but don't completely exclude
    // (Sometimes data entry is wrong, or it's a refund scenario)
    warnings.push(`Direction mismatch: ${document.documentType} expects ${expectedDirection}, got ${transaction.type}`);
  }
  
  // Get currencies
  const txCurrency = transaction.currency || "USD";
  const docCurrency = document.currency || "USD";
  const isCrossCurrency = txCurrency.toUpperCase() !== docCurrency.toUpperCase() && 
                          !currenciesMatch(txCurrency, docCurrency);
  
  // Score each component (pass currencies for FX handling)
  const refResult = scoreReference(transaction.description, document.documentNumber);
  const amtResult = scoreAmount(
    transaction.amount, 
    document.amountRemaining,
    txCurrency,
    docCurrency
  );
  const idResult = scoreIdentity(transaction.description, document.counterpartyName);
  const timeResult = scoreTime(transaction.date, document.documentDate, document.dueDate);
  
  // Build reasons
  if (refResult.reason) reasons.push(refResult.reason);
  if (amtResult.reason) reasons.push(amtResult.reason);
  if (idResult.reason) reasons.push(idResult.reason);
  if (timeResult.reason) reasons.push(timeResult.reason);
  
  // Context scoring
  let contextScore = 0;
  
  // Unique amount bonus
  if (allTransactionAmounts) {
    const sameAmountCount = allTransactionAmounts.filter(
      amt => Math.abs(Math.abs(amt) - Math.abs(transaction.amount)) < 0.01
    ).length;
    
    if (sameAmountCount === 1) {
      contextScore += 5;
      reasons.push("Unique amount (no duplicates)");
    } else if (sameAmountCount > 3) {
      contextScore -= 5;
      warnings.push(`Common amount appears ${sameAmountCount} times`);
    }
  }
  
  // Cross-currency bonus if reference matches (high confidence)
  if (isCrossCurrency && refResult.score >= 20) {
    contextScore += 5;
    reasons.push("Cross-currency with reference match");
  }
  
  // Build signals
  const signals: MatchSignals = {
    referenceScore: refResult.score,
    amountScore: amtResult.score,
    identityScore: idResult.score,
    timeScore: timeResult.score,
    contextScore,
    
    referenceFound: refResult.found,
    amountDifference: amtResult.difference,
    amountDifferencePercent: amtResult.differencePercent,
    feePatternDetected: amtResult.feePattern,
    originalAmountBeforeFees: amtResult.originalAmountBeforeFees,
    nameSimilarity: idResult.similarity,
    daysFromDocument: timeResult.daysFromDoc,
    daysFromDue: timeResult.daysFromDue,
    
    // FX info
    crossCurrency: isCrossCurrency,
    transactionCurrency: txCurrency,
    documentCurrency: docCurrency,
    fxRateUsed: amtResult.fxRateUsed,
    convertedAmount: amtResult.convertedAmount,
  };
  
  // Calculate total score
  let totalScore = refResult.score + amtResult.score + idResult.score + timeResult.score + contextScore;
  
  // Direction penalty
  if (transaction.type !== expectedDirection) {
    totalScore -= 20;
  }
  
  // Cap and calculate confidence
  const maxScore = 130;
  const confidence = Math.min(100, Math.max(0, Math.round((totalScore / maxScore) * 100)));
  
  // Determine final match type
  let matchType: MatchCandidate["matchType"] = "partial";
  if (amtResult.matchType === "exact" || amtResult.matchType === "fx_converted") {
    matchType = "exact";
  } else if (amtResult.matchType === "fee_adjusted") {
    matchType = "fee_adjusted";
  } else if (amtResult.matchType === "partial") {
    matchType = "partial";
  }
  // "split" is set externally when combining multiple transactions
  
  return {
    document,
    transaction,
    score: totalScore,
    confidence,
    matchType,
    reasons,
    warnings,
    signals,
  };
}

// ============================================
// BATCH MATCHING
// ============================================

export function findMatchesForTransaction(
  transaction: Transaction,
  documents: Document[],
  allTransactionAmounts?: number[]
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];
  
  // Filter documents by direction
  // Credits → invoices, Debits → bills
  const relevantType = transaction.type === "credit" ? "invoice" : "bill";
  const relevantDocs = documents.filter(d => d.documentType === relevantType);
  
  for (const doc of relevantDocs) {
    // Skip fully paid documents
    if (doc.amountRemaining <= 0) continue;
    
    const candidate = calculateMatch(transaction, doc, allTransactionAmounts);
    
    // Only include if above minimum threshold
    if (candidate.confidence >= 40) {
      candidates.push(candidate);
    }
  }
  
  // Sort by confidence
  candidates.sort((a, b) => b.confidence - a.confidence);
  
  return candidates;
}

export function findMatchesForDocument(
  document: Document,
  transactions: Transaction[],
  allTransactionAmounts?: number[]
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];
  
  // Filter transactions by direction
  // Invoices → credits, Bills → debits
  const relevantType = document.documentType === "invoice" ? "credit" : "debit";
  const relevantTxs = transactions.filter(t => t.type === relevantType);
  
  for (const tx of relevantTxs) {
    // Skip already matched transactions
    if (tx.reconciliationStatus === "matched") continue;
    
    const candidate = calculateMatch(tx, document, allTransactionAmounts);
    
    // Only include if above minimum threshold
    if (candidate.confidence >= 40) {
      candidates.push(candidate);
    }
  }
  
  // Sort by confidence
  candidates.sort((a, b) => b.confidence - a.confidence);
  
  return candidates;
}
