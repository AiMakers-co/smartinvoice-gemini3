/**
 * Bank Statement Scanning
 * Phase 1: Detect bank and account information
 * Uses Google AI Studio API for Gemini 3 Flash
 * 
 * For CSV files:
 * - Only sends first 15 rows to AI (header + sample data)
 * - AI generates parsing rules for programmatic extraction
 * - Rules are saved per bank type for reuse
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../config/firebase";
import { geminiApiKey, getModelName, calculateCost } from "../config/ai-models";
import { GoogleGenAI } from "@google/genai";
import { recordUsage } from "../utils/usage";
import { getUserModelPreference, getUserOrgId } from "../utils/model-preference";
import { downloadFileAsBase64 } from "../utils/storage";
import { DocumentScanResult } from "../types";
import * as XLSX from "xlsx";
import { 
  normalizeBankName, 
  getBankIdentifier, 
  findParsingRules, 
  saveParsingRules,
  CSVParsingRules 
} from "./csv-parser";

/**
 * Scan a document to detect bank and account information
 * This is the first step before full extraction
 */
export const scanDocument = onCall(
  { 
    cors: true, 
    timeoutSeconds: 300,  // 5 minutes - allows for AI rate limiting when bulk uploading
    memory: "1GiB",  // Increased from 512MiB - Excel files need more memory
    secrets: [geminiApiKey],
  },
  async (request): Promise<DocumentScanResult> => {
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

    console.log(`Scanning document for user ${userId} with model ${modelName}`);

    try {
      // Initialize Google AI client
      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
      
      // Download file from storage
      const base64Data = await downloadFileAsBase64(fileUrl);
      
      // Check if this is an Excel file
      const isExcelFile = mimeType && (
        mimeType.includes("spreadsheetml") ||
        mimeType.includes("excel") ||
        mimeType.includes("vnd.ms-excel") ||
        mimeType.includes("vnd.openxmlformats")
      );
      
      // Check if this is a text/CSV file (not an image/PDF)
      const isTextFile = mimeType && (
        mimeType.includes("csv") || 
        mimeType.includes("text/plain") ||
        mimeType.includes("text/")
      );
      
      // Convert Excel to CSV if needed
      let excelAsText = "";
      if (isExcelFile) {
        try {
          const buffer = Buffer.from(base64Data, "base64");
          const workbook = XLSX.read(buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          excelAsText = XLSX.utils.sheet_to_csv(sheet);
          console.log(`Converted Excel to CSV: ${excelAsText.length} chars`);
        } catch (xlsxError) {
          console.error("Failed to parse Excel file:", xlsxError);
          throw new HttpsError("invalid-argument", "Failed to parse Excel file. Please ensure it's a valid .xlsx or .xls file.");
        }
      }

      const scanPrompt = `Scan this bank statement and extract account details plus a preview of transactions.

ACCOUNT DETAILS (extract exactly as shown):
- bankName: Bank name
- bankCountry: Country code or null
- bankBranch: Branch or null
- accountNumber: FULL account number (all digits)
- accountType: checking/savings/credit/investment/other
- accountHolderName: Account holder name or null
- currency: Currency code (USD/EUR/GBP/ANG/XCG etc)
- currencies: Array if multi-currency else null
- periodStart: YYYY-MM-DD or null
- periodEnd: YYYY-MM-DD or null
- documentType: bank_statement/credit_card/investment/unknown
- pageCount: Number of pages
- openingBalance: Opening balance at start of statement period (number or null)
- closingBalance: IMPORTANT! This is the CURRENT/ENDING balance shown on the statement. Look for "Closing Balance", "Ending Balance", "Balance Forward", or the final balance after all transactions. This is critical for account tracking!
- transactionCount: Total number of transactions

TRANSACTION PREVIEW (first 5 only):
- sampleTransactions: Array of up to 5 transactions with:
  - date: YYYY-MM-DD format
  - description: SHORT description (max 50 chars, letters/numbers/spaces only, NO special chars)
  - amount: Positive number
  - type: "credit" or "debit"

QUALITY:
- confidence: 0.0-1.0
- warnings: []
- suggestions: []

CRITICAL: Keep descriptions SHORT and SIMPLE. No quotes, no special characters. Return valid JSON only.`;

      // Build the request contents based on file type
      let contents: any[];
      
      if (isExcelFile && excelAsText) {
        const truncatedContent = excelAsText.length > 50000 
          ? excelAsText.substring(0, 50000) + "\n...[truncated]..."
          : excelAsText;
        contents = [{
          role: "user",
          parts: [{ text: scanPrompt + "\n\nHere is the spreadsheet content:\n\n```\n" + truncatedContent + "\n```" }],
        }];
      } else if (isTextFile) {
        const fullTextContent = Buffer.from(base64Data, "base64").toString("utf-8");
        const allLines = fullTextContent.split("\n");
        const totalRows = allLines.length;
        
        // Only send first 15 lines for AI analysis (much faster!)
        const sampleLines = allLines.slice(0, 15).join("\n");
        
        // Extract filename for bank identification hints
        const fileName = fileUrl.split("/").pop()?.split("?")[0] || "";
        const decodedFileName = decodeURIComponent(fileName);
        
        // Use special CSV prompt that generates parsing rules
        const csvPrompt = `Analyze this CSV bank statement sample and extract account details PLUS generate parsing rules.

FILENAME: ${decodedFileName}

ACCOUNT DETAILS (extract from content OR infer from patterns):
- bankName: Bank name. Look for:
  1. Explicit bank name in the data
  2. Filename hints (e.g., "RBC" = RBC Royal Bank, "MCB" = Maduro & Curiel's Bank)
  3. Transaction patterns (RBC uses FT##### codes, specific SWIFT patterns)
  4. Account number formats (different banks use different formats)
  If you can reasonably identify the bank from any of these, provide the full proper bank name.
- bankCountry: Country code or null
- accountNumber: Extract from a dedicated account number column (not from description/memo text). Return the FULL account number (all digits).
- accountType: checking/savings/credit/investment/other
- accountHolderName: Account holder name if visible, else null
- currency: Currency code from the data (USD/EUR/GBP/ANG/AWG/XCG etc)
- periodStart: YYYY-MM-DD (earliest date in the data)
- periodEnd: YYYY-MM-DD (latest date in the data)
- documentType: bank_statement
- pageCount: 1
- openingBalance: Opening balance number or null
- closingBalance: IMPORTANT! If there is a Balance column, extract the balance value from the MOST RECENT transaction (usually first data row). This is the current account balance. Return as number.
- transactionCount: ${totalRows - 1} (total data rows)

BANK NAME HINTS from filename/patterns:
- "RBC" or FT###### transaction codes = "RBC Royal Bank"
- "MCB" or "Maduro" = "Maduro & Curiel's Bank"  
- "CMB" or "Caribbean Mercantile" = "Caribbean Mercantile Bank"
- "Butterfield" or "BNTB" = "Bank of N.T. Butterfield & Son"
- "CIBC" = "CIBC FirstCaribbean"
- "Scotia" = "Scotiabank"

CSV PARSING RULES (analyze the structure):
- csvParsingRules: {
    "headerRow": number (0-indexed row containing column headers),
    "dataStartRow": number (0-indexed row where data begins),
    "dateColumn": string (column header name for date),
    "dateFormat": string - MUST match exact format in data:
      - "YYYY-MM-DD" or "YYYY/MM/DD" (2025-01-15 or 2025/01/15)
      - "DD-MM-YYYY" or "DD/MM/YYYY" (15-01-2025 or 15/01/2025)
      - "MM-DD-YYYY" or "MM/DD/YYYY" (01-15-2025 or 01/15/2025)
      - "DD-MMM-YY" (28-Nov-25, 15-Jan-24)
      - "DD-MMM-YYYY" (28-Nov-2025)
    "descriptionColumn": string (column header name for description/memo),
    "amountColumn": string or null (if single amount column with +/-),
    "debitColumn": string or null (if separate debit column),
    "creditColumn": string or null (if separate credit column),
    "balanceColumn": string or null (IMPORTANT: Look for "Balance", "Running Balance", "Bal" columns - this is needed for account balance tracking!),
    "referenceColumn": string or null (if reference/check number column exists),
    "amountFormat": "sign" or "absolute" (whether amounts have +/- signs),
    "typeDetection": "sign" or "separate_columns" (how to determine debit vs credit),
    "thousandsSeparator": "," or "." or null,
    "decimalSeparator": "." or ","
  }

TRANSACTION PREVIEW (first 5 actual transactions):
- sampleTransactions: Array of up to 5 transactions with:
  - date: YYYY-MM-DD format
  - description: SHORT description (max 50 chars)
  - amount: Positive number
  - type: "credit" or "debit"

QUALITY:
- confidence: 0.0-1.0
- warnings: []
- suggestions: []

CRITICAL: The csvParsingRules must accurately describe how to parse this specific CSV format. Return valid JSON only.`;

        contents = [{
          role: "user",
          parts: [{ text: csvPrompt + "\n\nHere are the first 15 rows of the CSV:\n\n```\n" + sampleLines + "\n```" }],
        }];
      } else {
        contents = [{
          role: "user",
          parts: [
            { text: scanPrompt },
            { inlineData: { mimeType: mimeType || "application/pdf", data: base64Data } },
          ],
        }];
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          temperature: 0,  // Fully deterministic - no variation
          maxOutputTokens: 50000,
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "{}";
      const usageMetadata = response.usageMetadata;
      
      // Log raw AI response
      console.log("=== RAW AI RESPONSE ===");
      console.log("Response length:", text.length);
      console.log("Raw text:", text);
      console.log("=======================");
      
      // Parse JSON with auto-fix for malformed responses
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (jsonError) {
        console.error("JSON parse error, attempting AI auto-fix. Raw length:", text.length);
        console.error("First 500 chars:", text.substring(0, 500));
        console.error("Last 500 chars:", text.substring(text.length - 500));
        
        try {
          // Ask AI to fix the JSON
          const fixResponse = await ai.models.generateContent({
            model: modelName,
            contents: [{
              role: "user",
              parts: [{ text: `Fix this malformed JSON and return ONLY valid JSON. Do not include any explanation:\n\n${text.substring(0, 8000)}` }],
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
          // Return minimal valid response
          parsed = {
            bankName: "Unknown Bank",
            accountNumber: "Unknown",
            currency: "USD",
            documentType: "unknown",
            pageCount: 1,
            confidence: 0.3,
            transactionCount: 0,
            warnings: ["Failed to parse AI response - please try again"],
            suggestions: [],
          };
        }
      }
      
      // Handle case where AI returns an array instead of object
      if (Array.isArray(parsed)) {
        console.log("AI returned array with", parsed.length, "items - using first item");
        parsed = parsed[0] || {
          bankName: "Unknown Bank",
          accountNumber: "Unknown",
          currency: "USD",
          documentType: "unknown",
          pageCount: 1,
          confidence: 0.3,
          transactionCount: 0,
          warnings: ["AI returned array response - extracted first statement"],
          suggestions: [],
        };
      }
      
      // Handle nested response format (AI sometimes returns data inside "accountDetails")
      if (parsed.accountDetails && typeof parsed.accountDetails === "object") {
        console.log("Detected nested accountDetails format, flattening...");
        const details = parsed.accountDetails;
        parsed = {
          ...details,
          sampleTransactions: parsed.sampleTransactions || details.sampleTransactions || [],
          confidence: parsed.confidence || details.confidence,
          warnings: parsed.warnings || details.warnings || [],
          suggestions: parsed.suggestions || details.suggestions || [],
        };
      }
      
      // Handle confidence nested inside "quality" object
      if (parsed.quality && typeof parsed.quality === "object") {
        parsed.confidence = parsed.quality.confidence || parsed.confidence;
        parsed.warnings = parsed.quality.warnings || parsed.warnings || [];
        parsed.suggestions = parsed.quality.suggestions || parsed.suggestions || [];
      }
      
      // Log the parsed result for debugging
      console.log("=== SCAN RESULT ===");
      console.log("bankName:", parsed.bankName);
      console.log("accountNumber:", parsed.accountNumber);
      console.log("accountHolderName:", parsed.accountHolderName);
      console.log("currency:", parsed.currency);
      console.log("periodStart:", parsed.periodStart);
      console.log("periodEnd:", parsed.periodEnd);
      console.log("openingBalance:", parsed.openingBalance);
      console.log("closingBalance:", parsed.closingBalance);
      console.log("transactionCount:", parsed.transactionCount);
      console.log("confidence:", parsed.confidence);
      if (parsed.csvParsingRules) {
        console.log("=== CSV PARSING RULES ===");
        console.log("balanceColumn:", parsed.csvParsingRules.balanceColumn);
        console.log("debitColumn:", parsed.csvParsingRules.debitColumn);
        console.log("creditColumn:", parsed.csvParsingRules.creditColumn);
        console.log("dateColumn:", parsed.csvParsingRules.dateColumn);
        console.log("descriptionColumn:", parsed.csvParsingRules.descriptionColumn);
        console.log("=========================");
      }
      console.log("===================");
      
      const processingTime = Date.now() - startTime;

      // Get user's org for usage tracking
      const orgId = await getUserOrgId(userId);

      // Record usage
      const estimatedCost = calculateCost(
        modelToUse,
        usageMetadata?.promptTokenCount || 0,
        usageMetadata?.candidatesTokenCount || 0
      );

      const actualPdfPages = (isTextFile || isExcelFile) ? 0 : (parsed.pageCount || 1);
      
      await recordUsage({
        orgId: orgId || "personal",
        userId,
        type: "scan",
        aiProvider: provider,
        aiModel: modelToUse,
        inputTokens: usageMetadata?.promptTokenCount || 0,
        outputTokens: usageMetadata?.candidatesTokenCount || 0,
        pagesProcessed: actualPdfPages,
        transactionsExtracted: 0,
        confidence: parsed.confidence || 0.8,
        status: "success",
        processingTimeMs: processingTime,
        estimatedCost,
      });

      // Get bank name - check existing accounts first if AI couldn't find it
      let rawBankName = parsed.bankName;
      
      // If AI couldn't find bank name, check user's existing accounts by account number
      if (!rawBankName || rawBankName === "Unknown" || rawBankName === "Unknown Bank") {
        const accountNumber = parsed.accountNumber;
        if (accountNumber && accountNumber !== "Unknown") {
          // Get last 4 digits for matching (accounts are often masked)
          const last4 = accountNumber.slice(-4);
          
          console.log(`Bank name not in CSV, checking existing accounts for ****${last4}`);
          
          // Check user's existing accounts
          const existingAccounts = await db.collection("bank_accounts")
            .where("userId", "==", userId)
            .get();
          
          for (const doc of existingAccounts.docs) {
            const acct = doc.data();
            const acctLast4 = acct.accountNumber?.slice(-4);
            if (acctLast4 === last4) {
              rawBankName = acct.bankName;
              console.log(`Found matching account: ${acct.bankName} (****${acctLast4})`);
              break;
            }
          }
        }
      }
      
      // Still no bank name? Set as needs-identification
      if (!rawBankName || rawBankName === "Unknown" || rawBankName === "Unknown Bank") {
        rawBankName = null;
      }
      
      const normalizedBankName = rawBankName ? normalizeBankName(rawBankName) : null;
      const bankIdentifier = normalizedBankName ? getBankIdentifier(normalizedBankName) : null;
      
      console.log(`Bank name resolution: "${parsed.bankName}" -> "${rawBankName}" -> "${normalizedBankName}" (id: ${bankIdentifier})`);

      // Check if we have a matching template
      let templateMatch: { templateId: string; confidence: number } | undefined;
      
      if (normalizedBankName) {
        const templatesQuery = await db.collection("templates")
          .where("bankName", "==", normalizedBankName)
          .limit(1)
          .get();
        
        if (!templatesQuery.empty) {
          const template = templatesQuery.docs[0];
          templateMatch = {
            templateId: template.id,
            confidence: 0.9,
          };
        }
      }

      // Handle CSV parsing rules
      let csvParsingRulesId: string | undefined;
      let csvParsingRulesStatus: "existing" | "new" | "none" = "none";
      let csvParsingRulesData: CSVParsingRules | undefined;
      
      if (isTextFile || isExcelFile) {
        // Check for existing confirmed rules for this bank (only if we know the bank)
        const existingRules = normalizedBankName ? await findParsingRules(userId, normalizedBankName) : null;
        
        if (existingRules) {
          console.log(`Found existing parsing rules for ${normalizedBankName}: ${existingRules.id}`);
          csvParsingRulesId = existingRules.id;
          csvParsingRulesStatus = "existing";
          csvParsingRulesData = existingRules;
        } else if (parsed.csvParsingRules) {
          // AI generated new rules - save them for user confirmation
          console.log("AI generated new parsing rules:", JSON.stringify(parsed.csvParsingRules, null, 2));
          
          const fullTextContent = Buffer.from(base64Data, "base64").toString("utf-8");
          const allLines = fullTextContent.split("\n");
          const headerIdx = parsed.csvParsingRules.headerRow || 0;
          const sampleRowIdx = (parsed.csvParsingRules.dataStartRow || headerIdx + 1);
          
          const newRules: Omit<CSVParsingRules, "id" | "createdAt" | "usageCount"> = {
            bankIdentifier: bankIdentifier || "unknown_bank",
            bankDisplayName: normalizedBankName || "Unknown Bank",
            headerRow: parsed.csvParsingRules.headerRow || 0,
            dataStartRow: parsed.csvParsingRules.dataStartRow || 1,
            dateColumn: parsed.csvParsingRules.dateColumn,
            dateFormat: parsed.csvParsingRules.dateFormat || "YYYY-MM-DD",
            descriptionColumn: parsed.csvParsingRules.descriptionColumn,
            amountColumn: parsed.csvParsingRules.amountColumn,
            debitColumn: parsed.csvParsingRules.debitColumn,
            creditColumn: parsed.csvParsingRules.creditColumn,
            balanceColumn: parsed.csvParsingRules.balanceColumn,
            referenceColumn: parsed.csvParsingRules.referenceColumn,
            amountFormat: parsed.csvParsingRules.amountFormat || "sign",
            typeDetection: parsed.csvParsingRules.typeDetection || "sign",
            thousandsSeparator: parsed.csvParsingRules.thousandsSeparator,
            decimalSeparator: parsed.csvParsingRules.decimalSeparator || ".",
            createdBy: userId,
            sampleHeaders: allLines[headerIdx]?.split(",").map((h: string) => h.trim()),
            sampleRow: allLines[sampleRowIdx]?.split(",").map((v: string) => v.trim()),
          };
          
          csvParsingRulesId = await saveParsingRules(newRules);
          csvParsingRulesStatus = "new";
          csvParsingRulesData = { ...newRules, id: csvParsingRulesId } as CSVParsingRules;
          
          console.log(`Saved new parsing rules: ${csvParsingRulesId}`);
        }
      }

      // Add warning if bank name couldn't be determined
      const warnings = parsed.warnings || [];
      if (!normalizedBankName) {
        warnings.push("Bank name not found in CSV - please specify the bank");
      }
      
      return {
        bankName: normalizedBankName || "Unknown Bank",
        bankNameRaw: rawBankName || parsed.bankName,  // Keep original for reference
        bankIdentifier: bankIdentifier || "unknown",
        needsBankIdentification: !normalizedBankName,  // Flag for frontend
        bankCountry: parsed.bankCountry,
        bankBranch: parsed.bankBranch,
        accountNumber: parsed.accountNumber || "Unknown",
        accountType: parsed.accountType || "other",
        accountHolderName: parsed.accountHolderName,
        currency: parsed.currency || "USD",
        currencies: parsed.currencies,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        documentType: parsed.documentType || "unknown",
        pageCount: parsed.pageCount || 1,
        openingBalance: parsed.openingBalance,
        closingBalance: parsed.closingBalance,
        transactionCount: parsed.transactionCount || 0,
        sampleTransactions: parsed.sampleTransactions || [],
        templateMatch,
        // CSV parsing rules
        csvParsingRulesId,
        csvParsingRulesStatus,
        csvParsingRules: csvParsingRulesData,
        confidence: parsed.confidence || 0.8,
        warnings,
        suggestions: parsed.suggestions || [],
        inputTokens: usageMetadata?.promptTokenCount || 0,
        outputTokens: usageMetadata?.candidatesTokenCount || 0,
      };

    } catch (error) {
      console.error("Scan error:", error);
      throw new HttpsError("internal", `Failed to scan document: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);
