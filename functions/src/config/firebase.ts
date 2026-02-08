/**
 * Firebase Admin initialization and shared instances
 */
import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions";

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp();
}

// Export shared instances
export const db = admin.firestore();
export const storage = admin.storage();
export const auth = admin.auth();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;

// Set global options for all functions
setGlobalOptions({ maxInstances: 10, region: "us-central1" });

export { admin };

