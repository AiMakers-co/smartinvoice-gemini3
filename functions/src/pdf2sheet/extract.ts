/**
 * PDF2Sheet Extract Function
 * Extracts data from a single page using confirmed headers
 * Uses Google AI Studio API for Gemini 3 Flash
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { geminiApiKey, getModelName, calculateCost } from "../config/ai-models";
import { GoogleGenAI } from "@google/genai";
import { recordUsage } from "../utils/usage";
import { getUserModelPreference, getUserOrgId } from "../utils/model-preference";
import { downloadFileAsBase64 } from "../utils/storage";
import { Pdf2SheetExtractResult, Pdf2SheetHeader } from "../types";

interface ExtractRequest {
  fileUrl: string;
  mimeType?: string;
  pageNumber: number;
  totalPages: number;
  headers: Pdf2SheetHeader[];
}

/**
 * Extract data from a single page using the confirmed headers
 */
export const pdf2sheetExtract = onCall(
  { 
    cors: true, 
    timeoutSeconds: 120,
    secrets: [geminiApiKey],
  },
  async (request): Promise<Pdf2SheetExtractResult> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { fileUrl, mimeType, pageNumber, totalPages, headers } = request.data as ExtractRequest;
    
    if (!fileUrl) {
      throw new HttpsError("invalid-argument", "File URL required");
    }
    if (!headers || headers.length === 0) {
      throw new HttpsError("invalid-argument", "Headers required");
    }
    if (!pageNumber || pageNumber < 1) {
      throw new HttpsError("invalid-argument", "Valid page number required");
    }

    const startTime = Date.now();
    const userId = request.auth.uid;
    const { model: modelToUse, provider } = await getUserModelPreference(userId);
    const modelName = getModelName(modelToUse);

    console.log(`PDF2Sheet extract page ${pageNumber}/${totalPages} for user ${userId}`);

    try {
      // Initialize Google AI client
      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
      
      // Download file from storage
      const base64Data = await downloadFileAsBase64(fileUrl);

      // Build header schema description
      const headerSchema = headers.map(h => 
        `- "${h.name}" (${h.type}): ${h.description || "No description"}`
      ).join("\n");

      const headerNames = headers.map(h => h.name);

      const extractPrompt = `You are a data extraction expert. Extract ALL rows of tabular data from PAGE ${pageNumber} of ${totalPages} of this document.

COLUMN SCHEMA (use these EXACT column names):
${headerSchema}

Extract every row of data from this page that matches the schema above. Return the data as an array of objects.

Return ONLY valid JSON in this exact format:
{
  "page": ${pageNumber},
  "rows": [
    { ${headerNames.map(n => `"${n}": "value"`).join(", ")} }
  ],
  "confidence": number (0-1),
  "warnings": ["string"]
}

IMPORTANT RULES:
1. Extract EVERY row from page ${pageNumber} - do not skip any data
2. Use the EXACT column names provided above as object keys
3. For "date" type columns, use YYYY-MM-DD format
4. For "currency" and "number" types, use numeric values (no currency symbols)
5. For empty cells, use null
6. If a row is partially visible or unclear, still include it but add a warning
7. Focus ONLY on page ${pageNumber} of this document
8. Maintain the order of rows as they appear on the page`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{
          role: "user",
          parts: [
            { text: extractPrompt },
            { inlineData: { mimeType: mimeType || "application/pdf", data: base64Data } },
          ],
        }],
        config: {
          temperature: 0.1,
          maxOutputTokens: 16384,
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "{}";
      const usageMetadata = response.usageMetadata;

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        console.error("Failed to parse AI response:", text);
        // Try to fix malformed JSON
        const fixResponse = await ai.models.generateContent({
          model: modelName,
          contents: [{
            role: "user",
            parts: [{ text: `Fix this malformed JSON and return ONLY valid JSON:\n\n${text}` }],
          }],
          config: {
            temperature: 0,
            maxOutputTokens: 16384,
            responseMimeType: "application/json",
          },
        });
        const fixedText = fixResponse.text || "{}";
        parsed = JSON.parse(fixedText);
      }

      const processingTime = Date.now() - startTime;
      const rowsExtracted = parsed.rows?.length || 0;

      // Get user's org for usage tracking
      const orgId = await getUserOrgId(userId);

      // Calculate cost
      const inputTokens = usageMetadata?.promptTokenCount || 0;
      const outputTokens = usageMetadata?.candidatesTokenCount || 0;
      const estimatedCost = calculateCost(modelToUse, inputTokens, outputTokens);

      // Record usage
      await recordUsage({
        orgId: orgId || "personal",
        userId,
        type: "pdf2sheet_extraction",
        aiProvider: provider,
        aiModel: modelToUse,
        inputTokens,
        outputTokens,
        pagesProcessed: 1,
        transactionsExtracted: rowsExtracted,
        confidence: parsed.confidence || 0.8,
        status: "success",
        processingTimeMs: processingTime,
        estimatedCost,
      });

      console.log(`Extracted ${rowsExtracted} rows from page ${pageNumber}`);

      return {
        page: pageNumber,
        rows: parsed.rows || [],
        confidence: parsed.confidence || 0.8,
        warnings: parsed.warnings || [],
        inputTokens,
        outputTokens,
      };

    } catch (error) {
      console.error("PDF2Sheet extract error:", error);
      throw new HttpsError(
        "internal",
        `Failed to extract from page ${pageNumber}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);

/**
 * Helper to extract a single page (for batch processing)
 */
async function extractSinglePage(
  ai: GoogleGenAI,
  modelName: string,
  base64Data: string,
  mimeType: string,
  pageNumber: number,
  totalPages: number,
  headerSchema: string,
  headerNames: string[]
): Promise<Pdf2SheetExtractResult> {
  const extractPrompt = `You are a data extraction expert. Extract ALL rows of tabular data from PAGE ${pageNumber} of ${totalPages} of this document.

COLUMN SCHEMA (use these EXACT column names):
${headerSchema}

Return ONLY valid JSON:
{
  "page": ${pageNumber},
  "rows": [
    { ${headerNames.map(n => `"${n}": "value"`).join(", ")} }
  ],
  "confidence": number (0-1),
  "warnings": ["string"]
}

RULES:
1. Extract EVERY row from page ${pageNumber}
2. Use EXACT column names as object keys
3. Dates: YYYY-MM-DD format
4. Numbers/currency: numeric values only
5. Empty cells: null
6. Focus ONLY on page ${pageNumber}`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [{
      role: "user",
      parts: [
        { text: extractPrompt },
        { inlineData: { mimeType, data: base64Data } },
      ],
    }],
    config: {
      temperature: 0.1,
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
    },
  });

  const text = response.text || "{}";
  const parsed = JSON.parse(text);
  const usageMetadata = response.usageMetadata;

  return {
    page: pageNumber,
    rows: parsed.rows || [],
    confidence: parsed.confidence || 0.8,
    warnings: parsed.warnings || [],
    inputTokens: usageMetadata?.promptTokenCount || 0,
    outputTokens: usageMetadata?.candidatesTokenCount || 0,
  };
}

/**
 * Batch extract from multiple pages
 * Processes pages in parallel with rate limiting
 */
export const pdf2sheetBatchExtract = onCall(
  { 
    cors: true, 
    timeoutSeconds: 540, 
    memory: "2GiB",
    secrets: [geminiApiKey],
  },
  async (request): Promise<{ results: Pdf2SheetExtractResult[]; totalRows: number }> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { fileUrl, mimeType, totalPages, headers } = request.data;
    
    if (!fileUrl || !headers || headers.length === 0 || !totalPages) {
      throw new HttpsError("invalid-argument", "fileUrl, headers, and totalPages required");
    }

    const userId = request.auth.uid;
    const { model: modelToUse } = await getUserModelPreference(userId);
    const modelName = getModelName(modelToUse);

    console.log(`PDF2Sheet batch extract ${totalPages} pages for user ${userId}`);

    try {
      // Initialize Google AI client
      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
      
      const base64Data = await downloadFileAsBase64(fileUrl);

      // Build header schema
      const headerSchema = headers.map((h: Pdf2SheetHeader) => 
        `- "${h.name}" (${h.type}): ${h.description || "No description"}`
      ).join("\n");
      const headerNames = headers.map((h: Pdf2SheetHeader) => h.name);

      // Process pages in parallel batches of 5
      const results: Pdf2SheetExtractResult[] = [];
      const batchSize = 5;

      for (let i = 0; i < totalPages; i += batchSize) {
        const batch = [];
        
        for (let page = i + 1; page <= Math.min(i + batchSize, totalPages); page++) {
          batch.push(extractSinglePage(
            ai,
            modelName,
            base64Data,
            mimeType || "application/pdf",
            page,
            totalPages,
            headerSchema,
            headerNames
          ));
        }

        const batchResults = await Promise.allSettled(batch);
        
        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const pageNum = i + j + 1;
          
          if (result.status === "fulfilled") {
            results.push(result.value);
          } else {
            console.error(`Page ${pageNum} failed:`, result.reason);
            results.push({
              page: pageNum,
              rows: [],
              confidence: 0,
              warnings: [`Extraction failed: ${result.reason}`],
              inputTokens: 0,
              outputTokens: 0,
            });
          }
        }
      }

      // Sort by page number
      results.sort((a, b) => a.page - b.page);

      const totalRows = results.reduce((sum, r) => sum + r.rows.length, 0);
      console.log(`Batch extraction complete: ${totalRows} total rows from ${totalPages} pages`);

      return { results, totalRows };

    } catch (error) {
      console.error("PDF2Sheet batch extract error:", error);
      throw new HttpsError(
        "internal",
        `Batch extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);
