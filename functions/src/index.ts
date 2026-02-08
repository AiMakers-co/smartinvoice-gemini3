/**
 * Ormandy Cloud Functions
 * 
 * This file only handles imports and exports.
 * All function logic is organized in separate modules.
 * 
 * Structure:
 * - config/         Configuration (Firebase, AI models)
 * - types/          TypeScript type definitions
 * - utils/          Shared utilities (usage, storage, preferences)
 * - bank-statements/ Bank statement scanning and extraction
 * - invoices/       Invoice scanning and extraction
 * - settings/       AI settings management
 * - usage/          Usage tracking and analytics
 * - templates/      Template learning from corrections
 */

// ============================================
// BANK STATEMENT FUNCTIONS
// ============================================
export {
  scanDocument,
  extractTransactions,
  onExtractTriggered,
  onStatementCreated,
  createAccountFromScan,
  matchAccountFromFile,
  onStatementUpload,
  onStatementDeleted,
  // CSV Parsing Rules
  confirmCSVParsingRules,
  getCSVParsingRules,
  updateCSVParsingRules,
} from "./bank-statements";

// ============================================
// DOCUMENT TYPE IDENTIFICATION
// ============================================
export {
  identifyDocumentType,
} from "./documents/identify-type";

// ============================================
// INVOICE FUNCTIONS
// ============================================
export {
  scanInvoice,
  saveInvoice,
  getInvoices,
  getInvoiceTemplates,
  extractInvoices,
  migrateInvoiceReconciliationFields,
} from "./invoices";

// ============================================
// SETTINGS FUNCTIONS
// ============================================
export {
  getAISettings,
  updateAISettings,
} from "./settings";

// ============================================
// USAGE FUNCTIONS
// ============================================
export {
  getUsageStats,
  getUsageBreakdown,
  resetMonthlyUsage,
} from "./usage";

// ============================================
// TEMPLATE FUNCTIONS
// ============================================
export {
  onCorrectionCreated,
} from "./templates";

// ============================================
// AI ASSISTANT FUNCTIONS
// ============================================
export {
  aiAssistantChat,
  reconciliationChat,
} from "./ai-assistant";

// ============================================
// ADMIN FUNCTIONS
// ============================================
export {
  cleanupOrphanedTransactions,
} from "./admin";

// ============================================
// STRIPE / PAYMENTS FUNCTIONS
// ============================================
export {
  createStripeCustomer,
  createCheckoutSession,
  createPortalSession,
  stripeWebhook,
  updateSubscriptionPlan,
  trackPageUsage,
  getSubscriptionStatus,
  getBillingDetails,
  updateBillingPreferences,
  updateBillingAddress,
} from "./stripe";

// ============================================
// RECONCILIATION FUNCTIONS
// ============================================
export {
  getUnmatchedItems,
  getSuggestionsForTransaction,
  confirmMatchV2,
  categorizeTransactionV2,
  unmatchTransactionV2,
  getReconciliationStatsV2,
  aiMatchTransaction,
  batchAIMatch,
  reconcileAll,
} from "./reconciliation";

// AI Agent for intelligent match investigation
export {
  investigateMatch,
  investigateAllUncertainMatches,
} from "./reconciliation/ai-agent";

// Pattern Memory - learns from matches to improve future accuracy
export {
  learnFromMatch,
  addVendorAlias,
  updateVendorPattern,
  getAllVendorPatterns,
} from "./reconciliation/pattern-memory";

// Test Data Seeding
export {
  seedReconciliationTestData,
  cleanTestData,
} from "./reconciliation/seed-test-data";

// ============================================
// PDF2SHEET FUNCTIONS
// ============================================
export {
  pdf2sheetScan,
  pdf2sheetExtract,
  pdf2sheetBatchExtract,
} from "./pdf2sheet";

// ============================================
// EMAIL / SCHEDULED FUNCTIONS
// ============================================
export {
  checkTrialReminders,
} from "./email/trial-reminders";

// ============================================
// ALGOLIA SEARCH SYNC
// ============================================
export {
  onTransactionCreated,
  onTransactionUpdated,
  onTransactionDeleted,
  backfillTransactionsToAlgolia,
} from "./algolia";
