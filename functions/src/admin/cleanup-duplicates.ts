/**
 * Admin Function - Cleanup Duplicate Transactions
 * Deletes all transactions associated with a deleted/duplicate statement
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue } from "../config/firebase";

interface CleanupResult {
  statementId: string;
  transactionsDeleted: number;
  accountsUpdated: number;
}

/**
 * Cleanup orphaned transactions from a deleted statement
 * Use this after deleting duplicate statements
 */
export const cleanupOrphanedTransactions = onCall(
  { cors: true },
  async (request): Promise<CleanupResult> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { statementId } = request.data;
    
    if (!statementId) {
      throw new HttpsError("invalid-argument", "Statement ID required");
    }

    console.log(`Cleaning up orphaned transactions for statement ${statementId}`);

    try {
      // Find all transactions for this statement
      const transactionsQuery = await db.collection("transactions")
        .where("statementId", "==", statementId)
        .get();

      if (transactionsQuery.empty) {
        return {
          statementId,
          transactionsDeleted: 0,
          accountsUpdated: 0,
        };
      }

      console.log(`Found ${transactionsQuery.size} orphaned transactions`);

      // Group by accountId to update stats
      const accountUpdates: Record<string, number> = {};
      transactionsQuery.docs.forEach(doc => {
        const data = doc.data();
        const accountId = data.accountId;
        if (accountId) {
          accountUpdates[accountId] = (accountUpdates[accountId] || 0) + 1;
        }
      });

      // Delete transactions in batches (Firestore limit is 500 per batch)
      const batchSize = 500;
      const batches: FirebaseFirestore.WriteBatch[] = [];
      let currentBatch = db.batch();
      let operationCount = 0;

      for (const doc of transactionsQuery.docs) {
        currentBatch.delete(doc.ref);
        operationCount++;

        if (operationCount === batchSize) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          operationCount = 0;
        }
      }

      // Add the last batch if it has operations
      if (operationCount > 0) {
        batches.push(currentBatch);
      }

      // Commit all batches
      for (const batch of batches) {
        await batch.commit();
      }

      console.log(`Deleted ${transactionsQuery.size} transactions in ${batches.length} batch(es)`);

      // Update account stats
      const accountPromises = Object.entries(accountUpdates).map(([accountId, count]) =>
        db.collection("accounts").doc(accountId).update({
          transactionCount: FieldValue.increment(-count),
        })
      );

      await Promise.all(accountPromises);
      console.log(`Updated ${accountPromises.length} account(s)`);

      return {
        statementId,
        transactionsDeleted: transactionsQuery.size,
        accountsUpdated: accountPromises.length,
      };

    } catch (error) {
      console.error("Cleanup error:", error);
      throw new HttpsError("internal", `Cleanup failed: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  }
);

