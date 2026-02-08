/**
 * Storage Trigger for Bank Statements
 * Automatic processing when files are uploaded
 */
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { db } from "../config/firebase";
import { getBucketName } from "../utils/storage";

/**
 * Trigger when a statement file is uploaded to Cloud Storage
 * This is for automatic processing flow
 */
export const onStatementUpload = onObjectFinalized(
  { bucket: getBucketName() },
  async (event) => {
    const filePath = event.data.name;
    
    if (!filePath?.startsWith("statements/")) {
      console.log("Not a statement file, skipping:", filePath);
      return;
    }

    const pathParts = filePath.split("/");
    if (pathParts.length < 4) {
      console.log("Invalid path format:", filePath);
      return;
    }

    const userId = pathParts[1];
    const statementId = pathParts[2];

    console.log(`Auto-processing statement ${statementId} for user ${userId}`);

    // Just update status - actual processing is done via callable function
    await db.doc(`statements/${statementId}`).update({
      status: "scanning",
      fileUrl: `https://storage.googleapis.com/${event.bucket}/${filePath}`,
    });
  }
);

