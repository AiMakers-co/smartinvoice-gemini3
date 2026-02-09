import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";

const MASTER_USER_ID = "demo_coastal_creative_agency";
const MASTER_ORG_ID = "demo_org_coastal_creative";

const COLLECTIONS_TO_CLONE = [
  "accounts",
  "statements",
  "transactions",
  "invoices",
  "bills",
  "vendor_patterns",
  "pdf2sheet_jobs",
  "documents",
];

/** Deep-replace master IDs with session IDs in all string values */
function replaceIds(obj: unknown, sessionUserId: string, sessionOrgId: string): unknown {
  if (typeof obj === "string") {
    return obj
      .replaceAll(MASTER_USER_ID, sessionUserId)
      .replaceAll(MASTER_ORG_ID, sessionOrgId);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => replaceIds(item, sessionUserId, sessionOrgId));
  }
  if (obj !== null && typeof obj === "object") {
    // Preserve Firestore Timestamps and other special objects
    if (obj.constructor && obj.constructor.name !== "Object") {
      return obj;
    }
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = replaceIds(value, sessionUserId, sessionOrgId);
    }
    return result;
  }
  return obj;
}

/**
 * Clone all master demo data to a session-specific namespace.
 * Replaces all userId/orgId/accountId references via string replacement.
 */
export async function cloneDemoData(sessionId: string): Promise<void> {
  const sessionUserId = `demo_${sessionId}`;
  const sessionOrgId = `demo_org_${sessionId}`;

  // Clone user doc
  const userDoc = await getDoc(doc(db, "users", MASTER_USER_ID));
  if (userDoc.exists()) {
    const data = replaceIds(userDoc.data(), sessionUserId, sessionOrgId) as Record<string, unknown>;
    const batch = writeBatch(db);
    batch.set(doc(db, "users", sessionUserId), data);

    // Clone org doc
    const orgDoc = await getDoc(doc(db, "organizations", MASTER_ORG_ID));
    if (orgDoc.exists()) {
      const orgData = replaceIds(orgDoc.data(), sessionUserId, sessionOrgId) as Record<string, unknown>;
      batch.set(doc(db, "organizations", sessionOrgId), orgData);
    }
    await batch.commit();
  }

  // Clone each collection in parallel
  await Promise.all(
    COLLECTIONS_TO_CLONE.map(async (colName) => {
      const snap = await getDocs(
        query(collection(db, colName), where("userId", "==", MASTER_USER_ID))
      );

      if (snap.empty) return;

      // Write in batches of 500 (Firestore limit)
      for (let i = 0; i < snap.docs.length; i += 500) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 500).forEach((d) => {
          const data = replaceIds(d.data(), sessionUserId, sessionOrgId) as Record<string, unknown>;
          // If the doc ID contains the master userId, replace it; otherwise generate new
          const newId = d.id.includes(MASTER_USER_ID)
            ? d.id.replaceAll(MASTER_USER_ID, sessionUserId)
            : undefined;
          const ref = newId
            ? doc(db, colName, newId)
            : doc(collection(db, colName));
          batch.set(ref, data);
        });
        await batch.commit();
      }
    })
  );
}
