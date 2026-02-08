/**
 * Firestore Trigger for Transaction Extraction
 * Uses Google AI Studio API for Gemini 3 Flash
 * 
 * PAGE-BY-PAGE PARALLEL PROCESSING:
 * 1. Get page count from scan result
 * 2. Process each page in parallel with Gemini
 * 3. Merge all results
 * 4. Save to Firestore
 */
import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import { db, FieldValue, Timestamp } from "../config/firebase";
import { geminiApiKey, getModelName, calculateCost } from "../config/ai-models";
import { GoogleGenAI } from "@google/genai";
import { recordUsage } from "../utils/usage";
import { getUserModelPreference, getUserOrgId } from "../utils/model-preference";
import { downloadFileAsBase64 } from "../utils/storage";
import { TransactionData } from "../types";
import * as XLSX from "xlsx";
import { 
  findParsingRules, 
  parseCSVWithRules, 
  incrementRulesUsage,
  normalizeBankName,
  CSVParsingRules
} from "./csv-parser";

interface PageExtractionResult {
  page: number;
  transactions: TransactionData[];
  openingBalance?: number | null;
  closingBalance?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  confidence: number;
  warnings: string[];
  inputTokens: number;
  outputTokens: number;
}

interface TransactionSummaryItem {
  page: number;
  date?: string;
  amount?: number;
  type?: string;
  descriptionPreview?: string;
  continuesOnNextPage?: boolean;
  continuedFromPrevPage?: boolean;
  // AI can add any extra fields it discovers
  [key: string]: any;
}

interface DocumentContext {
  totalPages: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  openingBalance?: number | null;
  closingBalance?: number | null;
  currency?: string;
  accountNumber?: string;
  bankName?: string;
  transactionSummary: TransactionSummaryItem[];
  // Track multi-page transactions specifically
  multiPageTransactions?: Array<{
    startPage: number;
    endPage: number;
    date?: string;
    amount?: number;
    type?: string;
    descriptionStart?: string;
  }>;
  // Any extra context the AI discovers
  [key: string]: any;
  inputTokens: number;
  outputTokens: number;
}

/**
 * PASS 1: Get document context by scanning ALL pages at once
 * This gives us a bird's eye view of all transactions including those spanning pages
 */
async function getDocumentContext(
  ai: GoogleGenAI,
  modelName: string,
  base64Data: string,
  mimeType: string,
  bankContext: string
): Promise<DocumentContext> {
  const contextPrompt = `You are analyzing a bank statement PDF. Scan ALL pages and create a complete overview.

TASK: Look at the ENTIRE document and extract:

1. DOCUMENT INFO:
   - totalPages: How many pages
   - periodStart/periodEnd: Statement dates (YYYY-MM-DD)
   - openingBalance/closingBalance: Balances
   - currency: What currency (ANG, USD, EUR, etc.)
   - bankName: Bank name if visible
   - accountNumber: Account number (can be partial)

2. TRANSACTION SUMMARY - List EVERY transaction visible:
   For each transaction:
   - page: Which page number
   - date: Date (YYYY-MM-DD) 
   - amount: Amount as positive number
   - type: "credit" or "debit"
   - descriptionPreview: First 80 chars of description
   - continuesOnNextPage: true/false
   - continuedFromPrevPage: true/false
   - Add any other relevant fields you notice!

3. MULTI-PAGE TRANSACTIONS - CRITICAL!
   If ANY transaction spans multiple pages, list it separately:
   - startPage: Where it starts
   - endPage: Where it ends
   - date, amount, type, descriptionStart
   
   WATCH FOR:
   - "Outward SWIFT Payment" - often spans 2-3 pages with addresses
   - "InternetBanking WireTfr Debit" - may have long descriptions
   - Any transaction where you see "continued..." or text flowing to next page
   - Large amounts (5000+, 10000+, 20000+ ANG) are usually important wire transfers!

Return JSON (add any extra fields you find useful):
{
  "totalPages": 3,
  "periodStart": "2025-06-01",
  "periodEnd": "2025-06-30",
  "openingBalance": 13521.09,
  "closingBalance": 9649.19,
  "currency": "ANG",
  "transactionSummary": [
    {"page": 1, "date": "2025-06-15", "amount": 10135.22, "type": "debit", "descriptionPreview": "Outward SWIFT Payment MARK AUSTEN...", "continuesOnNextPage": true}
  ],
  "multiPageTransactions": [
    {"startPage": 2, "endPage": 3, "date": "2025-06-27", "amount": 10135.22, "type": "debit", "descriptionStart": "InternetBanking WireTfr Debit CMS REF..."}
  ]
}`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [{
      role: "user",
      parts: [
        { text: contextPrompt },
        { inlineData: { mimeType, data: base64Data } },
      ],
    }],
    config: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  const text = response.text || "{}";
  const usageMetadata = response.usageMetadata;
  
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("Failed to parse context response:", text.substring(0, 500));
    parsed = { transactionSummary: [] };
  }

  return {
    totalPages: parsed.totalPages || 1,
    periodStart: parsed.periodStart || null,
    periodEnd: parsed.periodEnd || null,
    openingBalance: parsed.openingBalance ?? null,
    closingBalance: parsed.closingBalance ?? null,
    transactionSummary: parsed.transactionSummary || [],
    inputTokens: usageMetadata?.promptTokenCount || 0,
    outputTokens: usageMetadata?.candidatesTokenCount || 0,
  };
}

