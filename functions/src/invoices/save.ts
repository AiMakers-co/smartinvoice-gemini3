/**
 * Invoice Saving Functions
 * Save invoices and line items to Firestore
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue, Timestamp } from "../config/firebase";
import { calculateCost } from "../config/ai-models";
import { recordUsage } from "../utils/usage";
import { getUserModelPreference, getUserOrgId } from "../utils/model-preference";

interface InvoiceData {
  vendorName: string;
  vendorAddress?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorTaxId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  purchaseOrder?: string;
  paymentTerms?: string;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: number;
  shippingAmount?: number;
  total: number;
  currency: string;
  amountDue?: number;
  status?: string;
  description?: string;
  customerName?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate?: number;
    confidence: number;
  }>;
  [key: string]: any; // Allow additional fields from AI
}

interface SaveInvoiceRequest {
  scanResult: InvoiceData & {
    // Multiple invoices from CSV/Excel
    invoices?: InvoiceData[];
    documentStructure?: "single_invoice" | "invoice_list" | "line_items_list" | "mixed";
    summary?: {
      totalRows?: number;
      totalInvoices?: number;
      totalAmount?: number;
    };
    confidence: number;
    pageCount: number;
    inputTokens: number;
    outputTokens: number;
  };
  fileUrl: string;
  fileName: string;
  fileSize: number;
  createTemplate: boolean;
  overrides?: {
    vendorName?: string;
    invoiceNumber?: string;
    total?: number;
  };
}

/**
 * Save invoice(s) to Firestore
 * Handles both single invoices and lists of invoices from CSV/Excel
 */
