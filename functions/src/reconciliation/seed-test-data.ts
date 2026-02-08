/**
 * Test Data Seeder for Reconciliation Demo
 * 
 * Creates comprehensive test data that exercises all three tiers of matching:
 * - Tier 1: Easy exact matches (rule-based auto-confirm)
 * - Tier 2: FX conversions, fuzzy references, abbreviations (AI LOW)
 * - Tier 3: Combined payments, partials, fee-adjusted (AI HIGH)
 * - Bank fees and transfers (classification)
 * - No-match items (edge cases)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../config/firebase";
import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

function ts(dateStr: string): Timestamp {
  return Timestamp.fromDate(new Date(dateStr));
}

export const seedReconciliationTestData = onCall(
  { cors: true, timeoutSeconds: 120 },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) throw new HttpsError("unauthenticated", "Must be logged in");

    // First, find the user's account
    const accountSnap = await db.collection("accounts")
      .where("userId", "==", userId)
      .limit(1)
      .get();

    let accountId = "test-account";
    let currency = "ANG";

    if (!accountSnap.empty) {
      accountId = accountSnap.docs[0].id;
      currency = accountSnap.docs[0].data().currency || "ANG";
    }

    const batch1 = db.batch();
    const batch2 = db.batch();
    const batch3 = db.batch();

    // ============================================
    // BILLS (30) — for debit transactions to match
    // ============================================

    const billsData = [
      // EASY MATCHES (10) — clear references, exact amounts
      { id: "test-bill-001", documentNumber: "ACME-2025-001", vendorName: "Acme Corporation", total: 5000, currency: "USD", date: "2025-12-01", due: "2025-12-30" },
      { id: "test-bill-002", documentNumber: "INV-15998", vendorName: "GlobalTech Solutions NV", total: 2458, currency: "USD", date: "2025-12-05", due: "2026-01-05" },
      { id: "test-bill-003", documentNumber: "SUP-2025-003", vendorName: "Island Supplies NV", total: 3500, currency: "ANG", date: "2025-12-10", due: "2026-01-10" },
      { id: "test-bill-004", documentNumber: "PO-44521", vendorName: "Caribbean Office Pro", total: 1200, currency: "USD", date: "2025-12-12", due: "2026-01-12" },
      { id: "test-bill-005", documentNumber: "INV-7823", vendorName: "NetSecure IT Services", total: 8750, currency: "USD", date: "2025-12-15", due: "2026-01-15" },
      { id: "test-bill-006", documentNumber: "VND-2025-006", vendorName: "Tropical Foods BV", total: 4200, currency: "EUR", date: "2025-12-18", due: "2026-01-18" },
      { id: "test-bill-007", documentNumber: "2025-Q4-007", vendorName: "Azure Cloud Services", total: 15340, currency: "USD", date: "2025-12-20", due: "2026-01-20" },
      { id: "test-bill-008", documentNumber: "RNT-2025-008", vendorName: "Punda Commercial Realty", total: 12500, currency: "ANG", date: "2025-12-01", due: "2025-12-31" },
      { id: "test-bill-009", documentNumber: "INV-2025-009", vendorName: "Clean Air HVAC Systems", total: 3875, currency: "USD", date: "2025-12-22", due: "2026-01-22" },
      { id: "test-bill-010", documentNumber: "MNT-2025-010", vendorName: "ProGuard Security NV", total: 2800, currency: "ANG", date: "2025-12-01", due: "2025-12-31" },

      // MEDIUM MATCHES (10) — vendor name variations, abbreviations
      { id: "test-bill-011", documentNumber: "GT-2025-019", vendorName: "GlobalTech Solutions NV", total: 6500, currency: "USD", date: "2025-12-08", due: "2026-01-08" },
      { id: "test-bill-012", documentNumber: "CONS-2025-012", vendorName: "J&J Consulting Group", total: 12000, currency: "USD", date: "2025-12-10", due: "2026-01-10" },
      { id: "test-bill-013", documentNumber: "FL-88234", vendorName: "FedEx Logistics", total: 892.50, currency: "USD", date: "2025-12-14", due: "2026-01-14" },
      { id: "test-bill-014", documentNumber: "INV-2025-014", vendorName: "Bonaire Water Authority", total: 1456.78, currency: "ANG", date: "2025-12-15", due: "2026-01-15" },
      { id: "test-bill-015", documentNumber: "WEB-2025-015", vendorName: "DigitalWave Agency", total: 3800, currency: "EUR", date: "2025-12-16", due: "2026-01-16" },
      { id: "test-bill-016", documentNumber: "TEL-2025-016", vendorName: "FLOW Telecom Curacao", total: 875, currency: "ANG", date: "2025-12-01", due: "2025-12-15" },
      { id: "test-bill-017", documentNumber: "INS-2025-017", vendorName: "Guardian Insurance NV", total: 4500, currency: "USD", date: "2025-12-18", due: "2026-01-18" },
      { id: "test-bill-018", documentNumber: "HW-2025-018", vendorName: "CompuTech Hardware", total: 7234.50, currency: "USD", date: "2025-12-20", due: "2026-01-20" },
      { id: "test-bill-019", documentNumber: "MKT-2025-019", vendorName: "AdVantage Marketing", total: 2150, currency: "USD", date: "2025-12-22", due: "2026-01-22" },
      { id: "test-bill-020", documentNumber: "LEGAL-2025-020", vendorName: "Baker & Associates Law", total: 5600, currency: "USD", date: "2025-12-24", due: "2026-01-24" },

      // HARD MATCHES (5) — combined, partial, fee-adjusted
      { id: "test-bill-021", documentNumber: "COMB-A", vendorName: "Office Essentials Ltd", total: 1500, currency: "USD", date: "2025-12-10", due: "2026-01-10" },
      { id: "test-bill-022", documentNumber: "COMB-B", vendorName: "Office Essentials Ltd", total: 2300, currency: "USD", date: "2025-12-12", due: "2026-01-12" },
      { id: "test-bill-023", documentNumber: "MEGA-2025-023", vendorName: "MegaBuild Construction", total: 45000, currency: "USD", date: "2025-11-01", due: "2026-02-01" },
      { id: "test-bill-024", documentNumber: "CW-UTIL-Q1-A", vendorName: "CW Utilities NV", total: 890, currency: "ANG", date: "2025-10-01", due: "2025-10-31" },
      { id: "test-bill-025", documentNumber: "CW-UTIL-Q1-B", vendorName: "CW Utilities NV", total: 910, currency: "ANG", date: "2025-11-01", due: "2025-11-30" },

      // DECOYS (5) — these should NOT match anything
      { id: "test-bill-026", documentNumber: "DECOY-001", vendorName: "Phantom Vendor LLC", total: 99999, currency: "USD", date: "2025-06-01", due: "2025-07-01" },
      { id: "test-bill-027", documentNumber: "DECOY-002", vendorName: "Ghost Services BV", total: 77777, currency: "EUR", date: "2025-03-15", due: "2025-04-15" },
      { id: "test-bill-028", documentNumber: "DECOY-003", vendorName: "Nonexistent Corp", total: 33333.33, currency: "ANG", date: "2025-08-20", due: "2025-09-20" },
      { id: "test-bill-029", documentNumber: "DECOY-004", vendorName: "Imaginary Industries", total: 11111.11, currency: "USD", date: "2025-05-05", due: "2025-06-05" },
      { id: "test-bill-030", documentNumber: "DECOY-005", vendorName: "Fictitious Freight", total: 55555, currency: "ANG", date: "2025-07-10", due: "2025-08-10" },
    ];

    for (const bill of billsData) {
      const ref = db.collection("bills").doc(bill.id);
      batch1.set(ref, {
        userId,
        documentType: "bill",
        documentNumber: bill.documentNumber,
        vendorName: bill.vendorName,
        counterpartyName: bill.vendorName,
        total: bill.total,
        amountRemaining: bill.total,
        amountPaid: 0,
        currency: bill.currency,
        documentDate: ts(bill.date),
        dueDate: ts(bill.due),
        paymentStatus: "unpaid",
        reconciliationStatus: "unmatched",
        direction: "incoming",
        status: "processed",
        isTestData: true,
        payments: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    // ============================================
    // INVOICES (10) — for credit transactions to match
    // ============================================

    const invoicesData = [
      // EASY MATCHES (5)
      { id: "test-inv-001", documentNumber: "C-INV-001", customerName: "Alpha Holdings Ltd", total: 25000, currency: "USD", date: "2025-12-01", due: "2026-01-01" },
      { id: "test-inv-002", documentNumber: "C-INV-002", customerName: "Beta Industries NV", total: 44750, currency: "ANG", date: "2025-12-05", due: "2026-01-05" },
      { id: "test-inv-003", documentNumber: "C-INV-003", customerName: "Gamma Consulting BV", total: 8500, currency: "EUR", date: "2025-12-10", due: "2026-01-10" },
      { id: "test-inv-004", documentNumber: "C-INV-004", customerName: "Delta Marine Services", total: 12350, currency: "USD", date: "2025-12-12", due: "2026-01-12" },
      { id: "test-inv-005", documentNumber: "C-INV-005", customerName: "Epsilon Tech Solutions", total: 7890, currency: "USD", date: "2025-12-15", due: "2026-01-15" },

      // MEDIUM MATCHES (3)
      { id: "test-inv-006", documentNumber: "C-INV-006", customerName: "Zeta Hospitality Group", total: 18500, currency: "USD", date: "2025-12-18", due: "2026-01-18" },
      { id: "test-inv-007", documentNumber: "C-INV-007", customerName: "Eta Manufacturing NV", total: 15000, currency: "ANG", date: "2025-12-20", due: "2026-01-20" },
      { id: "test-inv-008", documentNumber: "C-INV-008", customerName: "Theta Logistics BV", total: 4230, currency: "USD", date: "2025-12-22", due: "2026-01-22" },

      // HARD MATCHES (2) — fee-adjusted, partial
      { id: "test-inv-009", documentNumber: "C-INV-009", customerName: "Iota Financial Services", total: 9999.99, currency: "USD", date: "2025-12-24", due: "2026-01-24" },
      { id: "test-inv-010", documentNumber: "C-INV-010", customerName: "Kappa Real Estate", total: 35000, currency: "USD", date: "2025-12-28", due: "2026-01-28" },
    ];

    for (const inv of invoicesData) {
      const ref = db.collection("invoices").doc(inv.id);
      batch1.set(ref, {
        userId,
        documentType: "invoice",
        documentNumber: inv.documentNumber,
        invoiceNumber: inv.documentNumber,
        customerName: inv.customerName,
        counterpartyName: inv.customerName,
        total: inv.total,
        amountDue: inv.total,
        amountRemaining: inv.total,
        amountPaid: 0,
        currency: inv.currency,
        invoiceDate: ts(inv.date),
        documentDate: ts(inv.date),
        dueDate: ts(inv.due),
        paymentStatus: "unpaid",
        reconciliationStatus: "unmatched",
        direction: "outgoing",
        status: "processed",
        isTestData: true,
        payments: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    await batch1.commit();
    logger.info("Bills and invoices seeded", { bills: billsData.length, invoices: invoicesData.length });

    // ============================================
    // TRANSACTIONS (50) — the bank statement data
    // ============================================

    // FX rates: 1 USD = 1.79 ANG, 1 EUR = 1.94 ANG
    const USD_TO_ANG = 1.79;
    const EUR_TO_ANG = 1.94;

    let balance = 85000; // Starting balance

    const transactionsData = [
      // ==========================================
      // EASY DEBIT MATCHES (10) → Bills 1-10
      // Clear references + amounts = auto-confirm
      // ==========================================
      { desc: "PAY REF ACME-2025-001 ACME CORP", amount: 5000 * USD_TO_ANG, type: "debit", date: "2026-01-05", ref: "ACME-2025-001" },
      { desc: "SWIFT TFR REF 15998 GLOBALTECH SOLUTIONS", amount: 2458 * USD_TO_ANG, type: "debit", date: "2026-01-08", ref: "15998" },
      { desc: "LOCAL PAY ISLAND SUPPLIES NV REF SUP-2025-003", amount: 3500, type: "debit", date: "2026-01-10", ref: "SUP-2025-003" },
      { desc: "TFR REF PO-44521 CARIBBEAN OFFICE", amount: 1200 * USD_TO_ANG, type: "debit", date: "2026-01-12", ref: "PO-44521" },
      { desc: "PAYMENT NETSECURE IT SVCS INV-7823", amount: 8750 * USD_TO_ANG, type: "debit", date: "2026-01-15", ref: "INV-7823" },
      { desc: "EURO PAY TROPICAL FOODS REF VND-2025-006", amount: 4200 * EUR_TO_ANG, type: "debit", date: "2026-01-18", ref: "VND-2025-006" },
      { desc: "DIRECT DEBIT AZURE CLOUD 2025-Q4-007", amount: 15340 * USD_TO_ANG, type: "debit", date: "2026-01-20", ref: "2025-Q4-007" },
      { desc: "RENT PAYMENT PUNDA COMMERCIAL RNT-2025-008", amount: 12500, type: "debit", date: "2026-01-01", ref: "RNT-2025-008" },
      { desc: "PAY CLEAN AIR HVAC INV-2025-009", amount: 3875 * USD_TO_ANG, type: "debit", date: "2026-01-22", ref: "INV-2025-009" },
      { desc: "SECURITY SERVICES PROGUARD MNT-2025-010", amount: 2800, type: "debit", date: "2026-01-31", ref: "MNT-2025-010" },

      // ==========================================
      // EASY CREDIT MATCHES (5) → Invoices 1-5
      // ==========================================
      { desc: "DEPOSIT FROM ALPHA HOLDINGS REF C-INV-001", amount: 25000 * USD_TO_ANG, type: "credit", date: "2026-01-06", ref: "C-INV-001" },
      { desc: "INCOMNG TFR BETA INDUSTRIES NV C-INV-002", amount: 44750, type: "credit", date: "2026-01-09", ref: "C-INV-002" },
      { desc: "WIRE RCVD GAMMA CONSULTING C-INV-003", amount: 8500 * EUR_TO_ANG, type: "credit", date: "2026-01-11", ref: "C-INV-003" },
      { desc: "DEPOSIT DELTA MARINE SERVICES C-INV-004", amount: 12350 * USD_TO_ANG, type: "credit", date: "2026-01-14", ref: "C-INV-004" },
      { desc: "PAYMENT RECEIVED EPSILON TECH C-INV-005", amount: 7890 * USD_TO_ANG, type: "credit", date: "2026-01-16", ref: "C-INV-005" },

      // ==========================================
      // MEDIUM DEBIT MATCHES (10) → Bills 11-20
      // Name abbreviations, no direct ref match
      // ==========================================
      { desc: "ELEC PAYMENT GLOBALTECH SOL", amount: 6500 * USD_TO_ANG, type: "debit", date: "2026-01-09", ref: null },
      { desc: "J AND J CONSULTING PROFESSIONAL FEES", amount: 12000 * USD_TO_ANG, type: "debit", date: "2026-01-11", ref: null },
      { desc: "FEDEX INTL SHIPPING CHARGES", amount: 892.50 * USD_TO_ANG, type: "debit", date: "2026-01-16", ref: "SHP-88234" },
      { desc: "BONAIRE WATER UTIL MONTHLY", amount: 1456.78, type: "debit", date: "2026-01-17", ref: null },
      { desc: "EUR PAY DIGITALWAVE WEB DEVELOPMENT", amount: 3800 * EUR_TO_ANG, type: "debit", date: "2026-01-19", ref: null },
      { desc: "TELECOM FLOW MONTHLY SERVICE", amount: 875, type: "debit", date: "2026-01-05", ref: null },
      { desc: "GUARDIAN GRP INSURANCE PREMIUM Q1", amount: 4500 * USD_TO_ANG, type: "debit", date: "2026-01-20", ref: null },
      { desc: "COMPUTECH HW ORDER DELIVERY", amount: 7234.50 * USD_TO_ANG, type: "debit", date: "2026-01-22", ref: null },
      { desc: "MARKETING SERVICES ADVANTAGE MKT", amount: 2150 * USD_TO_ANG, type: "debit", date: "2026-01-24", ref: null },
      { desc: "BAKER ASSOC LEGAL FEES RETAINER", amount: 5600 * USD_TO_ANG, type: "debit", date: "2026-01-26", ref: null },

      // ==========================================
      // MEDIUM CREDIT MATCHES (3) → Invoices 6-8
      // ==========================================
      { desc: "ZETA HOSPITALITY DEPOSIT RECEIVED", amount: 18500 * USD_TO_ANG, type: "credit", date: "2026-01-20", ref: null },
      { desc: "INCOMING ETA MANUFACTURING PAYMENT", amount: 15000, type: "credit", date: "2026-01-22", ref: null },
      { desc: "THETA LOG SERVICES PAYMENT RCVD", amount: 4230 * USD_TO_ANG, type: "credit", date: "2026-01-24", ref: null },

      // ==========================================
      // HARD MATCHES (5) → Bills 21-25
      // Combined, partial, multi-month batch
      // ==========================================
      // Combined: pays COMB-A ($1500) + COMB-B ($2300) = $3800 total
      { desc: "OFFICE ESSENTIALS CONSOLIDATED PAYMENT", amount: 3800 * USD_TO_ANG, type: "debit", date: "2026-01-15", ref: null },
      // Partial: pays $15,000 of $45,000 bill (progress payment)
      { desc: "MEGABUILD CONSTRUCTION PROGRESS PAYMENT 1 OF 3", amount: 15000 * USD_TO_ANG, type: "debit", date: "2026-01-18", ref: null },
      // Batch utilities: pays 3 months at once (890 + 910 = 1800)
      { desc: "CW UTILITIES BATCH PAYMENT OCT-NOV", amount: 1800, type: "debit", date: "2026-01-20", ref: null },
      // Stripe fee adjusted: customer paid $9,999.99, Stripe took 2.9% + $0.30
      { desc: "STRIPE PAYOUT FEB 2026", amount: (9999.99 * (1 - 0.029) - 0.30) * USD_TO_ANG, type: "credit", date: "2026-01-25", ref: null },
      // Kappa paid via wire with FX from USD, partially
      { desc: "KAPPA RE FIRST INSTALLMENT", amount: 17500 * USD_TO_ANG, type: "credit", date: "2026-01-28", ref: null },

      // ==========================================
      // BANK FEES (5) — should classify as bank_fee
      // ==========================================
      { desc: "Monthly Fee", amount: 7.50, type: "debit", date: "2026-01-31", ref: null },
      { desc: "SWIFT Transfer Charges", amount: 35, type: "debit", date: "2026-01-08", ref: null },
      { desc: "Foreign Currency Exchange Fee", amount: 12.50, type: "debit", date: "2026-01-15", ref: null },
      { desc: "ATM Withdrawal Fee", amount: 5, type: "debit", date: "2026-01-20", ref: null },
      { desc: "Interest Earned January 2026", amount: 42.75, type: "credit", date: "2026-01-31", ref: null },

      // ==========================================
      // INTERNAL TRANSFERS (5) — should classify as transfer
      // ==========================================
      { desc: "Internal Transfer to Savings Account", amount: 25000, type: "debit", date: "2026-01-02", ref: null },
      { desc: "Transfer from USD Reserve Account", amount: 50000, type: "credit", date: "2026-01-03", ref: null },
      { desc: "Petty Cash Withdrawal", amount: 500, type: "debit", date: "2026-01-10", ref: null },
      { desc: "Owner Equity Injection", amount: 100000, type: "credit", date: "2026-01-15", ref: null },
      { desc: "Internal TFR Between Accounts ANG/USD", amount: 10000, type: "debit", date: "2026-01-25", ref: null },

      // ==========================================
      // NO MATCH (5) — nothing should match these
      // ==========================================
      { desc: "MISCELLANEOUS CHARGE REF-X99", amount: 347.82, type: "debit", date: "2026-01-07", ref: "X99" },
      { desc: "UNKNOWN DEPOSIT WIRE TRANSFER", amount: 8234.56, type: "credit", date: "2026-01-13", ref: null },
      { desc: "POS PURCHASE SUPERMARKET", amount: 156.40, type: "debit", date: "2026-01-19", ref: null },
      { desc: "CASH DEPOSIT BRANCH", amount: 3000, type: "credit", date: "2026-01-21", ref: null },
      { desc: "REVERSAL CHARGEBACK DISPUTE", amount: 450, type: "credit", date: "2026-01-27", ref: null },
    ];

    let txIndex = 0;
    for (const tx of transactionsData) {
      const ref = db.collection("transactions").doc(`test-tx-${String(txIndex).padStart(3, "0")}`);
      const amount = Math.round(tx.amount * 100) / 100; // round to 2 decimals

      if (tx.type === "debit") {
        balance -= amount;
      } else {
        balance += amount;
      }

      const batch = txIndex < 20 ? batch2 : batch3;
      batch.set(ref, {
        id: `test-tx-${String(txIndex).padStart(3, "0")}`,
        orgId: "personal",
        userId,
        accountId,
        statementId: "test-statement",
        date: ts(tx.date),
        description: tx.desc,
        descriptionOriginal: tx.desc,
        amount,
        type: tx.type,
        balance: Math.round(balance * 100) / 100,
        reference: tx.ref,
        category: tx.type === "credit" ? "Income" : "Bills",
        currency,
        searchText: `${tx.desc.toLowerCase()} ${(tx.ref || "").toLowerCase()}`,
        month: tx.date.slice(0, 7),
        confidence: 0.95,
        needsReview: false,
        reconciliationStatus: "unmatched",
        isTestData: true,
        createdAt: Timestamp.now(),
      });

      txIndex++;
    }

    await batch2.commit();
    await batch3.commit();

    logger.info("Test data seeded", {
      userId,
      transactions: transactionsData.length,
      bills: billsData.length,
      invoices: invoicesData.length,
    });

    return {
      success: true,
      seeded: {
        transactions: transactionsData.length,
        bills: billsData.length,
        invoices: invoicesData.length,
      },
      message: `Seeded ${transactionsData.length} transactions, ${billsData.length} bills, ${invoicesData.length} invoices. Go to Reconciliation to test!`,
    };
  }
);

/**
 * Clean up test data
 */
