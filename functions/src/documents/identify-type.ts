/**
 * Document Type Identification
 * Fast, lightweight type detection BEFORE full extraction
 * Only sends first page/sample to AI for quick classification
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { geminiApiKey } from "../config/ai-models";
import { ThinkingLevel } from "@google/genai";
import { getModelName, getGoogleAI } from "../config/ai-models";
import { downloadFileAsBase64 } from "../utils/storage";
import * as XLSX from "xlsx";

interface IdentifyResult {
  // Primary detection
  detectedType: "bank_statement" | "invoice" | "bill" | "receipt" | "vendor_list" | "invoice_list" | "payment_record" | "other";
  confidence: number;
  
  // Quick metadata
  detectedBank?: string;
  detectedVendor?: string;
  detectedCustomer?: string;
  currency?: string;
  pageCount?: number;
  
  // Reasoning
  reasoning: string;
  
  // Suggestions
  suggestions: string[];
  
  // Usage
  inputTokens: number;
  outputTokens: number;
}

/**
 * Identify document type - FAST detection only
 * Only sends first page of PDF or first 15 rows of CSV/Excel
 */
export const identifyDocumentType = onCall(
  { 
    cors: true, 
    timeoutSeconds: 60,  // 1 minute - should be fast
    memory: "512MiB",
    secrets: [geminiApiKey],
  },
  async (request): Promise<IdentifyResult> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { fileUrl, mimeType, fileName } = request.data;
    if (!fileUrl) {
      throw new HttpsError("invalid-argument", "File URL required");
    }

    const startTime = Date.now();
    const userId = request.auth.uid;

    console.log(`Identifying document type for user ${userId}: ${fileName}`);

    try {
      // Initialize Google AI client
      const ai = getGoogleAI();
      const modelName = getModelName("gemini-3-flash");
      
      // Download file
      const base64Data = await downloadFileAsBase64(fileUrl);
      
      // Check file type
      const isExcelFile = mimeType && (
        mimeType.includes("spreadsheetml") ||
        mimeType.includes("excel") ||
        mimeType.includes("vnd.ms-excel") ||
        mimeType.includes("vnd.openxmlformats")
      );
      
      const isCSV = mimeType && (
        mimeType.includes("csv") || 
        mimeType.includes("text/plain")
      );
      
      const isPDF = mimeType && mimeType.includes("pdf");
      const isImage = mimeType && mimeType.includes("image");

      // Prepare content for AI - LIGHTWEIGHT ONLY
      let contents: any[];
      
      if (isExcelFile) {
        // Excel: Convert to CSV, send only first 15 rows
        const buffer = Buffer.from(base64Data, "base64");
        const workbook = XLSX.read(buffer, { type: "buffer", sheetRows: 15 });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const csvSample = XLSX.utils.sheet_to_csv(sheet);
        
        contents = [{
          role: "user",
          parts: [{ 
            text: `Identify what type of document this is. Here are the first 15 rows:\n\n\`\`\`\n${csvSample}\n\`\`\`` 
          }],
        }];
      } else if (isCSV) {
        // CSV: Send only first 15 rows
        const fullText = Buffer.from(base64Data, "base64").toString("utf-8");
        const lines = fullText.split("\n").slice(0, 15).join("\n");
        
        contents = [{
          role: "user",
          parts: [{ 
            text: `Identify what type of document this is. Here are the first 15 rows:\n\n\`\`\`\n${lines}\n\`\`\`` 
          }],
        }];
      } else if (isPDF || isImage) {
        // PDF/Image: Send only FIRST PAGE
        const mimeTypeForAI = isPDF ? "application/pdf" : mimeType;
        contents = [{
          role: "user",
          parts: [
            { 
              text: "Identify what type of document this is (analyze ONLY the first page):" 
            },
            {
              inlineData: {
                mimeType: mimeTypeForAI,
                data: base64Data,
              }
            }
          ],
        }];
      } else {
        throw new HttpsError("invalid-argument", `Unsupported file type: ${mimeType}`);
      }

      // AI Prompt - CLASSIFICATION ONLY
      const prompt = `You are a document classifier. Analyze this document and identify its type.

DOCUMENT TYPES:
1. **bank_statement** - Bank account statements, transaction lists from banks
2. **invoice** - Invoices sent TO customers (outgoing invoices, accounts receivable)
3. **bill** - Bills/invoices received FROM vendors (incoming bills, accounts payable)
4. **receipt** - Payment receipts or simple transaction confirmations
5. **invoice_list** - Spreadsheet containing multiple invoices (CSV/Excel)
6. **vendor_list** - List of vendors or suppliers
7. **payment_record** - Payment confirmation or remittance advice
8. **other** - Anything else

QUICK METADATA (if visible):
- If bank statement: What bank? (e.g., "Chase Bank", "Wise", "Mercury")
- If invoice/bill: What vendor/customer? (e.g., "Acme Corp")
- Currency code (USD, EUR, GBP, etc.)

Return JSON:
{
  "detectedType": "bank_statement",
  "confidence": 0.95,
  "detectedBank": "Chase Bank",
  "detectedVendor": null,
  "detectedCustomer": null,
  "currency": "USD",
  "reasoning": "This is a bank statement because: [brief 1-2 sentence explanation]",
  "suggestions": ["First page shows account summary", "Multiple transactions visible"]
}

Respond with ONLY the JSON object, nothing else.`;

      // Call Gemini 3 Flash for classification
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents.concat([{ role: "user", parts: [{ text: prompt }] }]),
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });
      
      if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new HttpsError("internal", "No response from AI");
      }

      const result = JSON.parse(response.candidates[0].content.parts[0].text);
      const usage = response.usageMetadata || {};

      console.log(`Identification complete in ${Date.now() - startTime}ms: ${result.detectedType} (${result.confidence})`);

      return {
        detectedType: result.detectedType || "other",
        confidence: result.confidence || 0.5,
        detectedBank: result.detectedBank || null,
        detectedVendor: result.detectedVendor || null,
        detectedCustomer: result.detectedCustomer || null,
        currency: result.currency || null,
        pageCount: 1, // We only analyzed first page
        reasoning: result.reasoning || "",
        suggestions: result.suggestions || [],
        inputTokens: (usage as any).promptTokenCount || (usage as any).inputTokens || 0,
        outputTokens: (usage as any).candidatesTokenCount || (usage as any).outputTokens || 0,
      };

    } catch (error) {
      console.error("Identification error:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "Failed to identify document type"
      );
    }
  }
);
