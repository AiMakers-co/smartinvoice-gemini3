/**
 * AI Assistant Chat Function
 * Handles conversational AI for DOCUMENT PROCESSING using Gemini
 * Uses Google AI Studio API for Gemini 3 Flash
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { geminiApiKey, getModelName, calculateCost } from "../config/ai-models";
import { GoogleGenAI } from "@google/genai";
import { recordUsage } from "../utils/usage";
import { getUserOrgId } from "../utils/model-preference";

const AI_ASSISTANT_MODEL = "gemini-3-flash";

// ============================================
// TYPES
// ============================================

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface DocumentContext {
  documentType: "invoice" | "bank_statement";
  fileName?: string;
  extractedData?: any;
  issues?: any[];
  corrections?: any[];
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  context?: DocumentContext;
}

interface ChatResponse {
  content: string;
  actions?: Array<{
    id: string;
    type: string;
    label: string;
    payload: Record<string, any>;
    isPrimary?: boolean;
  }>;
  tokensUsed: {
    input: number;
    output: number;
  };
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * AI Assistant chat endpoint for document processing
 */
export const aiAssistantChat = onCall(
  { 
    cors: true, 
    timeoutSeconds: 60,
    secrets: [geminiApiKey],
  },
  async (request): Promise<ChatResponse> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { message, history, context } = request.data as ChatRequest;
    
    if (!message) {
      throw new HttpsError("invalid-argument", "Message is required");
    }

    const userId = request.auth.uid;
    const startTime = Date.now();

    try {
      // Initialize Google AI client
      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
      const modelName = getModelName(AI_ASSISTANT_MODEL);

      // Build system prompt for document processing
      const systemPrompt = buildSystemPrompt(context);

      // Build chat history for context
      const chatHistory = (history || []).slice(-10).map(msg => ({
        role: msg.role === "assistant" ? "model" as const : "user" as const,
        parts: [{ text: msg.content }],
      }));

      // Create the prompt with context
      const fullPrompt = `${systemPrompt}

Current user message: ${message}

Respond helpfully and concisely. If you suggest actions, format them as JSON at the end of your response like this:
[ACTIONS]
[{"type": "action_type", "label": "Button Label", "payload": {}}]
[/ACTIONS]

Available action types:
- "accept_all" - Accept all extracted data
- "correct_field" - Correct a specific field (payload: {field, newValue, originalValue})
- "create_template" - Save as vendor template (payload: {vendorName})
- "rescan" - Re-scan the document
- "navigate" - Navigate to section (payload: {section: "issues" | "lineItems"})
- "categorize" - Auto-categorize items`;

      // Generate response
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          ...chatHistory,
          { role: "user", parts: [{ text: fullPrompt }] },
        ],
        config: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0.9,
        },
      });

      const responseText = response.text || "";
      const usageMetadata = response.usageMetadata;

      // Parse response and extract actions
      const { content, actions } = parseResponse(responseText);

      // Calculate tokens and cost
      const inputTokens = usageMetadata?.promptTokenCount || 0;
      const outputTokens = usageMetadata?.candidatesTokenCount || 0;
      const processingTime = Date.now() - startTime;

      // Record usage
      const orgId = await getUserOrgId(userId);
      const estimatedCost = calculateCost(AI_ASSISTANT_MODEL, inputTokens, outputTokens);

      await recordUsage({
        orgId: orgId || "personal",
        userId,
        type: "api_call",
        aiProvider: "google",
        aiModel: AI_ASSISTANT_MODEL,
        inputTokens,
        outputTokens,
        pagesProcessed: 0,
        transactionsExtracted: 0,
        confidence: 1,
        status: "success",
        processingTimeMs: processingTime,
        estimatedCost,
      });

      console.log(`AI Assistant (document): ${inputTokens} input, ${outputTokens} output tokens`);

      return {
        content,
        actions,
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
        },
      };

    } catch (error) {
      console.error("AI Assistant chat error:", error);
      throw new HttpsError(
        "internal",
        `Failed to generate response: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);

// ============================================
// SYSTEM PROMPT
// ============================================

/**
 * Build system prompt based on document context
 */
function buildSystemPrompt(context: DocumentContext | undefined): string {
  if (!context) {
    return `You are an AI assistant helping users process financial documents. You are knowledgeable, helpful, and concise.`;
  }

  const basePrompt = `You are an AI assistant helping users process financial documents. You are knowledgeable, helpful, and concise.

Current context:
- Document type: ${context.documentType === "invoice" ? "Invoice" : "Bank Statement"}`;

  let contextDetails = "";

  if (context.extractedData) {
    if (context.documentType === "invoice") {
      const data = context.extractedData;
      contextDetails = `
- Vendor: ${data.vendorName || "Unknown"}
- Invoice #: ${data.invoiceNumber || "Unknown"}
- Total: ${data.currency || "USD"} ${data.total?.toFixed(2) || "0.00"}
- Line items: ${data.lineItems?.length || 0}
- Confidence: ${Math.round((data.confidence || 0.8) * 100)}%`;
    } else {
      const data = context.extractedData;
      contextDetails = `
- Bank: ${data.bankName || "Unknown"}
- Account: ****${data.accountNumber || "0000"}
- Transactions: ${data.transactions?.length || 0}
- Period: ${data.periodStart || "?"} to ${data.periodEnd || "?"}
- Confidence: ${Math.round((data.confidence || 0.8) * 100)}%`;
    }
  }

  if (context.issues && context.issues.length > 0) {
    const unresolvedIssues = context.issues.filter((i: any) => !i.resolved);
    contextDetails += `
- Unresolved issues: ${unresolvedIssues.length}`;
    
    if (unresolvedIssues.length > 0) {
      contextDetails += `
  Issues: ${unresolvedIssues.map((i: any) => i.title).join(", ")}`;
    }
  }

  if (context.corrections && context.corrections.length > 0) {
    contextDetails += `
- User corrections made: ${context.corrections.length}`;
  }

  return basePrompt + contextDetails + `

Guidelines:
1. Be helpful and concise
2. When suggesting corrections, be specific
3. Explain your reasoning briefly
4. Suggest actions when appropriate
5. If confidence is low, recommend review
6. For new vendors, suggest creating a template`;
}

// ============================================
// RESPONSE PARSER
// ============================================

/**
 * Parse response to extract content and actions
 */
function parseResponse(responseText: string): { content: string; actions?: any[] } {
  let content = responseText;
  let actions: any[] | undefined;

  // Check for actions block
  const actionsMatch = responseText.match(/\[ACTIONS\]([\s\S]*?)\[\/ACTIONS\]/);
  if (actionsMatch) {
    content = content.replace(/\[ACTIONS\][\s\S]*?\[\/ACTIONS\]/, "").trim();
    try {
      const parsedActions = JSON.parse(actionsMatch[1].trim()) as any[];
      actions = parsedActions.map((action: any, idx: number) => ({
        ...action,
        id: `action_${Date.now()}_${idx}`,
      }));
    } catch (e) {
      console.warn("Failed to parse actions:", e);
    }
  }

  return { content, actions };
}
