/**
 * Usage Reset Functions
 * Scheduled functions for resetting usage counters
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "../config/firebase";

/**
 * Reset monthly usage counters on the 1st of each month
 */
export const resetMonthlyUsage = onSchedule(
  { schedule: "0 0 1 * *", timeZone: "UTC" },
  async () => {
    console.log("Resetting monthly usage counters...");

    const orgsSnapshot = await db.collection("organizations").get();
    const batch = db.batch();

    orgsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        "usage.currentMonth": {
          statements: 0,
          invoices: 0,
          pages: 0,
          transactions: 0,
          apiCalls: 0,
          tokensUsed: 0,
          cost: 0,
        },
      });
    });

    const usersSnapshot = await db.collection("users").get();
    usersSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        "usage.currentMonth": {
          statements: 0,
          invoices: 0,
          pages: 0,
          transactions: 0,
          apiCalls: 0,
        },
      });
    });

    await batch.commit();
    console.log(`Reset usage for ${orgsSnapshot.size} organizations and ${usersSnapshot.size} users`);
  }
);

