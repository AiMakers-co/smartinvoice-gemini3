/**
 * Model Preference Utilities
 * Gets user/org AI model preferences
 */
import { db } from "../config/firebase";
import { DEFAULT_MODEL } from "../config/ai-models";
import { ModelPreference } from "../types";

/**
 * Get the AI model preference for a user, respecting org settings
 */
export async function getUserModelPreference(userId: string): Promise<ModelPreference> {
  const userDoc = await db.doc(`users/${userId}`).get();
  const userData = userDoc.data();
  
  let modelToUse = DEFAULT_MODEL;
  let aiProvider: "google" | "anthropic" = "google";
  
  if (userData?.orgId) {
    const orgDoc = await db.doc(`organizations/${userData.orgId}`).get();
    const orgData = orgDoc.data();
    
    if (orgData?.settings) {
      aiProvider = orgData.settings.aiProvider || "google";
      modelToUse = orgData.settings.aiModel || DEFAULT_MODEL;
      
      // Check if user can override
      if (orgData.settings.allowUserModelOverride && userData?.settings?.preferredAiModel) {
        modelToUse = userData.settings.preferredAiModel;
      }
    }
  }
  
  return { model: modelToUse, provider: aiProvider };
}

/**
 * Get user's organization ID
 */
export async function getUserOrgId(userId: string): Promise<string | null> {
  const userDoc = await db.doc(`users/${userId}`).get();
  const userData = userDoc.data();
  return userData?.orgId || null;
}

