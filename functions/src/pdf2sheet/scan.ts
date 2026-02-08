/**
 * PDF2Sheet Scan Function
 * Analyzes the first page of a PDF to detect table structure and propose headers
 * Uses Google AI Studio API for Gemini 3 Flash
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { geminiApiKey, getModelName, calculateCost } from "../config/ai-models";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { recordUsage } from "../utils/usage";
import { getUserModelPreference, getUserOrgId } from "../utils/model-preference";
import { downloadFileAsBase64 } from "../utils/storage";
import { Pdf2SheetScanResult, Pdf2SheetHeader } from "../types";

/**
 * Scan a PDF to detect table structure and propose column headers
 */
export const pdf2sheetScan = onCall(
  { 
    cors: true, 
    timeoutSeconds: 120,
    secrets: [geminiApiKey],
  },
  async (request): Promise<Pdf2SheetScanResult> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { fileUrl, mimeType } = request.data;
    if (!fileUrl) {
      throw new HttpsError("invalid-argument", "File URL required");
    }

    const startTime = Date.now();
    const userId = request.auth.uid;
    const { model: modelToUse, provider } = await getUserModelPreference(userId);
    const modelName = getModelName(modelToUse);

    console.log(`PDF2Sheet scan for user ${userId} with model ${modelName}`);

    try {
      // Initialize Google AI client
      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
      
      // Download file from storage
      const base64Data = await downloadFileAsBase64(fileUrl);

      const scanPrompt = `You are a document analysis expert specializing in extracting tabular data from PDFs.

Analyze this document and identify ANY tabular or structured data that could be extracted into a spreadsheet.

This could be:
- Financial transactions (bank statements, credit card statements)
- Invoice line items
- Product lists or catalogs
- Employee records
- Sales reports
- Inventory lists
- Any other structured/repeated data

Your task:
1. Identify the columns/headers that would best represent the data
2. Determine the data type for each column
3. Extract 3-5 sample rows to demonstrate the structure
4. Estimate the total number of pages

For each header, provide:
- name: A clean, concise column name (e.g., "Date", "Description", "Amount")
- type: One of "string", "number", "date", "currency", "boolean"
- description: Brief description of what this column contains
- example: An example value from the document

Return ONLY valid JSON in this exact format:
{
  "headers": [
    {
      "name": "string",
      "type": "string|number|date|currency|boolean",
      "description": "string",
      "example": "string"
    }
  ],
  "sampleRows": [
    { "Column1": "value1", "Column2": "value2" }
  ],
  "documentType": "string (e.g., 'bank_statement', 'invoice', 'report', 'inventory', 'image', 'letter', 'unknown', 'not_extractable')",
  "supplierName": "string or null - the company/supplier name if visible on the document",
  "documentDate": "string or null - YYYY-MM-DD format if a date is visible",
  "documentNumber": "string or null - invoice number, order number, etc if visible",
  "pageCount": number,
  "confidence": number (0-1),
  "isExtractable": true or false - whether this document contains tabular data that can be extracted,
  "warnings": ["string"],
  "suggestions": ["string"]
}

IMPORTANT:
- Focus on the FIRST PAGE to understand the structure
- Include ALL columns that appear in the tabular data
- Use consistent naming (Title Case for headers)
- For currency values, use type "currency" not "number"
- For dates, use type "date"
- Sample rows should use the header names as keys
- If the document does NOT contain extractable tabular data (e.g., it's just an image, a letter, blank page, or corrupted), set isExtractable to false, headers to [], sampleRows to [], confidence to 0, and add a clear warning explaining why it cannot be extracted
- ALWAYS return valid JSON even if the document is not extractable`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{
          role: "user",
          parts: [
            { text: scanPrompt },
            { inlineData: { mimeType: mimeType || "application/pdf", data: base64Data } },
          ],
        }],
        config: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const text = response.text || "{}";
      const usageMetadata = response.usageMetadata;

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        console.error("Failed to parse AI response. Raw text:", text.substring(0, 500));
        
        // Try to auto-fix malformed JSON
        try {
          const fixResponse = await ai.models.generateContent({
            model: modelName,
            contents: [{
              role: "user",
              parts: [{ text: `Fix this malformed JSON and return ONLY valid JSON:\n\n${text.substring(0, 3000)}` }],
            }],
            config: {
              temperature: 0,
              maxOutputTokens: 4096,
              responseMimeType: "application/json",
            },
          });
          const fixedText = fixResponse.text || "{}";
          parsed = JSON.parse(fixedText);
          console.log("AI auto-fix successful");
        } catch (fixError) {
          console.error("AI auto-fix failed:", fixError);
          // Return a valid response indicating the document couldn't be analyzed
          parsed = {
            headers: [],
            sampleRows: [],
            documentType: "not_extractable",
            pageCount: 1,
            confidence: 0,
            isExtractable: false,
            warnings: ["Could not analyze this document. It may be an image, corrupted, or contain no extractable data."],
            suggestions: ["Try uploading a different document with clear tabular data like an invoice or bank statement."],
          };
        }
      }

      const processingTime = Date.now() - startTime;

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
        type: "pdf2sheet_scan",
        aiProvider: provider,
        aiModel: modelToUse,
        inputTokens,
        outputTokens,
        pagesProcessed: 1,
        transactionsExtracted: 0,
        confidence: parsed.confidence || 0.8,
        status: "success",
        processingTimeMs: processingTime,
        estimatedCost,
      });

      // Validate and normalize headers
      const headers: Pdf2SheetHeader[] = (parsed.headers || []).map((h: any) => ({
        name: h.name || "Unknown",
        type: h.type || "string",
        description: h.description || "",
        example: h.example || "",
      }));

      // Check if document is extractable
      const isExtractable = parsed.isExtractable !== false && headers.length > 0;

      return {
        headers,
        sampleRows: parsed.sampleRows || [],
        documentType: parsed.documentType || "unknown",
        supplierName: parsed.supplierName || null,
        documentDate: parsed.documentDate || null,
        documentNumber: parsed.documentNumber || null,
        pageCount: parsed.pageCount || 1,
        confidence: isExtractable ? (parsed.confidence || 0.8) : 0,
        isExtractable,
        warnings: parsed.warnings || [],
        suggestions: parsed.suggestions || [],
        inputTokens,
        outputTokens,
      };

    } catch (error) {
      console.error("PDF2Sheet scan error:", error);
      
      // Instead of throwing, return a graceful error response
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      return {
        headers: [],
        sampleRows: [],
        documentType: "not_extractable",
        supplierName: null,
        documentDate: null,
        documentNumber: null,
        pageCount: 1,
        confidence: 0,
        isExtractable: false,
        warnings: [
          `Could not analyze this document: ${errorMessage}`,
          "The document may be an image, corrupted, password-protected, or contain no extractable data."
        ],
        suggestions: [
          "Try uploading a different document with clear tabular data.",
          "Supported formats: PDF with tables, invoices, bank statements, reports."
        ],
        inputTokens: 0,
        outputTokens: 0,
      };
    }
  }
);
