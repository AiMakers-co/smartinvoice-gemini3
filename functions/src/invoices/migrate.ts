/**
 * Invoice Migration Functions
 * 
 * One-time migrations to fix data issues
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../config/firebase";

/**
 * Add missing reconciliation fields to all invoices
 * Sets reconciliationStatus, amountPaid, amountRemaining for invoices missing these fields
 */
export const migrateInvoiceReconciliationFields = onCall(
  { 
    cors: true, 
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const userId = request.auth.uid;
    console.log(`Running invoice migration for user ${userId}`);

    try {
      // Get all invoices for this user that are missing reconciliationStatus
      const invoicesQuery = await db.collection("invoices")
        .where("userId", "==", userId)
        .get();

      console.log(`Found ${invoicesQuery.size} total invoices`);

      let updatedCount = 0;
      let skippedCount = 0;
      const BATCH_SIZE = 400;
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of invoicesQuery.docs) {
        const data = doc.data();
        
        // Skip if already has reconciliationStatus
        if (data.reconciliationStatus) {
          skippedCount++;
          continue;
        }

        // Determine values
        const total = data.total || data.amountDue || 0;
        const isPaid = data.paymentStatus === "paid";
        
        const updates: Record<string, any> = {
          reconciliationStatus: isPaid ? "matched" : "unmatched",
          amountPaid: data.amountPaid ?? (isPaid ? total : 0),
          amountRemaining: data.amountRemaining ?? (isPaid ? 0 : total),
        };

        // Also ensure amountDue is set
        if (data.amountDue === undefined) {
          updates.amountDue = isPaid ? 0 : total;
        }

        batch.update(doc.ref, updates);
        batchCount++;
        updatedCount++;

        // Commit batch if full
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`Committed batch of ${batchCount} updates`);
          batch = db.batch();
          batchCount = 0;
        }
      }

      // Commit remaining
      if (batchCount > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${batchCount} updates`);
      }

      console.log(`Migration complete: ${updatedCount} updated, ${skippedCount} skipped`);

      return {
        success: true,
        totalInvoices: invoicesQuery.size,
        updatedCount,
        skippedCount,
        message: `Updated ${updatedCount} invoices with reconciliation fields`,
      };

    } catch (error) {
      console.error("Migration error:", error);
      throw new HttpsError("internal", `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
);
