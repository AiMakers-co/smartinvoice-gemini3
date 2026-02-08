import { Timestamp } from "firebase/firestore";

// ============================================
// ORGANIZATION & TEAM TYPES
// ============================================

export type UserRole = "owner" | "admin" | "developer" | "member";

export interface Organization {
  id: string;
  name: string;
  slug: string; // URL-friendly name
  logo?: string;
  createdAt: Timestamp;
  createdBy: string;
  settings: OrganizationSettings;
  billing: BillingInfo;
  usage: UsageSummary;
}

export interface OrganizationSettings {
  // AI Configuration (admin-controlled)
  aiProvider: "google" | "anthropic";
  aiModel: string;
  allowUserModelOverride: boolean; // Can users pick their own model?
  
  // Limits
  maxUsersPerTeam: number;
  maxTeams: number;
  maxStatementsPerMonth: number;
  maxPagesPerStatement: number;
  
  // Features
  enableTemplateSharing: boolean;
  enableExport: boolean;
  enableApi: boolean;
  
  // Extraction settings
  confidenceThreshold: number;
  autoApproveThreshold: number;
}

export interface BillingInfo {
  plan: "free" | "starter" | "professional" | "enterprise";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  billingEmail: string;
  billingCycle: "monthly" | "annual";
  currentPeriodStart?: Timestamp;
  currentPeriodEnd?: Timestamp;
}

export interface UsageSummary {
  currentMonth: {
    statements: number;
    pages: number;
    transactions: number;
    apiCalls: number;
    tokensUsed: number;
    cost: number;
  };
  allTime: {
    statements: number;
    pages: number;
    transactions: number;
    apiCalls: number;
    tokensUsed: number;
  };
  lastUpdated: Timestamp;
}

export interface Team {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  createdAt: Timestamp;
  createdBy: string;
  memberCount: number;
  settings: TeamSettings;
}

export interface TeamSettings {
  // Can override org settings if allowed
  aiModelOverride?: string;
  defaultExportFormat: "csv" | "xlsx";
}

export interface TeamMember {
  id: string;
  orgId: string;
  teamId: string;
  userId: string;
  role: "lead" | "member";
  addedAt: Timestamp;
  addedBy: string;
}

// ============================================
// USER TYPES
// ============================================

export interface UserSubscription {
  status: "free" | "active" | "trialing" | "past_due" | "canceled" | "incomplete";
  planId: string;
  plan?: string;
  priceId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: Timestamp;
  currentPeriodEnd?: Timestamp;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: Timestamp;
  pagesUsedThisMonth: number;
  pagesLimit: number;
  overagePerPage?: number;
  amount?: number;
  billingCycle?: "monthly" | "annual";
  updatedAt?: Timestamp;
}

// Auth provider types for tracking sign-in methods
export type AuthProvider = "email" | "google";

export interface AuthProviderInfo {
  provider: AuthProvider;
  linkedAt: Timestamp;
  lastUsedAt?: Timestamp;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: Timestamp;
  lastLoginAt?: Timestamp;
  
  // Company identity — used by AI to determine invoice direction (A/R vs A/P)
  companyName?: string;
  companyAliases?: string[]; // Other names found on bank statements, trade names, etc.
  
  // Authentication providers
  authProviders?: AuthProviderInfo[];
  lastAuthProvider?: AuthProvider;
  
  // Organization membership
  orgId?: string;
  orgRole: UserRole;
  teamIds: string[];
  
  // Personal settings
  settings: UserSettings;
  
  // Usage tracking
  usage: UserUsage;
  
  // Subscription (user-level billing)
  stripeCustomerId?: string;
  subscriptionStatus?: string;
  subscription?: UserSubscription;
}

export interface UserSettings {
  // Personal preferences (may be overridden by org)
  preferredAiModel?: string; // Only used if org allows override
  defaultExportFormat: "csv" | "xlsx";
  theme: "light" | "dark" | "system";
  
  // Notifications
  emailNotifications: boolean;
  processingAlerts: boolean;
}

