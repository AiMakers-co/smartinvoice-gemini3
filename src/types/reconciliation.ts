/**
 * Shared types for AI Reconciliation Agent
 * Used by both frontend components and Firebase functions
 */

// ============================================
// AGENT TYPES
// ============================================

export type DiscrepancyType = 
  | "amount_mismatch" 
  | "vendor_mismatch" 
  | "no_match_found" 
  | "date_anomaly"
  | "currency_mismatch"
  | "partial_payment";

export type AgentStatus = "match_found" | "explanation_found" | "no_resolution" | "needs_human";

export type SuggestedAction = "confirm_match" | "split_payment" | "mark_partial" | "investigate" | "ignore";

export interface AgentQuery {
  invoiceId: string;
  transactionId?: string;
  discrepancyType: DiscrepancyType;
}

export interface MatchedTransaction {
  transactionId: string;
  amount: number;
  description: string;
  contribution: string; // e.g., "Full payment", "Partial - $500 of $1000"
}

export interface RelatedDocument {
  type: "credit_note" | "refund" | "fee" | "fx_adjustment";
  id: string;
  amount: number;
  description: string;
}

export interface AgentResult {
  status: AgentStatus;
  confidence: number;
  explanation: string;
  suggestedAction: SuggestedAction;
  matchedTransactions?: MatchedTransaction[];
  relatedDocuments?: RelatedDocument[];
  reasoning: string[];
  // Usage tracking
  tokensUsed?: number;
  toolCallsCount?: number;
  processingTimeMs?: number;
}

// ============================================
// PATTERN MEMORY TYPES
// ============================================

export interface VendorPattern {
  id?: string;
  userId: string;
  vendorName: string;
  vendorAliases: string[];
  
  // Payment patterns
  paymentProcessor?: string;
  typicalPaymentDelay?: number;
  paymentDelayRange?: { min: number; max: number };
  
  // Amount patterns
  typicalAmountRange?: { min: number; max: number };
  usesRounding?: boolean;
  roundingPrecision?: number;
  
  // Installment patterns
  usesInstallments?: boolean;
  typicalInstallmentCount?: number;
  installmentPattern?: string;
  
  // Currency patterns
  invoiceCurrency?: string;
  paymentCurrency?: string;
  typicalFxMargin?: number;
  
  // Invoice patterns
  invoiceNumberFormat?: string;
  typicalLineItemCount?: number;
  
  // Matching hints
  transactionKeywords: string[];
  
  // Learning metadata
  matchCount: number;
  lastMatchedAt?: Date;
  confidence: number;
  
  // Notes
  notes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchHistory {
  id?: string;
  userId: string;
  vendorName: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceAmount: number;
  invoiceCurrency: string;
  invoiceDate: Date;
  
  transactionId: string;
  transactionAmount: number;
  transactionCurrency: string;
  transactionDate: Date;
  transactionDescription: string;
  
  matchType: "exact" | "partial" | "combined" | "fx_converted";
  amountDifference: number;
  daysDifference: number;
  wasManual: boolean;
  aiConfidence?: number;
  
  matchedAt: Date;
  matchedBy: string;
}

// ============================================
// FX RATE TYPES
// ============================================

export interface FXRate {
  from: string;
  to: string;
  rate: number;
  date: string;
  source: "live" | "cached" | "fallback";
}

// ============================================
// USAGE TRACKING TYPES
// ============================================

export interface AIUsageRecord {
  id?: string;
  userId: string;
  functionName: string;
  tokensUsed: number;
  toolCalls: number;
  processingTimeMs: number;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

// ============================================
// INVOICE FOR INVESTIGATION
// ============================================

export interface InvoiceForInvestigation {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  total: number;
  currency: string;
  invoiceDate: string;
}

export interface SuspectedTransaction {
  id: string;
  description: string;
  amount: number;
  currency: string;
}
