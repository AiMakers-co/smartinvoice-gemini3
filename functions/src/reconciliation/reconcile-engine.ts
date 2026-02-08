/**
 * Unified AI Reconciliation Engine
 * 
 * Three-tier matching with dynamic Gemini 3 thinking levels:
 * 
 * Tier 1: QUICK SCAN (instant, no AI)
 * Tier 2: AI MATCHING with thinking_level: LOW (fast)
 * Tier 3: DEEP INVESTIGATION with thinking_level: HIGH (thorough)
 * 
 * STREAMING: Writes real-time progress to Firestore so the frontend
 * can render the AI's reasoning as it works — not after.
 */

import { Timestamp, FieldValue, FieldPath } from "firebase-admin/firestore";
import { db } from "../config/firebase";
import { getGoogleAI, getModelName } from "../config/ai-models";
import { ThinkingLevel } from "@google/genai";
import { logger } from "firebase-functions";
import {
  Document as MatchDocument,
  Transaction as MatchTransaction,
  calculateMatch,
  MatchCandidate,
} from "./matcher";
import { getVendorPatterns } from "./pattern-memory";

// ============================================
// TYPES
// ============================================

export interface ReconcileRequest {
  userId: string;
  progressId?: string; // Firestore doc ID for live streaming
  transactionIds?: string[];
  maxTransactions?: number;
  autoConfirmThreshold?: number;
}

export interface ReconcileResult {
  steps: ReconcileStep[];
  matches: TransactionMatch[];
  stats: ReconcileStats;
  patternsLearned: string[];
  processingTimeMs: number;
  model: string;
  progressId?: string;
}

export interface ReconcileStep {
  name: "quick_scan" | "ai_matching" | "deep_investigation" | "learning";
  status: "completed" | "skipped";
  count: number;
  details: string[];
  timeMs: number;
}

export interface TransactionMatch {
  transactionId: string;
  classification: "payment_match" | "bank_fee" | "transfer" | "no_match" | "needs_review";
  documentId: string | null;
  documentType: "bill" | "invoice" | null;
  documentNumber: string | null;
  counterpartyName: string | null;
  confidence: number;
  reasoning: string[];
  matchType: "exact" | "fx_converted" | "partial" | "combined" | "fee_adjusted" | "split" | "none";
  fxDetails: {
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    convertedAmount: number;
  } | null;
  thinkingLevel: "none" | "low" | "high";
  autoConfirmed: boolean;
  ruleBasedScore?: number;
}

export interface ReconcileStats {
  totalTransactions: number;
  quickMatches: number;
  aiMatches: number;
  deepMatches: number;
  bankFees: number;
  noMatch: number;
  autoConfirmed: number;
  needsReview: number;
  matchRate: number;
}

// ============================================
// PROGRESS STREAMING
// ============================================

interface ProgressEvent {
  ts: number;
  type: "step" | "analyze" | "search" | "match" | "fx" | "confirm" | "classify" | "escalate" | "learn" | "info";
  text: string;
  step?: string;
}

class ProgressStream {
  private events: ProgressEvent[] = [];
  private docRef: FirebaseFirestore.DocumentReference | null = null;
  private stepName = "";
  private writeQueue: Promise<void> = Promise.resolve();
  private userId: string;

  constructor(progressId: string | undefined, userId: string) {
    this.userId = userId;
    if (progressId) {
      this.docRef = db.collection("reconciliation_runs").doc(progressId);
    }
  }

  async init(totalTransactions: number, totalBills: number, totalInvoices: number) {
    if (!this.docRef) return;
    await this.docRef.set({
      userId: this.userId,
      status: "running",
      events: [],
      totalTransactions,
      totalBills,
      totalInvoices,
      startedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  async emit(type: ProgressEvent["type"], text: string) {
    const event: ProgressEvent = { ts: Date.now(), type, text, step: this.stepName };
    this.events.push(event);
    if (!this.docRef) return;
    // Queue writes to avoid race conditions
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await this.docRef!.update({
          events: FieldValue.arrayUnion(event),
          updatedAt: Timestamp.now(),
        });
      } catch (e) {
        // Non-critical
      }
    });
  }

  async emitBatch(newEvents: ProgressEvent[]) {
    this.events.push(...newEvents);
    if (!this.docRef) return;
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await this.docRef!.update({
          events: FieldValue.arrayUnion(...newEvents),
          updatedAt: Timestamp.now(),
        });
      } catch (e) {
        // Non-critical
      }
    });
  }

  setStep(name: string) {
    this.stepName = name;
  }

  async complete(stats: ReconcileStats) {
    await this.writeQueue; // Wait for all pending writes
    if (!this.docRef) return;
    try {
      await this.docRef.update({
        status: "completed",
        stats,
        updatedAt: Timestamp.now(),
      });
    } catch (e) {
      // Non-critical
    }
  }

  async error(message: string) {
    await this.writeQueue;
    if (!this.docRef) return;
    try {
      await this.docRef.update({
        status: "error",
        errorMessage: message,
        updatedAt: Timestamp.now(),
      });
    } catch (e) {
      // Non-critical
    }
  }
}

