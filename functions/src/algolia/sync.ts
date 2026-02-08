/**
 * Algolia Transaction Sync
 * 
 * Firestore triggers to keep Algolia index in sync with transactions collection.
 */

import { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { algoliasearch } from "algoliasearch";
import { db } from "../config/firebase";
import { algoliaAdminKey } from "../shared/secrets";

// Algolia configuration
const ALGOLIA_APP_ID = "HPQCAAP6CP";
const TRANSACTIONS_INDEX = "transactions";

// Create Algolia client (lazy initialization)
let algoliaClient: ReturnType<typeof algoliasearch> | null = null;

function getAlgoliaClient(adminKey: string) {
  if (!algoliaClient) {
    algoliaClient = algoliasearch(ALGOLIA_APP_ID, adminKey);
  }
  return algoliaClient;
}

// Transform Firestore transaction to Algolia record
interface FirestoreTransaction {
  description?: string;
  amount?: number;
  type?: "credit" | "debit";
  date?: FirebaseFirestore.Timestamp;
  balance?: number;
  currency?: string;
  category?: string;
  reference?: string;
  merchant?: string;
  accountId?: string;
  statementId?: string;
  userId?: string;
  confidence?: number;
  needsReview?: boolean;
  reconciled?: boolean;
  reconciledInvoiceId?: string;
}

function transformTransaction(id: string, data: FirestoreTransaction) {
  return {
    objectID: id,
    description: data.description || "",
    amount: data.amount || 0,
    type: data.type || "debit",
    // Convert Firestore Timestamp to Unix timestamp for Algolia
    date: data.date ? {
      _seconds: data.date.seconds,
      _nanoseconds: data.date.nanoseconds,
    } : null,
    balance: data.balance,
    currency: data.currency || "USD",
    category: data.category || null,
    reference: data.reference || null,
    merchant: data.merchant || null,
    accountId: data.accountId || null,
    statementId: data.statementId || null,
    userId: data.userId || null,
    confidence: data.confidence || 1,
    needsReview: data.needsReview || false,
    reconciled: data.reconciled || false,
    reconciledInvoiceId: data.reconciledInvoiceId || null,
  };
}

/**
 * Sync new transaction to Algolia
 */
export const onTransactionCreated = onDocumentCreated(
  {
    document: "transactions/{transactionId}",
    secrets: [algoliaAdminKey],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data in transaction create event");
      return;
    }

    const transactionId = event.params.transactionId;
    const data = snapshot.data() as FirestoreTransaction;

    console.log(`Indexing new transaction ${transactionId} to Algolia`);

    try {
      const client = getAlgoliaClient(algoliaAdminKey.value());
      const record = transformTransaction(transactionId, data);

      await client.saveObject({
        indexName: TRANSACTIONS_INDEX,
        body: record,
      });

      console.log(`Successfully indexed transaction ${transactionId}`);
    } catch (error) {
      console.error(`Failed to index transaction ${transactionId}:`, error);
      // Don't throw - we don't want to fail the Firestore write
    }
  }
);

/**
 * Update transaction in Algolia when modified
 */
export const onTransactionUpdated = onDocumentUpdated(
  {
    document: "transactions/{transactionId}",
    secrets: [algoliaAdminKey],
  },
  async (event) => {
    const afterSnapshot = event.data?.after;
    if (!afterSnapshot) {
      console.log("No data in transaction update event");
      return;
    }

    const transactionId = event.params.transactionId;
    const data = afterSnapshot.data() as FirestoreTransaction;

    console.log(`Updating transaction ${transactionId} in Algolia`);

    try {
      const client = getAlgoliaClient(algoliaAdminKey.value());
      const record = transformTransaction(transactionId, data);

      await client.saveObject({
        indexName: TRANSACTIONS_INDEX,
        body: record,
      });

      console.log(`Successfully updated transaction ${transactionId}`);
    } catch (error) {
      console.error(`Failed to update transaction ${transactionId}:`, error);
    }
  }
);

/**
 * Delete transaction from Algolia when removed
 */
export const onTransactionDeleted = onDocumentDeleted(
  {
    document: "transactions/{transactionId}",
    secrets: [algoliaAdminKey],
  },
  async (event) => {
    const transactionId = event.params.transactionId;

    console.log(`Deleting transaction ${transactionId} from Algolia`);

    try {
      const client = getAlgoliaClient(algoliaAdminKey.value());

      await client.deleteObject({
        indexName: TRANSACTIONS_INDEX,
        objectID: transactionId,
      });

      console.log(`Successfully deleted transaction ${transactionId}`);
    } catch (error) {
      console.error(`Failed to delete transaction ${transactionId}:`, error);
    }
  }
);

/**
 * Backfill all existing transactions to Algolia
 * Admin-only callable function
 */
export const backfillTransactionsToAlgolia = onCall(
  {
    cors: true,
    secrets: [algoliaAdminKey],
    timeoutSeconds: 540, // 9 minutes for large backfills
    memory: "1GiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    // Optional: Add admin check here
    // const userId = request.auth.uid;

    console.log("Starting Algolia backfill for all transactions");

    const client = getAlgoliaClient(algoliaAdminKey.value());
    const batchSize = 1000;
    let totalIndexed = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    try {
      // First, configure the index settings
      await client.setSettings({
        indexName: TRANSACTIONS_INDEX,
        indexSettings: {
          searchableAttributes: [
            "description",
            "merchant",
            "reference",
            "category",
          ],
          attributesForFaceting: [
            "filterOnly(userId)",
            "filterOnly(accountId)",
            "filterOnly(type)",
            "filterOnly(currency)",
            "filterOnly(reconciled)",
            "category",
          ],
          attributesToRetrieve: [
            "objectID",
            "description",
            "amount",
            "type",
            "date",
            "balance",
            "currency",
            "category",
            "reference",
            "merchant",
            "accountId",
            "statementId",
            "userId",
            "confidence",
            "needsReview",
          ],
          // Ranking for relevance
          ranking: [
            "typo",
            "geo",
            "words",
            "filters",
            "proximity",
            "attribute",
            "exact",
            "custom",
          ],
        },
      });
      console.log("Index settings configured");

      // Process in batches
      while (true) {
        let query = db.collection("transactions")
          .orderBy("date", "desc")
          .limit(batchSize);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
          break;
        }

        const records = snapshot.docs.map(doc => 
          transformTransaction(doc.id, doc.data() as FirestoreTransaction)
        );

        // Batch save to Algolia
        await client.saveObjects({
          indexName: TRANSACTIONS_INDEX,
          objects: records,
        });

        totalIndexed += records.length;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        console.log(`Indexed ${totalIndexed} transactions so far...`);

        // Check if we got less than batch size (last batch)
        if (snapshot.docs.length < batchSize) {
          break;
        }
      }

      console.log(`Backfill complete. Total indexed: ${totalIndexed}`);

      return {
        success: true,
        totalIndexed,
        message: `Successfully indexed ${totalIndexed} transactions to Algolia`,
      };
    } catch (error) {
      console.error("Backfill failed:", error);
      throw new HttpsError("internal", `Backfill failed: ${error}`);
    }
  }
);
