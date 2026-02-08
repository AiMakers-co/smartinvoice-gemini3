/**
 * Pattern Memory System
 * 
 * Stores and retrieves learned patterns about vendors/clients
 * to improve future matching accuracy.
 * 
 * Includes:
 * - Levenshtein distance for fuzzy string matching
 * - Usage tracking for billing
 * - Retry mechanisms for reliability
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const db = getFirestore();

// ============================================
// FUZZY STRING MATCHING (Levenshtein)
// ============================================

/**
 * Calculate Levenshtein distance between two strings
 * Optimized with early termination for large distance differences
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  // Early termination for empty strings
  if (m === 0) return n;
  if (n === 0) return m;
  
  // Early termination if difference in length is too large
  if (Math.abs(m - n) > Math.min(m, n)) {
    return Math.max(m, n);
  }
  
  // Use two rows instead of full matrix (memory optimization)
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }
  
  return prev[n];
}

/**
 * Calculate string similarity (0-1 scale)
 * 1 = identical, 0 = completely different
 */
export function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  return 1 - (distance / maxLength);
}

/**
 * Check if haystack fuzzy-contains needle
 */
export function fuzzyContains(haystack: string, needle: string, threshold: number = 0.7): boolean {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  
  // Exact contains check first
  if (h.includes(n)) return true;
  
  // Check each word in haystack against needle
  const words = h.split(/\s+/);
  for (const word of words) {
    if (stringSimilarity(word, n) >= threshold) {
      return true;
    }
  }
  
  return false;
}

/**
 * Find best matching string from an array
 */
export function findBestMatch(
  target: string, 
  candidates: string[]
): { match: string | null; similarity: number } {
  let bestMatch: string | null = null;
  let bestSimilarity = 0;
  
  for (const candidate of candidates) {
    const similarity = stringSimilarity(target, candidate);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = candidate;
    }
  }
  
  return { match: bestMatch, similarity: bestSimilarity };
}

// ============================================
// TYPES
// ============================================

export interface VendorPattern {
  id?: string;
  userId: string;
  vendorName: string;
  vendorAliases: string[];
  
  // Payment patterns
  paymentProcessor?: string;
  typicalPaymentDelay?: number;
  paymentDelayRange?: { min: number; max: number };
  
  // Amount patterns
  typicalAmountRange?: { min: number; max: number };
  usesRounding?: boolean;
  roundingPrecision?: number;
  
  // Installment patterns
  usesInstallments?: boolean;
  typicalInstallmentCount?: number;
  installmentPattern?: string;
  
  // Currency patterns
  invoiceCurrency?: string;
  paymentCurrency?: string;
  typicalFxMargin?: number;
  
  // Matching hints
  transactionKeywords: string[];
  
  // Learning metadata
  matchCount: number;
  lastMatchedAt?: Timestamp;
  confidence: number;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MatchHistory {
  id?: string;
  userId: string;
  vendorName: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceAmount: number;
  invoiceCurrency: string;
  invoiceDate: Timestamp;
  
  transactionId: string;
  transactionAmount: number;
  transactionCurrency: string;
  transactionDate: Timestamp;
  transactionDescription: string;
  
  matchType: "exact" | "partial" | "combined" | "fx_converted";
  amountDifference: number;
  daysDifference: number;
  wasManual: boolean;
  aiConfidence?: number;
  
  matchedAt: Timestamp;
  matchedBy: string;
}

// ============================================
// PATTERN RETRIEVAL
// ============================================

/**
 * Get vendor patterns with fuzzy matching
 */
export async function getVendorPatterns(
  userId: string, 
  vendorName: string
): Promise<VendorPattern[]> {
  const snapshot = await db.collection("vendor_patterns")
    .where("userId", "==", userId)
    .get();

  const patterns = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data() as VendorPattern
  }));
  
  // Filter by fuzzy matching
  const matchingPatterns = patterns.filter(p => {
    // Exact match
    if (p.vendorName.toLowerCase() === vendorName.toLowerCase()) return true;
    
    // Fuzzy match on name
    if (stringSimilarity(p.vendorName, vendorName) >= 0.7) return true;
    
    // Check aliases
    if (p.vendorAliases?.some(alias => 
      stringSimilarity(alias, vendorName) >= 0.7
    )) return true;
    
    return false;
  });

  // Sort by match quality
  return matchingPatterns.sort((a, b) => {
    const simA = stringSimilarity(a.vendorName, vendorName);
    const simB = stringSimilarity(b.vendorName, vendorName);
    return simB - simA;
  });
}

