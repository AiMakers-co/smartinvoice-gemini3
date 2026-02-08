import { Timestamp } from "firebase/firestore";

// ============================================
// DOCUMENT TYPES - RECEIVABLES (A/R) vs PAYABLES (A/P)
// ============================================

/**
 * Document Direction
 * - outgoing: Documents YOU send (invoices to clients) - track incoming payments
 * - incoming: Documents YOU receive (bills from vendors) - track outgoing payments
 */
export type DocumentDirection = "outgoing" | "incoming";

/**
 * Document Type
 * - invoice: Standard invoice
 * - credit_note: Credit/refund
 * - debit_note: Additional charge
 * - receipt: Payment receipt
 */
export type DocumentType = "invoice" | "credit_note" | "debit_note" | "receipt";

// ============================================
// IMPORT TEMPLATE (for CSV/Excel mapping)
// ============================================

export interface ImportTemplateColumn {
  sourceColumn: string;       // Column name or index from file
  targetField: string;        // Our field name
  transform?: ColumnTransform;
  required: boolean;
}

export type ColumnTransform = 
  | { type: "none" }
  | { type: "date"; format: string }       // e.g., "DD/MM/YYYY"
  | { type: "number"; thousandsSep?: string; decimalSep?: string }
  | { type: "currency"; symbol?: string }
  | { type: "split"; delimiter: string; index: number }
  | { type: "regex"; pattern: string; group: number }
  | { type: "map"; mappings: Record<string, string> };

export interface ImportTemplate {
  id: string;
  userId: string;
  orgId?: string;
  
  // Template info
  name: string;
  description?: string;
  direction: DocumentDirection;   // For incoming bills or outgoing invoices
  fileType: "csv" | "xlsx" | "xls";
  
  // Detection patterns (to auto-match this template)
  detectionPatterns?: {
    headerRow?: number;           // Which row has headers (0-based)
    requiredHeaders?: string[];   // Headers that must be present
    vendorPattern?: string;       // Regex to match vendor name in filename
  };
  
  // Column mappings
  columns: ImportTemplateColumn[];
  
  // Default values
  defaults?: {
    currency?: string;
    taxRate?: number;
    paymentTerms?: string;
  };
  
  // Statistics
  usageCount: number;
  lastUsedAt?: Timestamp;
  successRate: number;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isPublic: boolean;             // Share with other users?
}

// Fields that can be mapped from import files
export const IMPORTABLE_FIELDS = {
  // Required
  invoiceNumber: { label: "Invoice Number", required: true },
  total: { label: "Total Amount", required: true },
  invoiceDate: { label: "Invoice Date", required: true },
  
  // Vendor/Customer info
  vendorName: { label: "Vendor/Supplier Name", required: false },
  vendorEmail: { label: "Vendor Email", required: false },
  vendorAddress: { label: "Vendor Address", required: false },
  vendorTaxId: { label: "Vendor Tax ID", required: false },
  customerName: { label: "Customer Name", required: false },
  customerEmail: { label: "Customer Email", required: false },
  
  // Amounts
  subtotal: { label: "Subtotal", required: false },
  taxAmount: { label: "Tax Amount", required: false },
  taxRate: { label: "Tax Rate (%)", required: false },
  discount: { label: "Discount", required: false },
  shippingAmount: { label: "Shipping", required: false },
  currency: { label: "Currency", required: false },
  
  // Dates
  dueDate: { label: "Due Date", required: false },
  paymentDate: { label: "Payment Date", required: false },
  
  // Reference
  purchaseOrder: { label: "PO Number", required: false },
  reference: { label: "Reference", required: false },
  description: { label: "Description/Notes", required: false },
  paymentTerms: { label: "Payment Terms", required: false },
  
  // Status
  paymentStatus: { label: "Payment Status", required: false },
} as const;

export type ImportableField = keyof typeof IMPORTABLE_FIELDS;

// ============================================
// BASE DOCUMENT (shared fields)
// ============================================

export interface BaseDocument {
  id: string;
  userId: string;
  orgId?: string;
  
  // Document classification
  direction: DocumentDirection;
  documentType: DocumentType;
  
  // Source
  source: "upload" | "import" | "api" | "email";
  importTemplateId?: string;
  batchId?: string;              // If part of a bulk import
  
  // File info (for uploaded docs)
  fileName?: string;
  originalFileName?: string;
  fileUrl?: string;
  fileSize?: number;
  fileType?: "pdf" | "csv" | "xlsx" | "image";
  pageCount?: number;
  
  // Status
  status: "draft" | "processing" | "completed" | "needs_review" | "failed";
  createdAt: Timestamp;
  processedAt?: Timestamp;
  
  // Vendor/Customer info
  counterpartyName: string;      // Vendor (for incoming) or Customer (for outgoing)
  counterpartyEmail?: string;
  counterpartyAddress?: string;
  counterpartyTaxId?: string;
  
  // Document identifiers
  documentNumber: string;        // Invoice number, bill number, etc.
  documentDate: Timestamp;
  dueDate?: Timestamp;
  purchaseOrder?: string;
  reference?: string;
  paymentTerms?: string;
  
  // Amounts
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: number;
  shippingAmount?: number;
  total: number;
  currency: string;
  
  // Line items
  lineItemCount: number;
  lineItems?: DocumentLineItem[];
  
  // AI metadata (for uploads)
  confidence?: number;
  needsReview?: boolean;
  warnings?: string[];
  inputTokens?: number;
  outputTokens?: number;
  processingTimeMs?: number;
  
  // Payment tracking
  paymentStatus: "unpaid" | "partial" | "paid" | "overpaid" | "void";
  amountPaid: number;
  amountRemaining: number;
  