export const saveInvoice = onCall(
  { cors: true, timeoutSeconds: 300 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { scanResult, fileUrl, fileName, fileSize, createTemplate } = request.data as SaveInvoiceRequest;
    if (!scanResult) {
      throw new HttpsError("invalid-argument", "Scan result required");
    }

    const userId = request.auth.uid;
    const orgId = await getUserOrgId(userId);
    const { model: modelToUse, provider } = await getUserModelPreference(userId);

    try {
      // Determine if we have multiple invoices or just one
      const hasMultipleInvoices = scanResult.invoices && scanResult.invoices.length > 0;
      const invoicesToSave: InvoiceData[] = hasMultipleInvoices 
        ? scanResult.invoices! 
        : [scanResult];

      console.log(`Saving ${invoicesToSave.length} invoice(s) for user ${userId}`);

      const savedInvoiceIds: string[] = [];
      const templateIds: string[] = [];
      let totalLineItems = 0;

      // Process in batches of 400 (Firestore batch limit is 500)
      const BATCH_SIZE = 400;
      
      for (let batchStart = 0; batchStart < invoicesToSave.length; batchStart += BATCH_SIZE) {
        const batchInvoices = invoicesToSave.slice(batchStart, batchStart + BATCH_SIZE);
        const batch = db.batch();

        for (const invoice of batchInvoices) {
          // Skip invalid invoices
          if (!invoice.invoiceNumber && !invoice.vendorName && !invoice.total) {
            console.log("Skipping invalid invoice with no key data");
            continue;
          }

          // Create or update vendor template if requested
          let templateId: string | null = null;
          if (createTemplate && invoice.vendorName) {
            const existingTemplate = await db.collection("invoice_templates")
              .where("userId", "==", userId)
              .where("vendorName", "==", invoice.vendorName)
              .limit(1)
              .get();

            if (existingTemplate.empty) {
              const templateRef = db.collection("invoice_templates").doc();
              templateId = templateRef.id;
              batch.set(templateRef, {
                id: templateRef.id,
                userId,
                orgId: orgId || null,
                vendorName: invoice.vendorName,
                vendorAddress: invoice.vendorAddress,
                vendorEmail: invoice.vendorEmail,
                vendorPhone: invoice.vendorPhone,
                vendorTaxId: invoice.vendorTaxId,
                usageCount: 1,
                createdAt: FieldValue.serverTimestamp(),
                lastUsed: FieldValue.serverTimestamp(),
              });
              templateIds.push(templateId);
            } else {
              templateId = existingTemplate.docs[0].id;
              batch.update(existingTemplate.docs[0].ref, {
                usageCount: FieldValue.increment(1),
                lastUsed: FieldValue.serverTimestamp(),
              });
            }
          }

          // Parse date safely
          let invoiceDate;
          try {
            invoiceDate = Timestamp.fromDate(new Date(invoice.invoiceDate || new Date()));
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

          // Create invoice document
          const invoiceRef = db.collection("invoices").doc();
          const invoiceData = {
            id: invoiceRef.id,
            userId,
            orgId: orgId || null,
            
            // File info (shared for batch imports)
            fileName,
            fileUrl,
            fileSize,
            pageCount: scanResult.pageCount || 1,
            
            // Vendor info
            vendorName: invoice.vendorName || "Unknown Vendor",
            vendorAddress: invoice.vendorAddress,
            vendorEmail: invoice.vendorEmail,
            vendorPhone: invoice.vendorPhone,
            vendorTaxId: invoice.vendorTaxId,
            
            // Customer info
            customerName: invoice.customerName,
            
            // Invoice details
            invoiceNumber: invoice.invoiceNumber || `AUTO-${Date.now()}`,
            invoiceDate,
            dueDate,
            purchaseOrder: invoice.purchaseOrder,
            paymentTerms: invoice.paymentTerms,
            description: invoice.description,
            
            // Amounts
            subtotal: invoice.subtotal,
            taxRate: invoice.taxRate,
            taxAmount: invoice.taxAmount,
            discount: invoice.discount,
            shippingAmount: invoice.shippingAmount,
            total: invoice.total || 0,
            currency: invoice.currency || "USD",
            amountDue: invoice.amountDue ?? invoice.total,
            
            // Status from AI or default
            paymentStatus: invoice.status?.toLowerCase().includes("paid") ? "paid" : "unpaid",
            
            // Line items count
            lineItemCount: invoice.lineItems?.length || 0,
            
            // Processing info
            status: scanResult.confidence >= 0.85 ? "completed" : "needs_review",
            confidence: scanResult.confidence,
            templateId,
            
            // Import metadata
            importedFromFile: hasMultipleInvoices,
            importBatchSize: invoicesToSave.length,
            
            // Timestamps
            createdAt: FieldValue.serverTimestamp(),
            processedAt: FieldValue.serverTimestamp(),
          };

          batch.set(invoiceRef, invoiceData);
          savedInvoiceIds.push(invoiceRef.id);

          // Save line items if present
          if (invoice.lineItems && invoice.lineItems.length > 0) {
            for (const item of invoice.lineItems) {
              const lineItemRef = db.collection("invoice_line_items").doc();
              batch.set(lineItemRef, {
                id: lineItemRef.id,
                invoiceId: invoiceRef.id,
                userId,
                orgId: orgId || null,
                description: item.description || "Item",
                quantity: item.quantity || 1,
                unitPrice: item.unitPrice || 0,
                amount: item.amount || 0,
                taxRate: item.taxRate,
                confidence: item.confidence || 0.8,
                createdAt: FieldValue.serverTimestamp(),
              });
              totalLineItems++;
            }
          }
        }

        await batch.commit();
        console.log(`Committed batch of ${batchInvoices.length} invoices`);
      }

      // Record usage
      const estimatedCost = calculateCost(
        modelToUse,
        scanResult.inputTokens,
        scanResult.outputTokens
      );

      await recordUsage({
        orgId: orgId || "personal",
        userId,
        type: "invoice_extraction",
        aiProvider: provider,
        aiModel: modelToUse,
        inputTokens: scanResult.inputTokens,
        outputTokens: scanResult.outputTokens,
        pagesProcessed: scanResult.pageCount || 1,
        transactionsExtracted: savedInvoiceIds.length,
        confidence: scanResult.confidence,
        status: "success",
        processingTimeMs: 0,
        estimatedCost,
      });

      console.log(`Saved ${savedInvoiceIds.length} invoices for user ${userId}`);

      return {
        invoiceId: savedInvoiceIds[0], // First invoice ID for backwards compatibility
        invoiceIds: savedInvoiceIds,
        invoiceCount: savedInvoiceIds.length,
        templateIds,
        lineItemCount: totalLineItems,
      };

    } catch (error) {
      console.error("Save invoice error:", error);
      throw new HttpsError("internal", `Failed to save invoice: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);

/**
 * Get invoices for a user
 */
export const getInvoices = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { limit = 50, vendorName, startDate, endDate } = request.data || {};
    const userId = request.auth.uid;

    let query = db.collection("invoices")
      .where("userId", "==", userId)
      .orderBy("invoiceDate", "desc");

    if (vendorName) {
      query = query.where("vendorName", "==", vendorName);
    }

    if (startDate) {
      query = query.where("invoiceDate", ">=", Timestamp.fromDate(new Date(startDate)));
    }

    if (endDate) {
      query = query.where("invoiceDate", "<=", Timestamp.fromDate(new Date(endDate)));
    }

    const snapshot = await query.limit(limit).get();

    return {
      invoices: snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })),
    };
  }
);

/**
 * Get vendor templates for a user
 */
export const getInvoiceTemplates = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const userId = request.auth.uid;

    const snapshot = await db.collection("invoice_templates")
      .where("userId", "==", userId)
      .orderBy("usageCount", "desc")
      .limit(100)
      .get();

    return {
      templates: snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })),
    };
  }
);

