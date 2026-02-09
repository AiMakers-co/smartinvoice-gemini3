"use client";

/**
 * Cash Flow Forecast Component
 * Uses Gemini 3 to predict 30/60/90 day cash flow with AI reasoning.
 */

import { useState, useCallback, useRef } from "react";
import {
  Brain, TrendingUp, AlertTriangle, Sparkles,
  Loader2, ChevronDown, ChevronUp, Shield, Zap, Eye,
} from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ForecastPeriod {
  period: string;
  projected_inflow: number;
  projected_outflow: number;
  net: number;
  confidence: number;
}

interface ForecastRisk {
  description: string;
  severity: "high" | "medium" | "low";
  impact: number;
}

interface ForecastResult {
  forecast: ForecastPeriod[];
  reasoning: string;
  risks: ForecastRisk[];
  recommendations: string[];
}

export function CashFlowForecast() {
  const { user } = useAuth();
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [thinkingLines, setThinkingLines] = useState<string[]>([]);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runForecast = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setThinkingLines([]);
    setShowReasoning(false);

    // Thinking animation
    const thoughts = [
      "Analyzing historical transaction patterns...",
      "Scanning upcoming receivables and payables...",
      "Detecting seasonal spending trends...",
      "Computing projected inflows from unpaid invoices...",
      "Estimating recurring expense patterns...",
      "Assessing cash flow risk factors...",
      "Generating 90-day forecast with Gemini 3...",
    ];
    let idx = 0;
    intervalRef.current = setInterval(() => {
      if (idx < thoughts.length) {
        setThinkingLines(prev => [...prev, thoughts[idx]]);
        idx++;
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 800);

    try {
      // Load financial data
      const [accountsSnap, txSnap, invSnap, billSnap, patternsSnap, runsSnap] = await Promise.all([
        getDocs(query(collection(db, "accounts"), where("userId", "==", user.id), where("isArchived", "==", false))),
        getDocs(query(collection(db, "transactions"), where("userId", "==", user.id), orderBy("date", "desc"), limit(100))),
        getDocs(query(collection(db, "invoices"), where("userId", "==", user.id))),
        getDocs(query(collection(db, "bills"), where("userId", "==", user.id))),
        getDocs(query(collection(db, "vendor_patterns"), where("userId", "==", user.id))),
        getDocs(query(collection(db, "reconciliation_runs"), where("userId", "==", user.id), orderBy("updatedAt", "desc"), limit(3))),
      ]);

      const safeNum = (v: unknown): number => {
        const n = Number(v);
        return isFinite(n) ? n : 0;
      };

      const accounts = accountsSnap.docs.map(d => {
        const data = d.data();
        return { bankName: data.bankName || "Unknown", currency: data.currency || "USD", balance: safeNum(data.balance), transactionCount: safeNum(data.transactionCount) };
      });

      const transactions = txSnap.docs.map(d => {
        const data = d.data();
        let dateStr: string;
        try {
          const date = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
          dateStr = date.toISOString().split("T")[0];
        } catch {
          dateStr = "unknown";
        }
        return { date: dateStr, amount: safeNum(Math.abs(safeNum(data.amount))), type: (data.type || "debit") as string, currency: data.currency || "USD" };
      });

      // Monthly cash flow
      const monthlyMap = new Map<string, { credits: number; debits: number }>();
      transactions.forEach(tx => {
        if (tx.date === "unknown") return;
        const key = tx.date.substring(0, 7);
        const existing = monthlyMap.get(key) || { credits: 0, debits: 0 };
        if (tx.type === "credit") existing.credits += tx.amount;
        else existing.debits += tx.amount;
        monthlyMap.set(key, existing);
      });

      const monthlyCashFlow = Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6)
        .map(([k, d]) => {
          const [year, month] = k.split("-").map(Number);
          return {
            month: new Date(year, month - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
            credits: safeNum(Math.round(d.credits)),
            debits: safeNum(Math.round(d.debits)),
            net: safeNum(Math.round(d.credits - d.debits)),
          };
        });

      const invoices = invSnap.docs.map(d => d.data());
      const bills = billSnap.docs.map(d => d.data());

      const unpaidInvoices = invoices.filter(i => i.paymentStatus !== "paid").map(i => {
        let dueDate = "unknown";
        try {
          if (i.dueDate instanceof Timestamp) dueDate = i.dueDate.toDate().toISOString().split("T")[0];
          else if (i.dueDate) dueDate = new Date(i.dueDate).toISOString().split("T")[0];
        } catch { /* keep unknown */ }
        return {
          customer: i.customerName || i.counterpartyName || "Unknown",
          amountDue: safeNum(i.amountRemaining ?? i.total),
          currency: i.currency || "USD",
          dueDate,
        };
      });

      const unpaidBills = bills.filter(b => b.paymentStatus !== "paid").map(b => {
        let dueDate = "unknown";
        try {
          if (b.dueDate instanceof Timestamp) dueDate = b.dueDate.toDate().toISOString().split("T")[0];
          else if (b.dueDate) dueDate = new Date(b.dueDate).toISOString().split("T")[0];
        } catch { /* keep unknown */ }
        return {
          vendor: b.vendorName || b.counterpartyName || "Unknown",
          amountDue: safeNum(b.amountRemaining ?? b.total),
          currency: b.currency || "USD",
          dueDate,
        };
      });

      const latestRun = runsSnap.docs[0]?.data();
      const matchRate = safeNum(latestRun?.totalTransactions) > 0 ? Math.round((safeNum(latestRun.totalMatched) / safeNum(latestRun.totalTransactions)) * 100) : 0;

      if (intervalRef.current) clearInterval(intervalRef.current);
      setThinkingLines(prev => [...prev, "Sending to Gemini 3 for analysis..."]);

      const forecastFn = httpsCallable(functions, "cashFlowForecast");
      const res = await forecastFn({
        financialContext: {
          accounts,
          totalTransactions: transactions.length,
          unpaidInvoices,
          unpaidBills,
          monthlyCashFlow,
          matchRate,
          patternsLearned: patternsSnap.size,
        },
        effectiveUserId: user.id,
      });

      const data = res.data as ForecastResult;
      setResult(data);
      setGeneratedAt(new Date());
      setThinkingLines(prev => [...prev, `Forecast complete — ${data.forecast.length} periods, ${data.risks.length} risks identified.`]);
    } catch (err) {
      console.error("Forecast error:", err);
      setError("Failed to generate forecast. Please try again.");
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      setLoading(false);
    }
  }, [user?.id]);

  const formatCurrency = (amount: number) => {
    if (isNaN(amount) || amount === null || amount === undefined) return "$0";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-purple-100 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Cash Flow Forecast</h3>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {generatedAt
                ? `Last generated ${generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "AI-powered 90-day projection"
              }
            </p>
          </div>
        </div>
        <Button
          onClick={runForecast}
          disabled={loading}
          size="sm"
          className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 px-3"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Brain className="h-3.5 w-3.5 mr-1.5" />}
          {result ? "Regenerate" : "Generate Forecast"}
        </Button>
      </div>

      {/* Thinking animation */}
      {loading && thinkingLines.length > 0 && (
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <div className="space-y-1">
            {thinkingLines.map((line, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {i === thinkingLines.length - 1 && loading ? (
                  <Loader2 className="h-3 w-3 text-purple-500 animate-spin shrink-0" />
                ) : (
                  <span className="h-3 w-3 text-emerald-500 shrink-0 text-center">&#10003;</span>
                )}
                <span className={cn("text-slate-500", i === thinkingLines.length - 1 && loading && "text-purple-600 font-medium")}>
                  {line}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="p-5 space-y-5">
          {/* Forecast periods */}
          {result.forecast.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {result.forecast.map((period, i) => {
                const isPositive = (period.net || 0) >= 0;
                const confidence = Math.min(Math.max(Math.round((period.confidence || 0) * 100), 0), 100);
                return (
                  <div key={i} className="border border-slate-200 rounded-xl p-3.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-2">{period.period}</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">In</span>
                        <span className="text-xs font-medium text-emerald-600">{formatCurrency(period.projected_inflow || 0)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Out</span>
                        <span className="text-xs font-medium text-red-500">{formatCurrency(period.projected_outflow || 0)}</span>
                      </div>
                      <div className="border-t border-slate-100 pt-1.5 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Net</span>
                        <span className={cn("text-sm font-bold", isPositive ? "text-emerald-600" : "text-red-500")}>
                          {isPositive ? "+" : ""}{formatCurrency(period.net || 0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", confidence > 70 ? "bg-purple-400" : confidence > 40 ? "bg-amber-400" : "bg-red-400")}
                            style={{ width: `${confidence}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-400">{confidence}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-2">No forecast periods returned. Try again with more data.</p>
          )}

          {/* Risks */}
          {result.risks && result.risks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-amber-500" />
                Risk Factors
              </p>
              <div className="space-y-1.5">
                {result.risks.map((risk, i) => (
                  <div key={i} className={cn(
                    "flex items-start gap-2 px-3 py-2 rounded-lg text-xs",
                    risk.severity === "high" ? "bg-red-50 text-red-700" :
                    risk.severity === "medium" ? "bg-amber-50 text-amber-700" :
                    "bg-slate-50 text-slate-600"
                  )}>
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span>{risk.description}</span>
                      {(risk.impact || 0) > 0 && (
                        <span className="ml-1.5 font-medium">({formatCurrency(risk.impact)} impact)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-purple-500" />
                AI Recommendations
              </p>
              <div className="space-y-1.5">
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-purple-50/50 text-xs text-purple-700">
                    <span className="font-bold shrink-0">{i + 1}.</span>
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Reasoning (collapsible) */}
          {result.reasoning && (
            <>
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors w-full"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>AI Reasoning</span>
                {showReasoning ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
              </button>

              {showReasoning && (
                <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 leading-relaxed border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-3.5 w-3.5 text-purple-500" />
                    <span className="font-semibold text-slate-700">Gemini 3 Analysis</span>
                  </div>
                  <p className="whitespace-pre-wrap">{result.reasoning}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div className="px-5 py-8 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-purple-50 mb-3">
            <TrendingUp className="h-6 w-6 text-purple-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">AI Cash Flow Prediction</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Gemini 3 analyzes your transaction history, upcoming invoices, and bill payments to project your cash flow for the next 90 days.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-5 py-3 bg-red-50 text-red-600 text-xs flex items-center gap-2 border-t border-red-100">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
          <button onClick={runForecast} className="ml-auto text-red-700 font-medium hover:underline">Retry</button>
        </div>
      )}
    </div>
  );
}