export interface UserUsage {
  currentMonth: {
    statements: number;
    pages: number;
    transactions: number;
    apiCalls: number;
  };
  lastActivity: Timestamp;
}

// ============================================
// USAGE TRACKING TYPES
// ============================================

export interface UsageRecord {
  id: string;
  orgId: string;
  userId: string;
  teamId?: string;
  
  // What was used
  type: "extraction" | "re-extraction" | "api_call" | "export";
  
  // Resource details
  statementId?: string;
  accountId?: string;
  
  // AI usage
  aiProvider: "google" | "anthropic";
  aiModel: string;
  inputTokens: number;
  outputTokens: number;
  
  // Results
  pagesProcessed: number;
  transactionsExtracted: number;
  confidence: number;
  status: "success" | "failed" | "needs_review";
  
  // Timing
  processingTimeMs: number;
  timestamp: Timestamp;
  
  // Cost calculation
  estimatedCost: number;
}

export interface DailyUsageAggregate {
  id: string; // orgId_YYYY-MM-DD
  orgId: string;
  date: string; // YYYY-MM-DD
  
  statements: number;
  pages: number;
  transactions: number;
  apiCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  
  // By model breakdown
  byModel: {
    [modelId: string]: {
      calls: number;
      inputTokens: number;
      outputTokens: number;
      cost: number;
    };
  };
  
  // By user breakdown
  byUser: {
    [userId: string]: {
      statements: number;
      transactions: number;
    };
  };
}

// ============================================
// AI MODEL TYPES
// ============================================

export interface AIModel {
  id: string;
  name: string;
  provider: "google" | "anthropic";
  tier: "flagship" | "pro" | "fast";
  description: string;
  contextWindow: number;
  supportsVision: boolean;
  releaseDate: string;
  recommended?: boolean;
  pricing: {
    input: number;  // per million tokens
    output: number; // per million tokens
  };
  available: boolean; // Can be toggled by super admin
}

export const AI_MODELS: AIModel[] = [
  // Google AI - Gemini Models (January 2026)
  {
    id: "gemini-3-pro",
    name: "Gemini 3 Pro",
    provider: "google",
    tier: "flagship",
    description: "Latest flagship model. Multimodal with advanced reasoning, vision, and 1M token context.",
    contextWindow: 1000000,
    supportsVision: true,
    releaseDate: "Nov 18, 2025",
    recommended: true,
    pricing: { input: 2, output: 12 },
    available: true,
  },
  {
    id: "gemini-3-pro-preview",
    name: "Gemini 3 Pro Preview",
    provider: "google",
    tier: "flagship",
    description: "Preview version with experimental features. May have cutting-edge capabilities.",
    contextWindow: 1000000,
    supportsVision: true,
    releaseDate: "Nov 2025",
    pricing: { input: 2, output: 12 },
    available: true,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    tier: "pro",
    description: "Production-stable with excellent reasoning. Proven reliability for document extraction.",
    contextWindow: 1000000,
    supportsVision: true,
    releaseDate: "Jun 2025",
    pricing: { input: 1.25, output: 5 },
    available: true,
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    tier: "fast",
    description: "Optimized for speed and cost. Great for high-volume batch processing.",
    contextWindow: 1000000,
    supportsVision: true,
    releaseDate: "Jun 2025",
    pricing: { input: 0.075, output: 0.30 },
    available: true,
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    tier: "fast",
    description: "Fast and efficient baseline for simple extraction tasks.",
    contextWindow: 1000000,
    supportsVision: true,
    releaseDate: "Dec 2024",
    pricing: { input: 0.075, output: 0.30 },
    available: true,
  },
  
];

export const getModelsByProvider = (provider: string = "google") => 
  AI_MODELS.filter(m => m.provider === provider && m.available);

export const getModelById = (id: string) => 
  AI_MODELS.find(m => m.id === id);

export const getRecommendedModel = (provider: string = "google") =>
  AI_MODELS.find(m => m.provider === provider && m.recommended && m.available) || 
  AI_MODELS.find(m => m.provider === provider && m.available);

export const getDefaultModel = () => "gemini-3-flash";

