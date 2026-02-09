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
  Shield,
  Copy,
  Calendar,
  Activity,
  Terminal,
  AlertCircle,
  Search,
  FileWarning,
  Scan,
  Upload,
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
  const [scanComplete, setScanComplete] = useState(false);

  // Animate scan completion
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setScanComplete(true), transactions.length > 0 ? 1200 : 600);
      return () => clearTimeout(timer);
    }
  }, [loading, transactions.length]);

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

  // Load reconciliation runs
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
    const hasData = transactions.length > 0;

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

    const topCategories = Array.from(categoryMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const maxCategoryTotal = topCategories[0]?.total || 1;

    const topVendors = Array.from(counterpartyMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .filter(v => v.type === "debit")
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const topClients = Array.from(counterpartyMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .filter(v => v.type === "credit")
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

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
      if (avgConfidence < 1) avgConfidence = Math.round(avgConfidence * 100);
      else avgConfidence = Math.round(avgConfidence);
    }

    const matchTypes = Array.from(reconByType.entries())
      .map(([type, count]) => ({ type: type.replace(/_/g, " "), count }))
      .sort((a, b) => b.count - a.count);

    // --- ANOMALY DETECTION ENGINE ---
    const anomalies: { type: string; severity: "critical" | "high" | "medium" | "low"; description: string; detail: string; evidence: string[]; icon: string }[] = [];

    if (hasData) {
      // 1. Large transaction outliers (>2 std dev)
      const debitAmounts = transactions.filter((t: any) => t.type === "debit").map((t: any) => Math.abs(t.amount));
      if (debitAmounts.length > 5) {
        const mean = debitAmounts.reduce((a: number, b: number) => a + b, 0) / debitAmounts.length;
        const variance = debitAmounts.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / debitAmounts.length;
        const stdDev = Math.sqrt(variance);
        const threshold = mean + 2 * stdDev;
        const outliers = transactions.filter((t: any) => t.type === "debit" && Math.abs(t.amount) > threshold);
        if (outliers.length > 0) {
          anomalies.push({
            type: "large_transaction",
            severity: "medium",
            icon: "dollar",
            description: `${outliers.length} unusually large payment${outliers.length > 1 ? "s" : ""} detected`,
            detail: `Payments exceeding ${formatCurrency(threshold)} (2\u03C3 above mean of ${formatCurrency(mean)})`,
            evidence: outliers.slice(0, 3).map((t: any) => {
              const d = t.date instanceof Timestamp ? t.date.toDate() : new Date(t.date);
              return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} \u2014 ${t.description} \u2014 ${formatCurrencyFull(Math.abs(t.amount))}`;
            }),
          });
        }
      }

      // 2. Duplicate payments — same amount + similar description within 30 days
      const debits = transactions.filter((t: any) => t.type === "debit" && Math.abs(t.amount) > 10);
      const duplicatePairs: { a: any; b: any }[] = [];
      for (let i = 0; i < debits.length; i++) {
        for (let j = i + 1; j < debits.length; j++) {
          const a = debits[i];
          const b = debits[j];
          if (Math.abs(Math.abs(a.amount) - Math.abs(b.amount)) < 0.01) {
            const dateA = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date);
            const dateB = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date);
            const daysDiff = Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff <= 30 && daysDiff > 0) {
              const descA = (a.description || "").toLowerCase().replace(/[^a-z]/g, "");
              const descB = (b.description || "").toLowerCase().replace(/[^a-z]/g, "");
              if (descA && descB && (descA.includes(descB.slice(0, 8)) || descB.includes(descA.slice(0, 8)))) {
                duplicatePairs.push({ a, b });
              }
            }
          }
        }
      }
      if (duplicatePairs.length > 0) {
        anomalies.push({
          type: "duplicate_payment",
          severity: "critical",
          icon: "copy",
          description: `${duplicatePairs.length} potential duplicate payment${duplicatePairs.length > 1 ? "s" : ""} flagged`,
          detail: "Same amount and similar vendor within 30-day window \u2014 possible double-billing or processing error",
          evidence: duplicatePairs.slice(0, 3).map(({ a, b }) => {
            const dA = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date);
            const dB = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date);
            return `${a.description?.slice(0, 30)} \u2014 ${formatCurrencyFull(Math.abs(a.amount))} \u00D7 2 (${dA.toLocaleDateString("en-US", { month: "short", day: "numeric" })} & ${dB.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
          }),
        });
      }

      // 3. Weekend payments >$5k
      const weekendPayments = transactions.filter((t: any) => {
        if (t.type !== "debit" || Math.abs(t.amount) < 5000) return false;
        const date = t.date instanceof Timestamp ? t.date.toDate() : new Date(t.date);
        const day = date.getDay();
        return day === 0 || day === 6;
      });
      if (weekendPayments.length > 0) {
        anomalies.push({
          type: "weekend_payment",
          severity: "high",
          icon: "calendar",
          description: `${weekendPayments.length} large weekend payment${weekendPayments.length > 1 ? "s" : ""} (>$5K)`,
          detail: "High-value payments processed outside normal business hours \u2014 potential unauthorized activity",
          evidence: weekendPayments.slice(0, 3).map((t: any) => {
            const d = t.date instanceof Timestamp ? t.date.toDate() : new Date(t.date);
            const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
            return `${dayName} ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} \u2014 ${t.description?.slice(0, 30)} \u2014 ${formatCurrencyFull(Math.abs(t.amount))}`;
          }),
        });
      }

      // 4. Round number payments to unknown vendors
      const roundPayments = transactions.filter((t: any) => {
        if (t.type !== "debit") return false;
        const abs = Math.abs(t.amount);
        return abs >= 1000 && abs % 1000 === 0 && (t.category === "Unknown" || !t.category);
      });
      if (roundPayments.length > 0) {
        anomalies.push({
          type: "round_number",
          severity: "high",
          icon: "alert",
          description: `${roundPayments.length} round-number payment${roundPayments.length > 1 ? "s" : ""} to unrecognized vendors`,
          detail: "Exact round amounts to unknown payees are a common fraud indicator",
          evidence: roundPayments.slice(0, 3).map((t: any) => {
            const d = t.date instanceof Timestamp ? t.date.toDate() : new Date(t.date);
            return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} \u2014 ${t.description} \u2014 ${formatCurrencyFull(Math.abs(t.amount))}`;
          }),
        });
      }

      // 5. Slow payers from vendor patterns
      const slowPayers = vendorPatterns.filter((p: any) => p.typicalDelay && p.typicalDelay.max > 30);
      if (slowPayers.length > 0) {
        anomalies.push({
          type: "slow_payer",
          severity: "medium",
          icon: "clock",
          description: `${slowPayers.length} vendor${slowPayers.length > 1 ? "s" : ""} with 30+ day payment delays`,
          detail: "Chronic late payers increase working capital risk",
          evidence: slowPayers.map((p: any) => `${p.vendorName} \u2014 avg ${p.typicalDelay.min}-${p.typicalDelay.max} days (${p.matchCount} data points)`),
        });
      }

      // 6. Low reconciliation match rate
      const matched = transactions.filter((t: any) => {
        const status = t.reconciliationStatus || (t.reconciled ? "matched" : "unmatched");
        return status === "matched" || status === "categorized";
      }).length;
      const latestRun = reconRuns.find((r: any) => r.status === "completed");
      const effectiveMatched = matched > 0 ? matched : (latestRun?.totalMatched || 0);
      const effectiveTotal = matched > 0 ? transactions.length : (latestRun?.totalTransactions || transactions.length);
      const unmatchedRate = effectiveTotal > 0 ? ((effectiveTotal - effectiveMatched) / effectiveTotal) * 100 : 0;
      if (unmatchedRate > 20) {
        anomalies.push({
          type: "low_match_rate",
          severity: "high",
          icon: "shield",
          description: `${Math.round(unmatchedRate)}% of transactions are unreconciled`,
          detail: `${effectiveTotal - effectiveMatched} of ${effectiveTotal} transactions have no matching invoice or bill`,
          evidence: [`Match rate: ${(100 - unmatchedRate).toFixed(1)}% \u2014 industry target is >95%`],
        });
      }

      // 7. FX transactions
      const fxMatches = reconMatches.filter((m: any) => m.matchType === "fx_conversion" || m.transactionCurrency !== m.documentCurrency);
      if (fxMatches.length > 0) {
        anomalies.push({
          type: "fx_exposure",
          severity: "low",
          icon: "zap",
          description: `${fxMatches.length} cross-currency transaction${fxMatches.length > 1 ? "s" : ""}`,
          detail: "FX conversion matches may have rate variation \u2014 review for accuracy",
          evidence: [`${fxMatches.length} FX transactions detected in reconciliation data`],
        });
      }

      // 8. Unusual amount spikes per vendor
      const vendorAmounts = new Map<string, number[]>();
      transactions.filter((t: any) => t.type === "debit" && t.counterparty).forEach((t: any) => {
        const existing = vendorAmounts.get(t.counterparty) || [];
        existing.push(Math.abs(t.amount));
        vendorAmounts.set(t.counterparty, existing);
      });
      vendorAmounts.forEach((amounts, vendor) => {
        if (amounts.length < 3) return;
        const sorted = [...amounts].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const latest = amounts[0];
        if (median > 0 && latest > median * 3 && latest > 500) {
          anomalies.push({
            type: "vendor_spike",
            severity: "medium",
            icon: "trending",
            description: `${vendor} \u2014 latest charge ${((latest / median - 1) * 100).toFixed(0)}% above median`,
            detail: `Latest: ${formatCurrencyFull(latest)} vs median ${formatCurrencyFull(median)} across ${amounts.length} transactions`,
            evidence: [`Spike ratio: ${(latest / median).toFixed(1)}x normal`],
          });
        }
      });
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // --- Monthly trend ---
    const monthlyMap = new Map<string, { credits: number; debits: number }>();
    transactions.forEach((tx: any) => {
      const date = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthlyMap.get(key) || { credits: 0, debits: 0 };
      if (tx.type === "credit") existing.credits += Math.abs(tx.amount);
      else existing.debits += Math.abs(tx.amount);
      monthlyMap.set(key, existing);
    });

    const months = Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6);

    let spendingTrend: "up" | "down" | "flat" = "flat";
    if (months.length >= 2) {
      const recent = months[months.length - 1][1].debits;
      const prior = months[months.length - 2][1].debits;
      if (recent > prior * 1.1) spendingTrend = "up";
      else if (recent < prior * 0.9) spendingTrend = "down";
    }

    // Matched count for match rate
    const matched = transactions.filter((t: any) => {
      const status = t.reconciliationStatus || (t.reconciled ? "matched" : "unmatched");
      return status === "matched" || status === "categorized";
    }).length;

    return {
      hasData,
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
      months,
      matchRate: (() => {
        if (matched > 0) return Math.round((matched / transactions.length) * 100);
        const latestRun = reconRuns.find((r: any) => r.status === "completed");
        if (latestRun && latestRun.totalTransactions > 0) {
          return Math.round((latestRun.totalMatched / latestRun.totalTransactions) * 100);
        }
        return 0;
      })(),
    };
  }, [transactions, vendorPatterns, reconMatches, reconRuns]);

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "text-red-600";
      case "high": return "text-amber-600";
      case "medium": return "text-yellow-600";
      case "low": return "text-emerald-600";
      default: return "text-slate-500";
    }
  };

  const severityBg = (s: string) => {
    switch (s) {
      case "critical": return "bg-red-50 border-red-200 text-red-700";
      case "high": return "bg-amber-50 border-amber-200 text-amber-700";
      case "medium": return "bg-yellow-50 border-yellow-200 text-yellow-700";
      case "low": return "bg-emerald-50 border-emerald-200 text-emerald-700";
      default: return "bg-slate-50 border-slate-200 text-slate-600";
    }
  };

  const anomalyIcon = (icon: string, severity: string) => {
    const color = severityColor(severity);
    switch (icon) {
      case "dollar": return <DollarSign className={`h-4 w-4 ${color}`} />;
      case "copy": return <Copy className={`h-4 w-4 ${color}`} />;
      case "calendar": return <Calendar className={`h-4 w-4 ${color}`} />;
      case "alert": return <AlertTriangle className={`h-4 w-4 ${color}`} />;
      case "clock": return <Clock className={`h-4 w-4 ${color}`} />;
      case "shield": return <Shield className={`h-4 w-4 ${color}`} />;
      case "zap": return <Zap className={`h-4 w-4 ${color}`} />;
      case "trending": return <TrendingUp className={`h-4 w-4 ${color}`} />;
      default: return <AlertCircle className={`h-4 w-4 ${color}`} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <Header title="AI Insights" />

      <div className="flex-1 overflow-auto bg-slate-50/50">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex items-center gap-2">
              <Scan className="h-5 w-5 text-slate-600 animate-pulse" />
              <span className="font-mono text-sm text-slate-600 animate-pulse">SCANNING TRANSACTION DATABASE...</span>
            </div>
            <div className="w-48 h-1 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-slate-500 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {/* Terminal header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md shadow-sm">
                  <div className={`h-2 w-2 rounded-full ${scanComplete ? (insights?.hasData ? "bg-emerald-500" : "bg-slate-400") : "bg-amber-500 animate-pulse"}`} />
                  <span className="font-mono text-xs text-slate-600">
                    {scanComplete ? (insights?.hasData ? "SCAN COMPLETE" : "AWAITING DATA") : "ANALYZING..."}
                  </span>
                </div>
                <span className="font-mono text-xs text-slate-400">
                  {transactions.length} records {transactions.length > 0 && `\u2022 ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md shadow-sm">
                <Brain className="h-3.5 w-3.5 text-purple-500" />
                <span className="font-mono text-xs text-purple-600">Gemini 3 Fraud Engine</span>
              </div>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-6 gap-3">
              {[
                { label: "INCOME", value: insights?.hasData ? formatCurrency(insights.totalCredits) : "\u2014", color: insights?.hasData ? "text-emerald-600" : "text-slate-300", sub: null },
                { label: "EXPENSES", value: insights?.hasData ? formatCurrency(insights.totalDebits) : "\u2014", color: insights?.hasData ? "text-slate-800" : "text-slate-300",
                  sub: insights?.hasData ? (insights.spendingTrend === "up" ? "\u2191 TRENDING UP" : insights.spendingTrend === "down" ? "\u2193 TRENDING DOWN" : "\u2014 STABLE") : "no data",
                  subColor: insights?.hasData ? (insights.spendingTrend === "up" ? "text-red-500" : insights.spendingTrend === "down" ? "text-emerald-500" : "text-slate-400") : "text-slate-300"
                },
                { label: "NET FLOW", value: insights?.hasData ? `${insights.netCashFlow >= 0 ? "+" : ""}${formatCurrency(insights.netCashFlow)}` : "\u2014",
                  color: insights?.hasData ? (insights.netCashFlow >= 0 ? "text-emerald-600" : "text-red-600") : "text-slate-300", sub: null },
                { label: "MATCH RATE", value: insights?.hasData ? `${insights.matchRate}%` : "\u2014",
                  color: insights?.hasData ? (insights.matchRate >= 80 ? "text-emerald-600" : "text-amber-600") : "text-slate-300",
                  sub: insights?.hasData ? `${insights.avgConfidence}% avg conf` : "no data", subColor: "text-slate-400" },
                { label: "PATTERNS", value: `${vendorPatterns.length}`, color: vendorPatterns.length > 0 ? "text-purple-600" : "text-slate-300",
                  sub: vendorPatterns.length > 0 ? "AI learned" : "no data", subColor: "text-slate-400" },
                { label: "ALERTS", value: insights ? `${insights.anomalies.length}` : "0",
                  color: insights?.anomalies.some(a => a.severity === "critical") ? "text-red-600" :
                         insights?.anomalies.some(a => a.severity === "high") ? "text-amber-600" :
                         insights?.hasData ? "text-emerald-600" : "text-slate-300",
                  sub: insights?.hasData ? `${insights.anomalies.filter(a => a.severity === "critical" || a.severity === "high").length} critical/high` : "no data",
                  subColor: "text-slate-400"
                },
              ].map((kpi, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm">
                  <p className="font-mono text-[10px] text-slate-400 tracking-wider">{kpi.label}</p>
                  <p className={`font-mono text-lg font-bold mt-0.5 ${kpi.color}`}>{kpi.value}</p>
                  {kpi.sub && <p className={`font-mono text-[10px] mt-0.5 ${(kpi as any).subColor || "text-slate-400"}`}>{kpi.sub}</p>}
                </div>
              ))}
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-12 gap-4">
              {/* Left — Anomaly Detection */}
              <div className="col-span-8 space-y-4">
                {/* FRAUD DETECTION TERMINAL */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-500" />
                      <span className="font-mono text-xs font-bold text-slate-700 tracking-wide">ANOMALY DETECTION</span>
                      {insights?.hasData ? (
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                          insights.anomalies.some(a => a.severity === "critical") ? "bg-red-50 border-red-200 text-red-600" :
                          insights.anomalies.some(a => a.severity === "high") ? "bg-amber-50 border-amber-200 text-amber-600" :
                          "bg-emerald-50 border-emerald-200 text-emerald-600"
                        }`}>
                          {insights.anomalies.some(a => a.severity === "critical") ? "CRITICAL" :
                           insights.anomalies.some(a => a.severity === "high") ? "WARNINGS" : "ALL CLEAR"}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded border bg-slate-50 border-slate-200 text-slate-400">STANDBY</span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {insights?.hasData ? `${insights.anomalies.length} finding${insights.anomalies.length !== 1 ? "s" : ""}` : "8 detection algorithms ready"}
                    </span>
                  </div>

                  {!insights?.hasData ? (
                    /* Empty state — show what the engine CAN detect */
                    <div className="px-4 py-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Terminal className="h-4 w-4 text-slate-400" />
                        <span className="font-mono text-[11px] text-slate-500">Detection capabilities initialized. Upload statements to begin scanning.</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { icon: <Copy className="h-3.5 w-3.5 text-slate-400" />, label: "Duplicate Payments", desc: "Same amount + vendor within 30 days" },
                          { icon: <Calendar className="h-3.5 w-3.5 text-slate-400" />, label: "Weekend Payments", desc: "High-value transactions off-hours" },
                          { icon: <DollarSign className="h-3.5 w-3.5 text-slate-400" />, label: "Statistical Outliers", desc: "Amounts >2\u03C3 from vendor mean" },
                          { icon: <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />, label: "Round-Number Fraud", desc: "Exact amounts to unknown payees" },
                          { icon: <TrendingUp className="h-3.5 w-3.5 text-slate-400" />, label: "Vendor Spikes", desc: "Unusual charge increases per vendor" },
                          { icon: <Clock className="h-3.5 w-3.5 text-slate-400" />, label: "Slow Payers", desc: "Chronic payment delay patterns" },
                          { icon: <Shield className="h-3.5 w-3.5 text-slate-400" />, label: "Match Rate", desc: "Unreconciled transaction monitoring" },
                          { icon: <Zap className="h-3.5 w-3.5 text-slate-400" />, label: "FX Exposure", desc: "Cross-currency risk detection" },
                        ].map((cap, i) => (
                          <div key={i} className="flex items-start gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded">
                            <div className="mt-0.5 shrink-0">{cap.icon}</div>
                            <div>
                              <p className="font-mono text-[10px] font-bold text-slate-600">{cap.label}</p>
                              <p className="font-mono text-[9px] text-slate-400">{cap.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-center">
                        <Button size="sm" variant="outline" className="font-mono text-xs" asChild>
                          <Link href="/accounts"><Upload className="h-3.5 w-3.5 mr-1.5" />Upload Statements to Begin</Link>
                        </Button>
                      </div>
                    </div>
                  ) : insights.anomalies.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <ShieldCheck className="h-8 w-8 text-emerald-500/50 mx-auto mb-2" />
                      <p className="font-mono text-sm text-emerald-600">ALL CHECKS PASSED</p>
                      <p className="font-mono text-[10px] text-slate-400 mt-1">No anomalies detected across {transactions.length} transactions</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {insights.anomalies.map((anomaly, i) => (
                        <div key={i} className="px-4 py-3 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 shrink-0">
                              {anomalyIcon(anomaly.icon, anomaly.severity)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-mono text-xs font-bold ${severityColor(anomaly.severity)}`}>
                                  {anomaly.description}
                                </span>
                                <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded border ${severityBg(anomaly.severity)}`}>
                                  {anomaly.severity.toUpperCase()}
                                </span>
                              </div>
                              <p className="font-mono text-[11px] text-slate-500 leading-relaxed">{anomaly.detail}</p>
                              {anomaly.evidence.length > 0 && (
                                <div className="mt-2 space-y-0.5">
                                  {anomaly.evidence.map((ev, j) => (
                                    <div key={j} className="flex items-center gap-1.5">
                                      <span className="font-mono text-[10px] text-slate-300">{'>'}</span>
                                      <span className="font-mono text-[10px] text-slate-500">{ev}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Spending by Category — terminal style bar chart */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                    <BarChart3 className="h-4 w-4 text-slate-500" />
                    <span className="font-mono text-xs font-bold text-slate-700 tracking-wide">EXPENSE BREAKDOWN</span>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    {insights?.hasData && insights.topCategories.length > 0 ? (
                      insights.topCategories.map((cat) => (
                        <div key={cat.name} className="flex items-center gap-3">
                          <span className="font-mono text-[10px] text-slate-500 w-24 truncate text-right">{cat.name}</span>
                          <div className="flex-1 h-3 bg-slate-100 rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-slate-400 rounded-sm"
                              style={{ width: `${(cat.total / insights.maxCategoryTotal) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-slate-600 w-20 text-right">{formatCurrency(cat.total)}</span>
                          <span className="font-mono text-[10px] text-slate-400 w-8 text-right">{cat.count}x</span>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center">
                        <BarChart3 className="h-6 w-6 text-slate-200 mx-auto mb-2" />
                        <p className="font-mono text-[10px] text-slate-400">Category analysis will appear here</p>
                        <p className="font-mono text-[9px] text-slate-300 mt-0.5">Based on your transaction categorization data</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Monthly Cash Flow */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                    <Activity className="h-4 w-4 text-slate-500" />
                    <span className="font-mono text-xs font-bold text-slate-700 tracking-wide">MONTHLY FLOW</span>
                  </div>
                  <div className="px-4 py-3">
                    {insights?.months && insights.months.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400 mb-2">
                          <span className="w-16">MONTH</span>
                          <span className="w-20 text-right">IN</span>
                          <span className="w-20 text-right">OUT</span>
                          <span className="flex-1">BAR</span>
                          <span className="w-20 text-right">NET</span>
                        </div>
                        {insights.months.map(([key, data]) => {
                          const [year, month] = key.split("-");
                          const monthLabel = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                          const net = data.credits - data.debits;
                          const maxVal = Math.max(...insights.months.map(([, d]) => Math.max(d.credits, d.debits)));
                          return (
                            <div key={key} className="flex items-center gap-3">
                              <span className="font-mono text-[10px] text-slate-500 w-16">{monthLabel}</span>
                              <span className="font-mono text-[10px] text-emerald-600 w-20 text-right">{formatCurrency(data.credits)}</span>
                              <span className="font-mono text-[10px] text-red-500 w-20 text-right">{formatCurrency(data.debits)}</span>
                              <div className="flex-1 flex items-center gap-0.5 h-3">
                                <div className="h-full bg-emerald-200 rounded-sm" style={{ width: `${(data.credits / maxVal) * 50}%` }} />
                                <div className="h-full bg-red-200 rounded-sm" style={{ width: `${(data.debits / maxVal) * 50}%` }} />
                              </div>
                              <span className={`font-mono text-[10px] font-bold w-20 text-right ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {net >= 0 ? "+" : ""}{formatCurrency(net)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-4 text-center">
                        <Activity className="h-6 w-6 text-slate-200 mx-auto mb-2" />
                        <p className="font-mono text-[10px] text-slate-400">Monthly cash flow trends will appear here</p>
                        <p className="font-mono text-[9px] text-slate-300 mt-0.5">Requires transaction history across multiple months</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Top Vendors & Clients */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                      <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                      <span className="font-mono text-[10px] font-bold text-slate-700 tracking-wide">TOP VENDORS (OUTFLOW)</span>
                    </div>
                    {insights?.topVendors && insights.topVendors.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {insights.topVendors.map((v, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[10px] text-slate-300 w-3">{i + 1}</span>
                              <span className="font-mono text-[10px] text-slate-600 truncate">{v.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-[10px] text-slate-400">{v.count}x</span>
                              <span className="font-mono text-[10px] font-bold text-slate-700">{formatCurrency(v.total)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center">
                        <p className="font-mono text-[10px] text-slate-300">No vendor data yet</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="font-mono text-[10px] font-bold text-slate-700 tracking-wide">TOP CLIENTS (INFLOW)</span>
                    </div>
                    {insights?.topClients && insights.topClients.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {insights.topClients.map((c, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[10px] text-slate-300 w-3">{i + 1}</span>
                              <span className="font-mono text-[10px] text-slate-600 truncate">{c.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-[10px] text-slate-400">{c.count}x</span>
                              <span className="font-mono text-[10px] font-bold text-emerald-600">{formatCurrency(c.total)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-6 text-center">
                        <p className="font-mono text-[10px] text-slate-300">No client data yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="col-span-4 space-y-4">
                {/* Threat Level Summary */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                    <Shield className="h-4 w-4 text-slate-500" />
                    <span className="font-mono text-[10px] font-bold text-slate-700 tracking-wide">THREAT ASSESSMENT</span>
                  </div>
                  <div className="px-4 py-3 space-y-2.5">
                    {["critical", "high", "medium", "low"].map((level) => {
                      const count = insights?.anomalies.filter(a => a.severity === level).length || 0;
                      const total = insights?.anomalies.length || 0;
                      return (
                        <div key={level} className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full ${
                            level === "critical" ? "bg-red-500" :
                            level === "high" ? "bg-amber-500" :
                            level === "medium" ? "bg-yellow-500" : "bg-emerald-500"
                          }`} />
                          <span className="font-mono text-[10px] text-slate-400 uppercase w-14">{level}</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                level === "critical" ? "bg-red-400" :
                                level === "high" ? "bg-amber-400" :
                                level === "medium" ? "bg-yellow-400" : "bg-emerald-400"
                              }`}
                              style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
                            />
                          </div>
                          <span className={`font-mono text-xs font-bold w-6 text-right ${count > 0 ? severityColor(level) : "text-slate-200"}`}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vendor Intelligence */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-500" />
                      <span className="font-mono text-[10px] font-bold text-slate-700 tracking-wide">VENDOR INTEL</span>
                    </div>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border border-purple-200 bg-purple-50 text-purple-600">AI LEARNED</span>
                  </div>
                  {vendorPatterns.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <Repeat className="h-5 w-5 text-slate-200 mx-auto mb-2" />
                      <p className="font-mono text-[10px] text-slate-400">No vendor patterns learned yet</p>
                      <p className="font-mono text-[9px] text-slate-300 mt-0.5">AI learns patterns after reconciliation runs</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {vendorPatterns.map((p: any) => (
                        <div key={p.id} className="px-4 py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-[10px] font-bold text-slate-700">{p.vendorName}</span>
                            <span className="font-mono text-[10px] text-emerald-600">{p.matchCount} hits</span>
                          </div>
                          <div className="space-y-0.5">
                            {p.typicalDelay && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] text-slate-300">{'>'}</span>
                                <span className={`font-mono text-[9px] ${p.typicalDelay.max > 30 ? "text-amber-600" : "text-slate-500"}`}>
                                  delay: {p.typicalDelay.min}-{p.typicalDelay.max}d {p.typicalDelay.max > 30 ? "SLOW" : ""}
                                </span>
                              </div>
                            )}
                            {p.amountVariation && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] text-slate-300">{'>'}</span>
                                <span className="font-mono text-[9px] text-slate-500">
                                  variance: {p.amountVariation.value}% ({p.amountVariation.reason?.replace(/_/g, " ")})
                                </span>
                              </div>
                            )}
                            {p.aliases && p.aliases.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] text-slate-300">{'>'}</span>
                                <span className="font-mono text-[9px] text-slate-500">
                                  aka: {p.aliases.slice(0, 2).join(", ")}
                                </span>
                              </div>
                            )}
                            {p.currency && p.currency !== "USD" && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] text-slate-300">{'>'}</span>
                                <span className="font-mono text-[9px] text-slate-500">
                                  currency: {p.currency} {p.typicalFxVariation ? `(\u00B1${p.typicalFxVariation}% FX)` : ""}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Match Quality */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                    <ShieldCheck className="h-4 w-4 text-slate-500" />
                    <span className="font-mono text-[10px] font-bold text-slate-700 tracking-wide">MATCH QUALITY</span>
                  </div>
                  {reconMatches.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <ShieldCheck className="h-5 w-5 text-slate-200 mx-auto mb-2" />
                      <p className="font-mono text-[10px] text-slate-400">No reconciliation data</p>
                      <p className="font-mono text-[9px] text-slate-300 mt-0.5">Run AI matching to populate</p>
                    </div>
                  ) : (
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-slate-400">AVG CONFIDENCE</span>
                        <span className={`font-mono text-xs font-bold ${insights?.avgConfidence && insights.avgConfidence >= 90 ? "text-emerald-600" : "text-amber-600"}`}>
                          {insights?.avgConfidence || 0}%
                        </span>
                      </div>
                      <div className="space-y-1">
                        {insights?.matchTypes.map((mt) => (
                          <div key={mt.type} className="flex items-center gap-2">
                            <span className="font-mono text-[9px] text-slate-500 w-24 truncate capitalize">{mt.type}</span>
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-300 rounded-full"
                                style={{ width: `${(mt.count / reconMatches.length) * 100}%` }}
                              />
                            </div>
                            <span className="font-mono text-[9px] text-slate-400 w-4 text-right">{mt.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notable Transactions */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                    <Search className="h-4 w-4 text-slate-500" />
                    <span className="font-mono text-[10px] font-bold text-slate-700 tracking-wide">NOTABLE RECORDS</span>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    {insights?.hasData ? (
                      <>
                        <div>
                          <p className="font-mono text-[9px] text-slate-400 mb-0.5">LARGEST OUTFLOW</p>
                          <p className="font-mono text-[10px] text-slate-600 truncate">{insights.largestDebit.description || "--"}</p>
                          <p className="font-mono text-xs font-bold text-red-600">{formatCurrencyFull(insights.largestDebit.amount)}</p>
                        </div>
                        <div className="border-t border-slate-100 pt-3">
                          <p className="font-mono text-[9px] text-slate-400 mb-0.5">LARGEST INFLOW</p>
                          <p className="font-mono text-[10px] text-slate-600 truncate">{insights.largestCredit.description || "--"}</p>
                          <p className="font-mono text-xs font-bold text-emerald-600">{formatCurrencyFull(insights.largestCredit.amount)}</p>
                        </div>
                      </>
                    ) : (
                      <div className="py-2 text-center">
                        <p className="font-mono text-[10px] text-slate-300">Awaiting transaction data</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 pb-1 border-t border-slate-200">
              <span className="font-mono text-[10px] text-slate-400">
                SmartInvoice Fraud Detection Engine v3.0 \u2014 Powered by Gemini 3
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                Last scan: {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} UTC
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
