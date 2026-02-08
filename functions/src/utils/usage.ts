/**
 * Usage Tracking Utilities
 * Records and manages AI usage metrics
 */
import { db, FieldValue } from "../config/firebase";
import { UsageRecordData } from "../types";

/**
 * Record a usage event and update counters
 */
export async function recordUsage(data: UsageRecordData): Promise<string> {
  const usageRef = db.collection("usage_records").doc();
  
  await usageRef.set({
    ...data,
    id: usageRef.id,
    timestamp: FieldValue.serverTimestamp(),
  });

  // Update organization usage counters (if org exists)
  if (data.orgId && data.orgId !== "personal") {
    const orgRef = db.doc(`organizations/${data.orgId}`);
    const orgDoc = await orgRef.get();
    
    if (orgDoc.exists) {
      await orgRef.update({
        "usage.currentMonth.statements": FieldValue.increment(
          data.type === "extraction" ? 1 : 0
        ),
        "usage.currentMonth.invoices": FieldValue.increment(
          data.type === "invoice_extraction" ? 1 : 0
        ),
        "usage.currentMonth.pages": FieldValue.increment(data.pagesProcessed),
        "usage.currentMonth.transactions": FieldValue.increment(data.transactionsExtracted),
        "usage.currentMonth.apiCalls": FieldValue.increment(1),
        "usage.currentMonth.tokensUsed": FieldValue.increment(
          data.inputTokens + data.outputTokens
        ),
        "usage.currentMonth.cost": FieldValue.increment(data.estimatedCost),
        "usage.allTime.statements": FieldValue.increment(
          data.type === "extraction" ? 1 : 0
        ),
        "usage.allTime.invoices": FieldValue.increment(
          data.type === "invoice_extraction" ? 1 : 0
        ),
        "usage.allTime.pages": FieldValue.increment(data.pagesProcessed),
        "usage.allTime.transactions": FieldValue.increment(data.transactionsExtracted),
        "usage.allTime.apiCalls": FieldValue.increment(1),
        "usage.allTime.tokensUsed": FieldValue.increment(
          data.inputTokens + data.outputTokens
        ),
        "usage.lastUpdated": FieldValue.serverTimestamp(),
      });
    }
  }

  // Update user usage counters
  const userRef = db.doc(`users/${data.userId}`);
  const userDoc = await userRef.get();
  
  if (userDoc.exists) {
    await userRef.update({
      // Update both old and new field names for compatibility
      "usage.currentMonth.statements": FieldValue.increment(
        data.type === "extraction" ? 1 : 0
      ),
      "usage.currentMonth.invoices": FieldValue.increment(
        data.type === "invoice_extraction" || data.type === "invoice_scan" ? 1 : 0
      ),
      "usage.currentMonth.pages": FieldValue.increment(data.pagesProcessed),
      "usage.currentMonth.transactions": FieldValue.increment(data.transactionsExtracted),
      "usage.currentMonth.apiCalls": FieldValue.increment(1),
      "usage.lastActivity": FieldValue.serverTimestamp(),
      // Frontend reads from subscription.pagesUsedThisMonth
      "subscription.pagesUsedThisMonth": FieldValue.increment(data.pagesProcessed),
    });
  }

  // Update daily aggregate
  const today = new Date().toISOString().split("T")[0];
  const dailyRef = db.doc(`daily_usage/${data.orgId || "personal"}_${today}`);
  
  await dailyRef.set({
    orgId: data.orgId || "personal",
    date: today,
    statements: FieldValue.increment(data.type === "extraction" ? 1 : 0),
    invoices: FieldValue.increment(data.type === "invoice_extraction" ? 1 : 0),
    pages: FieldValue.increment(data.pagesProcessed),
    transactions: FieldValue.increment(data.transactionsExtracted),
    apiCalls: FieldValue.increment(1),
    inputTokens: FieldValue.increment(data.inputTokens),
    outputTokens: FieldValue.increment(data.outputTokens),
    estimatedCost: FieldValue.increment(data.estimatedCost),
    [`byModel.${data.aiModel}.calls`]: FieldValue.increment(1),
    [`byModel.${data.aiModel}.inputTokens`]: FieldValue.increment(data.inputTokens),
    [`byModel.${data.aiModel}.outputTokens`]: FieldValue.increment(data.outputTokens),
    [`byModel.${data.aiModel}.cost`]: FieldValue.increment(data.estimatedCost),
    [`byUser.${data.userId}.statements`]: FieldValue.increment(
      data.type === "extraction" ? 1 : 0
    ),
    [`byUser.${data.userId}.invoices`]: FieldValue.increment(
      data.type === "invoice_extraction" ? 1 : 0
    ),
    [`byUser.${data.userId}.transactions`]: FieldValue.increment(data.transactionsExtracted),
  }, { merge: true });

  return usageRef.id;
}

