/**
 * Bank Account Management Functions
 * Create and match bank accounts
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue } from "../config/firebase";
import { getUserOrgId } from "../utils/model-preference";

/**
 * Create a new bank account from scan results
 */
export const createAccountFromScan = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { scanResult, nickname, overrides } = request.data;
    if (!scanResult) {
      throw new HttpsError("invalid-argument", "Scan result required");
    }

    const userId = request.auth.uid;
    const orgId = await getUserOrgId(userId);

    // CRITICAL: Use transaction to prevent race condition duplicates
    // Match on bankName + accountNumber + currency (the true unique identifier)
    const bankName = overrides?.bankName || scanResult.bankName;
    const accountNumber = overrides?.accountNumber || scanResult.accountNumber;
    const currency = overrides?.currency || scanResult.currency;

    // First, check outside transaction (fast path for most cases)
    const existingAccountsQuery = await db.collection("accounts")
      .where("userId", "==", userId)
      .where("bankName", "==", bankName)
      .where("accountNumber", "==", accountNumber)
      .where("currency", "==", currency)
      .where("isArchived", "==", false)
      .limit(1)
      .get();

    if (!existingAccountsQuery.empty) {
      // Account already exists - return the existing account ID
      const existingAccount = existingAccountsQuery.docs[0];
      console.log(`Account already exists: ${existingAccount.id} for user ${userId}`);
      return {
        accountId: existingAccount.id,
        account: existingAccount.data(),
        existed: true,
      };
    }

    // Create a deterministic document ID based on user + bank + account + currency
    // This ensures parallel calls will try to create the SAME document ID
    const deterministicId = `${userId}_${bankName.replace(/\s+/g, "_")}_${accountNumber}_${currency}`.substring(0, 1500);
    const accountRef = db.collection("accounts").doc(deterministicId);

    // Use transaction to atomically check-and-create
    const result = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(accountRef);
      
      if (existing.exists) {
        // Someone else created it in parallel - return existing
        console.log(`Account created by parallel process: ${accountRef.id} for user ${userId}`);
        return {
          accountId: accountRef.id,
          account: existing.data(),
          existed: true,
        };
      }

      // Create account (only if doesn't exist)
      const accountData = {
        id: accountRef.id,
        orgId: orgId || null,
        userId,
        
        bankName,
        bankCountry: overrides?.bankCountry || scanResult.bankCountry,
        bankBranch: scanResult.bankBranch,
        
        accountNumber,
        accountNickname: nickname || `${scanResult.bankName} ****${scanResult.accountNumber}`,
        accountType: overrides?.accountType || scanResult.accountType,
        currency,
        currencies: scanResult.currencies,
        
        templateId: scanResult.templateMatch?.templateId || null,
        
        statementCount: 0,
        transactionCount: 0,
        balance: null,
        
        createdAt: FieldValue.serverTimestamp(),
        isArchived: false,
        detectionConfidence: scanResult.confidence,
      };

      transaction.set(accountRef, accountData);

      console.log(`Created account ${accountRef.id} for user ${userId}`);

      return {
        accountId: accountRef.id,
        account: accountData,
        existed: false,
      };
    });

    return result;
  }
);

/**
 * Match uploaded file to existing accounts
 */
export const matchAccountFromFile = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated");
    }

    const { bankName, accountNumber } = request.data;
    if (!bankName) {
      throw new HttpsError("invalid-argument", "Bank name required");
    }

    const userId = request.auth.uid;

    // Look for matching accounts
    let query = db.collection("accounts")
      .where("userId", "==", userId)
      .where("bankName", "==", bankName)
      .where("isArchived", "==", false);

    if (accountNumber) {
      query = query.where("accountNumber", "==", accountNumber);
    }

    const snapshot = await query.limit(5).get();
    
    const matches = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      confidence: accountNumber && doc.data().accountNumber === accountNumber ? 0.95 : 0.7,
    }));

    return { matches };
  }
);

