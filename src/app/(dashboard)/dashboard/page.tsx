"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  Receipt,
  Upload,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  FileText,
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
  Landmark,
  Brain,
  Sparkles,
  FileSpreadsheet,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Terminal,
  ShieldCheck,
  AlertOctagon,
  Repeat,
  DollarSign,
  Calendar,
  Copy,
} from "lucide-react";
import { UsageWarning } from "@/components/ui/usage-warning";
import { CashFlowForecast } from "@/components/financial-chat";
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { BankAccount, Statement, Transaction } from "@/types";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

// ============================================
// TYPES
// ============================================

interface CurrencyBalance {
  currency: string;
  balance: number;
  accountCount: number;
  transactionCount: number;
  lastUpdated: Date | null;
}

interface MonthlyData {
  month: string;
  credits: number;
  debits: number;
  net: number;
}

interface AIActivity {
  id: string;
  type: string;
  description: string;
  timestamp: Date;
  status: string;
}

// ============================================
// UTILITIES
// ============================================

function formatCurrency(amount: number | undefined | null, currency: string = "USD"): string {
  if (amount === undefined || amount === null || isNaN(amount)) return `${currency} 0.00`;
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCompactNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// ============================================
// MAIN
// ============================================

export default function DashboardPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [recentStatements, setRecentStatements] = useState<Statement[]>([]);
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalance[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [reconRuns, setReconRuns] = useState<any[]>([]);
  const [reconMatches, setReconMatches] = useState<any[]>([]);
  const [vendorPatterns, setVendorPatterns] = useState<any[]>([]);
  const [pdf2sheetJobs, setPdf2sheetJobs] = useState<any[]>([]);
  const [reconStats, setReconStats] = useState({ matched: 0, unmatched: 0, suggested: 0, total: 0 });
  const [stats, setStats] = useState({
    totalAccounts: 0,
    totalTransactions: 0,
    pendingExtractions: 0,
    totalStatements: 0,
    totalBanks: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Load accounts
  useEffect(() => {
    if (!user) return;

    const accountsQuery = query(
      collection(db, "accounts"),
      where("userId", "==", user.id),
      where("isArchived", "==", false)
    );

    const unsub = onSnapshot(accountsQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as BankAccount[];
      setAccounts(data);

      const currencyMap = new Map<string, CurrencyBalance>();
      const bankSet = new Set<string>();
      data.forEach((account) => {
        bankSet.add(account.bankName);
        const currency = account.currency || "AWG";
        const existing = currencyMap.get(currency);
        if (existing) {
          existing.balance += account.balance || 0;
          existing.accountCount += 1;
          existing.transactionCount += account.transactionCount || 0;
          if (account.lastStatementDate) {
            const d = account.lastStatementDate instanceof Timestamp ? account.lastStatementDate.toDate() : new Date(account.lastStatementDate);
            if (!existing.lastUpdated || d > existing.lastUpdated) existing.lastUpdated = d;
          }
        } else {
          currencyMap.set(currency, {
            currency,
            balance: account.balance || 0,
            accountCount: 1,
            transactionCount: account.transactionCount || 0,
            lastUpdated: account.lastStatementDate
              ? (account.lastStatementDate instanceof Timestamp ? account.lastStatementDate.toDate() : new Date(account.lastStatementDate))
              : null,
          });
        }
      });
      setCurrencyBalances(Array.from(currencyMap.values()).sort((a, b) => b.balance - a.balance));
      setStats((prev) => ({ ...prev, totalAccounts: data.length, totalBanks: bankSet.size }));
    });
    return () => unsub();
  }, [user]);

  // Load statements
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "statements"), where("userId", "==", user.id), orderBy("createdAt", "desc"), limit(10));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Statement[];
      setRecentStatements(data);
      const pending = data.filter((s) => s.status === "processing" || s.status === "needs_review" || s.status === "scanning").length;
      setStats((prev) => ({ ...prev, pendingExtractions: pending, totalStatements: data.length }));
    });
    return () => unsub();
  }, [user]);

  // Load transactions
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "transactions"), where("userId", "==", user.id), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Transaction[];
      setTransactions(data);
      setStats((prev) => ({ ...prev, totalTransactions: data.length }));

      // Compute reconciliation stats from transactions
      let matched = 0, unmatched = 0, suggested = 0;
      data.forEach((tx: any) => {
        const status = tx.reconciliationStatus || (tx.reconciled ? "matched" : "unmatched");
        if (status === "matched" || status === "categorized") matched++;
        else if (status === "suggested") suggested++;
        else unmatched++;
      });
      setReconStats({ matched, unmatched, suggested, total: data.length });

      const monthlyMap = new Map<string, { credits: number; debits: number }>();
      data.forEach((tx) => {
        const date = tx.date instanceof Timestamp ? tx.date.toDate() : new Date(tx.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = monthlyMap.get(key);
        if (existing) {
          if (tx.type === "credit") existing.credits += tx.amount;
          else existing.debits += tx.amount;
        } else {
          monthlyMap.set(key, { credits: tx.type === "credit" ? tx.amount : 0, debits: tx.type === "debit" ? tx.amount : 0 });
        }
      });

      const sorted = Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6)
        .map(([k, d]) => {
          const [year, month] = k.split("-");
          return {
            month: new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", { month: "short" }),
            credits: d.credits,
            debits: d.debits,
            net: d.credits - d.debits,
          };
        });
      setMonthlyData(sorted);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Load recent reconciliation runs
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "reconciliation_runs"), where("userId", "==", user.id), orderBy("updatedAt", "desc"), limit(5));
    const unsub = onSnapshot(q, (snap) => setReconRuns(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    return () => unsub();
  }, [user]);

  // Load recent pdf2sheet jobs
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "pdf2sheet_jobs"), where("userId", "==", user.id), orderBy("createdAt", "desc"), limit(5));
    const unsub = onSnapshot(q, (snap) => setPdf2sheetJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
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
    const q = query(collection(db, "reconciliation_matches"), where("userId", "==", user.id), orderBy("createdAt", "desc"), limit(10));
    const unsub = onSnapshot(q, (snap) => setReconMatches(snap.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    return () => unsub();
  }, [user]);

  // Use latest reconciliation run stats if transaction-level data hasn't been updated
  const effectiveReconStats = useMemo(() => {
    if (reconStats.matched > 0 || reconStats.suggested > 0) return reconStats;
    const latestRun = reconRuns.find((r: any) => r.status === "completed");
    if (latestRun) {
      return {
        matched: latestRun.totalMatched || 0,
        suggested: latestRun.totalSuggested || 0,
        unmatched: latestRun.totalUnmatched || 0,
        total: latestRun.totalTransactions || reconStats.total,
      };
    }
    return reconStats;
  }, [reconStats, reconRuns]);

  // Anomaly detection
  const anomalies = useMemo(() => {
    const results: { type: string; severity: "high" | "medium" | "low"; description: string; icon: React.ReactNode }[] = [];

    // Large transaction outliers (>2 std dev from mean)
    const debitAmounts = transactions.filter((t: any) => t.type === "debit").map((t: any) => Math.abs(t.amount));
    if (debitAmounts.length > 5) {
      const mean = debitAmounts.reduce((a: number, b: number) => a + b, 0) / debitAmounts.length;
      const variance = debitAmounts.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / debitAmounts.length;
      const stdDev = Math.sqrt(variance);
      const threshold = mean + 2 * stdDev;
      const outliers = transactions.filter((t: any) => t.type === "debit" && Math.abs(t.amount) > threshold);
      if (outliers.length > 0) {
        results.push({
          type: "large_transaction",
          severity: "medium",
          description: `${outliers.length} unusually large payment${outliers.length > 1 ? "s" : ""} (>${formatCurrency(threshold)})`,
          icon: <DollarSign className="h-3.5 w-3.5" />,
        });
      }
    }

    // Slow payers from vendor patterns (>30 day delay)
    const slowPayers = vendorPatterns.filter((p: any) => p.typicalDelay && p.typicalDelay.max > 30);
    if (slowPayers.length > 0) {
      results.push({
        type: "slow_payer",
        severity: "low",
        description: `${slowPayers.length} vendor${slowPayers.length > 1 ? "s" : ""} with 30+ day payment delays`,
        icon: <Clock className="h-3.5 w-3.5" />,
      });
    }

    // Low reconciliation match rate (>20% unmatched)
    const unmatchedRate = effectiveReconStats.total > 0
      ? ((effectiveReconStats.total - effectiveReconStats.matched) / effectiveReconStats.total) * 100
      : 0;
    if (unmatchedRate > 20) {
      results.push({
        type: "low_match_rate",
        severity: "high",
        description: `${Math.round(unmatchedRate)}% of transactions are unreconciled`,
        icon: <AlertCircle className="h-3.5 w-3.5" />,
      });
    }

    // FX cross-currency transactions
    const fxMatches = reconMatches.filter((m: any) => m.matchType === "fx_conversion" || m.transactionCurrency !== m.documentCurrency);
    if (fxMatches.length > 0) {
      results.push({
        type: "fx_exposure",
        severity: "low",
        description: `${fxMatches.length} cross-currency transaction${fxMatches.length > 1 ? "s" : ""}`,
        icon: <ArrowRight className="h-3.5 w-3.5" />,
      });
    }

    // Duplicate payments — same amount + similar description within 30 days
    const debits = transactions.filter((t: any) => t.type === "debit");
    const duplicates = new Set<string>();
    for (let i = 0; i < debits.length; i++) {
      for (let j = i + 1; j < debits.length; j++) {
        const a = debits[i] as any;
        const b = debits[j] as any;
        if (Math.abs(Math.abs(a.amount) - Math.abs(b.amount)) < 0.01) {
          const dateA = a.date instanceof Timestamp ? a.date.toDate() : new Date(a.date);
          const dateB = b.date instanceof Timestamp ? b.date.toDate() : new Date(b.date);
          const daysDiff = Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff <= 30 && daysDiff > 0) {
            const descA = (a.description || "").toLowerCase().replace(/[^a-z]/g, "");
            const descB = (b.description || "").toLowerCase().replace(/[^a-z]/g, "");
            if (descA && descB && (descA.includes(descB.slice(0, 8)) || descB.includes(descA.slice(0, 8)))) {
              duplicates.add(`${a.id}-${b.id}`);
            }
          }
        }
      }
    }
    if (duplicates.size > 0) {
      results.push({
        type: "duplicate_payment",
        severity: "high",
        description: `${duplicates.size} potential duplicate payment${duplicates.size > 1 ? "s" : ""} detected`,
        icon: <Copy className="h-3.5 w-3.5" />,
      });
    }

    // Unusual weekend payments (>$5k on Sat/Sun)
    const weekendPayments = transactions.filter((t: any) => {
      if (t.type !== "debit" || Math.abs(t.amount) < 5000) return false;
      const date = t.date instanceof Timestamp ? t.date.toDate() : new Date(t.date);
      const day = date.getDay();
      return day === 0 || day === 6;
    });
    if (weekendPayments.length > 0) {
      results.push({
        type: "weekend_payment",
        severity: "medium",
        description: `${weekendPayments.length} large weekend payment${weekendPayments.length > 1 ? "s" : ""} (>$5K)`,
        icon: <Calendar className="h-3.5 w-3.5" />,
      });
    }

    // Sort by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, [transactions, vendorPatterns, effectiveReconStats, reconMatches]);

  // Cash flow trend (current vs prior month)
  const cashFlowTrend = useMemo(() => {
    if (monthlyData.length < 2) return null;
    const current = monthlyData[monthlyData.length - 1];
    const prior = monthlyData[monthlyData.length - 2];
    if (!prior || prior.net === 0) return null;
    const change = ((current.net - prior.net) / Math.abs(prior.net)) * 100;
    return { change, direction: change >= 0 ? "up" as const : "down" as const };
  }, [monthlyData]);

  const getStatusIcon = (status: Statement["status"]) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
      case "processing": case "scanning": return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
      case "needs_review": return <AlertCircle className="h-3 w-3 text-amber-500" />;
      case "failed": return <XCircle className="h-3 w-3 text-red-500" />;
      default: return <Clock className="h-3 w-3 text-slate-400" />;
    }
  };

  // Build AI activity feed
  const aiActivity: AIActivity[] = [
    ...recentStatements
      .filter(s => s.status === "completed")
      .slice(0, 3)
      .map(s => ({
        id: `stmt-${s.id}`,
        type: "extraction",
        description: `Extracted ${s.transactionCount || 0} transactions from ${s.originalFileName || s.fileName}`,
        timestamp: s.uploadedAt instanceof Timestamp ? s.uploadedAt.toDate() : new Date(),
        status: "completed",
      })),
    ...reconRuns.slice(0, 3).map(r => ({
      id: `recon-${r.id}`,
      type: "reconciliation",
      description: `Matched ${r.totalMatched || 0} of ${r.totalTransactions || 0} transactions`,
      timestamp: r.updatedAt instanceof Timestamp ? r.updatedAt.toDate() : (r.updatedAt?.toDate?.() || new Date()),
      status: r.status || "completed",
    })),
    ...pdf2sheetJobs.slice(0, 3).map(j => ({
      id: `p2s-${j.id}`,
      type: "pdf2sheet",
      description: `Converted ${j.fileName} → ${j.rowCount || 0} rows`,
      timestamp: j.createdAt instanceof Timestamp ? j.createdAt.toDate() : (j.createdAt?.toDate?.() || new Date()),
      status: j.status || "completed",
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 6);

  const activityIcon = (type: string) => {
    switch (type) {
      case "extraction": return <FileText className="h-3.5 w-3.5 text-cyan-500" />;
      case "reconciliation": return <Landmark className="h-3.5 w-3.5 text-purple-500" />;
      case "pdf2sheet": return <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />;
      default: return <Sparkles className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  const userName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div className="flex flex-col h-full bg-white">
      <Header title="Dashboard" />

      <div className="flex-1 overflow-auto">
        <UsageWarning className="mx-4 mt-3 mb-0" showWhenAbove={75} />

        <div className="px-6 pt-5 pb-6 space-y-6">
          {/* Greeting row */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold font-mono tracking-wide text-slate-900">{getGreeting()}, {userName}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {(user as any)?.companyName && (
                  <span className="font-medium text-slate-700">{(user as any).companyName}</span>
                )}
                {(user as any)?.companyName && stats.totalTransactions > 0 && " — "}
                {stats.totalTransactions > 0
                  ? `${stats.totalTransactions.toLocaleString()} transactions across ${stats.totalAccounts} accounts`
                  : (user as any)?.companyName ? "" : "Upload a bank statement to get started"}
              </p>
            </div>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium font-mono text-slate-600">Gemini 3</span>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-6 gap-3">
            {currencyBalances.slice(0, 2).map((cb) => (
              <div key={cb.currency} className="bg-white border border-slate-200 rounded-lg shadow-sm px-4 py-3.5">
                <p className="text-xs text-slate-500 font-mono font-medium tracking-wide uppercase">{cb.currency} Balance</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">{formatCurrency(cb.balance, cb.currency)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{cb.accountCount} account{cb.accountCount !== 1 ? "s" : ""}</p>
              </div>
            ))}
            {currencyBalances.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-4 py-3.5 col-span-2">
                <p className="text-xs text-slate-500 font-mono font-medium tracking-wide uppercase">Total Balance</p>
                <p className="text-lg font-semibold text-slate-400 mt-1">--</p>
              </div>
            )}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-4 py-3.5">
              <p className="text-xs text-slate-500 font-mono font-medium tracking-wide uppercase">Transactions</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{formatCompactNumber(stats.totalTransactions)}</p>
              <p className="text-xs text-slate-400 mt-0.5">AI extracted</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-4 py-3.5">
              <p className="text-xs text-slate-500 font-mono font-medium tracking-wide uppercase">Match Rate</p>
              <p className={`text-lg font-semibold mt-1 ${effectiveReconStats.total > 0 && effectiveReconStats.matched / effectiveReconStats.total >= 0.8 ? "text-emerald-600" : "text-slate-900"}`}>
                {effectiveReconStats.total > 0 ? `${Math.round((effectiveReconStats.matched / effectiveReconStats.total) * 100)}%` : "--"}
              </p>
              <p className={`text-xs mt-0.5 ${effectiveReconStats.unmatched > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                {effectiveReconStats.total > 0 ? `${effectiveReconStats.matched} of ${effectiveReconStats.total}` : "no data yet"}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-4 py-3.5">
              <p className="text-xs text-slate-500 font-mono font-medium tracking-wide uppercase">Patterns Learned</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{vendorPatterns.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">vendor behaviors</p>
            </div>
            <div className="border border-purple-200 rounded-lg shadow-sm px-4 py-3.5 bg-purple-50/30">
              <p className="text-xs text-purple-600 font-mono font-medium tracking-wide uppercase flex items-center gap-1"><Brain className="h-3 w-3" /> AI Actions</p>
              <p className="text-lg font-semibold text-purple-700 mt-1">
                {recentStatements.filter(s => s.status === "completed").length + reconRuns.length + pdf2sheetJobs.length}
              </p>
              <p className="text-xs text-purple-400 mt-0.5">Gemini 3 powered</p>
            </div>
          </div>

          {/* AI Tools */}
          <div>
            <h2 className="text-sm font-semibold font-mono tracking-wide uppercase text-slate-900 mb-3">AI-Powered Tools</h2>
            <div className="grid grid-cols-3 gap-4">
              <Link
                href="/reconciliation"
                className="group bg-white border border-slate-200 rounded-lg shadow-sm p-4 hover:border-purple-400 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                    <Brain className="h-4 w-4 text-purple-600" />
                  </div>
                  <h3 className="font-medium font-mono tracking-wide text-slate-900 text-sm">AI Reconciliation</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  3-tier matching engine with real-time reasoning. Watch the AI think as it matches transactions.
                </p>
                <div className="flex items-center gap-1.5 mt-3 text-purple-600">
                  <Terminal className="h-3 w-3" />
                  <span className="text-[10px] font-medium">Live reasoning stream</span>
                  <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>

              <Link
                href="/pdf2sheet"
                className="group bg-white border border-slate-200 rounded-lg shadow-sm p-4 hover:border-emerald-400 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h3 className="font-medium font-mono tracking-wide text-slate-900 text-sm">Smart Extract</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Vision-powered document extraction. Any PDF table to structured Excel/CSV in seconds.
                </p>
                <div className="flex items-center gap-1.5 mt-3 text-emerald-600">
                  <Eye className="h-3 w-3" />
                  <span className="text-[10px] font-medium">Multimodal vision</span>
                  <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>

              <Link
                href="/accounts"
                className="group bg-white border border-slate-200 rounded-lg shadow-sm p-4 hover:border-cyan-400 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="h-8 w-8 rounded-lg bg-cyan-50 flex items-center justify-center">
                    <Upload className="h-4 w-4 text-cyan-600" />
                  </div>
                  <h3 className="font-medium font-mono tracking-wide text-slate-900 text-sm">Smart Import</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Upload bank statements and invoices. AI auto-detects format and extracts every transaction.
                </p>
                <div className="flex items-center gap-1.5 mt-3 text-cyan-600">
                  <Sparkles className="h-3 w-3" />
                  <span className="text-[10px] font-medium">Auto-detect any format</span>
                  <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            </div>
          </div>

          {/* Main content grid */}
          <div className="grid grid-cols-12 gap-5">
            {/* Left — Chart + Accounts */}
            <div className="col-span-8 space-y-5">
              {/* Cash Flow Chart */}
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold font-mono tracking-wide uppercase text-slate-900">Cash Flow</h3>
                    <span className="text-[10px] text-slate-400 font-medium">Last 6 months</span>
                    {cashFlowTrend && (
                      <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        cashFlowTrend.direction === "up" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      }`}>
                        {cashFlowTrend.direction === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(cashFlowTrend.change).toFixed(0)}% vs prior
                      </span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                    <Link href="/transactions">View all <ChevronRight className="h-3 w-3 ml-1" /></Link>
                  </Button>
                </div>
                <div className="px-5 py-4">
                  {monthlyData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <TrendingUp className="h-8 w-8 text-slate-200 mb-3" />
                      <p className="text-sm text-slate-500">No transaction data yet</p>
                      <p className="text-xs text-slate-400 mt-1">Upload a statement to see your cash flow</p>
                    </div>
                  ) : (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height={200} minWidth={0}>
                        <AreaChart data={monthlyData}>
                          <defs>
                            <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="debitGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.08} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={formatCompactNumber} />
                          <Tooltip
                            contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}
                            formatter={(value: number) => formatCompactNumber(value)}
                          />
                          <Area type="monotone" dataKey="credits" stroke="#10b981" strokeWidth={2} fill="url(#creditGrad)" name="Money In" />
                          <Area type="monotone" dataKey="debits" stroke="#ef4444" strokeWidth={2} fill="url(#debitGrad)" name="Money Out" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Cash Flow Forecast */}
              <CashFlowForecast />

              {/* Bank Accounts */}
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold font-mono tracking-wide uppercase text-slate-900">Bank Accounts</h3>
                    {accounts.length > 0 && <span className="text-xs text-slate-400">{accounts.length}</span>}
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                    <Link href="/accounts">Manage <ChevronRight className="h-3 w-3 ml-1" /></Link>
                  </Button>
                </div>
                {accounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Building2 className="h-8 w-8 text-slate-200 mb-3" />
                    <p className="text-sm text-slate-500 mb-1">No accounts yet</p>
                    <p className="text-xs text-slate-400 mb-3">Upload a bank statement to auto-create accounts</p>
                    <Button size="sm" asChild>
                      <Link href="/accounts"><Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Statement</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {accounts.slice(0, 5).map((account) => (
                      <Link
                        key={account.id}
                        href={`/accounts/${account.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <Landmark className="h-4 w-4 text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{account.accountNickname}</p>
                          <p className="text-xs text-slate-400">{account.bankName} &middot; ****{account.accountNumber?.slice(-4)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(account.balance || 0, account.currency)}</p>
                          <p className="text-xs text-slate-400">{account.transactionCount || 0} txns</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="col-span-4 space-y-5">
              {/* Anomaly Alerts */}
              {anomalies.length > 0 && (
                <div className="border border-red-200 bg-red-50/40 rounded-lg shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-red-50/60 border-b border-red-200/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <h3 className="text-sm font-semibold font-mono tracking-wide uppercase text-slate-900">Fraud Detection</h3>
                      <span className="text-[10px] font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
                        {anomalies.length} alert{anomalies.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700" asChild>
                      <Link href="/insights">Details <ChevronRight className="h-3 w-3 ml-1" /></Link>
                    </Button>
                  </div>
                  <div className="px-4 py-2.5 space-y-2">
                    {anomalies.slice(0, 5).map((anomaly, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs">
                        <div className={`mt-0.5 shrink-0 ${
                          anomaly.severity === "high" ? "text-red-500" :
                          anomaly.severity === "medium" ? "text-amber-500" : "text-slate-400"
                        }`}>
                          {anomaly.icon}
                        </div>
                        <span className="text-slate-700 flex-1 leading-relaxed">{anomaly.description}</span>
                        <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          anomaly.severity === "high" ? "bg-red-100 text-red-700" :
                          anomaly.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {anomaly.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reconciliation Overview */}
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold font-mono tracking-wide uppercase text-slate-900">Reconciliation</h3>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                    <Link href="/reconciliation">Open <ChevronRight className="h-3 w-3 ml-1" /></Link>
                  </Button>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-500">Match rate</span>
                      <span className="font-semibold text-slate-900">
                        {effectiveReconStats.total > 0 ? `${Math.round((effectiveReconStats.matched / effectiveReconStats.total) * 100)}%` : "0%"}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: effectiveReconStats.total > 0 ? `${(effectiveReconStats.matched / effectiveReconStats.total) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                  {/* Breakdown */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="py-1.5">
                      <p className="text-base font-semibold text-emerald-600">{effectiveReconStats.matched}</p>
                      <p className="text-[10px] text-slate-400">Matched</p>
                    </div>
                    <div className="py-1.5">
                      <p className="text-base font-semibold text-amber-500">{effectiveReconStats.suggested}</p>
                      <p className="text-[10px] text-slate-400">Suggested</p>
                    </div>
                    <div className="py-1.5">
                      <p className="text-base font-semibold text-slate-400">{effectiveReconStats.unmatched}</p>
                      <p className="text-[10px] text-slate-400">Unmatched</p>
                    </div>
                  </div>
                  {/* Recent matches */}
                  {reconMatches.length > 0 && (
                    <div className="border-t border-slate-100 pt-2 space-y-1.5">
                      {reconMatches.slice(0, 3).map((m: any) => (
                        <div key={m.id} className="flex items-center gap-2 text-xs">
                          <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="text-slate-600 truncate flex-1">{m.counterpartyName || m.documentNumber || m.matchType}</span>
                          <span className="text-emerald-600 font-medium shrink-0">{m.confidence < 1 ? Math.round(m.confidence * 100) : m.confidence}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Attention Items */}
              {(effectiveReconStats.unmatched > 0 || reconMatches.some((m: any) => m.status === "needs_review")) && (
                <div className="border border-amber-200 bg-amber-50/50 rounded-lg shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-amber-50/60 border-b border-amber-200/50 flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-semibold font-mono tracking-wide uppercase text-slate-900">Needs Attention</h3>
                  </div>
                  <div className="px-4 py-2.5 space-y-2">
                    {effectiveReconStats.unmatched > 0 && (
                      <Link href="/reconciliation" className="flex items-center gap-2.5 text-xs hover:underline">
                        <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                        <span className="text-slate-700">{effectiveReconStats.unmatched} unmatched transaction{effectiveReconStats.unmatched !== 1 ? "s" : ""}</span>
                        <ArrowRight className="h-3 w-3 text-slate-400 ml-auto" />
                      </Link>
                    )}
                    {reconMatches.filter((m: any) => m.status === "needs_review" || m.status === "pending").slice(0, 2).map((m: any) => (
                      <div key={m.id} className="flex items-center gap-2.5 text-xs">
                        <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                        <span className="text-slate-700 truncate">{m.reason || `Review ${m.matchType} match`}</span>
                      </div>
                    ))}
                    {stats.pendingExtractions > 0 && (
                      <div className="flex items-center gap-2.5 text-xs">
                        <Loader2 className="h-3 w-3 text-blue-500 animate-spin shrink-0" />
                        <span className="text-slate-700">{stats.pendingExtractions} statement{stats.pendingExtractions !== 1 ? "s" : ""} still processing</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Vendor Patterns */}
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold font-mono tracking-wide uppercase text-slate-900">Learned Patterns</h3>
                  <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">AI</span>
                </div>
                {vendorPatterns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                    <Repeat className="h-5 w-5 text-slate-200 mb-2" />
                    <p className="text-xs text-slate-500">No patterns yet</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">AI learns vendor behaviors over time</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {vendorPatterns.slice(0, 5).map((p: any) => (
                      <div key={p.id} className="px-4 py-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-900">{p.vendorName}</span>
                          <span className="text-[10px] text-slate-400">{p.matchCount || 0} matches</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                          {p.typicalDelay && (
                            <span>~{p.typicalDelay.min}-{p.typicalDelay.max}d delay</span>
                          )}
                          {p.amountVariation && (
                            <span>{p.amountVariation.value}% {p.amountVariation.reason?.replace("_", " ")}</span>
                          )}
                          {p.currency && p.currency !== "USD" && (
                            <span>{p.currency}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Activity Feed */}
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold font-mono tracking-wide uppercase text-slate-900">Recent Activity</h3>
                  <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Gemini 3</span>
                </div>
                {aiActivity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center px-4">
                    <Brain className="h-5 w-5 text-slate-200 mb-2" />
                    <p className="text-xs text-slate-500">No AI activity yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {aiActivity.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-start gap-2.5 px-4 py-2.5">
                        <div className="mt-0.5">{activityIcon(item.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 leading-relaxed">{item.description}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {item.timestamp.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                        {item.status === "completed" ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <Loader2 className="h-3 w-3 text-purple-500 animate-spin shrink-0 mt-0.5" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
