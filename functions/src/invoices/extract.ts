/**
 * Invoice Extraction
 * 
 * Extracts ALL invoices from CSV/Excel files using AI-generated parsing rules
 * Similar to bank statement extraction but for invoices
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue, Timestamp } from "../config/firebase";
import { downloadFileAsBase64 } from "../utils/storage";
import { recordUsage } from "../utils/usage";
import { getUserModelPreference, getUserOrgId } from "../utils/model-preference";
import { calculateCost } from "../config/ai-models";
import { 
  parseInvoiceCSVWithRules, 
  InvoiceParsingRules,
  getInvoiceParsingRules 
} from "./invoice-csv-parser";
import * as XLSX from "xlsx";

/**
 * Extract all invoices from a CSV/Excel file using parsing rules
 */
export const extractInvoices = onCall(
  { 
    cors: true, 
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { fileUrl, mimeType, parsingRules, parsingRulesId } = request.data;
    
    if (!fileUrl) {
      throw new HttpsError("invalid-argument", "File URL required");
    }
    
    if (!parsingRules && !parsingRulesId) {
      throw new HttpsError("invalid-argument", "Parsing rules required");
    }

    const userId = request.auth.uid;
    const orgId = await getUserOrgId(userId);
    const { model: modelToUse, provider } = await getUserModelPreference(userId);

    console.log(`Extracting invoices for user ${userId}`);

    try {
      // Get parsing rules
      let rules: InvoiceParsingRules;
      if (parsingRulesId) {
        const savedRules = await getInvoiceParsingRules(parsingRulesId);
        if (!savedRules) {
          throw new HttpsError("not-found", "Parsing rules not found");
        }
        rules = savedRules;
      } else {
        rules = parsingRules;
      }

      // Download and convert file to CSV
      const base64Data = await downloadFileAsBase64(fileUrl);
      let csvContent: string;

      const isExcelFile = mimeType && (
        mimeType.includes("spreadsheetml") ||
        mimeType.includes("excel") ||
        mimeType.includes("vnd.ms-excel") ||
        mimeType.includes("vnd.openxmlformats")
      );

      if (isExcelFile) {
        const buffer = Buffer.from(base64Data, "base64");
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        csvContent = XLSX.utils.sheet_to_csv(sheet);
        console.log(`Converted Excel to CSV: ${csvContent.length} chars`);
      } else {
        csvContent = Buffer.from(base64Data, "base64").toString("utf-8");
        console.log(`Read CSV: ${csvContent.length} chars`);
      }

      // Parse ALL rows using the rules
      const { invoices, warnings } = parseInvoiceCSVWithRules(csvContent, rules);
      
      console.log(`Extracted ${invoices.length} invoices with ${warnings.length} warnings`);

      // Save all invoices to Firestore in batches
      const savedInvoiceIds: string[] = [];
      const BATCH_SIZE = 400;
      
      for (let batchStart = 0; batchStart < invoices.length; batchStart += BATCH_SIZE) {
        const batchInvoices = invoices.slice(batchStart, batchStart + BATCH_SIZE);
        const batch = db.batch();
        
        for (const invoice of batchInvoices) {
          // Skip invoices with no meaningful data
          if (!invoice.invoiceNumber && invoice.amount === 0) {
            continue;
          }

          const invoiceRef = db.collection("invoices").doc();
          
          // Parse invoice date
          let invoiceDate;
          try {
            invoiceDate = Timestamp.fromDate(new Date(invoice.invoiceDate));
          } catch {
            invoiceDate = Timestamp.now();
          }

          let dueDate = null;
          if (invoice.dueDate) {
            try {
              dueDate = Timestamp.fromDate(new Date(invoice.dueDate));
            } catch {
              dueDate = null;
            }
          }

          const isPaid = invoice.status?.toLowerCase().includes("paid");
          const invoiceData = {
            id: invoiceRef.id,
            userId,
            orgId: orgId || null,
            
            // Invoice details
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customerName || null,
            vendorName: invoice.vendorName || null,
            invoiceDate,
            dueDate,
            description: invoice.description || null,
            purchaseOrder: invoice.purchaseOrder || null,
            
            // Amounts
            subtotal: invoice.subtotal || null,
            taxAmount: invoice.tax || null,
            total: invoice.amount,
            currency: invoice.currency,
            amountDue: isPaid ? 0 : invoice.amount,
            amountPaid: isPaid ? invoice.amount : 0,
            amountRemaining: isPaid ? 0 : invoice.amount,
            
            // Payment & Reconciliation status
            paymentStatus: isPaid ? "paid" : "unpaid",
            reconciliationStatus: isPaid ? "matched" : "unmatched",
            status: "completed",
            confidence: 0.9,
            
            // Import metadata
            importedFromFile: true,
            sourceFileName: fileUrl.split("/").pop()?.split("?")[0],
            sourceRowIndex: invoice.rowIndex,
            additionalFields: invoice.additionalFields || null,
            
            // Timestamps
            createdAt: FieldValue.serverTimestamp(),
            processedAt: FieldValue.serverTimestamp(),
          };

          batch.set(invoiceRef, invoiceData);
          savedInvoiceIds.push(invoiceRef.id);
        }
        
        await batch.commit();
        console.log(`Committed batch: ${batchStart} to ${batchStart + batchInvoices.length}`);
      }

      // Record usage
      const estimatedCost = calculateCost(modelToUse, 0, 0);
      
      await recordUsage({
        orgId: orgId || "personal",
        userId,
        type: "invoice_extraction",
        aiProvider: provider,
        aiModel: modelToUse,
        inputTokens: 0,
        outputTokens: 0,
        pagesProcessed: 1,
        transactionsExtracted: savedInvoiceIds.length,
        confidence: 0.9,
        status: "success",
        processingTimeMs: 0,
        estimatedCost,
      });

      // Calculate summary
      const summary = {
        totalInvoices: savedInvoiceIds.length,
        totalAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
        currencies: [...new Set(invoices.map(inv => inv.currency))],
        customers: [...new Set(invoices.map(inv => inv.customerName).filter(Boolean))].slice(0, 10),
        vendors: [...new Set(invoices.map(inv => inv.vendorName).filter(Boolean))].slice(0, 10),
      };

      return {
        success: true,
        invoiceIds: savedInvoiceIds,
        invoiceCount: savedInvoiceIds.length,
        summary,
        warnings,
      };

    } catch (error) {
      console.error("Invoice extraction error:", error);
      throw new HttpsError("internal", `Failed to extract invoices: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);
