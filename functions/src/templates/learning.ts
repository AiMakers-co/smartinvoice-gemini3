/**
 * Template Learning Functions
 * Learn from user corrections to improve extraction
 */
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db, FieldValue } from "../config/firebase";

/**
 * Learn from corrections to improve templates
 */
export const onCorrectionCreated = onDocumentCreated(
  "corrections/{correctionId}",
  async (event) => {
    const correction = event.data?.data();
    if (!correction) return;

    const { statementId, invoiceId, originalData, correctedData, templateId } = correction;

    if (templateId) {
      // Determine template collection
      const collection = invoiceId ? "invoice_templates" : "templates";
      const templateRef = db.doc(`${collection}/${templateId}`);
      const templateDoc = await templateRef.get();
      
      if (templateDoc.exists) {
        const template = templateDoc.data();
        const corrections = template?.corrections || [];
        
        corrections.push({
          id: event.params.correctionId,
          statementId,
          invoiceId,
          originalData,
          correctedData,
          correctedAt: FieldValue.serverTimestamp(),
        });

        // Update success rate
        const successCount = template?.successCount || 0;
        const failureCount = (template?.failureCount || 0) + 1;
        const successRate = successCount / (successCount + failureCount);

        await templateRef.update({
          corrections: corrections.slice(-100), // Keep last 100 corrections
          failureCount: FieldValue.increment(1),
          successRate,
          lastImproved: FieldValue.serverTimestamp(),
        });
      }
    }

    const docType = invoiceId ? "invoice" : "statement";
    console.log(`Processed correction for ${docType} ${statementId || invoiceId}`);
  }
);

/**
 * Mark a template extraction as successful
 */
export const recordTemplateSuccess = async (templateId: string, collection: string = "templates") => {
  const templateRef = db.doc(`${collection}/${templateId}`);
  const templateDoc = await templateRef.get();
  
  if (templateDoc.exists) {
    const template = templateDoc.data();
    const successCount = (template?.successCount || 0) + 1;
    const failureCount = template?.failureCount || 0;
    const successRate = successCount / (successCount + failureCount);

    await templateRef.update({
      successCount: FieldValue.increment(1),
      successRate,
      lastUsed: FieldValue.serverTimestamp(),
      usageCount: FieldValue.increment(1),
    });
  }
};