export const calculateCost = (model: AIModel, inputTokens: number, outputTokens: number) => {
  const inputCost = (inputTokens / 1000000) * model.pricing.input;
  const outputCost = (outputTokens / 1000000) * model.pricing.output;
  return inputCost + outputCost;
};

// ============================================
// BANK ACCOUNT & STATEMENT TYPES
// ============================================

export interface BankAccount {
  id: string;
  orgId?: string;
  userId: string;
  teamId?: string;
  
  // Bank info (AI-detected)
  bankName: string;
  bankLogo?: string;
  bankCountry?: string;
  bankBranch?: string;
  
  // Account info
  accountNumber: string; // Last 4 digits only
  accountNickname: string;
  accountType: "checking" | "savings" | "credit" | "investment" | "other";
  currency: string;
  currencies?: string[]; // For multi-currency accounts
  
  // Template link for future matching
  templateId?: string;
  
  // Aggregated stats
  statementCount: number;
  transactionCount: number;
  balance?: number; // Latest known balance
  oldestTransaction?: Timestamp;
  newestTransaction?: Timestamp;
  lastStatementDate?: Timestamp;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  isArchived: boolean;
  
  // AI detection confidence
  detectionConfidence?: number;
}

export interface Statement {
  id: string;
  orgId?: string;
  userId: string;
  accountId: string;
  
  // File info
  fileName: string;
  originalFileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: "pdf" | "csv" | "xlsx" | "image";
  pageCount: number;
  
  // Status
  uploadedAt: Timestamp;
  processedAt?: Timestamp;
  status: "uploading" | "scanning" | "processing" | "completed" | "needs_review" | "failed";
  
  // Extracted data
  transactionCount: number;
  periodStart?: Timestamp;
  periodEnd?: Timestamp;
  openingBalance?: number;
  closingBalance?: number;
  currency?: string;
  bankName?: string;
  accountNumber?: string;
  createdAt?: Timestamp;
  
  // Extraction details
  extractionModel: string;
  templateId?: string;
  confidence?: number;
  errorMessage?: string;
  warnings?: string[];
  
  // Usage tracking reference
  usageRecordId?: string;
}

export interface Transaction {
  id: string;
  orgId?: string;
  userId: string;
  accountId: string;
  statementId: string;
  
  // Core transaction data
  date: Timestamp;
  description: string; // FULL description, never truncated
  descriptionOriginal?: string; // Original as scanned
  amount: number;
  type: "debit" | "credit";
  balance?: number; // Running balance if available
  
  // Extended info
  reference?: string;
  category?: string;
  merchant?: string;
  currency?: string;
  
  // Search & filter
  searchText: string; // Lowercase searchable text
  month: string; // YYYY-MM for filtering
  
  // AI metadata
  confidence?: number;
  needsReview?: boolean;
  
  createdAt: Timestamp;
  
  // ============================================
  // RECONCILIATION FIELDS
  // ============================================
  
  // Status: unmatched → suggested → matched OR categorized
  reconciliationStatus?: "unmatched" | "suggested" | "matched" | "categorized";
  
  // If matched to a document (bill or invoice)
  matchedDocumentId?: string;
  matchedDocumentType?: "bill" | "invoice";
  matchedDocumentNumber?: string;
  matchedAt?: Timestamp;
  matchedBy?: string;
  matchConfidence?: number;
  matchMethod?: "auto" | "ai_suggested" | "manual";
  
  // If split across multiple documents
  allocations?: PaymentAllocation[];
  
  // If categorized (not a bill/invoice payment)
  categoryConfirmedAt?: Timestamp;
  categoryConfirmedBy?: string;
}

// Payment allocation for split payments
export interface PaymentAllocation {
  documentId: string;
  documentType: "bill" | "invoice";
  documentNumber: string;
  amount: number;  // How much of this transaction applies to this document
  allocatedAt: Timestamp;
  allocatedBy: string;
}

// ============================================
// DOCUMENT SCAN RESULT (for account detection)
// ============================================

export interface DocumentScanResult {
  // Bank identification
  bankName: string;
  bankCountry?: string;
  bankBranch?: string;
  bankLogo?: string;
  
