/**
 * AI Reconciliation Chat Function
 * Uses Google AI Studio API for Gemini 3 Flash
 * 
 * Specialized AI assistant for bank reconciliation that:
 * - Searches transactions, invoices, and bills
 * - Finds and explains matches
 * - Identifies discrepancies and their causes
 * - Learns from user confirmations
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { geminiApiKey, getModelName, calculateCost } from "../config/ai-models";
import { GoogleGenAI } from "@google/genai";
import { recordUsage } from "../utils/usage";
import { getUserOrgId } from "../utils/model-preference";

const AI_MODEL = "gemini-3-flash";

// ============================================
// TYPES
// ============================================

interface ReconciliationContext {
  transactionCount: number;
  invoiceCount: number;
  billCount: number;
  recentTransactions: Array<{
    id: string;
    description: string;
    amount: number;
    type: "credit" | "debit";
    date: string;
    reference?: string;
    currency?: string;
  }>;
  recentInvoices: Array<{
    id: string;
    documentNumber: string;
    customerName: string;
    total: number;
    amountRemaining: number;
    currency?: string;
    dueDate?: string;
  }>;
  recentBills?: Array<{
    id: string;
    documentNumber: string;
    vendorName: string;
    total: number;
    amountRemaining: number;
    currency?: string;
    dueDate?: string;
  }>;
}

interface MatchSuggestion {
  transactionId: string;
  documentId: string;
  documentType: "invoice" | "bill";
  documentNumber: string;
  counterparty: string;
  documentAmount: number;
  confidence: number;
  reasons: string[];
  amountDifference?: number;
}

interface ReconciliationChatRequest {
  message: string;
  context: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

interface ReconciliationChatResponse {
  response: string;
  suggestions?: MatchSuggestion[];
  tokensUsed: {
    input: number;
    output: number;
  };
}

// ============================================
// SYSTEM PROMPT
// ============================================

function buildSystemPrompt(context: ReconciliationContext): string {
  return `You are an expert AI reconciliation assistant for SmartInvoice, a financial document processing platform.

═══════════════════════════════════════════════════════════════════════════════
YOUR EXPERTISE
═══════════════════════════════════════════════════════════════════════════════

You specialize in matching bank transactions to invoices and bills. You understand:

1. PAYMENT PATTERNS
   - Wire transfers typically arrive 1-3 business days after initiation
   - ACH payments take 2-5 business days
   - Credit card payments via Stripe/Square arrive in batches
   - International payments can take 3-7 days with FX conversion

2. COMMON DISCREPANCIES
   - Wire transfer fees: $15-50 (domestic), $25-75 (international)
   - Credit card processing fees: 2.9% + $0.30 (Stripe), 2.6% + $0.10 (Square)
   - Early payment discounts: 2/10 Net 30 means 2% discount if paid in 10 days
   - FX conversion: rates fluctuate, expect 0.5-3% variance
   - Bank fees: $5-35 for incoming wire, $0-25 for ACH

3. MATCHING CONFIDENCE RULES
   - Exact amount + name match: 95-100%
   - Amount within 3% + name match: 85-95%
   - Amount within 5% + partial name: 75-85%
   - Amount match only: 60-75%
   - Multiple transactions summing to invoice: 80-90%

═══════════════════════════════════════════════════════════════════════════════
CURRENT DATA
═══════════════════════════════════════════════════════════════════════════════

SUMMARY:
- Bank transactions available: ${context.transactionCount}
- Invoices uploaded (A/R): ${context.invoiceCount}
- Bills uploaded (A/P): ${context.billCount || 0}

RECENT BANK TRANSACTIONS:
${formatTransactions(context.recentTransactions)}

RECENT INVOICES (money owed TO the business):
${formatInvoices(context.recentInvoices)}

${context.recentBills?.length ? `RECENT BILLS (money owed BY the business):
${formatBills(context.recentBills)}` : ""}

═══════════════════════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════════════════════

When the user asks a question:

1. UNDERSTAND the query - are they searching for a specific match, asking about a discrepancy, or exploring their data?

2. SEARCH the data provided - look for matches based on:
   - Amount (exact or close)
   - Name/description similarity
   - Date proximity
   - Reference numbers

3. EXPLAIN clearly - use plain language, not accounting jargon

4. SHOW YOUR WORK - explain why you think something is a match

5. BE SPECIFIC - reference actual transaction IDs, invoice numbers, amounts

6. SUGGEST ACTIONS - if you find matches, suggest confirming them

═══════════════════════════════════════════════════════════════════════════════
RESPONSE FORMAT
═══════════════════════════════════════════════════════════════════════════════

When you find potential matches, include them at the END of your response like this:

[SUGGESTIONS]
[{"transactionId": "actual_id", "documentId": "actual_id", "documentType": "invoice", "documentNumber": "INV-001", "counterparty": "Acme Corp", "documentAmount": 1000.00, "confidence": 92, "reasons": ["Amount within 2%", "Company name match"]}]
[/SUGGESTIONS]

IMPORTANT: Only include SUGGESTIONS if you found actual matches in the data. Don't make up IDs.`;
}

// ============================================
// FORMATTERS
// ============================================

function formatTransactions(transactions: ReconciliationContext["recentTransactions"]): string {
  if (!transactions?.length) {
    return "No transactions available. User needs to upload bank statements.";
  }

  return transactions.map((tx, i) => {
    const sign = tx.type === "credit" ? "+" : "-";
    const currency = tx.currency || "USD";
    return `  ${i + 1}. ID: ${tx.id}
     ${sign}${formatMoney(tx.amount, currency)} | ${tx.description}
     Date: ${tx.date}${tx.reference ? ` | Ref: ${tx.reference}` : ""}`;
  }).join("\n\n");
}

function formatInvoices(invoices: ReconciliationContext["recentInvoices"]): string {
  if (!invoices?.length) {
    return "No invoices uploaded yet. User needs to upload invoices to match.";
  }

  return invoices.map((inv, i) => {
    const currency = inv.currency || "USD";
    const remaining = inv.amountRemaining ?? inv.total;
    return `  ${i + 1}. ID: ${inv.id}
     ${inv.documentNumber || "No number"} | ${inv.customerName || "Unknown customer"}
     Total: ${formatMoney(inv.total, currency)} | Remaining: ${formatMoney(remaining, currency)}${inv.dueDate ? ` | Due: ${inv.dueDate}` : ""}`;
  }).join("\n\n");
}

function formatBills(bills: ReconciliationContext["recentBills"]): string {
  if (!bills?.length) return "";

  return bills.map((bill, i) => {
    const currency = bill.currency || "USD";
    const remaining = bill.amountRemaining ?? bill.total;
    return `  ${i + 1}. ID: ${bill.id}
     ${bill.documentNumber || "No number"} | ${bill.vendorName || "Unknown vendor"}
     Total: ${formatMoney(bill.total, currency)} | Remaining: ${formatMoney(remaining, currency)}${bill.dueDate ? ` | Due: ${bill.dueDate}` : ""}`;
  }).join("\n\n");
}

function formatMoney(amount: number, currency: string = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ============================================
// RESPONSE PARSER
// ============================================

function parseResponse(responseText: string): { content: string; suggestions?: MatchSuggestion[] } {
  let content = responseText;
  let suggestions: MatchSuggestion[] | undefined;

  const suggestionsMatch = responseText.match(/\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/);
  if (suggestionsMatch) {
    content = content.replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/, "").trim();
    try {
      suggestions = JSON.parse(suggestionsMatch[1].trim());
    } catch (e) {
      console.warn("Failed to parse suggestions:", e);
    }
  }

  return { content, suggestions };
}

// ============================================
// MAIN FUNCTION
// ============================================

export const reconciliationChat = onCall(
  { 
    cors: true, 
    timeoutSeconds: 90,
    memory: "512MiB",
    secrets: [geminiApiKey],
  },
  async (request): Promise<ReconciliationChatResponse> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { message, context: contextJson, history } = request.data as ReconciliationChatRequest;

    if (!message) {
      throw new HttpsError("invalid-argument", "Message is required");
    }

    const userId = request.auth.uid;
    const startTime = Date.now();

    // Parse context
    let context: ReconciliationContext;
    try {
      context = JSON.parse(contextJson || "{}");
    } catch (e) {
      context = {
        transactionCount: 0,
        invoiceCount: 0,
        billCount: 0,
        recentTransactions: [],
        recentInvoices: [],
      };
    }

    try {
      // Initialize Google AI client
      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
      const modelName = getModelName(AI_MODEL);

      // Build system prompt
      const systemPrompt = buildSystemPrompt(context);

      // Build chat history
      const chatHistory = (history || []).slice(-6).map(msg => ({
        role: msg.role === "assistant" ? "model" as const : "user" as const,
        parts: [{ text: msg.content }],
      }));

      // Full prompt
      const fullPrompt = `${systemPrompt}

═══════════════════════════════════════════════════════════════════════════════
USER QUESTION
═══════════════════════════════════════════════════════════════════════════════

${message}

Please analyze this question and provide a helpful, specific response based on the data above.`;

      // Generate response
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          ...chatHistory,
          { role: "user", parts: [{ text: fullPrompt }] },
        ],
        config: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          topP: 0.9,
        },
      });

      const responseText = response.text || "";
      const usageMetadata = response.usageMetadata;

      // Parse response
      const { content, suggestions } = parseResponse(responseText);

      // Calculate tokens
      const inputTokens = usageMetadata?.promptTokenCount || 0;
      const outputTokens = usageMetadata?.candidatesTokenCount || 0;
      const processingTime = Date.now() - startTime;

      // Record usage
      const orgId = await getUserOrgId(userId);
      const estimatedCost = calculateCost(AI_MODEL, inputTokens, outputTokens);

      await recordUsage({
        orgId: orgId || "personal",
        userId,
        type: "api_call",
        aiProvider: "google",
        aiModel: AI_MODEL,
        inputTokens,
        outputTokens,
        pagesProcessed: 0,
        transactionsExtracted: 0,
        confidence: 1,
        status: "success",
        processingTimeMs: processingTime,
        estimatedCost,
      });

      console.log(`Reconciliation chat: ${inputTokens} input, ${outputTokens} output tokens, ${processingTime}ms`);

      return {
        response: content,
        suggestions,
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
        },
      };

    } catch (error) {
      console.error("Reconciliation chat error:", error);
      throw new HttpsError(
        "internal",
        `AI service error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);
