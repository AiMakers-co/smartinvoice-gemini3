/**
 * Reconciliation Functions
 * 
 * AI-POWERED matching of bank transactions to bills and invoices
 * 
 * Architecture:
 * 1. Quick rule-based pass for obvious matches (95%+ confidence)
 * 2. AI investigation for uncertain matches (Gemini 3 Flash)
 * 3. Learning from user confirmations/rejections
 * 
 * The AI can:
 * - Fetch live FX rates for cross-currency matching
 * - Search for payment combinations (multiple transactions → 1 invoice)
 * - Search for invoice combinations (1 transaction → multiple invoices)
 * - Learn vendor patterns over time
 * - Explain its reasoning
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { db } from "../shared/firebase";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { geminiApiKey } from "../config/ai-models";
import { runReconciliation } from "./reconcile-engine";
import { getVendorPatterns } from "./pattern-memory";

// Types are now defined locally in each section or imported from ./matcher

// ============================================
// NEW: GET UNMATCHED ITEMS (V2)
// ============================================

import {
  Document as MatchDocument,
  Transaction as MatchTransaction,
  findMatchesForTransaction,
} from "./matcher";

// Extended types for Firestore documents with reconciliation fields
interface TransactionDoc {
  id: string;
  userId: string;
  accountId: string;
  date: Timestamp;
  description: string;
  amount: number;
  type: "debit" | "credit";
  currency?: string;
  reconciliationStatus?: string;
  matchedDocumentId?: string;
  [key: string]: any;
}

interface BillDoc {
  id: string;
  userId: string;
  documentNumber: string;
  vendorName: string;
  documentDate: Timestamp;
  dueDate?: Timestamp;
  total: number;
  amountRemaining: number;
  currency: string;
  paymentStatus: string;
  [key: string]: any;
}

interface InvoiceDoc {
  id: string;
  userId: string;
  invoiceNumber?: string;
  documentNumber?: string;
  customerName?: string;
  vendorName?: string;
  invoiceDate?: Timestamp;
  documentDate?: Timestamp;
  dueDate?: Timestamp;
  total: number;
  amountRemaining?: number;
  currency: string;
  paymentStatus?: string;
  [key: string]: any;
}

export const getUnmatchedItems = onCall(
  {
    cors: true,
  },
  async (request) => {
    const userId = request.auth?.uid;
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    try {
      // Get all transactions (last 180 days)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
      
      const [transactionsSnap, billsSnap, invoicesSnap] = await Promise.all([
        db.collection("transactions")
          .where("userId", "==", userId)
          .where("date", ">=", Timestamp.fromDate(sixMonthsAgo))
          .orderBy("date", "desc")
          .get(),
        db.collection("bills")
          .where("userId", "==", userId)
          .get(),
        db.collection("invoices")
          .where("userId", "==", userId)
          .get(),
      ]);
      
      // Process transactions
      const allTransactions: TransactionDoc[] = transactionsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as TransactionDoc));
      
      const unmatchedTransactions = allTransactions.filter(tx => 
        !tx.reconciliationStatus || 
        tx.reconciliationStatus === "unmatched" ||
        tx.reconciliationStatus === "suggested"
      );
      
      const matchedTransactions = allTransactions.filter(tx => 
        tx.reconciliationStatus === "matched" || 
        tx.reconciliationStatus === "categorized"
      );
      
      // Process bills
      const bills: BillDoc[] = billsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BillDoc));
      
      const unpaidBills = bills.filter(b => 
        b.paymentStatus === "unpaid" || 
        b.paymentStatus === "partial" ||
        !b.paymentStatus
      );
      
      // Process invoices
      const invoices: InvoiceDoc[] = invoicesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as InvoiceDoc));
      
      const unpaidInvoices = invoices.filter(inv => 
        inv.paymentStatus === "unpaid" || 
        inv.paymentStatus === "partial" ||
        !inv.paymentStatus
      );
      
      // Calculate totals
      const totalCredits = unmatchedTransactions
        .filter(tx => tx.type === "credit")
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      
      const totalDebits = unmatchedTransactions
        .filter(tx => tx.type === "debit")
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      
      const totalUnpaidBills = unpaidBills
        .reduce((sum, b) => sum + (b.amountRemaining || b.total || 0), 0);
      
      const totalUnpaidInvoices = unpaidInvoices
        .reduce((sum, inv) => sum + (inv.amountRemaining || inv.total || 0), 0);
      
      logger.info("Got unmatched items", {
        userId,
        totalTransactions: allTransactions.length,
        unmatchedTransactions: unmatchedTransactions.length,
        unpaidBills: unpaidBills.length,
        unpaidInvoices: unpaidInvoices.length,
      });
      
      return {
        transactions: {
          total: allTransactions.length,
          unmatched: unmatchedTransactions.length,
          matched: matchedTransactions.length,
          matchRate: allTransactions.length > 0 
            ? Math.round((matchedTransactions.length / allTransactions.length) * 100) 
            : 0,
          items: unmatchedTransactions.slice(0, 100).map(tx => ({
            id: tx.id,
            date: tx.date?.toDate?.() || tx.date,
            description: tx.description,
            amount: tx.amount,
            type: tx.type,
            currency: tx.currency,
            accountId: tx.accountId,
            reconciliationStatus: tx.reconciliationStatus || "unmatched",
          })),
          totalUnmatchedCredits: totalCredits,
          totalUnmatchedDebits: totalDebits,
        },
        bills: {
          total: bills.length,
          unpaid: unpaidBills.length,
          items: unpaidBills.slice(0, 50).map(b => ({
            id: b.id,
            documentNumber: b.documentNumber,
            vendorName: b.vendorName,
            total: b.total,
            amountRemaining: b.amountRemaining || b.total,
            currency: b.currency,
            documentDate: b.documentDate?.toDate?.() || b.documentDate,
            dueDate: b.dueDate?.toDate?.() || b.dueDate,
            paymentStatus: b.paymentStatus || "unpaid",
          })),
          totalUnpaid: totalUnpaidBills,
        },
        invoices: {
          total: invoices.length,
          unpaid: unpaidInvoices.length,
          items: unpaidInvoices.slice(0, 50).map(inv => ({
            id: inv.id,
            documentNumber: inv.invoiceNumber || inv.documentNumber,
            customerName: inv.customerName || inv.vendorName,
            total: inv.total,
            amountRemaining: inv.amountRemaining || inv.total,
            currency: inv.currency,
            documentDate: inv.invoiceDate?.toDate?.() || inv.documentDate?.toDate?.(),
            dueDate: inv.dueDate?.toDate?.(),
            paymentStatus: inv.paymentStatus || "unpaid",
          })),
          totalUnpaid: totalUnpaidInvoices,
        },
      };
    } catch (error: any) {
      logger.error("Error getting unmatched items", { error: error.message, userId });
      throw new HttpsError("internal", error.message);
    }
  }
);

// ============================================
// NEW: GET SUGGESTIONS FOR TRANSACTION (V2)
// ============================================

export const getSuggestionsForTransaction = onCall(
  {
    cors: true,
  },
  async (request) => {
    const { transactionId } = request.data;
    const userId = request.auth?.uid;
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    if (!transactionId) {
      throw new HttpsError("invalid-argument", "Transaction ID required");
    }
    
    try {
      // Get the transaction
      const txDoc = await db.collection("transactions").doc(transactionId).get();
      if (!txDoc.exists || txDoc.data()?.userId !== userId) {
        throw new HttpsError("not-found", "Transaction not found");
      }
      
      const transaction: MatchTransaction = {
        id: txDoc.id,
        ...txDoc.data() as any,
      };
      
      // Get bills and invoices based on transaction type
      // Credits → invoices, Debits → bills
      const relevantCollection = transaction.type === "credit" ? "invoices" : "bills";
      
      const docsSnap = await db.collection(relevantCollection)
        .where("userId", "==", userId)
        .get();
      
      // Transform to MatchDocument format
      const documents: MatchDocument[] = docsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          documentType: relevantCollection === "invoices" ? "invoice" : "bill",
          documentNumber: data.invoiceNumber || data.documentNumber || "Unknown",
          counterpartyName: data.customerName || data.vendorName || "Unknown",
          documentDate: data.invoiceDate || data.documentDate,
          dueDate: data.dueDate,
          total: data.total || 0,
          amountRemaining: data.amountRemaining ?? data.total ?? 0,
          currency: data.currency || "USD",
          paymentStatus: data.paymentStatus || "unpaid",
          reconciliationStatus: data.reconciliationStatus || "unmatched",
        };
      });
      
      // Get all transaction amounts for context scoring
      const allTxSnap = await db.collection("transactions")
        .where("userId", "==", userId)
        .where("type", "==", transaction.type)
        .limit(100)
        .get();
      
      const allAmounts = allTxSnap.docs.map(d => d.data().amount);
      
      // Find matches
      const candidates = findMatchesForTransaction(transaction, documents, allAmounts);
      
      logger.info("Generated suggestions for transaction", {
        userId,
        transactionId,
        transactionType: transaction.type,
        candidateCount: candidates.length,
        topConfidence: candidates[0]?.confidence,
      });
      
      return {
        transaction: {
          id: transaction.id,
          date: transaction.date?.toDate?.() || transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          type: transaction.type,
          currency: transaction.currency,
        },
        suggestions: candidates.slice(0, 5).map(c => ({
          documentId: c.document.id,
          documentType: c.document.documentType,
          documentNumber: c.document.documentNumber,
          counterpartyName: c.document.counterpartyName,
          documentAmount: c.document.amountRemaining,
          documentDate: c.document.documentDate?.toDate?.() || c.document.documentDate,
          dueDate: c.document.dueDate?.toDate?.() || c.document.dueDate,
          currency: c.document.currency,
          confidence: c.confidence,
          matchType: c.matchType,
          reasons: c.reasons,
          warnings: c.warnings,
          signals: c.signals,
        })),
        stats: {
          documentsAnalyzed: documents.length,
          suggestionsFound: candidates.length,
        },
      };
    } catch (error: any) {
      logger.error("Error getting suggestions", { error: error.message, userId, transactionId });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message);
    }
  }
);

// ============================================
// NEW: CONFIRM MATCH (V2) - Works with bills AND invoices
// ============================================

export const confirmMatchV2 = onCall(
  {
    cors: true,
  },
  async (request) => {
    const { transactionId, documentId, documentType, allocationAmount } = request.data;
    const userId = request.auth?.uid;
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    if (!transactionId || !documentId || !documentType) {
      throw new HttpsError("invalid-argument", "Transaction ID, Document ID, and Document Type required");
    }
    
    if (!["bill", "invoice"].includes(documentType)) {
      throw new HttpsError("invalid-argument", "Document type must be 'bill' or 'invoice'");
    }
    
    try {
      const collection = documentType === "bill" ? "bills" : "invoices";
      
      // Get transaction and document
      const [txDoc, docDoc] = await Promise.all([
        db.collection("transactions").doc(transactionId).get(),
        db.collection(collection).doc(documentId).get(),
      ]);
      
      if (!txDoc.exists || txDoc.data()?.userId !== userId) {
        throw new HttpsError("not-found", "Transaction not found");
      }
      
      if (!docDoc.exists || docDoc.data()?.userId !== userId) {
        throw new HttpsError("not-found", `${documentType} not found`);
      }
      
      const tx = txDoc.data()!;
      const doc = docDoc.data()!;
      
      // Calculate amounts
      const txAmount = Math.abs(tx.amount);
      const docTotal = doc.total || 0;
      const docRemaining = doc.amountRemaining ?? docTotal;
      const amountToAllocate = allocationAmount ?? Math.min(txAmount, docRemaining);
      
      // Determine payment status
      const newAmountPaid = (doc.amountPaid || 0) + amountToAllocate;
      const newAmountRemaining = docTotal - newAmountPaid;
      
      let paymentStatus: string;
      if (newAmountRemaining <= 0.01) {
        paymentStatus = newAmountRemaining < -0.01 ? "overpaid" : "paid";
      } else if (newAmountPaid > 0) {
        paymentStatus = "partial";
      } else {
        paymentStatus = "unpaid";
      }
      
      const now = Timestamp.now();
      
      // Create linked payment record
      const linkedPayment = {
        transactionId,
        transactionDate: tx.date,
        transactionDescription: tx.description,
        amount: amountToAllocate,
        linkedAt: now,
        linkedBy: userId,
        confidence: 100,
        method: "manual",
      };
      
      // Update document
      await db.collection(collection).doc(documentId).update({
        paymentStatus,
        amountPaid: newAmountPaid,
        amountRemaining: Math.max(0, newAmountRemaining),
        reconciliationStatus: paymentStatus === "paid" ? "matched" : "partial",
        payments: FieldValue.arrayUnion(linkedPayment),
        updatedAt: now,
      });
      
      // Update transaction
      await db.collection("transactions").doc(transactionId).update({
        reconciliationStatus: "matched",
        matchedDocumentId: documentId,
        matchedDocumentType: documentType,
        matchedDocumentNumber: doc.invoiceNumber || doc.documentNumber,
        matchedAt: now,
        matchedBy: userId,
        matchConfidence: 100,
        matchMethod: "manual",
      });
      
      // Create match record
      await db.collection("reconciliation_matches").add({
        userId,
        transactionId,
        transactionDate: tx.date,
        transactionAmount: txAmount,
        transactionDescription: tx.description,
        transactionType: tx.type,
        accountId: tx.accountId,
        documentId,
        documentType,
        documentNumber: doc.invoiceNumber || doc.documentNumber,
        documentAmount: docTotal,
        counterpartyName: doc.customerName || doc.vendorName,
        matchType: Math.abs(txAmount - docRemaining) < 0.01 ? "exact" : "partial",
        allocationAmount: amountToAllocate,
        confidence: 100,
        matchMethod: "manual",
        status: "confirmed",
        confirmedAt: now,
        confirmedBy: userId,
        createdAt: now,
        updatedAt: now,
      });
      
      // ---- LEARNING: Feed pattern memory ----
      try {
        const vendorName = doc.customerName || doc.vendorName || "Unknown";
        const invoiceDate = doc.invoiceDate?.toDate?.() || doc.documentDate?.toDate?.() || new Date();
        const transactionDate = tx.date?.toDate?.() || new Date();
        const daysDifference = Math.abs(Math.floor((transactionDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        // Record to match_history
        await db.collection("match_history").add({
          userId,
          vendorName,
          invoiceId: documentId,
          invoiceNumber: doc.invoiceNumber || doc.documentNumber || "",
          invoiceAmount: docTotal,
          invoiceCurrency: doc.currency || "USD",
          invoiceDate: doc.invoiceDate || doc.documentDate || Timestamp.now(),
          transactionId,
          transactionAmount: txAmount,
          transactionCurrency: tx.currency || "USD",
          transactionDate: tx.date || Timestamp.now(),
          transactionDescription: tx.description || "",
          matchType: Math.abs(txAmount - docRemaining) < 0.01 ? "exact" : "partial",
          amountDifference: Math.abs(txAmount - docRemaining),
          daysDifference,
          wasManual: true,
          aiConfidence: request.data.matchConfidence || 100,
          matchedAt: now,
          matchedBy: userId,
        });
        
        // Update or create vendor pattern
        const existingPatterns = await getVendorPatterns(userId, vendorName);
        const keywords = (tx.description || "").toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((w: string) => w.length > 2).slice(0, 10);
        
        if (existingPatterns.length > 0) {
          const p = existingPatterns[0];
          const newCount = (p.matchCount || 0) + 1;
          const newDelay = ((p.typicalPaymentDelay || 0) * (p.matchCount || 0) + daysDifference) / newCount;
          const allKw = [...(p.transactionKeywords || []), ...keywords];
          const kwCounts = allKw.reduce((acc: Record<string, number>, kw: string) => { acc[kw] = (acc[kw] || 0) + 1; return acc; }, {} as Record<string, number>);
          const topKw = Object.entries(kwCounts).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 15).map(([kw]) => kw);
          
          await db.collection("vendor_patterns").doc(p.id!).update({
            transactionKeywords: topKw,
            matchCount: newCount,
            lastMatchedAt: now,
            typicalPaymentDelay: Math.round(newDelay * 10) / 10,
            paymentDelayRange: {
              min: Math.min(p.paymentDelayRange?.min ?? daysDifference, daysDifference),
              max: Math.max(p.paymentDelayRange?.max ?? daysDifference, daysDifference),
            },
            confidence: Math.min(100, (p.confidence || 50) + 5),
            updatedAt: now,
          });
        } else {
          await db.collection("vendor_patterns").add({
            userId,
            vendorName,
            vendorAliases: [],
            transactionKeywords: keywords,
            matchCount: 1,
            lastMatchedAt: now,
            typicalPaymentDelay: daysDifference,
            paymentDelayRange: { min: daysDifference, max: daysDifference },
            confidence: 70,
            createdAt: now,
            updatedAt: now,
          });
        }
        
        logger.info("Pattern learned from manual match", { userId, vendorName });
      } catch (learnError: any) {
        // Non-critical — log but don't fail the match confirmation
        logger.warn("Learning failed (non-critical)", { error: learnError.message });
      }
      // ---- END LEARNING ----
      
      logger.info("Match confirmed", {
        userId,
        transactionId,
        documentId,
        documentType,
        amountAllocated: amountToAllocate,
        newPaymentStatus: paymentStatus,
      });
      
      return {
        success: true,
        paymentStatus,
        amountAllocated: amountToAllocate,
        amountRemaining: newAmountRemaining,
      };
    } catch (error: any) {
      logger.error("Error confirming match", { error: error.message, userId, transactionId, documentId });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message);
    }
  }
);

// ============================================
// NEW: CATEGORIZE TRANSACTION (non-document)
// ============================================

export const categorizeTransactionV2 = onCall(
  {
    cors: true,
  },
  async (request) => {
    const { transactionId, category } = request.data;
    const userId = request.auth?.uid;
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    if (!transactionId || !category) {
      throw new HttpsError("invalid-argument", "Transaction ID and category required");
    }
    
    const validCategories = [
      "bank_fees",
      "transfer",
      "subscription",
      "interest",
      "refund",
      "payroll",
      "tax",
      "other",
    ];
    
    if (!validCategories.includes(category)) {
      throw new HttpsError("invalid-argument", `Invalid category. Must be one of: ${validCategories.join(", ")}`);
    }
    
    try {
      const txDoc = await db.collection("transactions").doc(transactionId).get();
      
      if (!txDoc.exists || txDoc.data()?.userId !== userId) {
        throw new HttpsError("not-found", "Transaction not found");
      }
      
      const now = Timestamp.now();
      
      await db.collection("transactions").doc(transactionId).update({
        reconciliationStatus: "categorized",
        category,
        categoryConfirmedAt: now,
        categoryConfirmedBy: userId,
      });
      
      logger.info("Transaction categorized", {
        userId,
        transactionId,
        category,
      });
      
      return { success: true, category };
    } catch (error: any) {
      logger.error("Error categorizing transaction", { error: error.message, userId, transactionId });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message);
    }
  }
);

// ============================================
// NEW: UNMATCH TRANSACTION
// ============================================

export const unmatchTransactionV2 = onCall(
  {
    cors: true,
  },
  async (request) => {
    const { transactionId } = request.data;
    const userId = request.auth?.uid;
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    if (!transactionId) {
      throw new HttpsError("invalid-argument", "Transaction ID required");
    }
    
    try {
      const txDoc = await db.collection("transactions").doc(transactionId).get();
      
      if (!txDoc.exists || txDoc.data()?.userId !== userId) {
        throw new HttpsError("not-found", "Transaction not found");
      }
      
      const tx = txDoc.data()!;
      const documentId = tx.matchedDocumentId;
      const documentType = tx.matchedDocumentType;
      
      // Reset transaction
      await db.collection("transactions").doc(transactionId).update({
        reconciliationStatus: "unmatched",
        matchedDocumentId: FieldValue.delete(),
        matchedDocumentType: FieldValue.delete(),
        matchedDocumentNumber: FieldValue.delete(),
        matchedAt: FieldValue.delete(),
        matchedBy: FieldValue.delete(),
        matchConfidence: FieldValue.delete(),
        matchMethod: FieldValue.delete(),
        category: FieldValue.delete(),
        categoryConfirmedAt: FieldValue.delete(),
        categoryConfirmedBy: FieldValue.delete(),
      });
      
      // If was matched to a document, update that too
      if (documentId && documentType) {
        const collection = documentType === "bill" ? "bills" : "invoices";
        const docDoc = await db.collection(collection).doc(documentId).get();
        
        if (docDoc.exists) {
          const doc = docDoc.data()!;
          const payments = doc.payments || [];
          
          // Remove this transaction from payments
          const updatedPayments = payments.filter((p: any) => p.transactionId !== transactionId);
          const removedPayment = payments.find((p: any) => p.transactionId === transactionId);
          
          const newAmountPaid = (doc.amountPaid || 0) - (removedPayment?.amount || 0);
          const newAmountRemaining = (doc.total || 0) - newAmountPaid;
          
          let paymentStatus = "unpaid";
          if (newAmountPaid > 0 && newAmountRemaining > 0.01) {
            paymentStatus = "partial";
          } else if (newAmountRemaining <= 0.01) {
            paymentStatus = "paid";
          }
          
          await db.collection(collection).doc(documentId).update({
            payments: updatedPayments,
            amountPaid: Math.max(0, newAmountPaid),
            amountRemaining: newAmountRemaining,
            paymentStatus,
            reconciliationStatus: paymentStatus === "paid" ? "matched" : "unmatched",
            updatedAt: Timestamp.now(),
          });
        }
      }
      
      logger.info("Transaction unmatched", {
        userId,
        transactionId,
        previousDocumentId: documentId,
      });
      
      return { success: true };
    } catch (error: any) {
      logger.error("Error unmatching transaction", { error: error.message, userId, transactionId });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message);
    }
  }
);

// ============================================
// NEW: GET FULL RECONCILIATION STATS (V2)
// ============================================

export const getReconciliationStatsV2 = onCall(
  {
    cors: true,
  },
  async (request) => {
    const userId = request.auth?.uid;
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    try {
      // Get counts from all collections
      const [transactionsSnap, billsSnap, invoicesSnap] = await Promise.all([
        db.collection("transactions").where("userId", "==", userId).get(),
        db.collection("bills").where("userId", "==", userId).get(),
        db.collection("invoices").where("userId", "==", userId).get(),
      ]);
      
      // Process transactions
      const transactions = transactionsSnap.docs.map(d => d.data() as TransactionDoc);
      const unmatchedTx = transactions.filter(t => 
        !t.reconciliationStatus || t.reconciliationStatus === "unmatched"
      );
      const matchedTx = transactions.filter(t => t.reconciliationStatus === "matched");
      const categorizedTx = transactions.filter(t => t.reconciliationStatus === "categorized");
      const suggestedTx = transactions.filter(t => t.reconciliationStatus === "suggested");
      
      // Process bills
      const bills = billsSnap.docs.map(d => d.data() as BillDoc);
      const unpaidBills = bills.filter(b => !b.paymentStatus || b.paymentStatus === "unpaid");
      const partialBills = bills.filter(b => b.paymentStatus === "partial");
      const paidBills = bills.filter(b => b.paymentStatus === "paid");
      
      const totalBillsAmount = bills.reduce((sum, b) => sum + (b.total || 0), 0);
      const unpaidBillsAmount = unpaidBills.reduce((sum, b) => sum + (b.amountRemaining || b.total || 0), 0);
      
      // Process invoices
      const invoices = invoicesSnap.docs.map(d => d.data() as InvoiceDoc);
      const unpaidInvoices = invoices.filter(i => !i.paymentStatus || i.paymentStatus === "unpaid");
      const partialInvoices = invoices.filter(i => i.paymentStatus === "partial");
      const paidInvoices = invoices.filter(i => i.paymentStatus === "paid");
      
      const totalInvoicesAmount = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
      const unpaidInvoicesAmount = unpaidInvoices.reduce((sum, i) => sum + (i.amountRemaining || i.total || 0), 0);
      
      // Calculate match rate
      const totalItems = transactions.length;
      const reconciledItems = matchedTx.length + categorizedTx.length;
      const matchRate = totalItems > 0 ? Math.round((reconciledItems / totalItems) * 100) : 100;
      
      logger.info("Got reconciliation stats v2", {
        userId,
        totalTransactions: transactions.length,
        matchRate,
      });
      
      return {
        transactions: {
          total: transactions.length,
          unmatched: unmatchedTx.length,
          suggested: suggestedTx.length,
          matched: matchedTx.length,
          categorized: categorizedTx.length,
          matchRate,
        },
        bills: {
          total: bills.length,
          unpaid: unpaidBills.length,
          partial: partialBills.length,
          paid: paidBills.length,
          totalAmount: totalBillsAmount,
          unpaidAmount: unpaidBillsAmount,
        },
        invoices: {
          total: invoices.length,
          unpaid: unpaidInvoices.length,
          partial: partialInvoices.length,
          paid: paidInvoices.length,
          totalAmount: totalInvoicesAmount,
          unpaidAmount: unpaidInvoicesAmount,
        },
        summary: {
          matchRate,
          needsAttention: unmatchedTx.length + suggestedTx.length,
          totalOutstanding: unpaidBillsAmount + unpaidInvoicesAmount,
        },
      };
    } catch (error: any) {
      logger.error("Error getting stats v2", { error: error.message, userId });
      throw new HttpsError("internal", error.message);
    }
  }
);

// ============================================
// AI-POWERED MATCHING - Let Gemini figure it out!
// ============================================

export const aiMatchTransaction = onCall(
  {
    cors: true,
    timeoutSeconds: 60,
    memory: "512MiB",
    secrets: [geminiApiKey],
  },
  async (request) => {
    const { transactionId } = request.data;
    const userId = request.auth?.uid;
    const startTime = Date.now();
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    if (!transactionId) {
      throw new HttpsError("invalid-argument", "Transaction ID required");
    }
    
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "AI service not configured");
    }
    
    try {
      // Get the transaction
      const txDoc = await db.collection("transactions").doc(transactionId).get();
      if (!txDoc.exists || txDoc.data()?.userId !== userId) {
        throw new HttpsError("not-found", "Transaction not found");
      }
      
      const transaction = { id: txDoc.id, ...txDoc.data() } as any;
      
      // Get ALL potential documents (bills for debits, invoices for credits)
      const relevantCollection = transaction.type === "credit" ? "invoices" : "bills";
      const docsSnap = await db.collection(relevantCollection)
        .where("userId", "==", userId)
        .where("paymentStatus", "in", ["unpaid", "partial"])
        .limit(50)
        .get();
      
      const documents = docsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Ask Gemini to find matches
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
      
      const prompt = `You are a financial reconciliation AI. Match this transaction to ${relevantCollection}.

## TRANSACTION TO MATCH
${JSON.stringify({
  description: transaction.description,
  amount: Math.abs(transaction.amount),
  currency: transaction.currency || "ANG",
  date: transaction.date?.toDate?.()?.toISOString?.()?.split('T')[0],
  type: transaction.type,
  reference: transaction.reference,
}, null, 2)}

## AVAILABLE ${relevantCollection.toUpperCase()}
${JSON.stringify(documents.map(d => ({
  id: d.id,
  num: (d as any).documentNumber || (d as any).invoiceNumber,
  name: (d as any).vendorName || (d as any).customerName,
  amt: (d as any).total,
  remaining: (d as any).amountRemaining || (d as any).total,
  ccy: (d as any).currency || "USD",
  date: (d as any).documentDate?.toDate?.()?.toISOString?.()?.split('T')[0] || (d as any).invoiceDate?.toDate?.()?.toISOString?.()?.split('T')[0],
})), null, 2)}

## CRITICAL MATCHING RULES
1. BE FUZZY with invoice numbers: "INV-EXP 159067" can match "INV-15997" or "INV-159069"
2. FX RATES: 1 ANG = 0.56 USD. Transaction ANG 4451.44 = ~USD 2492.81
3. COMBINED PAYMENTS: "159067 AND 15998" means ONE payment for MULTIPLE bills
4. TEXT DESCRIPTIONS: "Management fee August" → find August management fee bill
5. AMOUNT TOLERANCE: Within 5% after FX conversion is a match
6. If this is a small amount ($5-$100) with "Monthly Fee" or "Service Charge", it's a bank fee

## YOUR TASK
Think step by step:
1. What invoice/bill numbers appear in the description?
2. What amount would this be in USD (if ANG)?
3. Which bill(s) match that amount?
4. Does the timing make sense?

## RESPOND IN JSON
{
  "matches": [
    {
      "documentId": "xxx",
      "documentNumber": "INV-15998",
      "confidence": 95,
      "matchType": "fx_converted|exact|combined",
      "explanation": "Reference 'INV-EXP102025' matches bill INV-EXP102025. Amount 4451.44 ANG × 0.56 = 2492.81 USD, matches bill total $2458 (within 2%)",
      "fxRate": 0.56,
      "convertedAmount": 2492.81
    }
  ],
  "noMatchReason": "Only if truly no match exists",
  "isBankFee": false
}

IMPORTANT: Real payments are messy! Numbers might be slightly off. Invoice numbers might be abbreviated. THINK about what makes sense.`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Parse AI response
      let aiResult;
      try {
        // Extract JSON from response (might be wrapped in markdown)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiResult = JSON.parse(jsonMatch[0]);
        } else {
          aiResult = { matches: [], noMatchReason: "Could not parse AI response" };
        }
      } catch {
        aiResult = { matches: [], noMatchReason: "AI response parsing failed", raw: responseText };
      }
      
      // Log for debugging
      logger.info("AI match result", {
        userId,
        transactionId,
        matchCount: aiResult.matches?.length || 0,
        topConfidence: aiResult.matches?.[0]?.confidence,
        processingTimeMs: Date.now() - startTime,
      });
      
      // Track AI usage
      await db.collection("ai_usage").add({
        userId,
        functionName: "aiMatchTransaction",
        transactionId,
        matchesFound: aiResult.matches?.length || 0,
        processingTimeMs: Date.now() - startTime,
        createdAt: Timestamp.now(),
      });
      
      return {
        transaction: {
          id: transaction.id,
          description: transaction.description,
          amount: transaction.amount,
          currency: transaction.currency,
          type: transaction.type,
          date: transaction.date?.toDate?.(),
        },
        aiMatches: aiResult.matches || [],
        noMatchReason: aiResult.noMatchReason,
        suggestions: aiResult.suggestions,
        processingTimeMs: Date.now() - startTime,
        documentsAnalyzed: documents.length,
      };
      
    } catch (error: any) {
      logger.error("AI match error", { error: error.message, userId, transactionId });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", `AI matching failed: ${error.message}`);
    }
  }
);

// ============================================
// BATCH AI MATCHING - Scale to 1000+ transactions
// ============================================

/**
 * Process many transactions efficiently using:
 * 1. Quick rule-based pre-filtering (obvious matches)
 * 2. Smart clustering by vendor/amount
 * 3. Parallel AI calls for uncertain matches
 * 4. Progressive results streaming
 */