/**
 * Get all vendor patterns for a user
 */
export async function getAllUserPatterns(userId: string): Promise<VendorPattern[]> {
  const snapshot = await db.collection("vendor_patterns")
    .where("userId", "==", userId)
    .orderBy("matchCount", "desc")
    .get();
    
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data() as VendorPattern
  }));
}

/**
 * Get match history for a vendor
 */
export async function getVendorMatchHistory(
  userId: string, 
  vendorName: string,
  limit: number = 20
): Promise<MatchHistory[]> {
  // Get all recent matches and filter by fuzzy vendor name
  const snapshot = await db.collection("match_history")
    .where("userId", "==", userId)
    .orderBy("matchedAt", "desc")
    .limit(100) // Get more, then filter
    .get();
  
  const history = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() as MatchHistory }))
    .filter(h => stringSimilarity(h.vendorName, vendorName) >= 0.7);
  
  return history.slice(0, limit);
}

/**
 * Get pattern context for AI prompt
 */
export async function getPatternContext(
  userId: string, 
  vendorName: string
): Promise<string> {
  const patterns = await getVendorPatterns(userId, vendorName);
  const history = await getVendorMatchHistory(userId, vendorName, 5);
  
  if (patterns.length === 0 && history.length === 0) {
    return "No prior history with this vendor.";
  }
  
  let context = "";
  
  if (patterns.length > 0) {
    const p = patterns[0];
    context += `## Learned Patterns for ${vendorName}\n`;
    context += `- Match confidence: ${p.confidence}%\n`;
    context += `- Total matches: ${p.matchCount}\n`;
    
    if (p.paymentProcessor) {
      context += `- Payment processor: ${p.paymentProcessor}\n`;
    }
    if (p.typicalPaymentDelay !== undefined) {
      context += `- Typical payment delay: ${p.typicalPaymentDelay} days\n`;
    }
    if (p.paymentDelayRange) {
      context += `- Payment delay range: ${p.paymentDelayRange.min}-${p.paymentDelayRange.max} days\n`;
    }
    if (p.usesInstallments) {
      context += `- Uses installments: Yes (${p.installmentPattern || p.typicalInstallmentCount + " payments"})\n`;
    }
    if (p.transactionKeywords?.length > 0) {
      context += `- Transaction keywords: ${p.transactionKeywords.join(", ")}\n`;
    }
    if (p.vendorAliases?.length > 0) {
      context += `- Known aliases: ${p.vendorAliases.join(", ")}\n`;
    }
  }
  
  if (history.length > 0) {
    context += `\n## Recent Matches\n`;
    for (const h of history) {
      context += `- ${h.invoiceNumber}: ${h.invoiceCurrency} ${h.invoiceAmount} → ${h.transactionDescription} (${h.daysDifference} days, ${h.matchType})\n`;
    }
  }
  
  return context;
}

// ============================================
// KEYWORD EXTRACTION
// ============================================

const COMMON_WORDS = new Set([
  "payment", "transfer", "invoice", "bill", "fee", "charge", "credit", "debit",
  "inc", "corp", "llc", "ltd", "co", "company", "services", "solutions", "group", "agency",
  "the", "a", "an", "and", "or", "for", "from", "to", "of", "in", "on", "with", "at", "by",
  "as", "is", "it", "be", "was", "are", "has", "had", "will", "can", "would", "should",
  "this", "that", "these", "those", "my", "your", "his", "her", "its", "our", "their",
  "me", "you", "him", "her", "us", "them", "i", "we", "he", "she", "it", "they",
  "card", "account", "bank", "wire", "ach", "ref", "reference", "transaction"
]);

