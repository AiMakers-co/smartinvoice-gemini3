/**
 * Invoice Scanning
 * Detect vendor and invoice information from PDFs, CSVs, and Excel files
 * Uses Google AI Studio API for Gemini 3 Flash
 * 
 * For CSV/Excel files:
 * - AI analyzes sample rows to understand the document structure
 * - Auto-detects columns for vendor, amount, date, line items, etc.
 * - Generates parsing rules for programmatic extraction
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../config/firebase";
import { geminiApiKey, getModelName, calculateCost } from "../config/ai-models";
import { GoogleGenAI } from "@google/genai";
import { recordUsage } from "../utils/usage";
import { getUserModelPreference, getUserOrgId } from "../utils/model-preference";
import { downloadFileAsBase64 } from "../utils/storage";
import { InvoiceScanResult } from "../types";
import * as XLSX from "xlsx";

/**
 * Scan an invoice PDF to extract vendor and invoice details
 */
export const scanInvoice = onCall(
  { 
    cors: true, 
    timeoutSeconds: 120,
    secrets: [geminiApiKey],
  },
  async (request): Promise<InvoiceScanResult> => {
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

    console.log(`Scanning invoice for user ${userId} with model ${modelName}, mimeType: ${mimeType}`);

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
      
      // Check if this is a CSV file
      const isCSVFile = mimeType && (
        mimeType.includes("csv") || 
        mimeType.includes("text/plain") ||
        mimeType.includes("text/")
      );
      
      // Convert Excel to CSV if needed
      let csvContent = "";
      if (isExcelFile) {
        try {
          const buffer = Buffer.from(base64Data, "base64");
          const workbook = XLSX.read(buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          csvContent = XLSX.utils.sheet_to_csv(sheet);
          console.log(`Converted Excel to CSV: ${csvContent.length} chars`);
        } catch (xlsxError) {
          console.error("Failed to parse Excel file:", xlsxError);
          throw new HttpsError("invalid-argument", "Failed to parse Excel file. Please ensure it's a valid .xlsx or .xls file.");
        }
      } else if (isCSVFile) {
        csvContent = Buffer.from(base64Data, "base64").toString("utf-8");
        console.log(`Read CSV content: ${csvContent.length} chars`);
      }

      // Build the appropriate prompt based on file type
      const pdfScanPrompt = `You are a financial document processing expert. Analyze this document and extract ALL relevant information.

FIRST: Determine the document type:
- "invoice" = An invoice/bill for goods or services (has vendor, line items, totals)
- "bank_statement" = A bank/financial statement showing account transactions (has account number, transaction list, opening/closing balances)
- "receipt" = A receipt for a purchase
- "expense_report" = An expense report or reimbursement form
- "other" = Other document type

If this is a BANK STATEMENT (shows account transactions, balances, etc.), return this response:
{
  "detectedType": "bank_statement",
  "bankName": "name of the bank",
  "accountNumber": "account number shown",
  "message": "This appears to be a bank statement. Please use the Bank Statements uploader instead."
}

For invoices, bills, expense reports - continue with full extraction:

Extract the following (include all fields that are present in the document):

VENDOR/SUPPLIER INFORMATION:
1. vendorName: Company name of the vendor/supplier/sender
2. vendorAddress: Full address of the vendor
3. vendorEmail: Vendor's email address (if shown)
4. vendorPhone: Vendor's phone number (if shown)
5. vendorTaxId: Tax ID, VAT number, ABN, etc. (if shown)

CUSTOMER/RECIPIENT INFORMATION:
6. customerName: Name of the customer/recipient (the "Invoice For" or "Bill To")
7. customerAddress: Customer's address (if shown)

DOCUMENT DETAILS:
8. invoiceNumber: The invoice/document number/ID
9. invoiceDate: Document date (YYYY-MM-DD format)
10. dueDate: Payment due date (YYYY-MM-DD format, if shown)
11. purchaseOrder: PO number (if shown)
12. paymentTerms: Payment terms (e.g., "Net 30", if shown)
13. subject: Subject line or description of what this document is for

BANK/PAYMENT DETAILS (if payment info is shown on document):
14. bankName: Name of the bank for payment (e.g., "Wise", "Chase", etc.)
15. accountHolderName: Name on the bank account
16. accountNumber: Bank account number
17. routingNumber: Routing number / Sort code
18. swiftBic: SWIFT/BIC code for international transfers
19. iban: IBAN number (if shown)
20. bankAddress: Bank's address (if shown)

AMOUNTS:
21. subtotal: Amount before tax (number)
22. taxRate: Tax rate as percentage (e.g., 10 for 10%)
23. taxAmount: Total tax amount (number)
24. discount: Any discount amount (number, if applicable)
25. shippingAmount: Shipping/freight charges (if shown)
26. total: Total amount due (number)
27. currency: Currency code (USD, EUR, GBP, AUD, etc.)
28. amountDue: Remaining amount due (if different from total)

LINE ITEMS (extract all):
For each line item:
- description: Full item description
- quantity: Quantity ordered
- unitPrice: Price per unit
- amount: Line total
- taxRate: Item-specific tax rate (if different from document tax rate)
- confidence: Your confidence for this line item (0.0 to 1.0)

QUALITY:
- confidence: Overall confidence in the extraction (0.0 to 1.0)
- warnings: Any issues or uncertainties (array of strings)
- suggestions: Helpful suggestions (array of strings)
- pageCount: Number of pages in the document

Return ONLY valid JSON:
{
  "detectedType": "invoice" or "bank_statement" or "receipt" or "expense_report" or "other",
  "vendorName": "string",
  "vendorAddress": "string or null",
  "vendorEmail": "string or null",
  "vendorPhone": "string or null",
  "vendorTaxId": "string or null",
  "customerName": "string or null",
  "customerAddress": "string or null",
  "invoiceNumber": "string",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD or null",
  "purchaseOrder": "string or null",
  "paymentTerms": "string or null",
  "subject": "string or null",
  "bankName": "string or null",
  "accountHolderName": "string or null",
  "accountNumber": "string or null",
  "routingNumber": "string or null",
  "swiftBic": "string or null",
  "iban": "string or null",
  "bankAddress": "string or null",
  "subtotal": number or null,
  "taxRate": number or null,
  "taxAmount": number or null,
  "discount": number or null,
  "shippingAmount": number or null,
  "total": number,
  "currency": "string",
  "amountDue": number or null,
  "lineItems": [
    {
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "amount": number,
      "taxRate": number or null,
      "confidence": number
    }
  ],
  "confidence": number,
  "warnings": ["string"],
  "suggestions": ["string"],
  "pageCount": number
}`;

      // CSV/Excel specific prompt - ONLY generates parsing rules, does NOT extract data
      // The actual extraction is done programmatically by invoice-csv-parser.ts
      const csvScanPrompt = `You are a data structure analyst. Analyze this CSV/spreadsheet sample and generate PARSING RULES so code can extract ALL rows.

YOUR ONLY TASK: Figure out the column structure and return mapping rules. DO NOT extract the actual data - that will be done programmatically.

STEP 1 - DETERMINE DOCUMENT TYPE:
- "invoice_list" = Each row is a separate invoice (MOST COMMON for CSV exports)
- "line_items" = Each row is a line item from an invoice
- "bank_statement" = Bank transactions (suggest using Bank Statements uploader instead)
- "other" = Other data type

STEP 2 - ANALYZE STRUCTURE:
- Which row contains the column headers? (usually row 0)
- Which row does the data start? (usually row 1)
- Are there footer/summary rows to skip?

STEP 3 - MAP COLUMNS:
Look at EVERY column header and figure out what data it contains.
Map column names to these standard field names:

REQUIRED FIELDS (find these):
- invoiceNumber: Invoice #, Order ID, Document ID, Bill No, etc.
- amount: Total, Amount, Total Invoiced, Grand Total, etc.

IMPORTANT FIELDS (find if present):
- customerName: Customer, Client, Bill To, Customer Name, etc.
- vendorName: Vendor, Supplier, From, Vendor Name, etc.
- invoiceDate: Date, Invoice Date, Doc Date, Order Date, etc.
- dueDate: Due Date, Payment Due, Due, etc.
- currency: Currency, CEx ID, Curr, etc.
- tax: Tax, VAT, GST, Total Taxes, Tax Amount, etc.
- subtotal: Subtotal, Net Amount, Items Total, Total Items, etc.
- status: Status, Payment Status, State, etc.
- description: Description, Memo, Notes, Subject, etc.
- purchaseOrder: PO, PO Number, Purchase Order, etc.

ADDITIONAL FIELDS (capture anything else useful):
- Any other columns that might be useful (category, location, agent, etc.)

STEP 4 - DETECT FORMATS:
- Date format: Look at the date values and determine format (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD, etc.)
- Number format: Thousands separator (comma, period, or none), decimal separator

RESPONSE FORMAT - Return ONLY this JSON structure:
{
  "detectedType": "invoice_list",
  "documentStructure": "invoice_list",
  "isCSV": true,
  
  "csvParsingRules": {
    "headerRow": 0,
    "dataStartRow": 1,
    "skipFooterRows": 0,
    "columns": {
      "invoiceNumber": "exact column name for invoice number",
      "customerName": "exact column name for customer" or null,
      "vendorName": "exact column name for vendor" or null,
      "invoiceDate": "exact column name for date",
      "dueDate": "exact column name for due date" or null,
      "amount": "exact column name for total amount",
      "subtotal": "exact column name for subtotal" or null,
      "tax": "exact column name for tax" or null,
      "currency": "exact column name for currency" or null,
      "status": "exact column name for status" or null,
      "description": "exact column name for description" or null,
      "purchaseOrder": "exact column name for PO" or null
    },
    "dateFormat": "MM/DD/YYYY" or "DD/MM/YYYY" or "YYYY-MM-DD",
    "thousandsSeparator": "," or "." or null,
    "decimalSeparator": "." or ",",
    "defaultCurrency": "USD" or detected currency code
  },
  
  "summary": {
    "totalRows": number of data rows (not including header),
    "sampleInvoice": {
      "invoiceNumber": "value from first data row",
      "customerName": "value from first data row",
      "amount": number from first data row,
      "currency": "currency from first data row"
    }
  },
  
  "confidence": 0.0-1.0,
  "warnings": ["any issues found"],
  "suggestions": ["helpful tips"],
  "pageCount": 1
}

CRITICAL:
1. Use EXACT column names from the headers - don't modify them
2. The columns mapping tells code which spreadsheet column maps to which invoice field
3. DO NOT try to extract all the data - just analyze the structure
4. If a column doesn't exist, set it to null
5. Be smart about matching - "Order ID" should map to invoiceNumber, "Total Invoiced" to amount, etc.`;

      const scanPrompt = (isCSVFile || isExcelFile) ? csvScanPrompt : pdfScanPrompt;

      // Build request contents based on file type
      let contents: any[];
      
      if (isCSVFile || isExcelFile) {
        // For CSV/Excel: Send text content with the prompt
        const allLines = csvContent.split("\n");
        const totalRows = allLines.length;
        
        // Send first 50 rows for analysis (enough to understand structure)
        const sampleLines = allLines.slice(0, 50).join("\n");
        const truncatedNote = totalRows > 50 ? `\n\n(Showing first 50 of ${totalRows} rows)` : "";
        
        console.log(`Sending CSV sample: ${sampleLines.length} chars, ${Math.min(50, totalRows)} rows`);
        
        contents = [{
          role: "user",
          parts: [{ 
            text: scanPrompt + 
              `\n\nHere is the spreadsheet data:\n\n\`\`\`\n${sampleLines}\n\`\`\`${truncatedNote}` 
          }],
        }];
      } else {
        // For PDFs: Send as binary data
        contents = [{
          role: "user",
          parts: [
            { text: scanPrompt },
            { inlineData: { mimeType: "application/pdf", data: base64Data } },
          ],
        }];
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          temperature: 0.1,
          maxOutputTokens: 75000,
          responseMimeType: "application/json",
        },
      });

      const text = response.text || "{}";
      const usageMetadata = response.usageMetadata;
      
      // Try to parse JSON, with AI auto-fix for malformed responses
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (jsonError) {
        console.error("JSON parse error, attempting AI auto-fix:", jsonError);
        
        try {
          const fixPrompt = `The following JSON has a syntax error. Please fix it and return ONLY valid JSON, nothing else.

Here is the malformed JSON:
${text.substring(0, 30000)}

Fix the JSON syntax errors and return the corrected JSON:`;

          const fixResponse = await ai.models.generateContent({
            model: modelName,
            contents: [{
              role: "user",
              parts: [{ text: fixPrompt }],
            }],
            config: {
              temperature: 0,
              maxOutputTokens: 75000,
              responseMimeType: "application/json",
            },
          });

          const fixedText = fixResponse.text || "{}";
          parsed = JSON.parse(fixedText);
          console.log("AI auto-fix successful");
        } catch (fixError) {
          console.error("AI auto-fix failed, using defaults:", fixError);
          parsed = {
            vendorName: "Unknown Vendor",
            invoiceNumber: "Unknown",
            invoiceDate: new Date().toISOString().split("T")[0],
            total: 0,
            currency: "USD",
            lineItems: [],
            confidence: 0.3,
            warnings: ["Failed to parse AI response - please try again or use a clearer PDF"],
            suggestions: [],
            pageCount: 1,
          };
        }
      }
      
      const processingTime = Date.now() - startTime;

      // Handle case where AI returns an array instead of object
      // (happens with multi-page documents or when AI thinks there are multiple invoices)
      if (Array.isArray(parsed)) {
        console.log("AI returned array with", parsed.length, "items - using first item");
        parsed = parsed[0] || {
          vendorName: "Unknown Vendor",
          invoiceNumber: "Unknown",
          invoiceDate: new Date().toISOString().split("T")[0],
          total: 0,
          currency: "USD",
          lineItems: [],
          confidence: 0.3,
          warnings: ["AI returned array response - extracted first invoice"],
          suggestions: [],
          pageCount: 1,
        };
      }

      // Log what we extracted
      console.log("=== SCAN RESULT ===");
      console.log("detectedType:", parsed.detectedType);
      console.log("documentStructure:", parsed.documentStructure);
      console.log("vendorName:", parsed.vendorName);
      console.log("invoiceNumber:", parsed.invoiceNumber);
      console.log("total:", parsed.total);
      console.log("status:", parsed.status);
      console.log("lineItems count:", parsed.lineItems?.length || 0);
      console.log("invoices count:", parsed.invoices?.length || 0);
      console.log("bankName:", parsed.bankName);
      console.log("accountNumber:", parsed.accountNumber);
      console.log("confidence:", parsed.confidence);
      console.log("message:", parsed.message);
      if (parsed.summary) {
        console.log("=== SUMMARY ===");
        console.log("totalRows:", parsed.summary.totalRows);
        console.log("totalInvoices:", parsed.summary.totalInvoices);
        console.log("totalAmount:", parsed.summary.totalAmount);
        console.log("currencies:", parsed.summary.currencies);
        console.log("vendors:", parsed.summary.vendors?.slice(0, 5), "...");
        console.log("===============");
      }
      if (parsed.csvParsingRules) {
        console.log("=== CSV PARSING RULES ===");
        console.log("headerRow:", parsed.csvParsingRules.headerRow);
        console.log("dataStartRow:", parsed.csvParsingRules.dataStartRow);
        console.log("columns:", JSON.stringify(parsed.csvParsingRules.columns));
        console.log("dateColumns:", parsed.csvParsingRules.dateColumns);
        console.log("amountColumns:", parsed.csvParsingRules.amountColumns);
        console.log("groupByColumn:", parsed.csvParsingRules.groupByColumn);
        console.log("=========================");
      }
      if (parsed.additionalFields) {
        console.log("=== ADDITIONAL FIELDS ===");
        console.log(JSON.stringify(parsed.additionalFields, null, 2));
        console.log("=========================");
      }
      console.log("===================");

      // Get user's org for usage tracking
      const orgId = await getUserOrgId(userId);

      // Record usage
      const estimatedCost = calculateCost(
        modelToUse,
        usageMetadata?.promptTokenCount || 0,
        usageMetadata?.candidatesTokenCount || 0
      );

      await recordUsage({
        orgId: orgId || "personal",
        userId,
        type: "invoice_scan",
        aiProvider: provider,
        aiModel: modelToUse,
        inputTokens: usageMetadata?.promptTokenCount || 0,
        outputTokens: usageMetadata?.candidatesTokenCount || 0,
        pagesProcessed: parsed.pageCount || 1,
        transactionsExtracted: parsed.lineItems?.length || 0,
        confidence: parsed.confidence || 0.8,
        status: "success",
        processingTimeMs: processingTime,
        estimatedCost,
      });

      // Check if we have a matching vendor template
      let templateMatch: { templateId: string; vendorName: string; confidence: number } | undefined;
      
      if (parsed.vendorName) {
        const templatesQuery = await db.collection("invoice_templates")
          .where("vendorName", "==", parsed.vendorName)
          .limit(1)
          .get();
        
        if (!templatesQuery.empty) {
          const template = templatesQuery.docs[0];
          templateMatch = {
            templateId: template.id,
            vendorName: template.data().vendorName,
            confidence: 0.9,
          };
        }
      }

      return {
        // Document type detection
        detectedType: parsed.detectedType || "invoice",
        documentStructure: parsed.documentStructure,
        message: parsed.message,
        // CSV/Excel file flag - explicit indicator for frontend
        isCSV: isCSVFile || isExcelFile,
        // Summary (for CSV with multiple records)
        summary: parsed.summary,
        // Vendor info
        vendorName: parsed.vendorName || "Unknown Vendor",
        vendorAddress: parsed.vendorAddress,
        vendorEmail: parsed.vendorEmail,
        vendorPhone: parsed.vendorPhone,
        vendorTaxId: parsed.vendorTaxId,
        // Document info
        invoiceNumber: parsed.invoiceNumber || "Unknown",
        invoiceDate: parsed.invoiceDate || new Date().toISOString().split("T")[0],
        dueDate: parsed.dueDate,
        purchaseOrder: parsed.purchaseOrder,
        paymentTerms: parsed.paymentTerms,
        status: parsed.status,
        // Amounts
        subtotal: parsed.subtotal,
        taxRate: parsed.taxRate,
        taxAmount: parsed.taxAmount,
        discount: parsed.discount,
        shippingAmount: parsed.shippingAmount,
        total: parsed.total || 0,
        currency: parsed.currency || "USD",
        amountDue: parsed.amountDue,
        // Line items (preserve all fields AI extracted, not just standard ones)
        lineItems: (parsed.lineItems || []).map((item: any) => ({
          ...item,  // Keep all fields AI extracted
          description: item.description || "Item",
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          amount: item.amount || 0,
          confidence: item.confidence || 0.8,
        })),
        // Multiple invoices (if CSV contains invoice list) - preserve all fields
        invoices: parsed.invoices,
        rowCount: parsed.rowCount,
        templateMatch,
        // CSV parsing rules (for programmatic extraction)
        csvParsingRules: parsed.csvParsingRules,
        // Additional fields discovered by AI
        additionalFields: parsed.additionalFields,
        // Quality metrics
        confidence: parsed.confidence || 0.8,
        warnings: parsed.warnings || [],
        suggestions: parsed.suggestions || [],
        pageCount: parsed.pageCount || 1,
        inputTokens: usageMetadata?.promptTokenCount || 0,
        outputTokens: usageMetadata?.candidatesTokenCount || 0,
      };

    } catch (error) {
      console.error("Invoice scan error:", error);
      throw new HttpsError("internal", `Failed to scan invoice: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);