/**
 * PASS 2: Extract transactions from a single page WITH context from Pass 1
 */
async function extractPageTransactions(
  ai: GoogleGenAI,
  modelName: string,
  base64Data: string,
  mimeType: string,
  pageNumber: number,
  totalPages: number,
  bankContext: string,
  isCSV: boolean,
  csvContent?: string,
  documentContext?: DocumentContext
): Promise<PageExtractionResult> {
  // Build context about what we expect on this page
  let pageContextInfo = "";
  if (documentContext && documentContext.transactionSummary && documentContext.transactionSummary.length > 0) {
    const transactionsOnThisPage = documentContext.transactionSummary.filter(t => t.page === pageNumber);
    const continuesFromPrevPage = documentContext.transactionSummary.find(t => t.page === pageNumber - 1 && t.continuesOnNextPage);
    
    // Also check multiPageTransactions for transactions that span to this page
    const multiPageOnThisPage = documentContext.multiPageTransactions?.filter(
      mpt => pageNumber >= mpt.startPage && pageNumber <= mpt.endPage
    ) || [];
    
    if (transactionsOnThisPage.length > 0) {
      pageContextInfo = `
KNOWN TRANSACTIONS ON THIS PAGE (from initial scan):
${transactionsOnThisPage.map(t => `- ${t.date || 'unknown'}: ${t.type} ${t.amount} ANG - "${t.descriptionPreview}"`).join('\n')}
`;
    }
    
    if (continuesFromPrevPage) {
      pageContextInfo += `
⚠️ CONTINUATION FROM PAGE ${pageNumber - 1}: 
The transaction "${continuesFromPrevPage.descriptionPreview}" (${continuesFromPrevPage.amount} ANG) continues from the previous page.
Text at the TOP of this page is part of that transaction's description - capture it!
`;
    }
    
    if (multiPageOnThisPage.length > 0) {
      pageContextInfo += `
⚠️ MULTI-PAGE TRANSACTIONS INVOLVING THIS PAGE:
${multiPageOnThisPage.map(mpt => `- ${mpt.date || 'unknown'}: ${mpt.amount} ANG ${mpt.type} (pages ${mpt.startPage}-${mpt.endPage}) "${mpt.descriptionStart}"`).join('\n')}
Make sure to capture ALL text for these transactions!
`;
    }
  }

  const pagePrompt = `You are extracting transactions from PAGE ${pageNumber} of ${totalPages} of a bank statement.

Bank Context: ${bankContext}
${pageContextInfo}

For EACH transaction on THIS PAGE, extract:
1. date: Transaction date (YYYY-MM-DD format)
2. description: FULL transaction description - ALL text associated with this transaction
3. amount: Amount as positive number
4. type: "credit" for money in, "debit" for money out
5. balance: Running balance after transaction
6. reference: Transaction reference/ID
7. category: "Transfer", "Income", "Bills", "Bank Fees", etc.
8. confidence: 0.0 to 1.0

Also extract if visible on this page:
- openingBalance, closingBalance, periodStart, periodEnd

CRITICAL RULES:

1. EXTRACT ALL TRANSACTIONS - even if description is incomplete!
   - If amount and date are visible, INCLUDE IT
   - Note in warnings if description continues to next page

2. CONTINUATION TEXT AT TOP OF PAGE:
   - If page ${pageNumber} starts with text that looks like it continues from page ${pageNumber - 1}
   - Create entry with: date=null, amount=0, continuedFrom="previous_page"
   - Include ALL the continuation text in description

3. WIRE TRANSFERS ARE CRITICAL (amounts 5000+):
   - "Outward SWIFT Payment" - ALWAYS capture these!
   - "InternetBanking WireTfr Debit" - ALWAYS capture these!
   - These have multi-line descriptions with addresses - capture ALL text

4. DO NOT SKIP ANY TRANSACTION BECAUSE:
   - Description is long or continues to next page
   - It spans multiple lines
   - You think it was "already on page 1"

Return valid JSON:
{
  "page": ${pageNumber},
  "transactions": [
    {
      "date": "YYYY-MM-DD or null for continuations",
      "description": "Full description text including ALL lines",
      "amount": 123.45,
      "type": "debit|credit|continuation",
      "balance": 1000.00,
      "reference": "string or null",
      "category": "string",
      "confidence": 0.95,
      "continuedFrom": "previous_page or null"
    }
  ],
  "openingBalance": number or null,
  "closingBalance": number or null,
  "periodStart": "YYYY-MM-DD or null",
  "periodEnd": "YYYY-MM-DD or null",
  "confidence": number (0-1),
  "warnings": ["string"]
}`;

  let contents: any[];

  if (isCSV && csvContent) {
    contents = [{
      role: "user",
      parts: [{ text: pagePrompt + "\n\nHere is the CSV content:\n\n```\n" + csvContent + "\n```" }],
    }];
  } else {
    contents = [{
      role: "user",
      parts: [
        { text: pagePrompt + `\n\nFocus ONLY on page ${pageNumber}. The PDF is attached.` },
        { inlineData: { mimeType, data: base64Data } },
      ],
    }];
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: contents,
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
  } catch {
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

  // Handle case where AI returns an array instead of object
  if (Array.isArray(parsed)) {
    console.log("AI returned array with", parsed.length, "items - using first item for page", pageNumber);
    parsed = parsed[0] || { transactions: [], confidence: 0.3, warnings: ["AI returned array"] };
  }

  return {
    page: pageNumber,
    transactions: parsed.transactions || [],
    openingBalance: parsed.openingBalance,
    closingBalance: parsed.closingBalance,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    confidence: parsed.confidence || 0.8,
    warnings: parsed.warnings || [],
    inputTokens: usageMetadata?.promptTokenCount || 0,
    outputTokens: usageMetadata?.candidatesTokenCount || 0,
  };
}

/**
 * Trigger extraction when statement status changes to "pending_extraction"
 */
export const onExtractTriggered = onDocumentUpdated(
  {
    document: "statements/{statementId}",
    timeoutSeconds: 540,
    memory: "2GiB",
    secrets: [geminiApiKey],
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const statementId = event.params.statementId;

    if (before?.status === "pending_extraction" || after?.status !== "pending_extraction") {
      return;
    }

    console.log(`Starting page-by-page extraction for statement ${statementId}`);

    const { userId, accountId, fileUrl, pageCount: scannedPageCount } = after;
    if (!userId || !accountId || !fileUrl) {
      console.error("Missing required fields for extraction");
      await event.data?.after.ref.update({
        status: "failed",
        errorMessage: "Missing required fields",
        processedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const startTime = Date.now();

    try {
      await event.data?.after.ref.update({
        status: "extracting",
        extractionProgress: 5,
      });

      const { model: modelToUse, provider } = await getUserModelPreference(userId);
      const modelName = getModelName(modelToUse);

      // Initialize Google AI client
      const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

      await event.data?.after.ref.update({ extractionProgress: 10 });
      const base64Data = await downloadFileAsBase64(fileUrl);

      const accountDoc = await db.doc(`accounts/${accountId}`).get();
      const accountData = accountDoc.data();
      const bankContext = `${accountData?.bankName || "Unknown"}, Account: ****${accountData?.accountNumber?.slice(-4) || "0000"}, Currency: ${accountData?.currency || "USD"}`;

      await event.data?.after.ref.update({ extractionProgress: 15 });

      const originalFileName = after.originalFileName || "";
      const isCSV = originalFileName.toLowerCase().endsWith(".csv") || 
                    after.fileType === "csv" ||
                    (after.mimeType && (after.mimeType.includes("csv") || after.mimeType.includes("text/")));
      
      const isExcel = originalFileName.toLowerCase().endsWith(".xlsx") ||
                      originalFileName.toLowerCase().endsWith(".xls") ||
                      (after.mimeType && (
                        after.mimeType.includes("spreadsheetml") ||
                        after.mimeType.includes("vnd.ms-excel") ||
                        after.mimeType.includes("vnd.openxmlformats")
                      ));

      const mimeType = after.mimeType || (after.fileType === "pdf" ? "application/pdf" : "image/png");

      let actualPdfPages = 0;
      let processingChunks = 1;
      let csvContent: string | undefined;

      if (isExcel) {
        try {
          const buffer = Buffer.from(base64Data, "base64");
          const workbook = XLSX.read(buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          csvContent = XLSX.utils.sheet_to_csv(sheet);
          console.log(`Converted Excel to CSV: ${csvContent.length} chars`);
          
          if (csvContent.length > 50000) {
            const lines = csvContent.split("\n");
            const dataLines = lines.slice(1);
            const chunkSize = Math.ceil(dataLines.length / Math.ceil(csvContent.length / 50000));
            processingChunks = Math.ceil(dataLines.length / chunkSize);
            console.log(`Large Excel detected: splitting into ${processingChunks} chunks`);
          }
        } catch (xlsxError) {
          console.error("Failed to parse Excel file:", xlsxError);
          await event.data?.after.ref.update({ 
            status: "failed",
            errorMessage: "Failed to parse Excel file.",
          });
          return;
        }
      } else if (isCSV) {
        actualPdfPages = 0;
        processingChunks = 1;
        csvContent = Buffer.from(base64Data, "base64").toString("utf-8");
        if (csvContent.length > 50000) {
          const lines = csvContent.split("\n");
          const dataLines = lines.slice(1);
          const chunkSize = Math.ceil(dataLines.length / Math.ceil(csvContent.length / 50000));
          processingChunks = Math.ceil(dataLines.length / chunkSize);
          console.log(`Large CSV detected: splitting into ${processingChunks} chunks`);
        }
      } else {
        actualPdfPages = scannedPageCount || 1;
        processingChunks = actualPdfPages;
      }

      console.log(`Processing ${processingChunks} chunks (${actualPdfPages} PDF pages)`);
      await event.data?.after.ref.update({ 
        extractionProgress: 15,
        pagesTotal: processingChunks,
        pagesCompleted: 0,
      });

      const isSpreadsheet = isCSV || isExcel;
      let documentContext: DocumentContext | undefined;
      let contextTokens = { input: 0, output: 0 };
      
      // Check for confirmed parsing rules for spreadsheets
      let parsingRules: CSVParsingRules | null = null;
      if (isSpreadsheet && csvContent) {
        // Get bank name from account to find rules
        const normalizedBankName = normalizeBankName(accountData?.bankName || "Unknown");
        parsingRules = await findParsingRules(userId, normalizedBankName);
        
        if (parsingRules) {
          console.log(`Found confirmed parsing rules for ${normalizedBankName}, using programmatic extraction`);
        } else {
          console.log(`No confirmed parsing rules found for ${normalizedBankName}, will use AI extraction`);
        }
      }

      // PASS 1: Get document context for PDFs (skip for spreadsheets)
      if (!isSpreadsheet && actualPdfPages > 1) {
        console.log(`PASS 1: Getting document context for ${actualPdfPages} page PDF...`);
        await event.data?.after.ref.update({ extractionProgress: 18 });
        
        try {
          documentContext = await getDocumentContext(ai, modelName, base64Data, mimeType, bankContext);
          contextTokens.input = documentContext.inputTokens;
          contextTokens.output = documentContext.outputTokens;
          
          console.log(`Document context extracted:`, {
            totalPages: documentContext.totalPages,
            transactionCount: documentContext.transactionSummary?.length || 0,
            multiPageTransactions: documentContext.multiPageTransactions?.length || 0,
            period: `${documentContext.periodStart} to ${documentContext.periodEnd}`,
          });
          
          // Log any multi-page transactions found
          if (documentContext.multiPageTransactions && documentContext.multiPageTransactions.length > 0) {
            console.log(`Found ${documentContext.multiPageTransactions.length} multi-page transactions:`);
            documentContext.multiPageTransactions.forEach(mpt => {
              console.log(`  - Pages ${mpt.startPage}-${mpt.endPage}: ${mpt.amount} ${mpt.type} "${mpt.descriptionStart?.substring(0, 50)}..."`);
            });
          }
        } catch (contextError) {
          console.error("Failed to get document context, proceeding without:", contextError);
          documentContext = undefined;
        }
      }

      await event.data?.after.ref.update({ extractionProgress: 20 });

      // PASS 2: Extract transactions
      const pagePromises: Promise<PageExtractionResult>[] = [];
      let programmaticResults: PageExtractionResult | null = null;

      if (isSpreadsheet && csvContent) {
        if (!parsingRules) {
          // No confirmed rules - cannot proceed
          console.error("No confirmed parsing rules found for this bank. User must confirm rules first.");
          await event.data?.after.ref.update({
            status: "needs_rules_confirmation",
            errorMessage: "Please confirm the CSV parsing rules before extraction can proceed.",
            processedAt: FieldValue.serverTimestamp(),
          });
          return;
        }
        
        // Use programmatic parsing with confirmed rules
        console.log("Using programmatic CSV parsing with confirmed rules...");
        await event.data?.after.ref.update({ extractionProgress: 30 });
        
        let { transactions: parsedTx, warnings: parseWarnings } = parseCSVWithRules(csvContent, parsingRules);
        
        console.log(`Programmatic parsing extracted ${parsedTx.length} transactions`);
        
        // SELF-HEALING: If 0 transactions but CSV has many rows, ask AI to fix the rules
        const csvLines = csvContent.split("\n");
        const expectedRows = csvLines.length - (parsingRules.dataStartRow || 1);
        
        if (parsedTx.length === 0 && expectedRows > 10) {
          console.log(`SELF-HEALING: 0 transactions from ${expectedRows} expected rows. Asking AI to fix rules...`);
          await event.data?.after.ref.update({ extractionProgress: 35, status: "self_healing" });
          
          // Get sample lines for AI
          const sampleLines = csvLines.slice(0, 15).join("\n");
          
          // Ask AI to analyze what went wrong and fix rules
          const fixPrompt = `The CSV parsing rules below FAILED to extract any transactions. 
Analyze the CSV sample and FIX the parsing rules.

CURRENT RULES (that failed):
${JSON.stringify(parsingRules, null, 2)}

PARSING ERRORS/WARNINGS:
${parseWarnings.join("\n") || "No specific errors - likely date format or column mismatch"}

CSV SAMPLE (first 15 rows):
\`\`\`
${sampleLines}
\`\`\`

ANALYZE what's wrong and return CORRECTED csvParsingRules JSON ONLY:
- Check if dateFormat matches actual dates in the data (e.g., "28-Nov-25" = "DD-MMM-YY")
- Check if column names exactly match the CSV headers
- Check if headerRow and dataStartRow are correct

Return ONLY the corrected rules as valid JSON object (no explanation):`;

          try {
            const fixResponse = await ai.models.generateContent({
              model: modelName,
              contents: [{ role: "user", parts: [{ text: fixPrompt }] }],
              config: { temperature: 0, maxOutputTokens: 4096, responseMimeType: "application/json" },
            });
            
            const fixedRulesText = fixResponse.text || "{}";
            const fixedRules = JSON.parse(fixedRulesText) as CSVParsingRules;
            
            console.log("AI suggested fixes:", JSON.stringify(fixedRules));
            
            // Merge fixed rules with original (keep id, bankIdentifier, bankDisplayName)
            const updatedRules: CSVParsingRules = {
              ...parsingRules,
              ...fixedRules,
              id: parsingRules.id,
              bankIdentifier: parsingRules.bankIdentifier,
              bankDisplayName: parsingRules.bankDisplayName,
            };
            
            // Retry parsing with fixed rules
            const retryResult = parseCSVWithRules(csvContent, updatedRules);
            console.log(`SELF-HEALING: Retry extracted ${retryResult.transactions.length} transactions`);
            
            if (retryResult.transactions.length > 0) {
              // Success! Save the fixed rules for future use
              if (parsingRules.id) {
                await db.collection("csv_parsing_rules").doc(parsingRules.id).update({
                  ...updatedRules,
                  updatedAt: FieldValue.serverTimestamp(),
                  selfHealedAt: FieldValue.serverTimestamp(),
                });
                console.log("SELF-HEALING: Updated rules saved for future use");
              }
              parsedTx = retryResult.transactions;
              parseWarnings = retryResult.warnings;
            } else {
              // Still failed - log and continue with 0 transactions
              console.error("SELF-HEALING: Retry still failed. Manual intervention needed.");
              parseWarnings.push("Self-healing attempted but failed. Manual rule correction needed.");
            }
          } catch (healError) {
            console.error("SELF-HEALING: AI fix request failed:", healError);
            parseWarnings.push(`Self-healing failed: ${healError}`);
          }
          
          await event.data?.after.ref.update({ extractionProgress: 50 });
        }
        
        // Convert parsed transactions to TransactionData format
        const txData: TransactionData[] = parsedTx.map((tx, idx) => ({
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          balance: tx.balance,
          reference: tx.reference,
          category: tx.category,
        }));
        
        // For CSVs: Calculate opening/closing balance from the PARSED DATA, not AI scan
        // The AI scan only determines column mappings, not actual values
        
        // Find opening balance: oldest transaction with a balance
        // Find closing balance: most recent transaction with a balance
        let openingBalance: number | null = null;
        let closingBalance: number | null = null;
        
        // Get all transactions that have balance values
        const txWithBalance = txData.filter(tx => tx.balance != null);
        
        if (txWithBalance.length > 0) {
          // Sort by date to find oldest and newest
          const sortedByDate = [...txWithBalance].sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateA - dateB;
          });
          
          // Opening = oldest transaction's balance (before that transaction)
          // Closing = newest transaction's balance (after that transaction)
          openingBalance = sortedByDate[0].balance ?? null;
          closingBalance = sortedByDate[sortedByDate.length - 1].balance ?? null;
          
          console.log(`CSV Balance from parsed data: opening=${openingBalance} (${sortedByDate[0].date}), closing=${closingBalance} (${sortedByDate[sortedByDate.length - 1].date}), txWithBalance=${txWithBalance.length}`);
        } else {
          console.log(`CSV has no balance column or no transactions with balance values`);
        }
        
        programmaticResults = {
          page: 1,
          transactions: txData,
          confidence: 0.95,
          warnings: parseWarnings,
          inputTokens: 0,
          outputTokens: 0,
          openingBalance,
          closingBalance,
        };
        
        // Increment usage count for these rules
        if (parsingRules.id) {
          await incrementRulesUsage(parsingRules.id);
        }
        
        await event.data?.after.ref.update({ extractionProgress: 80 });
        
      } else {
        // For PDFs, pass the document context to each page extraction
        for (let page = 1; page <= processingChunks; page++) {
          pagePromises.push(
            extractPageTransactions(ai, modelName, base64Data, mimeType, page, processingChunks, bankContext, false, undefined, documentContext)
          );
        }
      }

      const results: PageExtractionResult[] = [];
      let completedPages = 0;

      // If we have programmatic results, use those directly
      if (programmaticResults) {
        results.push(programmaticResults);
        console.log(`Programmatic parsing complete: ${programmaticResults.transactions.length} transactions`);
      } else if (pagePromises.length > 0) {
        // Process AI extraction results
        const batchSize = 5;
        for (let i = 0; i < pagePromises.length; i += batchSize) {
          const batch = pagePromises.slice(i, i + batchSize);
          const batchResults = await Promise.allSettled(batch);
          
          for (const result of batchResults) {
            completedPages++;
            if (result.status === "fulfilled") {
              results.push(result.value);
            } else {
              console.error(`Page extraction failed:`, result.reason);
              results.push({
                page: i + results.length + 1,
                transactions: [],
                confidence: 0,
                warnings: [`Extraction failed: ${result.reason}`],
                inputTokens: 0,
                outputTokens: 0,
              });
            }
          }

          const progressPercent = 20 + Math.floor((completedPages / processingChunks) * 60);
          await event.data?.after.ref.update({
            extractionProgress: progressPercent,
            pagesCompleted: completedPages,
          });
        }
      }

      console.log(`All ${results.length} result sets processed, merging...`);
      await event.data?.after.ref.update({ extractionProgress: 85 });

      const rawTransactions: TransactionData[] = [];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let openingBalance: number | null = null;
      let closingBalance: number | null = null;
      let periodStart: string | null = null;
      let periodEnd: string | null = null;
      const allWarnings: string[] = [];
      let totalConfidence = 0;

      results.sort((a, b) => a.page - b.page);

      // Add context extraction tokens to total
      totalInputTokens += contextTokens.input;
      totalOutputTokens += contextTokens.output;

      for (const pageResult of results) {
        rawTransactions.push(...pageResult.transactions);
        totalInputTokens += pageResult.inputTokens;
        totalOutputTokens += pageResult.outputTokens;
        totalConfidence += pageResult.confidence;
        allWarnings.push(...pageResult.warnings);

        // For programmatic CSV parsing, all data comes from page 1
        // For PDFs, opening balance is on page 1, closing balance on last page
        if (pageResult.page === 1) {
          if (pageResult.openingBalance != null) openingBalance = pageResult.openingBalance;
          if (pageResult.periodStart) periodStart = pageResult.periodStart;
          if (pageResult.periodEnd) periodEnd = pageResult.periodEnd;
          // For CSVs (programmatic), closing balance also comes from page 1
          if (pageResult.closingBalance != null && programmaticResults) {
            closingBalance = pageResult.closingBalance;
          }
        }
        if (pageResult.page === processingChunks) {
          // For PDFs, closing balance comes from last page
          if (pageResult.closingBalance != null) closingBalance = pageResult.closingBalance;
        }
      }
      
      // Use document context balance as fallback for PDFs
      if (documentContext) {
        if (openingBalance == null && documentContext.openingBalance != null) {
          openingBalance = documentContext.openingBalance;
          console.log(`Using document context openingBalance: ${openingBalance}`);
        }
        if (closingBalance == null && documentContext.closingBalance != null) {
          closingBalance = documentContext.closingBalance;
          console.log(`Using document context closingBalance: ${closingBalance}`);
        }
      }
      
      // Debug: Log balance values
      console.log(`Balance values: opening=${openingBalance}, closing=${closingBalance}, processingChunks=${processingChunks}`);

      // POST-PROCESSING: Merge continuation transactions with their parent transactions
      console.log(`Post-processing: merging continuations from ${rawTransactions.length} raw transactions`);
      const allTransactions: TransactionData[] = [];
      
      for (let i = 0; i < rawTransactions.length; i++) {
        const tx = rawTransactions[i];
        
        // Check if this is a continuation transaction
        if ((tx as any).type === "continuation" || (tx as any).continuedFrom === "previous_page") {
          // Try to merge with the last real transaction
          if (allTransactions.length > 0) {
            const lastTx = allTransactions[allTransactions.length - 1];
            lastTx.description = (lastTx.description || "") + " " + (tx.description || "");
            console.log(`Merged continuation into previous transaction: ${lastTx.description.substring(0, 100)}...`);
            allWarnings.push(`Merged continuation text from page break into transaction`);
          }
          continue; // Skip adding this as a separate transaction
        }
        
        // Check if this transaction has a very small or zero amount but has continuation text
        // that should be merged with the previous transaction
        if (tx.amount === 0 && tx.description && allTransactions.length > 0) {
          const lastTx = allTransactions[allTransactions.length - 1];
          // Check if this looks like it's continuation text (starts with address-like content)
          const looksLikeContinuation = 
            /^[A-Z]{2,}[-\s]/.test(tx.description) || // Starts with bank code like "SW-" or "MCBKCWCU"
            /^\d+\s+\w/.test(tx.description) || // Starts with street number
            /^[A-Z][a-z]+\s+[A-Z]/.test(tx.description) || // Starts with Name Address pattern
            tx.description.includes("MOBILEWEB") ||
            tx.description.includes("United States") ||
            tx.description.includes("United Kingdom");
          
          if (looksLikeContinuation) {
            lastTx.description = (lastTx.description || "") + " " + tx.description;
            console.log(`Merged zero-amount continuation: ${tx.description.substring(0, 50)}...`);
            continue;
          }
        }
        
        allTransactions.push(tx);
      }

      const avgConfidence = results.length > 0 ? totalConfidence / results.length : 0.8;
      const processingTime = Date.now() - startTime;

      console.log(`After merging: ${allTransactions.length} transactions (from ${rawTransactions.length} raw)`);

      const orgId = await getUserOrgId(userId) || "personal";
      const estimatedCost = calculateCost(modelToUse, totalInputTokens, totalOutputTokens);

      const needsReview = avgConfidence < 0.85 || 
        allTransactions.some((t: TransactionData) => (t.confidence || 1) < 0.8);

      await event.data?.after.ref.update({ extractionProgress: 90 });

      const usageRecordId = await recordUsage({
        orgId,
        userId,
        type: "extraction",
        statementId,
        accountId,
        aiProvider: provider,
        aiModel: modelToUse,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        pagesProcessed: actualPdfPages,
        transactionsExtracted: allTransactions.length,
        confidence: avgConfidence,
        status: needsReview ? "needs_review" : "success",
        processingTimeMs: processingTime,
        estimatedCost,
      });

      // Deduplication logic - be careful not to skip legitimate large transactions
      console.log(`Checking for duplicates among ${allTransactions.length} extracted transactions...`);
      
      const existingTxQuery = await db.collection("transactions")
        .where("userId", "==", userId)
        .where("accountId", "==", accountId)
        .get();
      
      const existingSignatures = new Set<string>();
      const existingAmountDateType = new Map<string, string[]>(); // For logging
      
      existingTxQuery.docs.forEach((doc) => {
        const tx = doc.data();
        const dateStr = tx.date.toDate().toISOString().split('T')[0];
        const amount = Math.round(tx.amount * 100) / 100;
        const balance = tx.balance ? Math.round(tx.balance * 100) / 100 : 'null';
        
        // Use a STRICT signature: date + type + amount + balance
        // This way, different wire transfers on the same day with same amount but different descriptions
        // will still be caught by balance differences
        const strictSignature = `${dateStr}|${tx.type}|${amount}|${balance}`;
        existingSignatures.add(strictSignature);
        
        // Track for debugging
        const key = `${dateStr}|${tx.type}|${amount}`;
        if (!existingAmountDateType.has(key)) {
          existingAmountDateType.set(key, []);
        }
        existingAmountDateType.get(key)!.push(tx.description?.substring(0, 50) || 'no desc');
      });
      
      console.log(`Found ${existingSignatures.size} existing transaction signatures`);
      
      const newTransactions: TransactionData[] = [];
      const duplicateTransactions: TransactionData[] = [];
      
      // Also track within this batch to avoid duplicates within the same extraction
      const batchSignatures = new Set<string>();
      
      for (const tx of allTransactions) {
        // Skip invalid transactions
        if (!tx.date || tx.amount === undefined || tx.amount === null) {
          console.log(`Skipping invalid transaction: ${JSON.stringify(tx).substring(0, 100)}`);
          continue;
        }
        
        const txDate = new Date(tx.date);
        if (isNaN(txDate.getTime())) {
          console.log(`Skipping transaction with invalid date: ${tx.date}`);
          continue;
        }
        
        const dateStr = txDate.toISOString().split('T')[0];
        const amount = Math.round(tx.amount * 100) / 100;
        const balance = tx.balance ? Math.round(tx.balance * 100) / 100 : 'null';
        
        // Strict signature based on date, type, amount, and balance
        const strictSignature = `${dateStr}|${tx.type}|${amount}|${balance}`;
        
        let isDuplicate = false;
        
        // Check against existing transactions
        if (existingSignatures.has(strictSignature)) {
          isDuplicate = true;
          console.log(`Duplicate found (existing): ${strictSignature} - ${tx.description?.substring(0, 50)}`);
        }
        
        // Check against this batch (same statement might extract same transaction twice)
        if (!isDuplicate && batchSignatures.has(strictSignature)) {
          isDuplicate = true;
          console.log(`Duplicate found (batch): ${strictSignature} - ${tx.description?.substring(0, 50)}`);
        }
        
        if (isDuplicate) {
          duplicateTransactions.push(tx);
        } else {
          newTransactions.push(tx);
          batchSignatures.add(strictSignature);
          
          // Log large transactions being added
          if (amount > 1000) {
            console.log(`✅ Adding large transaction: ${dateStr} ${tx.type} ${amount} - ${tx.description?.substring(0, 80)}`);
          }
        }
      }
      
      console.log(`Found ${newTransactions.length} new transactions, ${duplicateTransactions.length} duplicates`);
      
      const batchSizeFirestore = 500;
      for (let i = 0; i < newTransactions.length; i += batchSizeFirestore) {
        const batch = db.batch();
        const txBatch = newTransactions.slice(i, i + batchSizeFirestore);

        for (const tx of txBatch) {
          const txRef = db.collection("transactions").doc();
          const txDate = new Date(tx.date);

          batch.set(txRef, {
            id: txRef.id,
            orgId,
            userId,
            accountId,
            statementId,
            date: Timestamp.fromDate(txDate),
            description: tx.description,
            descriptionOriginal: tx.description,
            amount: tx.amount,
            type: tx.type,
            balance: tx.balance || null,
            reference: tx.reference || null,
            category: tx.category || null,
            currency: accountData?.currency || "USD",
            searchText: `${tx.description} ${tx.reference || ""} ${tx.category || ""}`.toLowerCase(),
            month: `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`,
            confidence: tx.confidence || avgConfidence,
            needsReview: (tx.confidence || 1) < 0.8,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        await batch.commit();
        console.log(`Saved batch ${Math.floor(i / batchSizeFirestore) + 1}`);
      }

      // Only update account balance if this statement is the most recent one
      const accountRef = db.doc(`accounts/${accountId}`);
      const currentAccountDoc = await accountRef.get();
      const currentAccountData = currentAccountDoc.data();
      
      const statementPeriodEnd = periodEnd ? new Date(periodEnd) : null;
      const existingLatestPeriodEnd = currentAccountData?.latestPeriodEnd?.toDate?.() || null;
      
      // Update balance only if:
      // 1. Account has no balance yet, OR
      // 2. This statement's periodEnd is newer than the existing one
      const shouldUpdateBalance = closingBalance != null && (
        currentAccountData?.balance == null ||
        !existingLatestPeriodEnd ||
        (statementPeriodEnd && statementPeriodEnd >= existingLatestPeriodEnd)
      );
      
      const accountUpdate: Record<string, unknown> = {
        transactionCount: FieldValue.increment(newTransactions.length),
        statementCount: FieldValue.increment(1),
        lastStatementDate: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      if (shouldUpdateBalance) {
        accountUpdate.balance = closingBalance;
        if (statementPeriodEnd) {
          accountUpdate.latestPeriodEnd = Timestamp.fromDate(statementPeriodEnd);
        }
        console.log(`Updating account balance to ${closingBalance} (periodEnd: ${periodEnd})`);
      } else {
        console.log(`Keeping existing account balance (this statement periodEnd ${periodEnd} is not newer than ${existingLatestPeriodEnd})`);
      }
      
      await accountRef.update(accountUpdate);

      const finalWarnings = [...allWarnings];
      if (duplicateTransactions.length > 0) {
        finalWarnings.push(`${duplicateTransactions.length} duplicate transactions were skipped`);
      }
      
      await event.data?.after.ref.update({
        status: needsReview ? "needs_review" : "completed",
        transactionCount: newTransactions.length,
        duplicatesSkipped: duplicateTransactions.length,
        transactionsExtracted: allTransactions.length,
        periodStart: periodStart ? Timestamp.fromDate(new Date(periodStart)) : null,
        periodEnd: periodEnd ? Timestamp.fromDate(new Date(periodEnd)) : null,
        openingBalance,
        closingBalance,
        confidence: avgConfidence,
        extractionModel: modelToUse,
        usageRecordId,
        warnings: finalWarnings.slice(0, 20),
        pagesTotal: processingChunks,
        pagesCompleted: processingChunks,
        actualPdfPages,
        extractionProgress: 100,
        processedAt: FieldValue.serverTimestamp(),
      });

      console.log(`✅ Extracted ${allTransactions.length} transactions, saved ${newTransactions.length} new in ${(processingTime / 1000).toFixed(1)}s`);

    } catch (error) {
      console.error("Extraction error:", error);
      
      await event.data?.after.ref.update({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        extractionProgress: 0,
        processedAt: FieldValue.serverTimestamp(),
      });
    }
  }
);

/**
 * Trigger extraction when statement is CREATED with status "pending_extraction"
 * Simply updates status to trigger the main onExtractTriggered handler
 */
export const onStatementCreated = onDocumentCreated(
  {
    document: "statements/{statementId}",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (event) => {
    const data = event.data?.data();
    const statementId = event.params.statementId;

    // Only process if created with pending_extraction status
    if (data?.status !== "pending_extraction") {
      return;
    }

    console.log(`Statement ${statementId} created with pending_extraction, updating to trigger extraction`);

    // Set to "uploaded" first, then back to "pending_extraction" to trigger onExtractTriggered
    await event.data?.ref.update({ status: "uploaded" });
    await event.data?.ref.update({ status: "pending_extraction" });
  }
);