  // Reconciliation
  reconciliationStatus: "unmatched" | "matched" | "partial" | "disputed";
  matchedTransactionIds?: string[];
  matchedAt?: Timestamp;
  matchedBy?: string;
  matchConfidence?: number;
  matchMethod?: "auto" | "manual" | "ai_agent";
  
  // Notes
  notes?: string;
  tags?: string[];
}

export interface DocumentLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
  productCode?: string;
  unit?: string;
}

// ============================================
// RECEIVABLES (A/R) - Outgoing Invoices
// ============================================

/**
 * Outgoing Invoice - what you send to clients
 * Match to: INCOMING payments (credits in your bank)
 */
export interface OutgoingInvoice extends BaseDocument {
  direction: "outgoing";
  
  // Customer info (override counterparty naming)
  customerName: string;
  customerEmail?: string;
  customerAddress?: string;
  customerTaxId?: string;
  
  // Your company info
  companyName?: string;
  companyAddress?: string;
  companyTaxId?: string;
  
  // Payment received tracking
  paymentsReceived?: PaymentRecord[];
  lastPaymentDate?: Timestamp;
  
  // Aging
  agingBucket?: "current" | "1-30" | "31-60" | "61-90" | "90+";
  daysOverdue?: number;
}

// ============================================
// PAYABLES (A/P) - Incoming Bills
// ============================================

/**
 * Incoming Bill - what you receive from vendors
 * Match to: OUTGOING payments (debits from your bank)
 */
export interface IncomingBill extends BaseDocument {
  direction: "incoming";
  
  // Vendor info (override counterparty naming)
  vendorName: string;
  vendorEmail?: string;
  vendorAddress?: string;
  vendorTaxId?: string;
  
  // Your company info (as recipient)
  billedToName?: string;
  billedToAddress?: string;
  
  // Payment made tracking
  paymentsMade?: PaymentRecord[];
  scheduledPaymentDate?: Timestamp;
  
  // Approval workflow
  approvalStatus?: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: Timestamp;
  
  // Aging
  agingBucket?: "current" | "1-30" | "31-60" | "61-90" | "90+";
  daysOverdue?: number;
}

// ============================================
// PAYMENT RECORDS
// ============================================

export interface PaymentRecord {
  id: string;
  transactionId: string;
  accountId: string;
  amount: number;
  currency: string;
  date: Timestamp;
  reference?: string;
  method?: "bank_transfer" | "card" | "check" | "cash" | "other";
  notes?: string;
  matchedAt: Timestamp;
  matchedBy: string;
}

// ============================================
// IMPORT BATCH
// ============================================

export interface ImportBatch {
  id: string;
  userId: string;
  orgId?: string;
  
  // Source
  fileName: string;
  fileUrl?: string;
  fileType: "csv" | "xlsx" | "xls";
  direction: DocumentDirection;
  
  // Template used
  templateId?: string;
  templateName?: string;
  
  // Processing status
  status: "uploading" | "mapping" | "processing" | "completed" | "failed";
  totalRows: number;
  processedRows: number;
  successCount: number;
  errorCount: number;
  
  // Errors
  errors?: ImportError[];
  
  // Results
  documentIds?: string[];
  
  // Metadata
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

export interface ImportError {
  row: number;
  field?: string;
  value?: string;
  message: string;
}

// ============================================
// AI FORMAT DETECTION
// ============================================

export interface DetectedFormat {
  // File structure
  headerRow: number;
  dataStartRow: number;
  totalRows: number;
  
  // Detected columns
  columns: DetectedColumn[];
  
  // Sample data (first 5 rows)
  sampleData: Record<string, string>[];
  
  // Confidence
  confidence: number;
  suggestions: string[];
  
  // Matched template (if any)
  matchedTemplateId?: string;
  matchedTemplateName?: string;
  templateConfidence?: number;
}

export interface DetectedColumn {
  index: number;
  header: string;
  suggestedField: ImportableField | null;
  confidence: number;
  sampleValues: string[];
  detectedType: "string" | "number" | "date" | "currency" | "percentage";
}

// ============================================
// RECONCILIATION DIRECTION
// ============================================

export interface ReconciliationContext {
  direction: DocumentDirection;
  
  // For outgoing invoices (A/R)
  // - Look for INCOMING payments (credits)
  // - Match invoices to credits in bank
  
  // For incoming bills (A/P)
  // - Look for OUTGOING payments (debits)
  // - Match bills to debits from bank
  
  transactionType: "credit" | "debit";
  documentType: "invoice" | "bill";
}

export function getReconciliationContext(direction: DocumentDirection): ReconciliationContext {
  if (direction === "outgoing") {
    return {
      direction: "outgoing",
      transactionType: "credit",      // Looking for money coming IN
      documentType: "invoice",
    };
  } else {
    return {
      direction: "incoming",
      transactionType: "debit",       // Looking for money going OUT
      documentType: "bill",
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function calculateAging(dueDate: Date): {
  bucket: "current" | "1-30" | "31-60" | "61-90" | "90+";
  daysOverdue: number;
} {
  const today = new Date();
  const diffTime = today.getTime() - dueDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) {
    return { bucket: "current", daysOverdue: 0 };
  } else if (diffDays <= 30) {
    return { bucket: "1-30", daysOverdue: diffDays };
  } else if (diffDays <= 60) {
    return { bucket: "31-60", daysOverdue: diffDays };
  } else if (diffDays <= 90) {
    return { bucket: "61-90", daysOverdue: diffDays };
  } else {
    return { bucket: "90+", daysOverdue: diffDays };
  }
}

export function formatCurrency(amount: number | undefined | null, currency: string = "USD"): string {
  if (amount === undefined || amount === null || isNaN(amount)) return `${currency} 0.00`;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