  // Account identification
  accountNumber: string; // Last 4 digits
  accountType: "checking" | "savings" | "credit" | "investment" | "other";
  accountHolderName?: string;
  
  // Currency
  currency: string;
  currencies?: string[];
  
  // Statement period
  periodStart?: string; // YYYY-MM-DD
  periodEnd?: string;
  
  // Document info
  documentType: "bank_statement" | "credit_card" | "investment" | "unknown";
  pageCount: number;
  
  // Template matching
  templateMatch?: {
    templateId: string;
    confidence: number;
  };
  
  // AI metrics
  confidence: number;
  warnings: string[];
  suggestions: string[];
  
  // Usage
  inputTokens: number;
  outputTokens: number;
}

// ============================================
// TEMPLATE TYPES
// ============================================

export interface Template {
  id: string;
  orgId?: string; // null = global template
  
  // Bank identification
  bankName: string;
  bankCountry?: string;
  templateName: string;
  bankLogo?: string;
  
  // Matching patterns
  fingerprint: string; // Unique hash for this bank/format combination
  identifiers: string[]; // Text patterns to identify this format
  layoutSignature: string; // Visual layout identifier
  
  // Sample for reference
  sampleImageUrl: string;
  sampleFileType: "pdf" | "csv" | "xlsx" | "image";
  
  // Extraction schema
  schema: ExtractionSchema;
  
  // Learning from corrections
  examples: TemplateExample[];
  corrections: TemplateCorrection[];
  
  // Statistics
  usageCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageConfidence: number;
  lastUsed?: Timestamp;
  lastImproved?: Timestamp;
  
  // Visibility
  visibility: "global" | "organization" | "private";
  createdBy: string;
  createdAt: Timestamp;
}

export interface ExtractionSchema {
  // Document structure
  headerRow?: number;
  dataStartRow?: number;
  
  // Column definitions (for tabular data)
  dateColumn?: { index: number; format: string; header?: string };
  descriptionColumn?: { index: number; header?: string };
  amountColumn?: { index: number; header?: string };
  debitColumn?: { index: number; header?: string };
  creditColumn?: { index: number; header?: string };
  balanceColumn?: { index: number; header?: string };
  referenceColumn?: { index: number; header?: string };
  
  // Format hints
  hasRunningBalance: boolean;
  hasSeparateDebitCredit: boolean;
  dateFormat: string; // e.g., "DD/MM/YYYY", "MM-DD-YYYY"
  amountFormat: "signed" | "unsigned"; // signed: -100 for debit, unsigned: uses columns
  thousandsSeparator?: string;
  decimalSeparator?: string;
  
  // Multi-currency support
  hasCurrencyColumn: boolean;
  defaultCurrency?: string;
}

export interface TemplateExample {
  imageUrl: string;
  pageNumber: number;
  extractedData: Partial<Transaction>[];
  addedAt: Timestamp;
}

export interface TemplateCorrection {
  id: string;
  statementId: string;
  originalData: Partial<Transaction>[];
  correctedData: Partial<Transaction>[];
  correctedBy: string;
  correctedAt: Timestamp;
  improvementNotes?: string;
}

// ============================================
// INVITATION TYPES
// ============================================

export interface Invitation {
  id: string;
  orgId: string;
  teamId?: string;
  
  email: string;
  role: UserRole;
  
  invitedBy: string;
  invitedAt: Timestamp;
  expiresAt: Timestamp;
  
  status: "pending" | "accepted" | "expired" | "revoked";
  acceptedAt?: Timestamp;
  acceptedBy?: string;
}

// ============================================
// AUDIT LOG TYPES
// ============================================

export interface AuditLog {
  id: string;
  orgId: string;
  userId: string;
  
  action: AuditAction;
  resource: string;
  resourceId: string;
  
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  
  timestamp: Timestamp;
}

