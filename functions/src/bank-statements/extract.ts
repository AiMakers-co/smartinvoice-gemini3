/**
 * Bank Statement Transaction Extraction
 * This callable triggers extraction - actual work is done by Firestore trigger
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../config/firebase";

interface TriggerExtractionResult {
  statementId: string;
  status: "pending_extraction";
  message: string;
}

/**
 * Trigger extraction for a statement
 * Returns immediately - Firestore trigger does the actual work
 */
export const extractTransactions = onCall(
  { cors: true },
  async (request): Promise<TriggerExtractionResult> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { statementId, accountId, fileUrl, mimeType } = request.data;
    
    if (!statementId) {
      throw new HttpsError("invalid-argument", "Statement ID required");
    }
    if (!fileUrl || !accountId) {
      throw new HttpsError("invalid-argument", "File URL and account ID required");
    }

    console.log(`Triggering extraction for statement ${statementId}`);

    // Just update the status - Firestore trigger will do the rest
    await db.doc(`statements/${statementId}`).update({
      status: "pending_extraction",
      accountId,
      fileUrl,
      fileType: mimeType?.includes("pdf") ? "pdf" : "image",
      extractionProgress: 0,
    });

    // Return immediately - no waiting!
    return {
      statementId,
      status: "pending_extraction",
      message: "Extraction started. Listen to statement document for progress updates.",
    };
  }
);

