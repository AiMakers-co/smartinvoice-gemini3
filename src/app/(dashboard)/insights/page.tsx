"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Repeat,
  ArrowRight,
  ChevronRight,
  DollarSign,
  Users,
  ShieldCheck,
  Zap,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Eye,
} from "lucide-react";
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Transaction } from "@/types";

// ============================================
// UTILITIES
// ============================================

function formatCurrency(amount: number | undefined | null, currency: string = "USD"): string {
  if (amount === undefined || amount === null || isNaN(amount)) return `${currency} 0`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyFull(amount: number | undefined | null, currency: string = "USD"): string {
  if (amount === undefined || amount === null || isNaN(amount)) return `${currency} 0.00`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ============================================
// MAIN
// ============================================

export default function InsightsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [vendorPatterns, setVendorPatterns] = useState<any[]>([]);
  const [reconMatches, setReconMatches] = useState<any[]>([]);
  const [reconRuns, setReconRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load transactions
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "transactions"), where("userId", "==", user.id), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user]);

  // Load vendor patterns
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "vendor_patterns"), where("userId", "==", user.id));
    const unsub = onSnapshot(q, (snap) => setVendorPatterns(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    return () => unsub();
  }, [user]);

  // Load reconciliation matches
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "reconciliation_matches"), where("userId", "==", user.id), orderBy("createdAt", "desc"), limit(50));
    const unsub = onSnapshot(q, (snap) => setReconMatches(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    return () => unsub();
  }, [user]);

  // Load reconciliation runs (for match rate fallback)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "reconciliation_runs"), where("userId", "==", user.id), orderBy("updatedAt", "desc"), limit(5));
    const unsub = onSnapshot(q, (snap) => setReconRuns(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    return () => unsub();
  }, [user]);

  // ============================================
  // COMPUTED INSIGHTS
  // ============================================

  const insights = useMemo(() => {
    if (transactions.length === 0) return null;

    // --- Spending by category ---
    const categoryMap = new Map<string, { total: number; count: number }>();
    const counterpartyMap = new Map<string, { total: number; count: number; type: string }>();
    let totalCredits = 0;
    let totalDebits = 0;
    let largestDebit = { amount: 0, description: "", date: new Date() };
    let largestCredit = { amount: 0, description: "", date: new Date() };

    transactions.forEach((tx: any) => {
      const amount = Math.abs(tx.amount);
      const cat = tx.category || "Uncategorized";
      const cp = tx.counterparty || tx.merchant || "";
      const date = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);

      if (tx.type === "debit") {
        totalDebits += amount;
        const existing = categoryMap.get(cat) || { total: 0, count: 0 };
        categoryMap.set(cat, { total: existing.total + amount, count: existing.count + 1 });
        if (amount > largestDebit.amount) {
          largestDebit = { amount, description: tx.description, date };
        }
      } else {
        totalCredits += amount;
        if (amount > largestCredit.amount) {
          largestCredit = { amount, description: tx.description, date };
        }
      }

      if (cp) {
        const existing = counterpartyMap.get(cp) || { total: 0, count: 0, type: tx.type };
        counterpartyMap.set(cp, { total: existing.total + amount, count: existing.count + 1, type: tx.type });
      }
    });

    // Sort categories by total
    const topCategories = Array.from(categoryMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const maxCategoryTotal = topCategories[0]?.total || 1;

    // Top counterparties
    const topVendors = Array.from(counterpartyMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .filter(v => v.type === "debit")
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const topClients = Array.from(counterpartyMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .filter(v => v.type === "credit")
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    // --- Reconciliation quality ---
    const reconByType = new Map<string, number>();
    let avgConfidence = 0;
    reconMatches.forEach((m: any) => {
      const type = m.matchType || "unknown";
      reconByType.set(type, (reconByType.get(type) || 0) + 1);
      avgConfidence += (m.confidence || 0);
    });
    if (reconMatches.length > 0) {
      avgConfidence = avgConfidence / reconMatches.length;
      // Handle decimal confidence values (0.0-1.0) vs percentage (0-100)
      if (avgConfidence < 1) avgConfidence = Math.round(avgConfidence * 100);
      else avgConfidence = Math.round(avgConfidence);
    }

    const matchTypes = Array.from(reconByType.entries())
      .map(([type, count]) => ({ type: type.replace(/_/g, " "), count }))
      .sort((a, b) => b.count - a.count);

    // --- Anomalies / attention items ---
    const anomalies: { type: string; severity: "high" | "medium" | "low"; description: string; detail: string }[] = [];

    // Large single transactions (> 2 std dev from mean)
    const debitAmounts = transactions.filter((t: any) => t.type === "debit").map((t: any) => t.amount);
    if (debitAmounts.length > 5) {
      const mean = debitAmounts.reduce((a: number, b: number) => a + b, 0) / debitAmounts.length;
      const variance = debitAmounts.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / debitAmounts.length;
      const stdDev = Math.sqrt(variance);
      const threshold = mean + 2 * stdDev;
      const outliers = transactions.filter((t: any) => t.type === "debit" && t.amount > threshold);
      if (outliers.length > 0) {
        anomalies.push({
          type: "large_transaction",
          severity: "medium",
          description: `${outliers.length} unusually large payment${outliers.length > 1 ? "s" : ""} detected`,
          detail: `Payments above ${formatCurrency(threshold)} (2x standard deviation from average)`,
        });
      }
    }

    // Slow payers from vendor patterns
    const slowPayers = vendorPatterns.filter((p: any) => p.typicalDelay && p.typicalDelay.max > 30);
    if (slowPayers.length > 0) {
      anomalies.push({
        type: "slow_payer",
        severity: "low",
        description: `${slowPayers.length} vendor${slowPayers.length > 1 ? "s" : ""} with 30+ day payment delays`,
        detail: slowPayers.map((p: any) => `${p.vendorName} (${p.typicalDelay.min}-${p.typicalDelay.max}d)`).join(", "),
      });
    }

    // Unmatched rate
    const matched = transactions.filter((t: any) => {
      const status = t.reconciliationStatus || (t.reconciled ? "matched" : "unmatched");
      return status === "matched" || status === "categorized";
    }).length;
    // Use reconciliation run data if transaction-level data isn't populated
    const latestRun = reconRuns.find((r: any) => r.status === "completed");
    const effectiveMatched = matched > 0 ? matched : (latestRun?.totalMatched || 0);
    const effectiveTotal = matched > 0 ? transactions.length : (latestRun?.totalTransactions || transactions.length);
    const unmatchedRate = effectiveTotal > 0 ? ((effectiveTotal - effectiveMatched) / effectiveTotal) * 100 : 0;
    if (unmatchedRate > 20) {
      anomalies.push({
        type: "low_match_rate",
        severity: "high",
        description: `${Math.round(unmatchedRate)}% of transactions are unreconciled`,
        detail: `${effectiveTotal - effectiveMatched} of ${effectiveTotal} transactions haven't been matched to invoices or bills`,
      });
    }

    // FX transactions
    const fxMatches = reconMatches.filter((m: any) => m.matchType === "fx_conversion" || m.transactionCurrency !== m.documentCurrency);
    if (fxMatches.length > 0) {
      anomalies.push({
        type: "fx_exposure",
        severity: "low",
        description: `${fxMatches.length} cross-currency transaction${fxMatches.length > 1 ? "s" : ""} detected`,
        detail: "FX conversion matches may have rate variation — review for accuracy",
      });
    }

    // --- Monthly trend ---
    const monthlyMap = new Map<string, { credits: number; debits: number }>();
    transactions.forEach((tx: any) => {
      const date = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthlyMap.get(key) || { credits: 0, debits: 0 };
      if (tx.type === "credit") existing.credits += tx.amount;
      else existing.debits += tx.amount;
      monthlyMap.set(key, existing);
    });

    const months = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-3);

    let spendingTrend: "up" | "down" | "flat" = "flat";
    if (months.length >= 2) {
      const recent = months[months.length - 1][1].debits;
      const prior = months[months.length - 2][1].debits;
      if (recent > prior * 1.1) spendingTrend = "up";
      else if (recent < prior * 0.9) spendingTrend = "down";
    }

    return {
      totalCredits,
      totalDebits,
      netCashFlow: totalCredits - totalDebits,
      topCategories,
      maxCategoryTotal,
      topVendors,
      topClients,
      largestDebit,
      largestCredit,
      avgConfidence,
      matchTypes,
      anomalies,
      spendingTrend,
      matchRate: (() => {
        // If transactions have reconciliation statuses, use that
        if (matched > 0) return Math.round((matched / transactions.length) * 100);
        // Otherwise use latest completed reconciliation run
        const latestRun = reconRuns.find((r: any) => r.status === "completed");
        if (latestRun && latestRun.totalTransactions > 0) {
          return Math.round((latestRun.totalMatched / latestRun.totalTransactions) * 100);
        }
        return 0;
      })(),
    };
  }, [transactions, vendorPatterns, reconMatches, reconRuns]);

  return (
    <div className="flex flex-col h-full bg-white">
      <Header title="AI Insights" />

      <div className="flex-1 px-6 py-5 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Brain className="h-6 w-6 text-purple-400 animate-pulse" />
          </div>
        ) : !insights || transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Brain className="h-10 w-10 text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-600">No data to analyze yet</p>
            <p className="text-xs text-slate-400 mt-1">Upload bank statements to generate AI insights</p>
            <Button size="sm" className="mt-4" asChild>
              <Link href="/accounts">Upload Statement</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">AI Insights</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Analysis of {transactions.length} transactions across your accounts
                </p>
              </div>
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                <Brain className="h-4 w-4 text-purple-500" />
                <span className="text-xs font-medium text-slate-600">Powered by Gemini 3</span>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-5 gap-4">
              <div className="border border-slate-200 rounded-xl px-4 py-3.5">
                <p className="text-xs text-slate-500">Total Income</p>
                <p className="text-lg font-semibold text-emerald-600 mt-1">{formatCurrency(insights.totalCredits)}</p>
              </div>
              <div className="border border-slate-200 rounded-xl px-4 py-3.5">
                <p className="text-xs text-slate-500">Total Spending</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">{formatCurrency(insights.totalDebits)}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {insights.spendingTrend === "up" ? (
                    <><ArrowUpRight className="h-3 w-3 text-red-500" /><span className="text-[10px] text-red-500">Trending up</span></>
                  ) : insights.spendingTrend === "down" ? (
                    <><ArrowDownRight className="h-3 w-3 text-emerald-500" /><span className="text-[10px] text-emerald-500">Trending down</span></>
                  ) : (
                    <span className="text-[10px] text-slate-400">Stable</span>
                  )}
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl px-4 py-3.5">
                <p className="text-xs text-slate-500">Net Cash Flow</p>
                <p className={`text-lg font-semibold mt-1 ${insights.netCashFlow >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {insights.netCashFlow >= 0 ? "+" : ""}{formatCurrency(insights.netCashFlow)}
                </p>
              </div>
              <div className="border border-slate-200 rounded-xl px-4 py-3.5">
                <p className="text-xs text-slate-500">Reconciliation</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">{insights.matchRate}%</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{insights.avgConfidence}% avg confidence</p>
              </div>
              <div className="border border-slate-200 rounded-xl px-4 py-3.5">
                <p className="text-xs text-slate-500">Alerts</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">{insights.anomalies.length}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {insights.anomalies.filter(a => a.severity === "high").length > 0
                    ? `${insights.anomalies.filter(a => a.severity === "high").length} high priority`
                    : "No critical issues"}
                </p>
              </div>
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-12 gap-5">
              {/* Left column */}
              <div className="col-span-8 space-y-5">
                {/* Anomalies / Attention */}
                {insights.anomalies.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                      <Eye className="h-4 w-4 text-amber-500" />
                      <h3 className="text-sm font-semibold text-slate-900">Anomaly Detection</h3>
                      <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full ml-auto">AI</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {insights.anomalies.map((anomaly, i) => (
                        <div key={i} className="px-5 py-3 flex items-start gap-3">
                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            anomaly.severity === "high" ? "bg-red-50" :
                            anomaly.severity === "medium" ? "bg-amber-50" : "bg-slate-50"
                          }`}>
                            {anomaly.type === "large_transaction" && <TrendingUp className={`h-3.5 w-3.5 ${anomaly.severity === "high" ? "text-red-500" : "text-amber-500"}`} />}
                            {anomaly.type === "slow_payer" && <Clock className="h-3.5 w-3.5 text-slate-500" />}
                            {anomaly.type === "low_match_rate" && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                            {anomaly.type === "fx_exposure" && <DollarSign className="h-3.5 w-3.5 text-slate-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-900">{anomaly.description}</p>
                              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                                anomaly.severity === "high" ? "bg-red-100 text-red-700" :
                                anomaly.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                              }`}>
                                {anomaly.severity}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{anomaly.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Spending by Category */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">Spending by Category</h3>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    {insights.topCategories.map((cat) => (
                      <div key={cat.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-700">{cat.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-400">{cat.count} txn{cat.count !== 1 ? "s" : ""}</span>
                            <span className="text-xs font-semibold text-slate-900 w-24 text-right">{formatCurrency(cat.total)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-800 rounded-full"
                            style={{ width: `${(cat.total / insights.maxCategoryTotal) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Vendors & Clients */}
                <div className="grid grid-cols-2 gap-5">
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-900">Top Vendors</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {insights.topVendors.map((v, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] text-slate-400 w-4">{i + 1}.</span>
                            <span className="text-xs text-slate-700 truncate">{v.name}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-semibold text-slate-900">{formatCurrency(v.total)}</span>
                            <span className="text-[10px] text-slate-400 ml-2">{v.count}x</span>
                          </div>
                        </div>
                      ))}
                      {insights.topVendors.length === 0 && (
                        <p className="px-4 py-4 text-xs text-slate-400 text-center">No vendor data</p>
                      )}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-900">Top Clients</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {insights.topClients.map((c, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] text-slate-400 w-4">{i + 1}.</span>
                            <span className="text-xs text-slate-700 truncate">{c.name}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-semibold text-emerald-600">{formatCurrency(c.total)}</span>
                            <span className="text-[10px] text-slate-400 ml-2">{c.count}x</span>
                          </div>
                        </div>
                      ))}
                      {insights.topClients.length === 0 && (
                        <p className="px-4 py-4 text-xs text-slate-400 text-center">No client data</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="col-span-4 space-y-5">
                {/* Vendor Intelligence */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Vendor Intelligence</h3>
                    <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">AI Learned</span>
                  </div>
                  {vendorPatterns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                      <Repeat className="h-5 w-5 text-slate-200 mb-2" />
                      <p className="text-xs text-slate-500">No patterns learned yet</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">AI learns after reconciliation</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {vendorPatterns.map((p: any) => (
                        <div key={p.id} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-slate-900">{p.vendorName}</span>
                            <span className="text-[10px] text-emerald-600 font-medium">{p.matchCount} matches</span>
                          </div>
                          <div className="space-y-1">
                            {p.typicalDelay && (
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <Clock className="h-2.5 w-2.5" />
                                <span>Pays in {p.typicalDelay.min}-{p.typicalDelay.max} days</span>
                                {p.typicalDelay.max > 30 && (
                                  <span className="text-amber-500 font-medium ml-1">Slow payer</span>
                                )}
                              </div>
                            )}
                            {p.amountVariation && (
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <DollarSign className="h-2.5 w-2.5" />
                                <span>{p.amountVariation.value}% {p.amountVariation.reason?.replace(/_/g, " ")}</span>
                              </div>
                            )}
                            {p.aliases && p.aliases.length > 0 && (
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <Users className="h-2.5 w-2.5" />
                                <span>Also: {p.aliases.slice(0, 2).join(", ")}</span>
                              </div>
                            )}
                            {p.currency && p.currency !== "USD" && (
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <Zap className="h-2.5 w-2.5" />
                                <span>Invoices in {p.currency}</span>
                                {p.typicalFxVariation && <span>({p.typicalFxVariation}% FX tolerance)</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Match Quality */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">Match Quality</h3>
                  </div>
                  {reconMatches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                      <ShieldCheck className="h-5 w-5 text-slate-200 mb-2" />
                      <p className="text-xs text-slate-500">No matches yet</p>
                    </div>
                  ) : (
                    <div className="px-4 py-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Avg confidence</span>
                        <span className="text-xs font-semibold text-slate-900">{insights.avgConfidence}%</span>
                      </div>
                      <div className="space-y-1.5">
                        {insights.matchTypes.map((mt) => (
                          <div key={mt.type} className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-600 capitalize">{mt.type}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-purple-400 rounded-full"
                                  style={{ width: `${(mt.count / reconMatches.length) * 100}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 w-4 text-right">{mt.count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notable Transactions */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-900">Notable Transactions</h3>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Largest payment</p>
                      <p className="text-xs font-medium text-slate-900 truncate">{insights.largestDebit.description || "--"}</p>
                      <p className="text-xs font-semibold text-slate-700">{formatCurrencyFull(insights.largestDebit.amount)}</p>
                    </div>
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-[10px] text-slate-400 mb-0.5">Largest receipt</p>
                      <p className="text-xs font-medium text-slate-900 truncate">{insights.largestCredit.description || "--"}</p>
                      <p className="text-xs font-semibold text-emerald-600">{formatCurrencyFull(insights.largestCredit.amount)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