const PAYMENT_PROCESSORS = [
  { pattern: /stripe/i, name: "Stripe" },
  { pattern: /paypal/i, name: "PayPal" },
  { pattern: /square/i, name: "Square" },
  { pattern: /wise|transferwise/i, name: "Wise" },
  { pattern: /ach|wire transfer/i, name: "ACH/Wire" },
  { pattern: /sepa/i, name: "SEPA" },
  { pattern: /visa|mastercard|amex|discover/i, name: "Card Payment" },
  { pattern: /zelle/i, name: "Zelle" },
  { pattern: /venmo/i, name: "Venmo" },
];

function extractKeywords(description: string): string[] {
  return description
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(word => word.length > 2 && !COMMON_WORDS.has(word))
    .slice(0, 10);
}

function detectPaymentProcessor(description: string): string | undefined {
  for (const { pattern, name } of PAYMENT_PROCESSORS) {
    if (pattern.test(description)) {
      return name;
    }
  }
  return undefined;
}

// ============================================
// LEARNING FROM MATCHES
// ============================================

export const learnFromMatch = onCall(
  { cors: true },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const {
      invoiceId, invoiceNumber, invoiceAmount, invoiceCurrency, invoiceDate,
      transactionId, transactionAmount, transactionCurrency, transactionDate, transactionDescription,
      vendorName, matchType, wasManual, aiConfidence
    } = request.data;

    // Calculate differences
    const invDate = invoiceDate?.toDate?.() || new Date(invoiceDate);
    const txDate = transactionDate?.toDate?.() || new Date(transactionDate);
    const daysDifference = Math.abs(Math.floor((txDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24)));
    const amountDifference = Math.abs(transactionAmount - invoiceAmount);

    // 1. Record to match_history
    await db.collection("match_history").add({
      userId,
      vendorName,
      invoiceId, 
      invoiceNumber, 
      invoiceAmount, 
      invoiceCurrency, 
      invoiceDate: Timestamp.fromDate(new Date(invoiceDate)),
      transactionId, 
      transactionAmount, 
      transactionCurrency, 
      transactionDate: Timestamp.fromDate(new Date(transactionDate)), 
      transactionDescription,
      matchType, 
      amountDifference, 
      daysDifference, 
      wasManual, 
      aiConfidence,
      matchedAt: Timestamp.now(),
      matchedBy: userId,
    });

    // 2. Update/create vendor_patterns
    const existingPatterns = await getVendorPatterns(userId, vendorName);
    const existingPattern = existingPatterns[0];

    const newKeywords = extractKeywords(transactionDescription);
    const paymentProcessor = detectPaymentProcessor(transactionDescription);

    if (existingPattern) {
      // Update existing pattern
      const currentMatchCount = existingPattern.matchCount || 0;
      const newMatchCount = currentMatchCount + 1;
      
      // Calculate running averages
      const currentTotalDelay = (existingPattern.typicalPaymentDelay || 0) * currentMatchCount;
      const newTypicalDelay = (currentTotalDelay + daysDifference) / newMatchCount;
      
      // Update payment delay range
      const currentMin = existingPattern.paymentDelayRange?.min ?? daysDifference;
      const currentMax = existingPattern.paymentDelayRange?.max ?? daysDifference;
      
      // Merge keywords (keep top 15 most common)
      const allKeywords = [...(existingPattern.transactionKeywords || []), ...newKeywords];
      const keywordCounts = allKeywords.reduce((acc, kw) => {
        acc[kw] = (acc[kw] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const topKeywords = Object.entries(keywordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([kw]) => kw);

      // Update confidence (manual matches boost more)
      let newConfidence = existingPattern.confidence || 50;
      if (wasManual) {
        newConfidence = Math.min(100, newConfidence + 5);
      } else if (aiConfidence) {
        newConfidence = (newConfidence * currentMatchCount + aiConfidence) / newMatchCount;
      }

      await db.collection("vendor_patterns").doc(existingPattern.id!).update({
        transactionKeywords: topKeywords,
        matchCount: newMatchCount,
        lastMatchedAt: Timestamp.now(),
        typicalPaymentDelay: Math.round(newTypicalDelay * 10) / 10,
        paymentDelayRange: {
          min: Math.min(currentMin, daysDifference),
          max: Math.max(currentMax, daysDifference),
        },
        confidence: Math.round(newConfidence),
        ...(paymentProcessor && { paymentProcessor }),
        ...(invoiceCurrency && { invoiceCurrency }),
        ...(transactionCurrency && { paymentCurrency: transactionCurrency }),
        updatedAt: Timestamp.now(),
      });
      
    } else {
      // Create new pattern
      await db.collection("vendor_patterns").add({
        userId,
        vendorName,
        vendorAliases: [],
        transactionKeywords: newKeywords,
        matchCount: 1,
        lastMatchedAt: Timestamp.now(),
        typicalPaymentDelay: daysDifference,
        paymentDelayRange: { min: daysDifference, max: daysDifference },
        confidence: wasManual ? 70 : (aiConfidence || 50),
        paymentProcessor,
        invoiceCurrency,
        paymentCurrency: transactionCurrency,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as VendorPattern);
    }

    return { success: true };
  }
);

// ============================================
// ADD VENDOR ALIAS
// ============================================

export const addVendorAlias = onCall(
  { cors: true },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const { vendorName, alias } = request.data;
    
    if (!vendorName || !alias) {
      throw new HttpsError("invalid-argument", "vendorName and alias are required");
    }

    const patterns = await getVendorPatterns(userId, vendorName);
    
    if (patterns.length === 0) {
      // Create new pattern with alias
      await db.collection("vendor_patterns").add({
        userId,
        vendorName,
        vendorAliases: [alias],
        transactionKeywords: [],
        matchCount: 0,
        confidence: 50,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    } else {
      // Add alias to existing pattern
      const pattern = patterns[0];
      const currentAliases = pattern.vendorAliases || [];
      
      if (!currentAliases.includes(alias)) {
        await db.collection("vendor_patterns").doc(pattern.id!).update({
          vendorAliases: [...currentAliases, alias],
          updatedAt: Timestamp.now(),
        });
      }
    }

    return { success: true };
  }
);

// ============================================
// UPDATE VENDOR PATTERN
// ============================================

export const updateVendorPattern = onCall(
  { cors: true },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const { patternId, updates } = request.data;
    
    if (!patternId) {
      throw new HttpsError("invalid-argument", "patternId is required");
    }

    // Verify ownership
    const patternDoc = await db.collection("vendor_patterns").doc(patternId).get();
    if (!patternDoc.exists || patternDoc.data()?.userId !== userId) {
      throw new HttpsError("not-found", "Pattern not found");
    }

    // Allowed fields to update
    const allowedFields = [
      "vendorAliases", "paymentProcessor", "typicalPaymentDelay",
      "usesInstallments", "installmentPattern", "typicalInstallmentCount",
      "transactionKeywords", "notes"
    ];

    const sanitizedUpdates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    sanitizedUpdates.updatedAt = Timestamp.now();

    await db.collection("vendor_patterns").doc(patternId).update(sanitizedUpdates);

    return { success: true };
  }
);

// ============================================
// GET ALL VENDOR PATTERNS (for UI)
// ============================================

export const getAllVendorPatterns = onCall(
  { cors: true },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const patterns = await getAllUserPatterns(userId);
    
    // Convert Timestamps for JSON serialization
    return patterns.map(p => ({
      ...p,
      lastMatchedAt: p.lastMatchedAt?.toDate?.().toISOString(),
      createdAt: p.createdAt?.toDate?.().toISOString(),
      updatedAt: p.updatedAt?.toDate?.().toISOString(),
    }));
  }
);
