/**
 * Statement Delete Trigger
 * Automatically delete all associated transactions when a statement is deleted
 */
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { db, FieldValue } from "../config/firebase";

/**
 * Cascade delete: When a statement is deleted, delete all its transactions
 */
export const onStatementDeleted = onDocumentDeleted(
  {
    document: "statements/{statementId}",
    timeoutSeconds: 60,
  },
  async (event) => {
    const statementId = event.params.statementId;
    const statementData = event.data?.data();

    if (!statementData) {
      console.log(`No data for deleted statement ${statementId}`);
      return;
    }

    console.log(`Cascade deleting transactions for statement ${statementId}`);

    const { accountId } = statementData;

    try {
      // Find all transactions for this statement
      const transactionsQuery = await db.collection("transactions")
        .where("statementId", "==", statementId)
        .get();

      if (transactionsQuery.empty) {
        console.log(`No transactions found for statement ${statementId}`);
        return;
      }

      console.log(`Found ${transactionsQuery.size} transactions to delete`);

      // Delete in batches (Firestore limit: 500 operations per batch)
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

      if (operationCount > 0) {
        batches.push(currentBatch);
      }

      // Commit all batches
      for (const batch of batches) {
        await batch.commit();
      }

      console.log(`Deleted ${transactionsQuery.size} transactions in ${batches.length} batch(es)`);

      // Update account stats
      if (accountId) {
        await db.collection("accounts").doc(accountId).update({
          transactionCount: FieldValue.increment(-transactionsQuery.size),
          statementCount: FieldValue.increment(-1),
        });
        console.log(`Updated account ${accountId} stats`);
      }

      console.log(`Cascade delete complete for statement ${statementId}`);
    } catch (error) {
      console.error(`Error cascading delete for statement ${statementId}:`, error);
    }
  }
);