export type AuditAction = 
  | "user.login"
  | "user.logout"
  | "user.invite"
  | "user.remove"
  | "user.role_change"
  | "team.create"
  | "team.update"
  | "team.delete"
  | "settings.update"
  | "model.change"
  | "statement.upload"
  | "statement.process"
  | "statement.delete"
  | "export.create"
  | "api_key.create"
  | "api_key.revoke";

// ============================================
// API KEY TYPES (for developer access)
// ============================================

export interface ApiKey {
  id: string;
  orgId: string;
  userId: string;
  
  name: string;
  keyHash: string; // Hashed API key
  keyPrefix: string; // First 8 chars for identification
  
  permissions: ApiPermission[];
  rateLimit: number; // Requests per minute
  
  createdAt: Timestamp;
  lastUsedAt?: Timestamp;
  expiresAt?: Timestamp;
  
  isActive: boolean;
}

export type ApiPermission = 
  | "statements:read"
  | "statements:write"
  | "transactions:read"
  | "transactions:write"
  | "accounts:read"
  | "accounts:write"
  | "templates:read"
  | "usage:read";

// ============================================
// HELPER TYPES
// ============================================

export interface ExtractionResult {
  // Extracted transactions
  transactions: ExtractedTransaction[];
  transactionCount?: number; // Used when transactions are saved directly to Firestore
  
  // Statement metadata
  bankName?: string;
  accountNumber?: string;
  periodStart?: Date;
  periodEnd?: Date;
  openingBalance?: number;
  closingBalance?: number;
  
  // Quality metrics
  confidence: number;
  needsReview: boolean;
  warnings: string[];
  
  // Template matching
  templateMatch?: {
    templateId: string;
    confidence: number;
  };
  
  // Usage metrics (optional - only set when returned from function)
  inputTokens?: number;
  outputTokens?: number;
  processingTimeMs?: number;
}

export interface ExtractedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: "debit" | "credit";
  balance?: number;
  reference?: string;
  category?: string;
  confidence?: number;
}

// ============================================
// UPLOAD FLOW TYPES
// ============================================

export type UploadStep = 
  | "select_file"      // User selecting file
  | "scanning"         // AI scanning document
  | "confirm_account"  // User confirming detected account
  | "processing"       // Extracting transactions
  | "review"           // Review extracted data
  | "complete";        // Done

export interface UploadState {
  step: UploadStep;
  file?: File;
  fileUrl?: string;
  
  // Scan results
  scanResult?: DocumentScanResult;
  
  // Account (existing or new)
  existingAccountId?: string;
  newAccountData?: Partial<BankAccount>;
  
  // Processing
  statementId?: string;
  extractionResult?: ExtractionResult;
  
  // Errors
  error?: string;
}

// Account with computed stats for display
export interface AccountWithStats extends BankAccount {
  recentStatements?: Statement[];
  monthlyTotals?: {
    month: string;
    credits: number;
    debits: number;
    net: number;
  }[];
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
  taxAmount?: number;
}

export interface Invoice {
  id: string;
  orgId?: string;
  userId: string;
  
  // File info
  fileName: string;
  originalFileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: "pdf" | "image";
  pageCount: number;
  
  // Status
  createdAt: Timestamp;
  processedAt?: Timestamp;
  status: "uploading" | "scanning" | "processing" | "completed" | "needs_review" | "failed";
  
  // Vendor info
  vendorName: string;
  vendorAddress?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  vendorTaxId?: string;
  
  // Invoice details
  invoiceNumber: string;
  invoiceDate: Timestamp;
  dueDate?: Timestamp;
  purchaseOrder?: string;
  paymentTerms?: string;
  
  // Line items
  lineItems?: InvoiceLineItem[]; // Optional - may be stored separately
  lineItemCount: number; // Count of line items
  
  // Amounts
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: number | null;
  shippingAmount?: number | null;
  total: number; // Total amount (backend field name)
  totalAmount?: number; // Alias for compatibility
  amountDue?: number;
  currency: string;
  
  // Customer info (optional)
  customerName?: string;
  customerAddress?: string;
  
  // AI metadata
  confidence: number;
  needsReview: boolean;
  warnings: string[];
  
