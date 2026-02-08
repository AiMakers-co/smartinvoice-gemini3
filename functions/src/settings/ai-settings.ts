/**
 * AI Settings Functions
 * Get and manage AI configuration
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../config/firebase";
import { GEMINI_MODELS, DEFAULT_MODEL } from "../config/ai-models";

/**
 * Get organization's AI settings and available models
 */
export const getAISettings = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const userDoc = await db.doc(`users/${request.auth.uid}`).get();
    const userData = userDoc.data();
    
    if (!userData?.orgId) {
      return {
        provider: "google",
        model: DEFAULT_MODEL,
        allowOverride: true,
        models: Object.keys(GEMINI_MODELS),
      };
    }

    const orgDoc = await db.doc(`organizations/${userData.orgId}`).get();
    const orgData = orgDoc.data();

    return {
      provider: orgData?.settings?.aiProvider || "google",
      model: orgData?.settings?.aiModel || DEFAULT_MODEL,
      allowOverride: orgData?.settings?.allowUserModelOverride || false,
      models: Object.keys(GEMINI_MODELS),
    };
  }
);

/**
 * Update organization's AI settings (admin only)
 */
export const updateAISettings = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { aiModel, allowUserModelOverride } = request.data;
    const userId = request.auth.uid;

    // Get user's org and check permissions
    const userDoc = await db.doc(`users/${userId}`).get();
    const userData = userDoc.data();
    
    if (!userData?.orgId) {
      throw new HttpsError("permission-denied", "No organization found");
    }

    if (!["owner", "admin"].includes(userData.orgRole)) {
      throw new HttpsError("permission-denied", "Admin access required");
    }

    // Validate model
    if (!Object.keys(GEMINI_MODELS).includes(aiModel)) {
      throw new HttpsError("invalid-argument", "Invalid AI model");
    }

    // Update org settings
    await db.doc(`organizations/${userData.orgId}`).update({
      "settings.aiProvider": "google",
      "settings.aiModel": aiModel,
      "settings.allowUserModelOverride": allowUserModelOverride ?? false,
    });

    console.log(`Updated AI settings for org ${userData.orgId}`);

    return { success: true };
  }
);
