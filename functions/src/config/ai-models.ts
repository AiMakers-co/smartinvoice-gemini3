/**
 * AI Model Configuration (January 2026)
 * Using Google AI Studio API for Gemini 3 Flash support
 * 
 * See: https://ai.google.dev/gemini-api/docs/gemini-3
 * 
 * COST CALCULATION:
 * - Typical page: ~8,000 input tokens + ~2,000 output tokens
 * - Cost per page = (8000/1M × input_price) + (2000/1M × output_price)
 */
import { GoogleGenAI } from "@google/genai";
import { defineSecret } from "firebase-functions/params";

// Define the API key secret
export const geminiApiKey = defineSecret("GEMINI_API_KEY");

// ============================================
// MODEL CONFIGURATION
// ============================================

export const GEMINI_MODELS = {
  "gemini-3-flash": "gemini-3-flash-preview",
  "gemini-3-flash-preview": "gemini-3-flash-preview",
  "gemini-3-pro": "gemini-3-pro-preview",
  "gemini-3-pro-preview": "gemini-3-pro-preview",
  "gemini-2.5-pro": "gemini-2.5-pro",
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.0-flash": "gemini-2.0-flash-exp",
} as const;

// Pricing per 1M tokens (USD)
// Source: https://ai.google.dev/gemini-api/docs/gemini-3
export const MODEL_PRICING = {
  "gemini-3-flash": { input: 0.50, output: 3.00, costPerPage: 0.01 },
  "gemini-3-flash-preview": { input: 0.50, output: 3.00, costPerPage: 0.01 },
  "gemini-3-pro": { input: 2.00, output: 12.00, costPerPage: 0.04 },
  "gemini-3-pro-preview": { input: 2.00, output: 12.00, costPerPage: 0.04 },
  "gemini-2.5-pro": { input: 1.25, output: 5.00, costPerPage: 0.02 },
  "gemini-2.5-flash": { input: 0.075, output: 0.30, costPerPage: 0.001 },
  "gemini-2.0-flash": { input: 0.075, output: 0.30, costPerPage: 0.001 },
} as const;

// DEFAULT: Gemini 3 Flash
export const DEFAULT_MODEL = "gemini-3-flash";
export const DEFAULT_PROVIDER = "google";

// Cost per page for revenue calculations
export const COST_PER_PAGE = MODEL_PRICING[DEFAULT_MODEL].costPerPage;

// ============================================
// GOOGLE AI CLIENT
// ============================================

let _genAI: GoogleGenAI | null = null;

/**
 * Get the Google AI client (lazy initialization)
 * Must be called from within a function that has access to secrets
 */
export function getGoogleAI(): GoogleGenAI {
  if (!_genAI) {
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY secret not available");
    }
    _genAI = new GoogleGenAI({ apiKey });
  }
  return _genAI;
}

/**
 * Get model name with preview suffix if needed
 */
export function getModelName(modelId: string = DEFAULT_MODEL): string {
  return GEMINI_MODELS[modelId as keyof typeof GEMINI_MODELS] || GEMINI_MODELS[DEFAULT_MODEL];
}

/**
 * Generate content using Google AI
 */
export async function generateContent(
  modelId: string,
  contents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>,
  config?: { temperature?: number; maxOutputTokens?: number }
) {
  const ai = getGoogleAI();
  const modelName = getModelName(modelId);
  
  const response = await ai.models.generateContent({
    model: modelName,
    contents: contents,
    config: config ? {
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
    } : undefined,
  });
  
  return response;
}

/**
 * Calculate cost based on token usage
 */
export function calculateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[modelId as keyof typeof MODEL_PRICING] || MODEL_PRICING[DEFAULT_MODEL];
  return ((inputTokens / 1000000) * pricing.input) + ((outputTokens / 1000000) * pricing.output);
}

/**
 * Get all available Gemini models
 */
export function getAvailableModels() {
  return Object.keys(GEMINI_MODELS);
}