export const batchAIMatch = onCall(
  {
    cors: true,
    timeoutSeconds: 300,  // 5 minutes - smaller batches are faster
    memory: "1GiB",
    secrets: [geminiApiKey],
  },
  async (request) => {
    // Support both modes: specific IDs or auto-fetch
    const { 
      transactionIds,  // Optional: specific transaction IDs to process
      maxTransactions = 200, 
      onlyUnmatched = true 
    } = request.data || {};
    const userId = request.auth?.uid;
    const startTime = Date.now();
    const MAX_RUNTIME_MS = 240000; // 4 minutes - leave buffer for smaller batches
    
    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }
    
    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "AI service not configured");
    }
    
    try {
      // Step 1: Get transactions - either by specific IDs or by query
      let transactions: any[] = [];
      
      if (transactionIds && transactionIds.length > 0) {
        // Fetch specific transactions by ID (for parallel processing)
        // Firestore limits batch reads to 30, so chunk them
        const chunks: string[][] = [];
        for (let i = 0; i < transactionIds.length; i += 30) {
          chunks.push(transactionIds.slice(i, i + 30));
        }
        
        const allDocs = await Promise.all(
          chunks.map(chunk => 
            db.collection("transactions")
              .where("userId", "==", userId)
              .where("__name__", "in", chunk)
              .get()
          )
        );
        
        transactions = allDocs.flatMap(snap => 
          snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        );
      } else {
        // Auto-fetch unmatched transactions
        const txSnap = await db.collection("transactions")
          .where("userId", "==", userId)
          .orderBy("date", "desc")
          .limit(Math.min(maxTransactions * 2, 500))
          .get();
        
        transactions = txSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        // Filter for unmatched if requested
        if (onlyUnmatched) {
          transactions = transactions.filter(tx => 
            !tx.reconciliationStatus || 
            tx.reconciliationStatus === "unmatched" ||
            tx.reconciliationStatus === "suggested"
          );
        }
        
        // Limit to requested amount
        transactions = transactions.slice(0, maxTransactions);
      }
      
      logger.info("Batch AI match starting", {
        userId,
        transactionCount: transactions.length,
      });
      
      if (transactions.length === 0) {
        return {
          processed: 0,
          matched: 0,
          failed: 0,
          results: [],
          message: "No unmatched transactions found",
        };
      }
      
      // Step 2: Get all unpaid bills and invoices
      const [billsSnap, invoicesSnap] = await Promise.all([
        db.collection("bills")
          .where("userId", "==", userId)
          .where("paymentStatus", "in", ["unpaid", "partial"])
          .limit(200)
          .get(),
        db.collection("invoices")
          .where("userId", "==", userId)
          .where("paymentStatus", "in", ["unpaid", "partial"])
          .limit(200)
          .get(),
      ]);
      
      const bills = billsSnap.docs.map(doc => ({ id: doc.id, type: "bill", ...doc.data() }));
      const invoices = invoicesSnap.docs.map(doc => ({ id: doc.id, type: "invoice", ...doc.data() }));
      
      // ============================================
      // PURE AI MATCHING - Let Gemini handle everything!
      // No hardcoded rules, no pre-filtering, just AI
      // ============================================
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
      
      // All bills/invoices for matching - send everything to the AI
      const billsForAI = bills;
      const invoicesForAI = invoices;
      
      // 10 transactions per AI call, 5 calls in parallel = 50 tx per round
      const batchSize = 10;
      const batches: any[][] = [];
      for (let i = 0; i < transactions.length; i += batchSize) {
        batches.push(transactions.slice(i, i + batchSize));
      }
      
      logger.info("Pure AI matching", {
        totalTransactions: transactions.length,
        totalBills: billsForAI.length,
        totalInvoices: invoicesForAI.length,
        batches: batches.length,
      });
      
      const allResults: any[] = [];
      
      // 5 parallel AI calls for speed
      const concurrency = 5;
      let stoppedEarly = false;
      let batchesProcessed = 0;
      
      for (let i = 0; i < batches.length; i += concurrency) {
        // Check if we're running out of time (leave 1 min buffer)
        if (Date.now() - startTime > MAX_RUNTIME_MS) {
          logger.info("Stopping early due to time limit", {
            elapsed: Date.now() - startTime,
            batchesProcessed,
            totalBatches: batches.length,
          });
          stoppedEarly = true;
          break;
        }
        
        const batchPromises = batches.slice(i, i + concurrency).map(async (batch, idx) => {
          try {
            const result = await processWithPureAI(model, batch, billsForAI, invoicesForAI, userId);
            return result;
          } catch (error: any) {
            logger.error("AI batch error", { batchIndex: i + idx, error: error.message });
            return batch.map((tx: any) => ({
              transactionId: tx.id,
              error: error.message,
              method: "ai_failed",
            }));
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults.flat());
        batchesProcessed += Math.min(concurrency, batches.length - i);
        
        // Small delay between batches
        if (i + concurrency < batches.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      const matched = allResults.filter(r => r.documentId && !r.error);
      const failed = allResults.filter(r => r.error);
      const bankFees = allResults.filter(r => r.classification === "bank_fee");
      const noMatch = allResults.filter(r => !r.documentId && !r.error && r.classification !== "bank_fee");
      
      // Log summary
      logger.info("Pure AI match complete", {
        userId,
        processed: transactions.length,
        matched: matched.length,
        bankFees: bankFees.length,
        noMatch: noMatch.length,
        failed: failed.length,
        processingTimeMs: Date.now() - startTime,
      });
      
      // Track usage
      await db.collection("ai_usage").add({
        userId,
        functionName: "batchAIMatch",
        transactionsProcessed: transactions.length,
        matchesFound: matched.length,
        bankFeesIdentified: bankFees.length,
        aiCalls: batches.length,
        processingTimeMs: Date.now() - startTime,
        createdAt: Timestamp.now(),
      });
      
      // Calculate remaining unmatched (estimate based on what we didn't process)
      const processedCount = allResults.length;
      const remainingEstimate = transactions.length - processedCount;
      
      return {
        processed: processedCount,
        matched: matched.length,
        failed: failed.length,
        bankFees: bankFees.length,
        noMatch: noMatch.length,
        processingTimeMs: Date.now() - startTime,
        results: allResults.slice(0, 200), // Return more results for better UI feedback
        hasMore: stoppedEarly || remainingEstimate > 0,
        remaining: Math.max(0, remainingEstimate),
        summary: {
          documentsAvailable: { bills: billsForAI.length, invoices: invoicesForAI.length },
          batchesProcessed,
          totalBatches: batches.length,
          stoppedEarly,
          aiPowered: true,
          model: "gemini-3-flash-preview",
        },
      };
      
    } catch (error: any) {
      logger.error("Batch AI match error", { error: error.message, userId });
      throw new HttpsError("internal", error.message);
    }
  }
);

/**
 * PURE AI MATCHING - Let Gemini handle ALL the reasoning
 * 
 * Sends rich context to AI so it can make intelligent matches
 */
async function processWithPureAI(
  model: any,
  transactions: any[],
  bills: any[],
  invoices: any[],
  userId: string
): Promise<any[]> {
  
  const prompt = `You are an expert accountant matching bank transactions to bills and invoices.

BANK TRANSACTIONS TO MATCH:
${JSON.stringify(transactions.map(tx => ({
  id: tx.id,
  date: tx.date?._seconds ? new Date(tx.date._seconds * 1000).toISOString().split('T')[0] : 'unknown',
  description: tx.description || tx.descriptionOriginal,
  amount: Math.abs(tx.amount),
  balance: tx.balance,
  currency: tx.currency || "ANG",
  type: tx.type, // "debit" = money out (paying bills), "credit" = money in
  reference: tx.reference,
  category: tx.category,
  counterparty: tx.counterparty || tx.payee || tx.payer,
})), null, 2)}

UNPAID BILLS (money we owe - match to DEBIT transactions):
${JSON.stringify(bills.map(b => ({
  id: b.id,
  invoiceNumber: b.documentNumber,
  vendor: b.vendorName,
  description: b.originalFileName?.replace(/\.[^/.]+$/, '') || b.description || b.notes || '',
  amount: b.total,
  amountRemaining: b.amountRemaining || b.total,
  currency: b.currency || "USD",
  date: b.documentDate?._seconds ? new Date(b.documentDate._seconds * 1000).toISOString().split('T')[0] : 'unknown',
  dueDate: b.dueDate?._seconds ? new Date(b.dueDate._seconds * 1000).toISOString().split('T')[0] : null,
  lineItems: b.lineItems?.map((li: any) => li.description || li.name).filter(Boolean).join(', ') || null,
  bankDetails: b.bankPaymentReference || b.bankDetails?.reference || null,
})), null, 2)}

UNPAID INVOICES (money owed to us - match to CREDIT transactions):
${JSON.stringify(invoices.map(i => ({
  id: i.id,
  invoiceNumber: i.documentNumber || i.invoiceNumber,
  customer: i.customerName || i.vendorName,
  description: i.originalFileName?.replace(/\.[^/.]+$/, '') || i.description || i.notes || '',
  amount: i.total,
  amountRemaining: i.amountRemaining || i.total,
  currency: i.currency || "USD",
  date: i.documentDate?._seconds ? new Date(i.documentDate._seconds * 1000).toISOString().split('T')[0] : 'unknown',
  dueDate: i.dueDate?._seconds ? new Date(i.dueDate._seconds * 1000).toISOString().split('T')[0] : null,
  lineItems: i.lineItems?.map((li: any) => li.description || li.name).filter(Boolean).join(', ') || null,
})), null, 2)}

FX RATES (approximate): 1 USD = 1.79 ANG, 1 EUR = 1.94 ANG

MATCHING LOGIC:
1. DEBIT transactions (money leaving account) should match BILLS (money we owe)
2. CREDIT transactions (money coming in) should match INVOICES (money owed to us)
3. Look for invoice numbers in transaction references/descriptions (e.g., "INV-15998", "159067")
4. Match by converted amounts when currencies differ
5. Match by context - "Management fee August" matches bill named "August Management Fee"
6. "Monthly Fee" at small amounts (5-10 ANG) = bank_fee
7. "Fees Debited" at 50-60 ANG = bank processing fees = bank_fee
8. "SWIFT Charges" = bank_fee
9. Large payments with invoice references or expense descriptions = payment_match

For each transaction return your analysis. If a single payment covers multiple bills, list ALL matching bill IDs.

Return ONLY valid JSON:
{
  "analysis": [
    {
      "transactionId": "xxx",
      "classification": "payment_match" | "bank_fee" | "no_match" | "needs_review",
      "documentId": "bill_or_invoice_id" | null,
      "documentIds": ["id1", "id2"] | null,
      "documentType": "bill" | "invoice" | null,
      "confidence": 0-100,
      "explanation": "brief reason",
      "fxDetails": {"fromCurrency": "ANG", "toCurrency": "USD", "rate": 0.56, "convertedAmount": 1234.56} | null
    }
  ]
}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.analysis || []).map((m: any) => ({
        transactionId: m.transactionId,
        documentId: m.documentId || (m.documentIds && m.documentIds[0]) || null,
        documentIds: m.documentIds || (m.documentId ? [m.documentId] : null),
        documentType: m.documentType,
        confidence: m.confidence || 0,
        matchType: m.documentIds && m.documentIds.length > 1 ? "combined" : "single",
        explanation: m.explanation,
        classification: m.classification,
        fxRate: m.fxDetails?.rate,
        fxFrom: m.fxDetails?.fromCurrency,
        fxTo: m.fxDetails?.toCurrency,
        convertedAmount: m.fxDetails?.convertedAmount,
        method: "pure_ai",
      }));
    }
  } catch (e) {
    logger.error("Failed to parse AI response", { error: String(e), response: responseText.slice(0, 500) });
  }
  
  // Return results indicating parse failure
  return transactions.map(tx => ({
    transactionId: tx.id,
    documentId: null,
    confidence: 0,
    explanation: "AI response parsing failed - will retry",
    classification: "error",
    method: "ai_failed",
  }));
}

// ============================================
// NEW: UNIFIED RECONCILIATION ENGINE
// Three-tier matching with dynamic thinking levels
// ============================================

export const reconcileAll = onCall(
  {
    cors: true,
    timeoutSeconds: 300,
    memory: "1GiB",
    secrets: [geminiApiKey],
  },
  async (request) => {
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const {
      transactionIds,
      progressId,
      maxTransactions = 200,
      autoConfirmThreshold = 93,
    } = request.data || {};

    try {
      const result = await runReconciliation({
        userId,
        progressId,
        transactionIds,
        maxTransactions,
        autoConfirmThreshold,
      });

      return {
        steps: result.steps,
        matches: result.matches,
        stats: result.stats,
        patternsLearned: result.patternsLearned,
        processingTimeMs: result.processingTimeMs,
        model: result.model,
        progressId: result.progressId,
      };
    } catch (error: any) {
      logger.error("reconcileAll error", { error: error.message, userId });
      throw new HttpsError("internal", error.message);
    }
  }
);