export const cleanTestData = onCall(
  { cors: true, timeoutSeconds: 60 },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) throw new HttpsError("unauthenticated", "Must be logged in");

    let deleted = 0;

    // Delete test transactions
    const txSnap = await db.collection("transactions")
      .where("userId", "==", userId)
      .where("isTestData", "==", true)
      .get();

    for (const doc of txSnap.docs) {
      await doc.ref.delete();
      deleted++;
    }

    // Delete test bills
    const billSnap = await db.collection("bills")
      .where("userId", "==", userId)
      .where("isTestData", "==", true)
      .get();

    for (const doc of billSnap.docs) {
      await doc.ref.delete();
      deleted++;
    }

    // Delete test invoices
    const invSnap = await db.collection("invoices")
      .where("userId", "==", userId)
      .where("isTestData", "==", true)
      .get();

    for (const doc of invSnap.docs) {
      await doc.ref.delete();
      deleted++;
    }

    // Delete test match records
    const matchSnap = await db.collection("reconciliation_matches")
      .where("userId", "==", userId)
      .get();

    for (const doc of matchSnap.docs) {
      const data = doc.data();
      if (data.transactionId?.startsWith("test-tx-")) {
        await doc.ref.delete();
        deleted++;
      }
    }

    return { success: true, deleted, message: `Cleaned up ${deleted} test documents` };
  }
);
