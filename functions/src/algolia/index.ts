/**
 * Algolia Search Integration
 * 
 * Syncs transactions to Algolia for fast full-text search.
 * Triggers on Firestore document changes.
 */

export { 
  onTransactionCreated,
  onTransactionUpdated,
  onTransactionDeleted,
  backfillTransactionsToAlgolia,
} from "./sync";
