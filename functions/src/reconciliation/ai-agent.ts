/**
 * AI Reconciliation Agent
 * 
 * An intelligent agent that investigates uncertain matches by:
 * 1. Analyzing the discrepancy between invoice and transaction
 * 2. Using tools to query related data
 * 3. Reasoning through possible explanations
 * 4. Suggesting matches with detailed explanations
 * 
 * Features:
 * - Retry mechanisms for API failures
 * - Usage tracking for billing
 * - Real FX rate integration
 * - Optimized database queries
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { GoogleGenerativeAI, SchemaType, FunctionDeclaration } from "@google/generative-ai";
import { getVendorPatterns, getVendorMatchHistory, stringSimilarity } from "./pattern-memory";
import { defineSecret } from "firebase-functions/params";

const db = getFirestore();

// Define secret for Gemini API key
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// ============================================
// TYPES
// ============================================

interface AgentQuery {
  invoiceId: string;
  transactionId?: string;
  discrepancyType: 
    | "amount_mismatch" 
    | "vendor_mismatch" 
    | "no_match_found" 
    | "date_anomaly"
    | "currency_mismatch"
    | "partial_payment";
}

interface AgentResult {
  status: "match_found" | "explanation_found" | "no_resolution" | "needs_human";
  confidence: number;
  explanation: string;
  suggestedAction: "confirm_match" | "split_payment" | "mark_partial" | "investigate" | "ignore";
  matchedTransactions?: Array<{
    transactionId: string;
    amount: number;
    description: string;
    contribution: string;
  }>;
  relatedDocuments?: Array<{
    type: "credit_note" | "refund" | "fee" | "fx_adjustment";
    id: string;
    amount: number;
    description: string;
  }>;
  reasoning: string[];
  // Usage tracking
  tokensUsed?: number;
  toolCallsCount?: number;
  processingTimeMs?: number;
}

// ============================================
// RETRY UTILITY
// ============================================

async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error = new Error("Unknown error");
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      onRetry?.(attempt, lastError);
      
      // Wait with exponential backoff
      const waitTime = delayMs * Math.pow(backoffMultiplier, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
}

// ============================================
// USAGE TRACKING
// ============================================

async function trackAIUsage(
  userId: string,
  functionName: string,
  data: {
    tokensUsed?: number;
    toolCalls?: number;
    processingTimeMs: number;
    success: boolean;
    errorMessage?: string;
  }
) {
  try {
    await db.collection("ai_usage").add({
      userId,
      functionName,
      tokensUsed: data.tokensUsed || 0,
      toolCalls: data.toolCalls || 0,
      processingTimeMs: data.processingTimeMs,
      success: data.success,
      errorMessage: data.errorMessage,
      createdAt: Timestamp.now(),
    });

    // Update user's usage stats
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      "usage.aiTokensUsed": FieldValue.increment(data.tokensUsed || 0),
      "usage.aiCallsCount": FieldValue.increment(1),
      "usage.lastAICall": Timestamp.now(),
    });
  } catch (error) {
    // Non-critical - log but don't fail
    console.error("Failed to track AI usage:", error);
  }
}

// ============================================
// FX RATE SERVICE (with fallback)
// ============================================

interface FXRateResult {
  rate: number;
  date: string;
  source: "live" | "cached" | "fallback";
}

// Fallback rates (updated periodically)
const FALLBACK_RATES: Record<string, Record<string, number>> = {
  "EUR": { "USD": 1.09, "CAD": 1.47, "GBP": 0.86, "CHF": 0.94 },
  "USD": { "EUR": 0.92, "CAD": 1.35, "GBP": 0.79, "CHF": 0.86 },
  "CAD": { "USD": 0.74, "EUR": 0.68, "GBP": 0.59, "CHF": 0.64 },
  "GBP": { "USD": 1.27, "EUR": 1.16, "CAD": 1.71, "CHF": 1.09 },
  "CHF": { "USD": 1.16, "EUR": 1.06, "CAD": 1.57, "GBP": 0.92 },
};

async function getFXRate(fromCurrency: string, toCurrency: string, date: string): Promise<FXRateResult> {
  if (fromCurrency === toCurrency) {
    return { rate: 1, date, source: "live" };
  }

  // Check cache first
  const cacheKey = `fx_${fromCurrency}_${toCurrency}_${date}`;
  const cached = await db.collection("fx_cache").doc(cacheKey).get();
  
  if (cached.exists) {
    const data = cached.data()!;
    return { rate: data.rate, date, source: "cached" };
  }

  // Try live API (Open Exchange Rates)
  try {
    const apiKey = process.env.OPENEXCHANGERATES_API_KEY;
    if (apiKey) {
      const response = await withRetry(
        () => fetch(`https://openexchangerates.org/api/historical/${date}.json?app_id=${apiKey}&base=USD`),
        { maxRetries: 2, delayMs: 500 }
      );
      
      if (response.ok) {
        const data = await response.json();
        const rates = data.rates;
        
        // Convert from USD base to requested currencies
        let rate: number;
        if (fromCurrency === "USD") {
          rate = rates[toCurrency];
        } else if (toCurrency === "USD") {
          rate = 1 / rates[fromCurrency];
        } else {
          rate = rates[toCurrency] / rates[fromCurrency];
        }

        // Cache for future use
        await db.collection("fx_cache").doc(cacheKey).set({
          rate,
          fromCurrency,
          toCurrency,
          date,
          fetchedAt: Timestamp.now(),
        });

        return { rate, date, source: "live" };
      }
    }
  } catch (error) {
    console.error("FX API error, using fallback:", error);
  }

  // Fallback to hardcoded rates
  const fallbackRate = FALLBACK_RATES[fromCurrency]?.[toCurrency] || 1;
  return { rate: fallbackRate, date, source: "fallback" };
}

// ============================================
// OPTIMIZED DATABASE QUERIES
// ============================================

async function searchTransactionsOptimized(
  userId: string,
  params: {
    minAmount?: number;
    maxAmount?: number;
    vendorKeywords?: string[];
    dateFrom?: string;
    dateTo?: string;
    currency?: string;
    excludeIds?: string[];
    limit?: number;
  }
) {
  // Build query with compound conditions where possible
  let query = db.collection("transactions")
    .where("userId", "==", userId);

  // Add currency filter at query level if specified
  if (params.currency) {
    query = query.where("currency", "==", params.currency);
  }

  // Add date range filters at query level
  if (params.dateFrom) {
    query = query.where("date", ">=", Timestamp.fromDate(new Date(params.dateFrom)));
  }
  if (params.dateTo) {
    query = query.where("date", "<=", Timestamp.fromDate(new Date(params.dateTo)));
  }

  // Order and limit
  query = query.orderBy("date", "desc").limit(params.limit || 50);

  const results = await query.get();
  let transactions = results.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Filter remaining conditions in memory (more efficient after query reduction)
  if (params.minAmount !== undefined) {
    transactions = transactions.filter((t: any) => Math.abs(t.amount) >= params.minAmount!);
  }
  if (params.maxAmount !== undefined) {
    transactions = transactions.filter((t: any) => Math.abs(t.amount) <= params.maxAmount!);
  }
  if (params.vendorKeywords?.length) {
    transactions = transactions.filter((t: any) => 
      params.vendorKeywords!.some(kw => {
        const desc = t.description?.toLowerCase() || "";
        const keyword = kw.toLowerCase();
        // Use fuzzy matching for keywords
        return desc.includes(keyword) || stringSimilarity(desc, keyword) > 0.6;
      })
    );
  }
  if (params.excludeIds?.length) {
    transactions = transactions.filter((t: any) => !params.excludeIds!.includes(t.id));
  }

  return transactions.slice(0, params.limit || 20);
}

async function searchInvoicesOptimized(
  userId: string,
  params: {
    minAmount?: number;
    maxAmount?: number;
    vendorName?: string;
    status?: string;
    currency?: string;
    excludeIds?: string[];
    limit?: number;
  }
) {
  let query = db.collection("invoices")
    .where("userId", "==", userId);

  if (params.status) {
    query = query.where("status", "==", params.status);
  }
  if (params.currency) {
    query = query.where("currency", "==", params.currency);
  }

  query = query.orderBy("invoiceDate", "desc").limit(params.limit || 50);

  const results = await query.get();
  let invoices = results.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  if (params.minAmount !== undefined) {
    invoices = invoices.filter((i: any) => i.total >= params.minAmount!);
  }
  if (params.maxAmount !== undefined) {
    invoices = invoices.filter((i: any) => i.total <= params.maxAmount!);
  }
  if (params.vendorName) {
    const searchName = params.vendorName.toLowerCase();
    invoices = invoices.filter((i: any) => {
      const vendorName = i.vendorName?.toLowerCase() || "";
      return vendorName.includes(searchName) || stringSimilarity(vendorName, searchName) > 0.6;
    });
  }
  if (params.excludeIds?.length) {
    invoices = invoices.filter((i: any) => !params.excludeIds!.includes(i.id));
  }

  return invoices.slice(0, params.limit || 20);
}

// ============================================
// AGENT TOOLS - Functions the AI can call
// ============================================

const agentTools = {
  searchTransactions: searchTransactionsOptimized,
  searchInvoices: searchInvoicesOptimized,

  // Find invoices that sum to a specific amount
  findInvoiceCombination: async (
    userId: string,
    targetAmount: number,
    tolerance: number = 0.01,
    maxInvoices: number = 5
  ) => {
    const results = await db.collection("invoices")
      .where("userId", "==", userId)
      .where("reconciliationStatus", "in", ["unmatched", "partial"])
      .limit(30) // Reduced from 50 for performance
      .get();

    const invoices = results.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as { total: number; vendorName: string; invoiceNumber: string }
    }));

    const combinations: Array<{
      invoices: typeof invoices;
      sum: number;
      difference: number;
    }> = [];

    // Optimized subset sum with early termination
    const findCombos = (
      remaining: typeof invoices,
      current: typeof invoices,
      currentSum: number,
      startIdx: number
    ) => {
      if (current.length > maxInvoices) return;
      if (combinations.length >= 5) return; // Early termination
      
      const diff = Math.abs(currentSum - targetAmount);
      if (diff <= tolerance && current.length > 0) {
        combinations.push({
          invoices: [...current],
          sum: currentSum,
          difference: diff
        });
        return;
      }

      // Skip if already over target
      if (currentSum > targetAmount + tolerance) return;

      for (let i = startIdx; i < remaining.length; i++) {
        findCombos(
          remaining,
          [...current, remaining[i]],
          currentSum + remaining[i].total,
          i + 1
        );
      }
    };

    findCombos(invoices, [], 0, 0);
    return combinations.sort((a, b) => a.invoices.length - b.invoices.length).slice(0, 5);
  },

  // Find transactions that sum to invoice amount
  findPaymentCombination: async (
    userId: string,
    targetAmount: number,
    tolerance: number = 0.01,
    maxTransactions: number = 5
  ) => {
    const results = await db.collection("transactions")
      .where("userId", "==", userId)
      .where("type", "==", "debit")
      .orderBy("date", "desc")
      .limit(50)
      .get();

    const transactions = results.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as { amount: number; description: string; date: Timestamp }
    }));

    const combinations: Array<{
      transactions: typeof transactions;
      sum: number;
      difference: number;
    }> = [];

    const findCombos = (
      remaining: typeof transactions,
      current: typeof transactions,
      currentSum: number,
      startIdx: number
    ) => {
      if (current.length > maxTransactions) return;
      if (combinations.length >= 5) return;
      
      const diff = Math.abs(currentSum - targetAmount);
      if (diff <= tolerance && current.length > 0) {
        combinations.push({
          transactions: [...current],
          sum: currentSum,
          difference: diff
        });
        return;
      }

      if (currentSum > targetAmount + tolerance) return;

      for (let i = startIdx; i < remaining.length; i++) {
        findCombos(
          remaining,
          [...current, remaining[i]],
          currentSum + remaining[i].amount,
          i + 1
        );
      }
    };

    findCombos(transactions, [], 0, 0);
    return combinations.sort((a, b) => a.transactions.length - b.transactions.length).slice(0, 5);
  },

  // Get FX rate (with real API + fallback)
  getFXRate: async (fromCurrency: string, toCurrency: string, date: string) => {
    return getFXRate(fromCurrency, toCurrency, date);
  },

  // Search for credit notes or adjustments
  searchCreditNotes: async (userId: string, vendorName: string, maxAmount: number) => {
    const results = await db.collection("invoices")
      .where("userId", "==", userId)
      .limit(100)
      .get();

    const vendorLower = vendorName.toLowerCase();
    const credits = results.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .filter(inv => {
        const isCredit = inv.total < 0 || 
                        inv.invoiceNumber?.toLowerCase().includes("cn") || 
                        inv.type === "credit_note";
        const vendorMatch = stringSimilarity(inv.vendorName?.toLowerCase() || "", vendorLower) > 0.6;
        const amountMatch = Math.abs(inv.total) <= maxAmount;
        return isCredit && vendorMatch && amountMatch;
      });

    return credits;
  },

  // Get vendor payment history
  getVendorHistory: async (userId: string, vendorName: string) => {
    const [invoices, transactions] = await Promise.all([
      db.collection("invoices")
        .where("userId", "==", userId)
        .orderBy("invoiceDate", "desc")
        .limit(100)
        .get(),
      db.collection("transactions")
        .where("userId", "==", userId)
        .orderBy("date", "desc")
        .limit(200)
        .get()
    ]);

    const vendorLower = vendorName.toLowerCase();
    const vendorInvoices = invoices.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .filter(inv => stringSimilarity(inv.vendorName?.toLowerCase() || "", vendorLower) > 0.5);

    const vendorTransactions = transactions.docs
      .map(doc => ({ id: doc.id, ...doc.data() as any }))
      .filter(tx => stringSimilarity(tx.description?.toLowerCase() || "", vendorLower) > 0.4);

    // Calculate average payment delay
    const delays: number[] = [];
    for (const inv of vendorInvoices) {
      if (inv.matchedAt && inv.invoiceDate) {
        const invDate = inv.invoiceDate.toDate?.() || new Date(inv.invoiceDate);
        const matchDate = inv.matchedAt.toDate?.() || new Date(inv.matchedAt);
        const delay = Math.floor((matchDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
        if (delay >= 0 && delay < 90) delays.push(delay);
      }
    }

    return {
      invoiceCount: vendorInvoices.length,
      totalInvoiced: vendorInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
      transactionCount: vendorTransactions.length,
      totalPaid: vendorTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0),
      averagePaymentDelay: delays.length > 0 ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null,
      paymentDelayRange: delays.length > 0 ? { min: Math.min(...delays), max: Math.max(...delays) } : null,
    };
  },

  // Get learned patterns for a vendor
  getLearnedPatterns: async (userId: string, vendorName: string) => {
    const patterns = await getVendorPatterns(userId, vendorName);
    const history = await getVendorMatchHistory(userId, vendorName, 10);
    
    if (patterns.length === 0) {
      return { hasPatterns: false, message: "No learned patterns for this vendor yet" };
    }

    const p = patterns[0];
    return {
      hasPatterns: true,
      vendorName: p.vendorName,
      confidence: p.confidence,
      matchCount: p.matchCount,
      paymentProcessor: p.paymentProcessor,
      typicalPaymentDelay: p.typicalPaymentDelay,
      paymentDelayRange: p.paymentDelayRange,
      typicalAmountRange: p.typicalAmountRange,
      usesInstallments: p.usesInstallments,
      installmentPattern: p.installmentPattern,
      vendorAliases: p.vendorAliases,
      transactionKeywords: p.transactionKeywords,
      recentMatches: history.slice(0, 5).map(h => ({
        invoiceNumber: h.invoiceNumber,
        invoiceAmount: h.invoiceAmount,
        transactionDescription: h.transactionDescription,
        transactionAmount: h.transactionAmount,
        daysDifference: h.daysDifference,
        matchType: h.matchType,
      }))
    };
  }
};

// ============================================
// TOOL DEFINITIONS FOR GEMINI
// ============================================

const toolDefinitions: FunctionDeclaration[] = [
  {
    name: "searchTransactions",
    description: "Search for bank transactions matching specific criteria. Use this to find potential payment matches.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        minAmount: { type: SchemaType.NUMBER, description: "Minimum transaction amount" },
        maxAmount: { type: SchemaType.NUMBER, description: "Maximum transaction amount" },
        vendorKeywords: { 
          type: SchemaType.ARRAY, 
          items: { type: SchemaType.STRING },
          description: "Keywords to search in transaction description" 
        },
        dateFrom: { type: SchemaType.STRING, description: "Start date (YYYY-MM-DD)" },
        dateTo: { type: SchemaType.STRING, description: "End date (YYYY-MM-DD)" },
        currency: { type: SchemaType.STRING, description: "Currency code (USD, EUR, etc.)" },
      },
      required: []
    }
  },
  {
    name: "searchInvoices",
    description: "Search for invoices matching specific criteria.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        minAmount: { type: SchemaType.NUMBER, description: "Minimum invoice amount" },
        maxAmount: { type: SchemaType.NUMBER, description: "Maximum invoice amount" },
        vendorName: { type: SchemaType.STRING, description: "Vendor name to search" },
        status: { type: SchemaType.STRING, description: "Invoice status" },
        currency: { type: SchemaType.STRING, description: "Currency code" },
      },
      required: []
    }
  },
  {
    name: "findInvoiceCombination",
    description: "Find a combination of invoices that sum to a specific payment amount. Useful when one payment covers multiple invoices.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        targetAmount: { type: SchemaType.NUMBER, description: "The payment amount to match" },
        tolerance: { type: SchemaType.NUMBER, description: "Acceptable difference (default 0.01)" },
      },
      required: ["targetAmount"]
    }
  },
  {
    name: "findPaymentCombination",
    description: "Find a combination of transactions that sum to an invoice amount. Useful when invoice was paid in installments.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        targetAmount: { type: SchemaType.NUMBER, description: "The invoice amount to match" },
        tolerance: { type: SchemaType.NUMBER, description: "Acceptable difference (default 0.01)" },
      },
      required: ["targetAmount"]
    }
  },
  {
    name: "getFXRate",
    description: "Get the exchange rate between two currencies on a specific date. Uses live rates when available.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        fromCurrency: { type: SchemaType.STRING, description: "Source currency code" },
        toCurrency: { type: SchemaType.STRING, description: "Target currency code" },
        date: { type: SchemaType.STRING, description: "Date (YYYY-MM-DD)" },
      },
      required: ["fromCurrency", "toCurrency", "date"]
    }
  },
  {
    name: "searchCreditNotes",
    description: "Search for credit notes or refunds from a vendor that might explain amount differences.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        vendorName: { type: SchemaType.STRING, description: "Vendor name to search" },
        maxAmount: { type: SchemaType.NUMBER, description: "Maximum credit amount to search for" },
      },
      required: ["vendorName", "maxAmount"]
    }
  },
  {
    name: "getVendorHistory",
    description: "Get historical payment patterns and relationship data for a vendor.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        vendorName: { type: SchemaType.STRING, description: "The vendor name to look up" },
      },
      required: ["vendorName"]
    }
  },
  {
    name: "getLearnedPatterns",
    description: "Get AI-learned patterns for a vendor from previous matches. This includes payment processor used, typical payment delays, installment patterns, and transaction keywords. ALWAYS call this first for any investigation.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        vendorName: { type: SchemaType.STRING, description: "The vendor name to look up" },
      },
      required: ["vendorName"]
    }
  }
];

// ============================================
// MAIN AGENT FUNCTION
// ============================================

export const investigateMatch = onCall(
  { 
    cors: true,
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [geminiApiKey],
  },
  async (request) => {
    const startTime = Date.now();
    const userId = request.auth?.uid;
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const { invoiceId, transactionId, discrepancyType } = request.data as AgentQuery;

    // Validate API key
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      await trackAIUsage(userId, "investigateMatch", {
        processingTimeMs: Date.now() - startTime,
        success: false,
        errorMessage: "GEMINI_API_KEY not configured",
      });
      throw new HttpsError("failed-precondition", "AI service not configured. Please contact support.");
    }

    // Fetch the invoice
    const invoiceDoc = await db.collection("invoices").doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      throw new HttpsError("not-found", "Invoice not found");
    }
    const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() };

    // Fetch the transaction if provided
    let transaction = null;
    if (transactionId) {
      const txDoc = await db.collection("transactions").doc(transactionId).get();
      if (txDoc.exists) {
        transaction = { id: txDoc.id, ...txDoc.data() };
      }
    }

    let tokensUsed = 0;
    let toolCallsCount = 0;

    try {
      // Initialize Gemini with retry
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview",
        tools: [{ functionDeclarations: toolDefinitions }]
      });

      const systemPrompt = `You are a financial reconciliation expert AI agent. Your job is to investigate uncertain matches between invoices and bank transactions.

You have access to tools to search the user's financial data. Use them to:
1. Find potential matches or explanations
2. Identify patterns in payment behavior
3. Explain discrepancies (partial payments, currency conversions, fees, etc.)

IMPORTANT: Always start by calling getLearnedPatterns for the vendor to check for prior history.
Always think step by step and explain your reasoning.`;

      const investigationPrompt = buildInvestigationPrompt(invoice, transaction, discrepancyType);

      // Run with retry
      const result = await withRetry(
        async () => {
          const chat = model.startChat({
            history: [
              { role: "user", parts: [{ text: systemPrompt }] },
              { role: "model", parts: [{ text: "I understand. I'm ready to investigate financial reconciliation issues using the available tools. What would you like me to look into?" }] }
            ]
          });

          const reasoning: string[] = [];
          let response = await chat.sendMessage(investigationPrompt);
          
          // Process tool calls in a loop
          let iterations = 0;
          const maxIterations = 10;

          while (response.response.candidates?.[0]?.content?.parts?.some(p => p.functionCall) && iterations < maxIterations) {
            iterations++;
            const functionCalls = response.response.candidates[0].content.parts.filter(p => p.functionCall);
            
            const toolResults = [];
            for (const part of functionCalls) {
              const call = part.functionCall!;
              toolCallsCount++;
              reasoning.push(`🔍 Searching: ${call.name}(${JSON.stringify(call.args)})`);
              
              let toolResult;
              try {
                switch (call.name) {
                  case "searchTransactions":
                    toolResult = await agentTools.searchTransactions(userId, call.args as any);
                    break;
                  case "searchInvoices":
                    toolResult = await agentTools.searchInvoices(userId, call.args as any);
                    break;
                  case "findInvoiceCombination":
                    toolResult = await agentTools.findInvoiceCombination(
                      userId, 
                      (call.args as any).targetAmount,
                      (call.args as any).tolerance
                    );
                    break;
                  case "findPaymentCombination":
                    toolResult = await agentTools.findPaymentCombination(
                      userId,
                      (call.args as any).targetAmount,
                      (call.args as any).tolerance
                    );
                    break;
                  case "getFXRate":
                    toolResult = await agentTools.getFXRate(
                      (call.args as any).fromCurrency,
                      (call.args as any).toCurrency,
                      (call.args as any).date
                    );
                    break;
                  case "searchCreditNotes":
                    toolResult = await agentTools.searchCreditNotes(
                      userId,
                      (call.args as any).vendorName,
                      (call.args as any).maxAmount
                    );
                    break;
                  case "getVendorHistory":
                    toolResult = await agentTools.getVendorHistory(userId, (call.args as any).vendorName);
                    break;
                  case "getLearnedPatterns":
                    toolResult = await agentTools.getLearnedPatterns(userId, (call.args as any).vendorName);
                    break;
                  default:
                    toolResult = { error: "Unknown tool" };
                }
              } catch (error) {
                toolResult = { error: String(error) };
              }

              reasoning.push(`📊 Found: ${JSON.stringify(toolResult).slice(0, 200)}...`);
              
              toolResults.push({
                functionResponse: {
                  name: call.name,
                  response: toolResult
                }
              });
            }

            response = await chat.sendMessage(toolResults.map(r => ({ functionResponse: r.functionResponse })));
          }

          // Get token usage if available
          const usageMetadata = response.response.usageMetadata;
          if (usageMetadata) {
            tokensUsed = (usageMetadata.promptTokenCount || 0) + (usageMetadata.candidatesTokenCount || 0);
          }

          const finalText = response.response.candidates?.[0]?.content?.parts
            ?.filter(p => p.text)
            ?.map(p => p.text)
            ?.join("\n") || "";

          return { finalText, reasoning };
        },
        {
          maxRetries: 3,
          delayMs: 2000,
          onRetry: (attempt, error) => {
            console.log(`Gemini API retry ${attempt}: ${error.message}`);
          }
        }
      );

      const agentResult = parseAgentResponse(result.finalText, result.reasoning);
      agentResult.tokensUsed = tokensUsed;
      agentResult.toolCallsCount = toolCallsCount;
      agentResult.processingTimeMs = Date.now() - startTime;

      // Store the investigation result
      await db.collection("reconciliation_investigations").add({
        userId,
        invoiceId,
        transactionId,
        discrepancyType,
        result: agentResult,
        createdAt: Timestamp.now()
      });

      // Track usage
      await trackAIUsage(userId, "investigateMatch", {
        tokensUsed,
        toolCalls: toolCallsCount,
        processingTimeMs: Date.now() - startTime,
        success: true,
      });

      return agentResult;

    } catch (error: any) {
      // Track failed usage
      await trackAIUsage(userId, "investigateMatch", {
        tokensUsed,
        toolCalls: toolCallsCount,
        processingTimeMs: Date.now() - startTime,
        success: false,
        errorMessage: error.message,
      });

      console.error("Investigation error:", error);
      throw new HttpsError("internal", `Investigation failed: ${error.message}. Please try again.`);
    }
  }
);

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildInvestigationPrompt(
  invoice: any, 
  transaction: any | null, 
  discrepancyType: string
): string {
  let prompt = `Please investigate the following reconciliation issue:

## Invoice Details
- Invoice Number: ${invoice.invoiceNumber}
- Vendor: ${invoice.vendorName}
- Amount: ${invoice.currency} ${invoice.total}
- Date: ${invoice.invoiceDate?.toDate?.()?.toISOString?.()?.split('T')[0] || invoice.invoiceDate}
- Status: ${invoice.reconciliationStatus || 'unmatched'}
`;

  if (transaction) {
    prompt += `
## Suspected Transaction Match
- Description: ${transaction.description}
- Amount: ${transaction.currency} ${transaction.amount}
- Date: ${transaction.date?.toDate?.()?.toISOString?.()?.split('T')[0] || transaction.date}
- Type: ${transaction.type}
`;
  }

  prompt += `
## Issue Type: ${discrepancyType}

## IMPORTANT: Investigation Steps

1. **FIRST: Call getLearnedPatterns("${invoice.vendorName}")** to check if we have prior history with this vendor.

2. **Use learned patterns** to guide your search:
   - If vendor uses a payment processor, search for that processor name
   - If vendor has known aliases, search for those too
   - If vendor typically pays in X days, focus on that date range
   - If vendor pays in installments, look for multiple smaller transactions

3. **Search for evidence** using other tools

4. **Provide a clear recommendation**

After your investigation, summarize your findings in this format:
- STATUS: (match_found | explanation_found | no_resolution | needs_human)
- CONFIDENCE: (0-100)
- EXPLANATION: (one paragraph summary)
- ACTION: (confirm_match | split_payment | mark_partial | investigate | ignore)
- MATCHED_TRANSACTIONS: (list of transaction IDs if applicable)
`;

  return prompt;
}

function parseAgentResponse(text: string, reasoning: string[]): AgentResult {
  const statusMatch = text.match(/STATUS:\s*(match_found|explanation_found|no_resolution|needs_human)/i);
  const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/i);
  const explanationMatch = text.match(/EXPLANATION:\s*([^\n]+)/i);
  const actionMatch = text.match(/ACTION:\s*(confirm_match|split_payment|mark_partial|investigate|ignore)/i);

  return {
    status: (statusMatch?.[1]?.toLowerCase() || "no_resolution") as AgentResult["status"],
    confidence: parseInt(confidenceMatch?.[1] || "0"),
    explanation: explanationMatch?.[1] || text.slice(0, 500),
    suggestedAction: (actionMatch?.[1]?.toLowerCase() || "investigate") as AgentResult["suggestedAction"],
    reasoning
  };
}

// ============================================
// BATCH INVESTIGATION
// ============================================

export const investigateAllUncertainMatches = onCall(
  {
    cors: true,
    timeoutSeconds: 540,
    memory: "1GiB",
    secrets: [geminiApiKey],
  },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    // Validate API key
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "AI service not configured");
    }

    const unmatchedInvoices = await db.collection("invoices")
      .where("userId", "==", userId)
      .where("reconciliationStatus", "in", ["unmatched", "partial"])
      .limit(10) // Reduced batch size for reliability
      .get();

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const invoiceDoc of unmatchedInvoices.docs) {
      const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() } as any;
      
      try {
        // Run investigation directly using internal function
        const result = await runInvestigation(
          userId,
          apiKey,
          invoice.id,
          "no_match_found"
        );
        
        successCount++;
        results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          result,
          success: true,
        });

        // Small delay between calls to avoid overloading
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        errorCount++;
        results.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          error: error.message,
          success: false,
        });
      }
    }

    return {
      investigated: results.length,
      successCount,
      errorCount,
      results
    };
  }
);

// ============================================
// INTERNAL INVESTIGATION LOGIC (shared)
// ============================================

async function runInvestigation(
  userId: string,
  apiKey: string,
  invoiceId: string,
  discrepancyType: AgentQuery["discrepancyType"],
  transactionId?: string
): Promise<AgentResult> {
  const startTime = Date.now();
  
  // Fetch the invoice
  const invoiceDoc = await db.collection("invoices").doc(invoiceId).get();
  if (!invoiceDoc.exists) {
    throw new Error("Invoice not found");
  }
  const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() };

  // Fetch the transaction if provided
  let transaction = null;
  if (transactionId) {
    const txDoc = await db.collection("transactions").doc(transactionId).get();
    if (txDoc.exists) {
      transaction = { id: txDoc.id, ...txDoc.data() };
    }
  }

  let tokensUsed = 0;
  let toolCallsCount = 0;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      tools: [{ functionDeclarations: toolDefinitions }]
    });

    const systemPrompt = `You are a financial reconciliation expert AI agent. Your job is to investigate uncertain matches between invoices and bank transactions.

You have access to tools to search the user's financial data. Use them to:
1. Find potential matches or explanations
2. Identify patterns in payment behavior
3. Explain discrepancies (partial payments, currency conversions, fees, etc.)

IMPORTANT: Always start by calling getLearnedPatterns for the vendor to check for prior history.
Always think step by step and explain your reasoning.`;

    const investigationPrompt = buildInvestigationPrompt(invoice, transaction, discrepancyType);

    const result = await withRetry(
      async () => {
        const chat = model.startChat({
          history: [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "I understand. I'm ready to investigate financial reconciliation issues using the available tools. What would you like me to look into?" }] }
          ]
        });

        const reasoning: string[] = [];
        let response = await chat.sendMessage(investigationPrompt);
        
        let iterations = 0;
        const maxIterations = 10;

        while (response.response.candidates?.[0]?.content?.parts?.some(p => p.functionCall) && iterations < maxIterations) {
          iterations++;
          const functionCalls = response.response.candidates[0].content.parts.filter(p => p.functionCall);
          
          const toolResults = [];
          for (const part of functionCalls) {
            const call = part.functionCall!;
            toolCallsCount++;
            reasoning.push(`🔍 Searching: ${call.name}(${JSON.stringify(call.args)})`);
            
            let toolResult;
            try {
              switch (call.name) {
                case "searchTransactions":
                  toolResult = await agentTools.searchTransactions(userId, call.args as any);
                  break;
                case "searchInvoices":
                  toolResult = await agentTools.searchInvoices(userId, call.args as any);
                  break;
                case "findInvoiceCombination":
                  toolResult = await agentTools.findInvoiceCombination(
                    userId, 
                    (call.args as any).targetAmount,
                    (call.args as any).tolerance
                  );
                  break;
                case "findPaymentCombination":
                  toolResult = await agentTools.findPaymentCombination(
                    userId,
                    (call.args as any).targetAmount,
                    (call.args as any).tolerance
                  );
                  break;
                case "getFXRate":
                  toolResult = await agentTools.getFXRate(
                    (call.args as any).fromCurrency,
                    (call.args as any).toCurrency,
                    (call.args as any).date
                  );
                  break;
                case "searchCreditNotes":
                  toolResult = await agentTools.searchCreditNotes(
                    userId,
                    (call.args as any).vendorName,
                    (call.args as any).maxAmount
                  );
                  break;
                case "getVendorHistory":
                  toolResult = await agentTools.getVendorHistory(userId, (call.args as any).vendorName);
                  break;
                case "getLearnedPatterns":
                  toolResult = await agentTools.getLearnedPatterns(userId, (call.args as any).vendorName);
                  break;
                default:
                  toolResult = { error: "Unknown tool" };
              }
            } catch (error) {
              toolResult = { error: String(error) };
            }

            reasoning.push(`📊 Found: ${JSON.stringify(toolResult).slice(0, 200)}...`);
            
            toolResults.push({
              functionResponse: {
                name: call.name,
                response: toolResult
              }
            });
          }

          response = await chat.sendMessage(toolResults.map(r => ({ functionResponse: r.functionResponse })));
        }

        const usageMetadata = response.response.usageMetadata;
        if (usageMetadata) {
          tokensUsed = (usageMetadata.promptTokenCount || 0) + (usageMetadata.candidatesTokenCount || 0);
        }

        const finalText = response.response.candidates?.[0]?.content?.parts
          ?.filter(p => p.text)
          ?.map(p => p.text)
          ?.join("\n") || "";

        return { finalText, reasoning };
      },
      {
        maxRetries: 3,
        delayMs: 2000,
        onRetry: (attempt, error) => {
          console.log(`Gemini API retry ${attempt}: ${error.message}`);
        }
      }
    );

    const agentResult = parseAgentResponse(result.finalText, result.reasoning);
    agentResult.tokensUsed = tokensUsed;
    agentResult.toolCallsCount = toolCallsCount;
    agentResult.processingTimeMs = Date.now() - startTime;

    // Store the investigation result
    await db.collection("reconciliation_investigations").add({
      userId,
      invoiceId,
      transactionId,
      discrepancyType,
      result: agentResult,
      createdAt: Timestamp.now()
    });

    // Track usage
    await trackAIUsage(userId, "runInvestigation", {
      tokensUsed,
      toolCalls: toolCallsCount,
      processingTimeMs: Date.now() - startTime,
      success: true,
    });

    return agentResult;

  } catch (error: any) {
    await trackAIUsage(userId, "runInvestigation", {
      tokensUsed,
      toolCalls: toolCallsCount,
      processingTimeMs: Date.now() - startTime,
      success: false,
      errorMessage: error.message,
    });

    throw error;
  }
}