// ============================================
// INTERNAL: Learn from a confirmed match
// ============================================

async function learnFromMatchInternal(
  userId: string,
  data: {
    invoiceId: string;
    invoiceNumber: string;
    invoiceAmount: number;
    invoiceCurrency: string;
    invoiceDate: Date;
    transactionId: string;
    transactionAmount: number;
    transactionCurrency: string;
    transactionDate: Date;
    transactionDescription: string;
    vendorName: string;
    matchType: string;
    wasManual: boolean;
    aiConfidence: number;
  }
): Promise<string | null> {
  try {
    const daysDifference = Math.abs(
      Math.floor((data.transactionDate.getTime() - data.invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const amountDifference = Math.abs(data.transactionAmount - data.invoiceAmount);

    await db.collection("match_history").add({
      userId,
      vendorName: data.vendorName,
      invoiceId: data.invoiceId,
      invoiceNumber: data.invoiceNumber,
      invoiceAmount: data.invoiceAmount,
      invoiceCurrency: data.invoiceCurrency,
      invoiceDate: Timestamp.fromDate(data.invoiceDate),
      transactionId: data.transactionId,
      transactionAmount: data.transactionAmount,
      transactionCurrency: data.transactionCurrency,
      transactionDate: Timestamp.fromDate(data.transactionDate),
      transactionDescription: data.transactionDescription,
      matchType: data.matchType,
      amountDifference,
      daysDifference,
      wasManual: data.wasManual,
      aiConfidence: data.aiConfidence,
      matchedAt: Timestamp.now(),
      matchedBy: userId,
    });

    const existingPatterns = await getVendorPatterns(userId, data.vendorName);
    const keywords = data.transactionDescription
      .toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/)
      .filter(w => w.length > 2).slice(0, 10);

    if (existingPatterns.length > 0) {
      const p = existingPatterns[0];
      const newCount = (p.matchCount || 0) + 1;
      const newDelay = ((p.typicalPaymentDelay || 0) * (p.matchCount || 0) + daysDifference) / newCount;
      const allKeywords = [...(p.transactionKeywords || []), ...keywords];
      const keywordCounts = allKeywords.reduce((acc, kw) => {
        acc[kw] = (acc[kw] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const topKeywords = Object.entries(keywordCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 15).map(([kw]) => kw);

      await db.collection("vendor_patterns").doc(p.id!).update({
        transactionKeywords: topKeywords,
        matchCount: newCount,
        lastMatchedAt: Timestamp.now(),
        typicalPaymentDelay: Math.round(newDelay * 10) / 10,
        paymentDelayRange: {
          min: Math.min(p.paymentDelayRange?.min ?? daysDifference, daysDifference),
          max: Math.max(p.paymentDelayRange?.max ?? daysDifference, daysDifference),
        },
        confidence: Math.min(100, Math.round((p.confidence || 50) + (data.wasManual ? 5 : 2))),
        updatedAt: Timestamp.now(),
      });
      return data.vendorName;
    } else {
      await db.collection("vendor_patterns").add({
        userId,
        vendorName: data.vendorName,
        vendorAliases: [],
        transactionKeywords: keywords,
        matchCount: 1,
        lastMatchedAt: Timestamp.now(),
        typicalPaymentDelay: daysDifference,
        paymentDelayRange: { min: daysDifference, max: daysDifference },
        confidence: data.wasManual ? 70 : Math.min(90, data.aiConfidence),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return data.vendorName;
    }
  } catch (error) {
    logger.error("learnFromMatchInternal error", { error: String(error) });
    return null;
  }
}

// ============================================
// HELPERS for readable reasoning
// ============================================

function fmtCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysBetween(d1: any, d2: any): number {
  const date1 = d1?.toDate ? d1.toDate() : (d1?._seconds ? new Date(d1._seconds * 1000) : null);
  const date2 = d2?.toDate ? d2.toDate() : (d2?._seconds ? new Date(d2._seconds * 1000) : null);
  if (!date1 || !date2) return 0;
  return Math.abs(Math.floor((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24)));
}

// ============================================
// MAIN ENGINE
// ============================================

export async function runReconciliation(request: ReconcileRequest): Promise<ReconcileResult> {
  const startTime = Date.now();
  const { userId, progressId, transactionIds, maxTransactions = 200, autoConfirmThreshold = 93 } = request;
  const modelName = getModelName("gemini-3-flash");
  const steps: ReconcileStep[] = [];
  const allMatches: TransactionMatch[] = [];
  const patternsLearned: string[] = [];

  const progress = new ProgressStream(progressId, userId);

  // ============================================
  // STEP 0: FETCH ALL DATA
  // ============================================

  let transactions: any[] = [];

  if (transactionIds && transactionIds.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < transactionIds.length; i += 30) {
      chunks.push(transactionIds.slice(i, i + 30));
    }
    const allSnapshots = await Promise.all(
      chunks.map(chunk =>
        db.collection("transactions")
          .where(FieldPath.documentId(), "in", chunk)
          .get()
      )
    );
    transactions = allSnapshots.flatMap(snap =>
      snap.docs
        .filter(doc => doc.data().userId === userId)
        .map(doc => ({ id: doc.id, ...doc.data() }))
    );
  } else {
    const txSnap = await db.collection("transactions")
      .where("userId", "==", userId)
      .orderBy("date", "desc")
      .limit(maxTransactions * 2)
      .get();

    transactions = txSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((tx: any) =>
        !tx.reconciliationStatus ||
        tx.reconciliationStatus === "unmatched" ||
        tx.reconciliationStatus === "suggested"
      )
      .slice(0, maxTransactions);
  }

  if (transactions.length === 0) {
    return {
      steps: [], matches: [], stats: emptyStats(), patternsLearned: [],
      processingTimeMs: Date.now() - startTime, model: modelName, progressId,
    };
  }

  const [billsSnap, invoicesSnap] = await Promise.all([
    db.collection("bills")
      .where("userId", "==", userId)
      .where("paymentStatus", "in", ["unpaid", "partial"])
      .limit(200).get(),
    db.collection("invoices")
      .where("userId", "==", userId)
      .where("paymentStatus", "in", ["unpaid", "partial"])
      .limit(200).get(),
  ]);

  const bills = billsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const invoices = invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const allAmounts = transactions.map((tx: any) => tx.amount);

  const billDocs: MatchDocument[] = bills.map((b: any) => ({
    id: b.id, userId: b.userId, documentType: "bill" as const,
    documentNumber: b.documentNumber || "Unknown",
    counterpartyName: b.vendorName || "Unknown",
    documentDate: b.documentDate, dueDate: b.dueDate,
    total: b.total || 0, amountRemaining: b.amountRemaining ?? b.total ?? 0,
    currency: b.currency || "USD",
    paymentStatus: b.paymentStatus || "unpaid",
    reconciliationStatus: b.reconciliationStatus || "unmatched",
  }));

  const invoiceDocs: MatchDocument[] = invoices.map((i: any) => ({
    id: i.id, userId: i.userId, documentType: "invoice" as const,
    documentNumber: i.documentNumber || i.invoiceNumber || "Unknown",
    counterpartyName: i.customerName || i.vendorName || "Unknown",
    documentDate: i.documentDate || i.invoiceDate, dueDate: i.dueDate,
    total: i.total || 0, amountRemaining: i.amountRemaining ?? i.total ?? 0,
    currency: i.currency || "USD",
    paymentStatus: i.paymentStatus || "unpaid",
    reconciliationStatus: i.reconciliationStatus || "unmatched",
  }));

  const allDocs = [...billDocs, ...invoiceDocs];

  // Init progress
  await progress.init(transactions.length, bills.length, invoices.length);
  await progress.emit("info", `Loaded ${transactions.length} transactions, ${bills.length} bills, ${invoices.length} invoices`);

  // ============================================
  // STEP 1: QUICK SCAN (Rule-based, instant)
  // ============================================

  progress.setStep("quick_scan");
  await progress.emit("step", "Step 1: Quick Analysis — rule-based scoring, no AI needed");

  const step1Start = Date.now();
  const step1Details: string[] = [];
  const quickMatches: TransactionMatch[] = [];
  const needsAI: Array<{ transaction: any; candidates: MatchCandidate[] }> = [];

  for (const tx of transactions) {
    const matchTx: MatchTransaction = {
      id: tx.id, userId: tx.userId, accountId: tx.accountId,
      date: tx.date,
      description: tx.description || tx.descriptionOriginal || "",
      amount: tx.amount, type: tx.type, currency: tx.currency,
      reconciliationStatus: tx.reconciliationStatus,
    };

    const relevantType = tx.type === "credit" ? "invoice" : "bill";
    const relevantDocs = allDocs.filter(d => d.documentType === relevantType && d.amountRemaining > 0);

    const candidates: MatchCandidate[] = [];
    for (const doc of relevantDocs) {
      const candidate = calculateMatch(matchTx, doc, allAmounts);
      if (candidate.confidence >= 30) {
        candidates.push(candidate);
      }
    }
    candidates.sort((a, b) => b.confidence - a.confidence);
    const topCandidate = candidates[0];

    if (topCandidate && topCandidate.confidence >= autoConfirmThreshold) {
      const doc = topCandidate.document;
      const sig = topCandidate.signals;

      // Build detailed human-readable reasoning for the stream
      const events: ProgressEvent[] = [];
      events.push({ ts: Date.now(), type: "analyze", text: `Analyzing "${tx.description}"`, step: "quick_scan" });

      if (sig.referenceFound) {
        events.push({ ts: Date.now(), type: "search", text: `Found reference '${sig.referenceFound}' in description`, step: "quick_scan" });
      }

      events.push({ ts: Date.now(), type: "search", text: `Searching ${relevantType}s... found ${doc.documentNumber} from ${doc.counterpartyName}`, step: "quick_scan" });

      if (sig.crossCurrency && sig.fxRateUsed) {
        const converted = sig.convertedAmount || Math.abs(tx.amount) / sig.fxRateUsed;
        events.push({ ts: Date.now(), type: "fx", text: `${fmtCurrency(Math.abs(tx.amount), tx.currency || "ANG")} ÷ ${sig.fxRateUsed.toFixed(4)} = ${fmtCurrency(converted, doc.currency)} — ${sig.amountDifferencePercent < 1 ? "exact match" : `${sig.amountDifferencePercent.toFixed(1)}% difference`}`, step: "quick_scan" });
      } else {
        const diff = sig.amountDifferencePercent;
        events.push({ ts: Date.now(), type: "match", text: `Amount ${fmtCurrency(Math.abs(tx.amount), tx.currency || "ANG")} vs ${doc.documentType} ${fmtCurrency(doc.amountRemaining, doc.currency)} — ${diff < 0.5 ? "exact match" : `${diff.toFixed(1)}% difference`}`, step: "quick_scan" });
      }

      const days = daysBetween(tx.date, doc.documentDate);
      if (days > 0) {
        events.push({ ts: Date.now(), type: "info", text: `Payment ${days} days after ${doc.documentType} date — within normal range`, step: "quick_scan" });
      }

      events.push({ ts: Date.now(), type: "confirm", text: `MATCH: ${topCandidate.confidence}% confidence — auto-confirmed`, step: "quick_scan" });

      await progress.emitBatch(events);

      const match: TransactionMatch = {
        transactionId: tx.id,
        classification: "payment_match",
        documentId: doc.id,
        documentType: doc.documentType,
        documentNumber: doc.documentNumber,
        counterpartyName: doc.counterpartyName,
        confidence: topCandidate.confidence,
        reasoning: topCandidate.reasons,
        matchType: topCandidate.matchType,
        fxDetails: sig.crossCurrency ? {
          fromCurrency: sig.transactionCurrency || "USD",
          toCurrency: sig.documentCurrency || "USD",
          rate: sig.fxRateUsed || 1,
          convertedAmount: sig.convertedAmount || Math.abs(tx.amount),
        } : null,
        thinkingLevel: "none",
        autoConfirmed: true,
        ruleBasedScore: topCandidate.confidence,
      };

      quickMatches.push(match);
      step1Details.push(
        `${tx.description?.slice(0, 40)}... → ${doc.documentNumber} (${topCandidate.confidence}%)`
      );
    } else {
      // Log that this needs AI
      if (candidates.length > 0) {
        await progress.emit("analyze", `"${(tx.description || "").slice(0, 50)}" — best rule score ${candidates[0].confidence}%, needs AI`);
      } else {
        await progress.emit("analyze", `"${(tx.description || "").slice(0, 50)}" — no rule-based candidates, needs AI`);
      }
      needsAI.push({ transaction: tx, candidates: candidates.slice(0, 3) });
    }
  }

  steps.push({
    name: "quick_scan", status: "completed",
    count: quickMatches.length, details: step1Details,
    timeMs: Date.now() - step1Start,
  });
  allMatches.push(...quickMatches);

  await progress.emit("info", `Quick scan complete: ${quickMatches.length} auto-confirmed, ${needsAI.length} need AI analysis`);

  // Auto-confirm + learn
  for (const match of quickMatches) {
    try {
      await autoConfirmMatch(userId, match, transactions, allDocs);
      const tx = transactions.find((t: any) => t.id === match.transactionId);
      const doc = allDocs.find(d => d.id === match.documentId);
      if (tx && doc) {
        const vendorName = await learnFromMatchInternal(userId, {
          invoiceId: doc.id, invoiceNumber: doc.documentNumber,
          invoiceAmount: doc.total, invoiceCurrency: doc.currency,
          invoiceDate: doc.documentDate?.toDate?.() || new Date(),
          transactionId: tx.id, transactionAmount: Math.abs(tx.amount),
          transactionCurrency: tx.currency || "USD",
          transactionDate: tx.date?.toDate?.() || new Date(),
          transactionDescription: tx.description || "",
          vendorName: doc.counterpartyName,
          matchType: match.matchType, wasManual: false, aiConfidence: match.confidence,
        });
        if (vendorName && !patternsLearned.includes(vendorName)) {
          patternsLearned.push(vendorName);
          await progress.emit("learn", `Learned pattern for ${vendorName}`);
        }
      }
    } catch (err) {
      logger.error("Auto-confirm error", { transactionId: match.transactionId, error: String(err) });
    }
  }

  // ============================================
  // STEP 2: AI MATCHING — thinking_level: LOW
  // ============================================

  if (needsAI.length === 0) {
    steps.push({ name: "ai_matching", status: "skipped", count: 0, details: ["All matched by rules"], timeMs: 0 });
    steps.push({ name: "deep_investigation", status: "skipped", count: 0, details: ["Not needed"], timeMs: 0 });
    await progress.emit("info", "All transactions matched by rules — AI not needed!");
  } else {
    progress.setStep("ai_matching");
    await progress.emit("step", `Step 2: AI Matching — sending ${needsAI.length} transactions to Gemini 3 Flash (fast thinking)`);

    const step2Start = Date.now();
    const step2Details: string[] = [];
    const aiMatches: TransactionMatch[] = [];
    const needsDeep: Array<{ transaction: any; candidates: MatchCandidate[] }> = [];

    const aiBatchSize = 10;
    const aiBatches: Array<Array<{ transaction: any; candidates: MatchCandidate[] }>> = [];
    for (let i = 0; i < needsAI.length; i += aiBatchSize) {
      aiBatches.push(needsAI.slice(i, i + aiBatchSize));
    }

    const ai = getGoogleAI();
    const concurrency = 4;

    for (let wave = 0; wave < aiBatches.length; wave += concurrency) {
      const waveBatches = aiBatches.slice(wave, wave + concurrency);
      const batchNum = Math.floor(wave / concurrency) + 1;
      const totalWaves = Math.ceil(aiBatches.length / concurrency);

      await progress.emit("info", `Sending batch ${batchNum}/${totalWaves} to Gemini 3 Flash (thinking_level: LOW)...`);

      const waveResults = await Promise.all(
        waveBatches.map(batch => runAIBatch(ai, modelName, batch, bills, invoices, "low"))
      );

      for (const batchResult of waveResults) {
        for (const result of batchResult) {
          // Stream AI reasoning for each result
          const tx = needsAI.find(n => n.transaction.id === result.transactionId)?.transaction;
          const desc = tx?.description?.slice(0, 50) || result.transactionId;

          if (result.classification === "payment_match" && result.confidence >= 60) {
            const events: ProgressEvent[] = [
              { ts: Date.now(), type: "analyze", text: `"${desc}"`, step: "ai_matching" },
              ...result.reasoning.map(r => ({ ts: Date.now(), type: "match" as const, text: r, step: "ai_matching" })),
              { ts: Date.now(), type: "confirm", text: `AI MATCH: ${result.confidence}% → ${result.documentNumber || "document"} (${result.counterpartyName || "vendor"})`, step: "ai_matching" },
            ];
            await progress.emitBatch(events);
            aiMatches.push(result);
            step2Details.push(`${result.reasoning[0] || "AI match"} (${result.confidence}%)`);
          } else if (result.classification === "bank_fee") {
            await progress.emit("classify", `"${desc}" → Bank fee: ${result.reasoning[0] || "fee pattern detected"}`);
            aiMatches.push(result);
            step2Details.push(`Bank fee: ${result.reasoning[0] || "fee pattern"}`);
          } else if (result.classification === "transfer") {
            await progress.emit("classify", `"${desc}" → Internal transfer: ${result.reasoning[0] || "transfer pattern"}`);
            aiMatches.push(result);
            step2Details.push(`Transfer: ${result.reasoning[0] || "transfer pattern"}`);
          } else if (result.confidence > 0 && result.confidence < 60) {
            await progress.emit("escalate", `"${desc}" → uncertain (${result.confidence}%), escalating to deep thinking`);
            const original = needsAI.find(n => n.transaction.id === result.transactionId);
            if (original) needsDeep.push(original);
          } else {
            await progress.emit("classify", `"${desc}" → no match found`);
            aiMatches.push(result);
          }
        }
      }

      if (wave + concurrency < aiBatches.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    steps.push({
      name: "ai_matching", status: "completed",
      count: aiMatches.filter(m => m.classification === "payment_match").length,
      details: step2Details, timeMs: Date.now() - step2Start,
    });
    allMatches.push(...aiMatches);

    const aiPayments = aiMatches.filter(m => m.classification === "payment_match").length;
    const aiFees = aiMatches.filter(m => m.classification === "bank_fee").length;
    await progress.emit("info", `AI matching complete: ${aiPayments} matches, ${aiFees} bank fees, ${needsDeep.length} need deep investigation`);

    // ============================================
    // STEP 3: DEEP INVESTIGATION — thinking_level: HIGH
    // ============================================

    if (needsDeep.length === 0) {
      steps.push({ name: "deep_investigation", status: "skipped", count: 0, details: ["Not needed"], timeMs: 0 });
    } else {
      progress.setStep("deep_investigation");
      await progress.emit("step", `Step 3: Deep Investigation — ${needsDeep.length} complex cases, Gemini 3 Flash (deep thinking)`);

      const step3Start = Date.now();
      const step3Details: string[] = [];
      const deepMatches: TransactionMatch[] = [];
      const deepItems = needsDeep.slice(0, 10);

      for (const item of deepItems) {
        const tx = item.transaction;
        await progress.emit("analyze", `Deep analysis: "${(tx.description || "").slice(0, 60)}" — ${fmtCurrency(Math.abs(tx.amount), tx.currency || "ANG")}`);
        await progress.emit("info", `Engaging Gemini 3 with thinking_level: HIGH for extended reasoning...`);

        const results = await runAIBatch(ai, modelName, [item], bills, invoices, "high");
        for (const result of results) {
          deepMatches.push(result);

          // Stream the deep reasoning
          for (const reason of result.reasoning) {
            await progress.emit("match", reason);
          }

          if (result.classification === "payment_match") {
            await progress.emit("confirm", `DEEP MATCH: ${result.confidence}% → ${result.documentNumber || "document"}`);
            step3Details.push(`Deep: ${result.reasoning.join(" → ")} (${result.confidence}%)`);
          } else {
            await progress.emit("classify", `Deep analysis: ${result.classification} — ${result.reasoning[0] || "no match"}`);
            step3Details.push(`Deep: ${result.reasoning[0] || "no match"}`);
          }
        }
      }

      for (const item of needsDeep.slice(10)) {
        deepMatches.push({
          transactionId: item.transaction.id,
          classification: "needs_review", documentId: null, documentType: null,
          documentNumber: null, counterpartyName: null, confidence: 0,
          reasoning: ["Skipped — too many items for deep analysis"],
          matchType: "none", fxDetails: null, thinkingLevel: "none", autoConfirmed: false,
        });
      }

      steps.push({
        name: "deep_investigation", status: "completed",
        count: deepMatches.filter(m => m.classification === "payment_match").length,
        details: step3Details, timeMs: Date.now() - step3Start,
      });
      allMatches.push(...deepMatches);
    }
  }

  // ============================================
  // STEP 4: LEARNING
  // ============================================

  progress.setStep("learning");
  if (patternsLearned.length > 0) {
    await progress.emit("step", `Step 4: Pattern Memory — ${patternsLearned.length} vendor patterns updated`);
    for (const vendor of patternsLearned) {
      await progress.emit("learn", `Updated pattern for ${vendor}`);
    }
  }

  steps.push({
    name: "learning",
    status: patternsLearned.length > 0 ? "completed" : "skipped",
    count: patternsLearned.length,
    details: patternsLearned.map(v => `Updated pattern for ${v}`),
    timeMs: 0,
  });

  // ============================================
  // BUILD STATS
  // ============================================

  const paymentMatches = allMatches.filter(m => m.classification === "payment_match");
  const bankFees = allMatches.filter(m => m.classification === "bank_fee");
  const transfers = allMatches.filter(m => m.classification === "transfer");
  const noMatch = allMatches.filter(m => m.classification === "no_match");
  const needsReview = allMatches.filter(m => m.classification === "needs_review");
  const autoConfirmed = allMatches.filter(m => m.autoConfirmed);

  const stats: ReconcileStats = {
    totalTransactions: transactions.length,
    quickMatches: quickMatches.length,
    aiMatches: paymentMatches.length - quickMatches.length,
    deepMatches: allMatches.filter(m => m.thinkingLevel === "high" && m.classification === "payment_match").length,
    bankFees: bankFees.length,
    noMatch: noMatch.length + transfers.length,
    autoConfirmed: autoConfirmed.length,
    needsReview: needsReview.length + paymentMatches.filter(m => !m.autoConfirmed && m.confidence < autoConfirmThreshold).length,
    matchRate: transactions.length > 0
      ? Math.round(((paymentMatches.length + bankFees.length + transfers.length) / transactions.length) * 100)
      : 100,
  };

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  await progress.emit("info", `Reconciliation complete in ${elapsed}s — ${stats.matchRate}% match rate`);
  await progress.complete(stats);

  // Track AI usage
  try {
    await db.collection("ai_usage").add({
      userId, functionName: "reconcileAll",
      transactionsProcessed: transactions.length,
      quickMatches: stats.quickMatches, aiMatches: stats.aiMatches,
      deepMatches: stats.deepMatches, bankFees: stats.bankFees,
      autoConfirmed: stats.autoConfirmed, matchRate: stats.matchRate,
      processingTimeMs: Date.now() - startTime, model: modelName,
      createdAt: Timestamp.now(),
    });
  } catch (e) { /* Non-critical */ }

  logger.info("Reconciliation complete", { userId, ...stats, processingTimeMs: Date.now() - startTime });

  return {
    steps, matches: allMatches, stats, patternsLearned,
    processingTimeMs: Date.now() - startTime, model: modelName, progressId,
  };
}

// ============================================
// AI BATCH PROCESSING
// ============================================

async function runAIBatch(
  ai: ReturnType<typeof getGoogleAI>,
  modelName: string,
  items: Array<{ transaction: any; candidates: MatchCandidate[] }>,
  bills: any[],
  invoices: any[],
  thinkingLevel: "low" | "high"
): Promise<TransactionMatch[]> {
  const transactionContext = items.map(item => {
    const tx = item.transaction;
    const candidateInfo = item.candidates.length > 0
      ? item.candidates.map((c, i) => {
          const doc = c.document;
          return `    ${i + 1}. ${doc.documentType} ${doc.documentNumber} (${doc.counterpartyName}, ${doc.currency} ${doc.amountRemaining.toFixed(2)}) → Rule score: ${c.confidence}% [${c.reasons.join(", ")}]${c.warnings.length > 0 ? ` ⚠ ${c.warnings.join(", ")}` : ""}`;
        }).join("\n")
      : "    No rule-based candidates found.";

    return `TRANSACTION: ${tx.id}
  Description: "${tx.description || tx.descriptionOriginal || "N/A"}"
  Amount: ${tx.currency || "ANG"} ${Math.abs(tx.amount).toFixed(2)}
  Type: ${tx.type} (${tx.type === "debit" ? "money out → match to bills" : "money in → match to invoices"})
  Date: ${tx.date?.toDate ? tx.date.toDate().toISOString().split("T")[0] : (tx.date?._seconds ? new Date(tx.date._seconds * 1000).toISOString().split("T")[0] : "unknown")}
  Reference: ${tx.reference || "none"}
  Pre-analyzed candidates:
${candidateInfo}`;
  }).join("\n\n");

  const prompt = `You are an expert financial reconciliation AI. For each bank transaction below, determine the correct match.

${thinkingLevel === "high" ? `DEEP ANALYSIS MODE: Think carefully about each transaction. Consider:
- FX conversions (1 USD ≈ 1.79 ANG, 1 EUR ≈ 1.94 ANG)
- Combined payments (one transaction paying multiple bills)
- Partial payments and installments  
- Payment processor fees (Stripe 2.9%, PayPal 2.9%)
- Reference numbers that may be abbreviated or reformatted
- Vendor name variations and aliases
` : `FAST ANALYSIS MODE: Quickly classify each transaction. Focus on:
- Obvious matches from the pre-analysis
- Bank fees (small recurring debits like "Monthly Fee", "SWIFT Charges")
- Internal transfers between accounts
`}

I've already pre-analyzed each transaction with rule-based scoring. Review my analysis and either confirm the top candidate, override with a better match, or classify as a bank fee / no match.

${transactionContext}

For each transaction, provide:
- classification: "payment_match" if it matches a bill/invoice, "bank_fee" if it's a bank charge, "transfer" if internal, "no_match" if nothing matches, "needs_review" if you're uncertain
- documentId: the matched bill/invoice ID (null if not a payment_match)
- documentType: "bill" or "invoice" (null if not a payment_match)
- confidence: 0-100
- reasoning: array of 2-4 short explanation strings showing your step-by-step logic chain (e.g. "Found reference '15998' in description", "Bill INV-15998 from GlobalTech matches", "ANG 4,399.82 ÷ 1.79 = USD 2,458.00 — exact", "Payment 15 days after invoice — consistent with vendor pattern")
- matchType: "exact", "fx_converted", "partial", "combined", "fee_adjusted"

Return JSON with a "matches" array.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingLevel: thinkingLevel === "high" ? ThinkingLevel.HIGH : ThinkingLevel.LOW,
        },
      },
    });

    const text = response.text || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      logger.error("AI JSON parse failed", { text: text.slice(0, 500) });
      return items.map(item => fallbackResult(item.transaction.id, thinkingLevel));
    }

    const aiMatches = parsed.matches || parsed.analysis || [];

    return items.map(item => {
      const aiMatch = aiMatches.find((m: any) => m.transactionId === item.transaction.id);
      if (!aiMatch) return fallbackResult(item.transaction.id, thinkingLevel);

      let docNumber: string | null = null;
      let counterpartyName: string | null = null;
      if (aiMatch.documentId) {
        const doc = [...bills, ...invoices].find((d: any) => d.id === aiMatch.documentId);
        if (doc) {
          docNumber = (doc as any).documentNumber || (doc as any).invoiceNumber || null;
          counterpartyName = (doc as any).vendorName || (doc as any).customerName || null;
        }
      }

      return {
        transactionId: item.transaction.id,
        classification: aiMatch.classification || "no_match",
        documentId: aiMatch.documentId || null,
        documentType: aiMatch.documentType || null,
        documentNumber: docNumber || aiMatch.documentNumber || null,
        counterpartyName: counterpartyName || aiMatch.counterpartyName || null,
        confidence: aiMatch.confidence || 0,
        reasoning: Array.isArray(aiMatch.reasoning)
          ? aiMatch.reasoning
          : [aiMatch.explanation || aiMatch.reasoning || "No explanation"],
        matchType: aiMatch.matchType || "none",
        fxDetails: aiMatch.fxDetails || null,
        thinkingLevel,
        autoConfirmed: false,
        ruleBasedScore: item.candidates[0]?.confidence,
      } as TransactionMatch;
    });
  } catch (error: any) {
    logger.error("AI batch error", { error: error.message, thinkingLevel });
    return items.map(item => fallbackResult(item.transaction.id, thinkingLevel));
  }
}

function fallbackResult(transactionId: string, thinkingLevel: "low" | "high"): TransactionMatch {
  return {
    transactionId, classification: "needs_review",
    documentId: null, documentType: null, documentNumber: null, counterpartyName: null,
    confidence: 0, reasoning: ["AI analysis failed — needs manual review"],
    matchType: "none", fxDetails: null, thinkingLevel, autoConfirmed: false,
  };
}

// ============================================
// AUTO-CONFIRM IN FIRESTORE
// ============================================

async function autoConfirmMatch(
  userId: string, match: TransactionMatch,
  transactions: any[], documents: MatchDocument[]
): Promise<void> {
  if (!match.documentId || !match.documentType) return;
  const tx = transactions.find((t: any) => t.id === match.transactionId);
  const doc = documents.find(d => d.id === match.documentId);
  if (!tx || !doc) return;

  const collectionName = match.documentType === "bill" ? "bills" : "invoices";
  const txAmount = Math.abs(tx.amount);
  const docTotal = doc.total || 0;
  const docRemaining = doc.amountRemaining ?? docTotal;
  const amountToAllocate = Math.min(txAmount, docRemaining);
  const existingPaid = docTotal - docRemaining;
  const newAmountPaid = existingPaid + amountToAllocate;
  const newAmountRemaining = docRemaining - amountToAllocate;
  const paymentStatus = newAmountRemaining <= 0.01
    ? (newAmountRemaining < -0.01 ? "overpaid" : "paid")
    : (newAmountPaid > 0 ? "partial" : "unpaid");

  const now = Timestamp.now();

  const linkedPayment = {
    transactionId: match.transactionId, transactionDate: tx.date,
    transactionDescription: tx.description, amount: amountToAllocate,
    linkedAt: now, linkedBy: "ai_engine", confidence: match.confidence,
    method: `auto_${match.thinkingLevel || "rule"}`,
  };

  await db.collection(collectionName).doc(match.documentId).update({
    paymentStatus, amountPaid: FieldValue.increment(amountToAllocate),
    amountRemaining: Math.max(0, newAmountRemaining),
    reconciliationStatus: paymentStatus === "paid" ? "matched" : "partial",
    payments: FieldValue.arrayUnion(linkedPayment), updatedAt: now,
  });

  await db.collection("transactions").doc(match.transactionId).update({
    reconciliationStatus: "matched", matchedDocumentId: match.documentId,
    matchedDocumentType: match.documentType, matchedDocumentNumber: match.documentNumber,
    matchedAt: now, matchedBy: "ai_engine", matchConfidence: match.confidence,
    matchMethod: `auto_${match.thinkingLevel || "rule"}`,
  });

  await db.collection("reconciliation_matches").add({
    userId, transactionId: match.transactionId, transactionDate: tx.date,
    transactionAmount: txAmount, transactionDescription: tx.description,
    transactionType: tx.type, accountId: tx.accountId,
    documentId: match.documentId, documentType: match.documentType,
    documentNumber: match.documentNumber, documentAmount: docTotal,
    counterpartyName: match.counterpartyName, matchType: match.matchType,
    allocationAmount: amountToAllocate, confidence: match.confidence,
    matchMethod: `auto_${match.thinkingLevel || "rule"}`,
    status: "confirmed", reasoning: match.reasoning,
    thinkingLevel: match.thinkingLevel,
    confirmedAt: now, confirmedBy: "ai_engine", createdAt: now, updatedAt: now,
  });
}

function emptyStats(): ReconcileStats {
  return {
    totalTransactions: 0, quickMatches: 0, aiMatches: 0, deepMatches: 0,
    bankFees: 0, noMatch: 0, autoConfirmed: 0, needsReview: 0, matchRate: 100,
  };
}
