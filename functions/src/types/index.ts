/**
 * Shared TypeScript types for Cloud Functions
 */

// ============================================
// USAGE TRACKING
// ============================================

export interface UsageRecordData {
  orgId: string;
  userId: string;
  teamId?: string;
  type: "scan" | "extraction" | "re-extraction" | "api_call" | "export" | "invoice_scan" | "invoice_extraction" | "pdf2sheet_scan" | "pdf2sheet_extraction";
  statementId?: string;
  invoiceId?: string;
  accountId?: string;
  aiProvider: "google" | "anthropic";
  aiModel: string;
  inputTokens: number;
  outputTokens: number;
  pagesProcessed: number;
  transactionsExtracted: number;
  confidence: number;
  status: "success" | "failed" | "needs_review";
  processingTimeMs: number;
  estimatedCost: number;
}

// ============================================
// DOCUMENT SCANNING
// ============================================

export interface SampleTransaction {
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  balance?: number;
}

export interface DocumentScanResult {
  bankName: string;
  bankNameRaw?: string;        // Original bank name before normalization
  bankIdentifier?: string;     // Normalized ID for matching (e.g., "maduro_curiels_bank")
  needsBankIdentification?: boolean;  // True if bank name couldn't be determined
  bankCountry?: string;
  bankBranch?: string;
  accountNumber: string;
  accountType: "checking" | "savings" | "credit" | "investment" | "other";
  accountHolderName?: string;
  currency: string;
  currencies?: string[];
  periodStart?: string;
  periodEnd?: string;
  documentType: "bank_statement" | "credit_card" | "investment" | "unknown";
  pageCount: number;
  openingBalance?: number;
  closingBalance?: number;
  transactionCount?: number;
  sampleTransactions?: SampleTransaction[];
  templateMatch?: { templateId: string; confidence: number };
  // CSV Parsing Rules (for smart CSV extraction)
  csvParsingRulesId?: string;
  csvParsingRulesStatus?: "existing" | "new" | "none";
  csvParsingRules?: any;       // Full rules object if status is "new"
  confidence: number;
  warnings: string[];
  suggestions: string[];
  inputTokens: number;
  outputTokens: number;
}

// ============================================
// TRANSACTION EXTRACTION
// ============================================

export interface TransactionData {
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  balance?: number;
  reference?: string;
  category?: string;
  confidence?: number;
}

export interface ExtractionResult {
  transactions: TransactionData[];
  bankName?: string;
  accountNumber?: string;
  periodStart?: Date;
  periodEnd?: Date;
  openingBalance?: number;
  closingBalance?: number;
  confidence: number;
  needsReview: boolean;
  warnings: string[];
  inputTokens: number;
  outputTokens: number;
}

// ============================================
// INVOICE TYPES
// ============================================

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
  confidence: number;
}

export interface InvoiceScanResult {
  // Document type detection
  detectedType?: "invoice" | "invoice_list" | "line_items" | "bill" | "expense_report" | "purchase_order" | "payment_record" | "vendor_list" | "bank_statement" | "receipt" | "other";
  documentStructure?: "single_invoice" | "invoice_list" | "line_items_list" | "mixed";
  message?: string;
  
  // CSV/Excel file flag
  isCSV?: boolean;
  
  // Summary (for CSV files with multiple records)
  summary?: {
    totalRows?: number;
    totalInvoices?: number;
    totalAmount?: number;
    currencies?: string[];
    dateRange?: {
      earliest?: string;
      latest?: string;
    };
    vendors?: string[];
  };
  
  // Vendor info
  vendorName: string;
  vendorAddress?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorTaxId?: string;
  vendorLogo?: string;

  // Invoice details
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  purchaseOrder?: string;
  paymentTerms?: string;
  status?: string;

  // Amounts
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: number;
  shippingAmount?: number;
  total: number;
  currency: string;
  amountDue?: number;

  // Line items
  lineItems: InvoiceLineItem[];

  // Multiple invoices (for CSV invoice lists) - flexible schema
  invoices?: Array<Record<string, any>>;
  rowCount?: number;

  // Template matching
  templateMatch?: {
    templateId: string;
    vendorName: string;
    confidence: number;
  };

  // CSV parsing rules (for programmatic extraction) - flexible schema
  csvParsingRules?: {
    headerRow: number;
    dataStartRow: number;
    dataEndRow?: number | null;
    columns: Record<string, string>;  // Flexible column mapping
    dateColumns?: string[];
    dateFormat?: string;
    amountColumns?: string[];
    thousandsSeparator?: string | null;
    decimalSeparator?: string;
    currencySymbols?: string[];
    groupByColumn?: string | null;
  };

  // Additional fields discovered by AI (flexible)
  additionalFields?: Record<string, any>;

  // Quality
  confidence: number;
  warnings: string[];
  suggestions: string[];
  pageCount: number;

  // Usage
  inputTokens: number;
  outputTokens: number;
}

// ============================================
// ACCOUNT MATCHING
// ============================================

export interface AccountMatch {
  id: string;
  bankName: string;
  accountNumber: string;
  accountNickname: string;
  confidence: number;
}

// ============================================
// MODEL PREFERENCES
// ============================================

export interface ModelPreference {
  model: string;
  provider: "google" | "anthropic";
}

// ============================================
// PDF2SHEET TYPES
// ============================================

export interface Pdf2SheetHeader {
  name: string;
  type: "string" | "number" | "date" | "currency" | "boolean";
  description?: string;
  example?: string;
}

export interface Pdf2SheetScanResult {
  headers: Pdf2SheetHeader[];
  sampleRows: Record<string, any>[];
  documentType: string;
  supplierName?: string | null;
  documentDate?: string | null;
  documentNumber?: string | null;
  pageCount: number;
  confidence: number;
  isExtractable: boolean;
  warnings: string[];
  suggestions: string[];
  inputTokens: number;
  outputTokens: number;
}

export interface Pdf2SheetExtractResult {
  page: number;
  rows: Record<string, any>[];
  confidence: number;
  warnings: string[];
  inputTokens: number;
  outputTokens: number;
}
