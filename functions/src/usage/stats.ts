/**
 * Usage Statistics Functions
 * Get usage data and analytics
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../config/firebase";

/**
 * Get usage statistics for the organization
 */
export const getUsageStats = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const userDoc = await db.doc(`users/${request.auth.uid}`).get();
    const userData = userDoc.data();
    
    if (!userData?.orgId) {
      return {
        usage: userData?.usage || {},
        settings: {},
        billing: {},
      };
    }

    // Check if user is admin
    if (!["owner", "admin", "developer"].includes(userData.orgRole)) {
      throw new HttpsError("permission-denied", "Admin access required");
    }

    const orgDoc = await db.doc(`organizations/${userData.orgId}`).get();
    const orgData = orgDoc.data();

    return {
      usage: orgData?.usage || {},
      settings: orgData?.settings || {},
      billing: orgData?.billing || {},
    };
  }
);

/**
 * Get detailed usage breakdown
 */
export const getUsageBreakdown = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { startDate, endDate } = request.data || {};
    const userId = request.auth.uid;

    const userDoc = await db.doc(`users/${userId}`).get();
    const userData = userDoc.data();
    
    if (!userData?.orgId) {
      throw new HttpsError("permission-denied", "No organization found");
    }

    if (!["owner", "admin", "developer"].includes(userData.orgRole)) {
      throw new HttpsError("permission-denied", "Admin access required");
    }

    // Query usage records
    let query = db.collection("usage_records")
      .where("orgId", "==", userData.orgId)
      .orderBy("timestamp", "desc");

    if (startDate) {
      query = query.where("timestamp", ">=", new Date(startDate));
    }

    if (endDate) {
      query = query.where("timestamp", "<=", new Date(endDate));
    }

    const snapshot = await query.limit(1000).get();

    const records = snapshot.docs.map(doc => doc.data());

    // Aggregate by model
    const byModel: Record<string, { calls: number; tokens: number; cost: number }> = {};
    const byUser: Record<string, { statements: number; invoices: number; transactions: number }> = {};
    const byType: Record<string, number> = {};

    for (const record of records) {
      // By model
      if (!byModel[record.aiModel]) {
        byModel[record.aiModel] = { calls: 0, tokens: 0, cost: 0 };
      }
      byModel[record.aiModel].calls++;
      byModel[record.aiModel].tokens += (record.inputTokens || 0) + (record.outputTokens || 0);
      byModel[record.aiModel].cost += record.estimatedCost || 0;

      // By user
      if (!byUser[record.userId]) {
        byUser[record.userId] = { statements: 0, invoices: 0, transactions: 0 };
      }
      if (record.type === "extraction") byUser[record.userId].statements++;
      if (record.type === "invoice_extraction") byUser[record.userId].invoices++;
      byUser[record.userId].transactions += record.transactionsExtracted || 0;

      // By type
      byType[record.type] = (byType[record.type] || 0) + 1;
    }

    return {
      totalRecords: records.length,
      byModel,
      byUser,
      byType,
    };
  }
);