  // Usage tracking
  inputTokens: number;
  outputTokens: number;
  processingTimeMs: number;
  usageRecordId?: string;
  
  // Reconciliation
  reconciliationStatus: "unmatched" | "matched" | "partial" | "disputed";
  matchedTransactionId?: string;
  matchedTransactionIds?: string[]; // For partial matches (multiple payments)
  matchedAt?: Timestamp;
  matchedBy?: string; // userId who confirmed the match
  matchConfidence?: number; // AI confidence in the match
  matchMethod?: "auto" | "manual" | "ai_suggested";
  paymentStatus?: "unpaid" | "paid" | "partial" | "overpaid";
  amountPaid?: number;
  amountRemaining?: number;
}

// ============================================
// RECONCILIATION TYPES
// ============================================

// Linked payment record - stored on bills/invoices
export interface LinkedPayment {
  transactionId: string;
  transactionDate: Timestamp;
  transactionDescription: string;
  amount: number;  // How much of this payment applies to this document
  linkedAt: Timestamp;
  linkedBy: string;
  confidence: number;
  method: "auto" | "ai_suggested" | "manual";
}

// Match record - stored in reconciliation_matches collection
export interface ReconciliationMatch {
  id: string;
  orgId?: string;
  userId: string;
  
  // Transaction side
  transactionId: string;
  transactionDate: Timestamp;
  transactionAmount: number;
  transactionDescription: string;
  transactionType: "credit" | "debit";
  accountId: string;
  
  // Document side (can be bill OR invoice)
  documentId: string;
  documentType: "bill" | "invoice";
  documentNumber: string;
  documentAmount: number;
  counterpartyName: string;  // Vendor (for bills) or Customer (for invoices)
  
  // Match details
  matchType: "exact" | "partial" | "fee_adjusted" | "split";
  allocationAmount: number;  // If split, how much was allocated
  confidence: number;
  matchMethod: "auto" | "ai_suggested" | "manual";
  
  // Matching signals (for learning)
  signals?: {
    amountMatch: boolean;
    nameMatch: boolean;
    referenceMatch: boolean;
    dateProximity: number;  // days
    feePatternDetected?: string;  // "stripe_2.9" etc.
  };
  
  // AI details (if applicable)
  aiSuggestionId?: string;
  aiReasoning?: string;
  
  // Status
  status: "pending" | "confirmed" | "rejected";
  confirmedAt?: Timestamp;
  confirmedBy?: string;
  rejectedAt?: Timestamp;
  rejectedBy?: string;
  rejectionReason?: string;
  
  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Suggestion for UI display
export interface ReconciliationSuggestion {
  // Document info
  documentId: string;
  documentType: "bill" | "invoice";
  documentNumber: string;
  documentAmount: number;
  counterpartyName: string;
  documentDate: Timestamp;
  dueDate?: Timestamp;
  
  // Transaction info
  transactionId: string;
  transactionAmount: number;
  transactionDate: Timestamp;
  transactionDescription: string;
  
  // Match analysis
  confidence: number;
  matchType: "exact" | "partial" | "fee_adjusted" | "split";
  reasons: string[];
  warnings: string[];
  
  // Differences
  amountDifference: number;
  dateDifference: number;  // days between invoice/bill date and transaction
  
  // Fee detection
  feePatternDetected?: string;
  originalAmountBeforeFees?: number;
}

// Role permissions helper
export const ROLE_PERMISSIONS = {
  owner: ["all"],
  admin: [
    "users.manage", "teams.manage", "settings.manage", "models.manage",
    "usage.view", "billing.view", "audit.view", "api_keys.manage",
    "statements.all", "accounts.all", "templates.all", "export.all"
  ],
  developer: [
    "api_keys.manage", "usage.view",
    "statements.all", "accounts.all", "templates.all", "export.all"
  ],
  member: [
    "statements.own", "accounts.own", "templates.read", "export.own"
  ],
} as const;

export const canUserAccess = (role: UserRole, permission: string): boolean => {
  const permissions = ROLE_PERMISSIONS[role] as readonly string[];
  return permissions.includes("all") || permissions.includes(permission);
};
