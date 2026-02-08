"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, Timestamp, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Bot,
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  FileCheck,
  FileSpreadsheet,
  CreditCard,
  Building2,
  Calendar,
  DollarSign,
  Link2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Plus,
  Zap,
  Clock,
  AlertCircle,
  ArrowRight,
  Check,
  X,
  Brain,
  Eye,
  Tag,
  TrendingUp,
  Search,
  Terminal,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Transaction } from "@/types";
import { OutgoingInvoice, IncomingBill } from "@/types/documents";
import { Header } from "@/components/layout/header";
import { useUploadState } from "@/hooks/use-upload-state";

// ============================================
// TYPES
// ============================================

interface TransactionMatch {
  transactionId: string;
  classification: "payment_match" | "bank_fee" | "transfer" | "no_match" | "needs_review";
  documentId: string | null;
  documentType: "bill" | "invoice" | null;
  documentNumber: string | null;
  counterpartyName: string | null;
  confidence: number;
  reasoning: string[];
  matchType: string;
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

interface ReconcileStep {
  name: "quick_scan" | "ai_matching" | "deep_investigation" | "learning";
  status: "completed" | "skipped" | "running";
  count: number;
  details: string[];
  timeMs: number;
}

interface ReconcileResult {
  steps: ReconcileStep[];
  matches: TransactionMatch[];
  stats: {
    totalTransactions: number;
    quickMatches: number;
    aiMatches: number;
    deepMatches: number;
    bankFees: number;
    noMatch: number;
    autoConfirmed: number;
    needsReview: number;
    matchRate: number;
  };
  patternsLearned: string[];
  processingTimeMs: number;
  model: string;
  progressId?: string;
}

interface TransactionWithMatch extends Transaction {
  match?: TransactionMatch;
}

interface ProgressEvent {
  ts: number;
  type: "step" | "analyze" | "search" | "match" | "fx" | "confirm" | "classify" | "escalate" | "learn" | "info";
  text: string;
  step?: string;
}

// ============================================
// HELPERS
// ============================================

function formatCurrency(amount: number | undefined | null, currency: string = "USD") {
  if (amount === undefined || amount === null || isNaN(amount)) return `${currency} 0.00`;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatFullDate(timestamp: Timestamp | undefined) {
  if (!timestamp) return "-";
  const date = timestamp.toDate();
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

// Extract a human-readable entity name from a bank transaction description
function extractEntityName(description: string): string | null {
  if (!description) return null;
  const desc = description.trim();
  
  // Pattern: "Incoming Instant Payment ... <BANK> <ENTITY NAME> ACCTNUM..."
  const incomingMatch = desc.match(/(?:ORBACWCU|MCBKCWCU|CMBAAWAX)\s+(.+?)(?:\s+ACCTNUM|\s+(?:INV|S\d))/i);
  if (incomingMatch) return cleanEntityName(incomingMatch[1]);
  
  // Pattern: "Internet Transfer Credit <ENTITY>"
  const transferMatch = desc.match(/Internet Transfer Credit\s+(.+?)$/i);
  if (transferMatch) return cleanEntityName(transferMatch[1]);
  
  // Pattern: "Inward SWIFT Payment ... <ENTITY NAME> ... DBA ..."
  const swiftInMatch = desc.match(/Inward SWIFT Payment\s+\/\d+\s+(.+?)(?:\s+DBA|\s+SW-)/i);
  if (swiftInMatch) return cleanEntityName(swiftInMatch[1]);
  
  // Pattern: "Outward SWIFT Payment <ENTITY>"
  const swiftOutMatch = desc.match(/(?:Outward SWIFT|WireTfr Debit).+?(?:MOBILEWEB|ILEWEB)\s+(.+?)\s+\d/i);
  if (swiftOutMatch) return cleanEntityName(swiftOutMatch[1]);
  
  // Pattern: "InternetBanking ... Mark Austen ..."  
  const wireMatch = desc.match(/WireTfr Debit.+?(?:MOBILEWEB|ILEWEB)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
  if (wireMatch) return cleanEntityName(wireMatch[1]);
  
  // Pattern: "OVERHEID CURACAO LANDSONTVANGER"
  if (desc.includes("OVERHEID CURACAO") || desc.includes("LANDSONTVANGER")) return "Overheid Curaçao (Tax)";
  
  return null;
}

function cleanEntityName(name: string): string {
  return name
    .replace(/\s+(N\.?V\.?|B\.?V\.?|LLC|INC|LTD|CORP)\.?\s*$/i, (m) => ` ${m.trim()}`)
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(w => w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Truncate a long bank description for display
function truncateDescription(desc: string, maxLen: number = 80): string {
  if (!desc || desc.length <= maxLen) return desc;
  return desc.slice(0, maxLen).trim() + "…";
}

// ============================================
// AI REASONING STREAM — the showpiece
// ============================================

function ReasoningStream({
  isRunning,
  events,
  stats,
  result,
  elapsedMs,
  onClose,
}: {
  isRunning: boolean;
  events: ProgressEvent[];
  stats: { totalTransactions: number; totalBills: number; totalInvoices: number } | null;
  result: ReconcileResult | null;
  elapsedMs: number;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Auto-scroll to bottom as new events arrive
  useEffect(() => {
    if (scrollRef.current && !isMinimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, isMinimized]);

  if (events.length === 0 && !isRunning) return null;

  const elapsed = (elapsedMs / 1000).toFixed(1);

  const getEventIcon = (type: ProgressEvent["type"]) => {
    switch (type) {
      case "step": return "▸";
      case "analyze": return "→";
      case "search": return "  ↳";
      case "match": return "  ↳";
      case "fx": return "  ↳";
      case "confirm": return "  ✓";
      case "classify": return "  ◆";
      case "escalate": return "  ⚡";
      case "learn": return "  🧠";
      case "info": return "─";
      default: return " ";
    }
  };

  const getEventStyle = (type: ProgressEvent["type"]) => {
    switch (type) {
      case "step": return "text-slate-900 font-bold text-[13px] mt-3 first:mt-0";
      case "analyze": return "text-cyan-700 font-medium mt-1.5";
      case "search": return "text-slate-500";
      case "match": return "text-purple-700";
      case "fx": return "text-amber-600";
      case "confirm": return "text-emerald-600 font-semibold";
      case "classify": return "text-slate-500";
      case "escalate": return "text-amber-600 font-medium";
      case "learn": return "text-emerald-600";
      case "info": return "text-slate-400 text-[10px]";
      default: return "text-slate-500";
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-amber-400" />
            <div className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-mono text-slate-600">SmartInvoice AI Engine</span>
            {isRunning && (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-600 font-mono">LIVE</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-400">{elapsed}s</span>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            {isMinimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          {!isRunning && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal body */}
      {!isMinimized && (
        <div
          ref={scrollRef}
          className="p-4 font-mono text-[11px] leading-[1.6] max-h-[420px] overflow-y-auto scroll-smooth"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
        >
          {/* Init line */}
          {stats && (
            <div className="text-slate-400 mb-2">
              <span className="text-purple-600">$</span> reconcile --mode=ai --engine=gemini-3-flash
            </div>
          )}

          {/* Events */}
          {events.map((event, idx) => {
            const icon = getEventIcon(event.type);
            const style = getEventStyle(event.type);

            if (event.type === "step") {
              return (
                <div key={idx} className={cn("font-mono", style)}>
                  <div className="border-b border-slate-200 pb-1 mb-1">
                    {icon} {event.text}
                  </div>
                </div>
              );
            }

            if (event.type === "info" && event.text.includes("complete")) {
              return (
                <div key={idx} className={cn("font-mono mt-1", style)}>
                  {icon} {event.text}
                </div>
              );
            }

            return (
              <div
                key={idx}
                className={cn(
                  "font-mono animate-in fade-in slide-in-from-bottom-1 duration-200",
                  style
                )}
              >
                {icon} {event.text}
              </div>
            );
          })}

          {/* Cursor blink */}
          {isRunning && (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-purple-600">$</span>
              <span className="w-2 h-4 bg-purple-400 animate-pulse" />
            </div>
          )}

          {/* Completion summary */}
          {!isRunning && result && (
            <div className="mt-4 pt-3 border-t border-slate-200">
              <div className="text-emerald-600 font-bold text-xs mb-2">
                ✓ Reconciliation complete — {result.stats.matchRate}% match rate
              </div>
              <div className="grid grid-cols-4 gap-3 mt-2">
                <div className="text-center p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="text-lg font-bold text-emerald-600">{result.stats.autoConfirmed}</div>
                  <div className="text-[9px] text-emerald-500 uppercase tracking-wider">Auto-matched</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-purple-50 border border-purple-200">
                  <div className="text-lg font-bold text-purple-600">
                    {result.stats.aiMatches + result.stats.deepMatches}
                  </div>
                  <div className="text-[9px] text-purple-500 uppercase tracking-wider">AI Suggestions</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-lg font-bold text-slate-600">{result.stats.bankFees}</div>
                  <div className="text-[9px] text-slate-400 uppercase tracking-wider">Bank Fees</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="text-lg font-bold text-amber-600">{result.stats.needsReview}</div>
                  <div className="text-[9px] text-amber-500 uppercase tracking-wider">Need Review</div>
                </div>
              </div>
              {result.patternsLearned.length > 0 && (
                <div className="mt-2 text-[10px] text-emerald-600">
                  Patterns updated: {result.patternsLearned.join(", ")}
                </div>
              )}
              <div className="mt-2 text-[10px] text-slate-500">
                Processed in {(result.processingTimeMs / 1000).toFixed(1)}s using {result.model}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// STATS CARDS
// ============================================

function StatsCards({
  transactions,
  bills,
  invoices,
}: {
  transactions: TransactionWithMatch[];
  bills: IncomingBill[];
  invoices: OutgoingInvoice[];
}) {
  const unmatched = transactions.filter(tx =>
    (!tx.reconciliationStatus || tx.reconciliationStatus === "unmatched") && !tx.match
  );
  const suggested = transactions.filter(tx =>
    tx.match && tx.match.classification === "payment_match" && !tx.match.autoConfirmed && tx.reconciliationStatus !== "matched"
  );
  const matched = transactions.filter(tx => tx.reconciliationStatus === "matched");
  const bankFees = transactions.filter(tx => tx.match?.classification === "bank_fee");

  const progress = transactions.length > 0
    ? Math.round(((matched.length + bankFees.length) / transactions.length) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Card className="border-orange-200 bg-orange-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
              <Clock className="h-4 w-4 text-orange-600" />
            </div>
            <div className="text-xs text-orange-600 font-medium">Unmatched</div>
          </div>
          <div className="text-2xl font-bold text-orange-700">{unmatched.length}</div>
          <div className="text-xs text-orange-600">need matching</div>
        </CardContent>
      </Card>

      <Card className="border-purple-200 bg-purple-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-xs text-purple-600 font-medium">Suggested</div>
          </div>
          <div className="text-2xl font-bold text-purple-700">{suggested.length}</div>
          <div className="text-xs text-purple-600">to review</div>
        </CardContent>
      </Card>

      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-xs text-emerald-600 font-medium">Matched</div>
          </div>
          <div className="text-2xl font-bold text-emerald-700">{matched.length}</div>
          <div className="text-xs text-emerald-600">reconciled</div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-slate-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-slate-500" />
            </div>
            <div className="text-xs text-slate-500 font-medium">Bank Fees</div>
          </div>
          <div className="text-2xl font-bold text-slate-600">{bankFees.length}</div>
          <div className="text-xs text-slate-500">identified</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-slate-600 font-medium mb-2">Match Rate</div>
          <div className="text-2xl font-bold">{progress}%</div>
          <Progress value={progress} className="h-2 mt-2" />
          <div className="text-[10px] text-slate-500 mt-1">
            {bills.length} bills • {invoices.length} invoices
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// TRANSACTION ROW
// ============================================

function TransactionRow({
  transaction,
  onConfirm,
  onReject,
  onCategorize,
  isProcessing,
}: {
  transaction: TransactionWithMatch;
  onConfirm: (tx: TransactionWithMatch) => void;
  onReject: (txId: string) => void;
  onCategorize: (txId: string) => void;
  isProcessing: boolean;
}) {
  const [showReasoning, setShowReasoning] = useState(false);
  const isCredit = transaction.type === "credit";
  const match = transaction.match;
  const isMatched = transaction.reconciliationStatus === "matched";
  const isBankFee = match?.classification === "bank_fee";
  const isTransfer = match?.classification === "transfer";
  const isPaymentMatch = match?.classification === "payment_match" && !match.autoConfirmed;
  const isAutoConfirmed = match?.autoConfirmed;

  // Resolve "Unknown" counterparty — extract from description if needed
  const displayCounterparty = match?.counterpartyName && match.counterpartyName !== "Unknown" && match.counterpartyName !== "null"
    ? match.counterpartyName
    : extractEntityName(transaction.description || "") || null;
  
  const hasLinkedDocument = match?.documentId != null;
  const displayDocNumber = match?.documentNumber || null;

  return (
    <div className={cn(
      "border-b last:border-0 transition-colors",
      isMatched && "bg-emerald-50/30",
      isAutoConfirmed && "bg-emerald-50/30",
      isBankFee && "bg-slate-50/50 opacity-60",
      isTransfer && "bg-slate-50/50 opacity-60",
      isPaymentMatch && "hover:bg-slate-50/50",
    )}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Icon */}
        <div className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
          isBankFee || isTransfer ? "bg-slate-100" : isCredit ? "bg-emerald-50" : "bg-orange-50"
        )}>
          {isBankFee ? (
            <CreditCard className="h-4 w-4 text-slate-400" />
          ) : isTransfer ? (
            <RefreshCw className="h-4 w-4 text-slate-400" />
          ) : isCredit ? (
            <ArrowDownRight className="h-4 w-4 text-emerald-600" />
          ) : (
            <ArrowUpRight className="h-4 w-4 text-orange-600" />
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Top row: description + badges */}
          <div className="flex items-center gap-2">
            {/* Show entity name if available, else truncated description */}
            <p className={cn(
              "text-sm font-medium truncate",
              (isBankFee || isTransfer) ? "text-slate-400" : "text-slate-900"
            )}>
              {isBankFee ? (transaction.description?.split(" ").slice(0, 4).join(" ") || "Bank Fee")
                : displayCounterparty || truncateDescription(transaction.description || "", 60)}
            </p>
            {isBankFee && (
              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">Bank Fee</span>
            )}
            {isTransfer && (
              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">Transfer</span>
            )}
          </div>

          {/* Date + reference line */}
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
            <span>{formatFullDate(transaction.date)}</span>
            {displayCounterparty && !isBankFee && (
              <span className="truncate text-slate-400 max-w-[300px]">
                {truncateDescription(transaction.description || "", 50)}
              </span>
            )}
          </div>

          {/* AI Match Suggestion — clean card */}
          {isPaymentMatch && match && (
            <div className={cn(
              "mt-2 p-2.5 rounded-lg border",
              hasLinkedDocument ? "bg-emerald-50/50 border-emerald-200" : "bg-purple-50/50 border-purple-200"
            )}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Confidence pill */}
                  <div className={cn(
                    "h-7 min-w-[42px] rounded-md flex items-center justify-center text-xs font-bold shrink-0",
                    match.confidence >= 90 ? "bg-emerald-100 text-emerald-700" :
                    match.confidence >= 75 ? "bg-purple-100 text-purple-700" :
                    "bg-amber-100 text-amber-700"
                  )}>
                    {match.confidence}%
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {displayDocNumber && (
                        <span className="text-xs font-semibold text-slate-800 font-mono">{displayDocNumber}</span>
                      )}
                      {displayCounterparty && (
                        <span className="text-xs text-slate-500">{displayCounterparty}</span>
                      )}
                      {!hasLinkedDocument && displayDocNumber && (
                        <span className="text-[9px] text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded shrink-0">
                          Ref only
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{match.reasoning[0]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {match.reasoning.length > 1 && (
                    <button
                      onClick={() => setShowReasoning(!showReasoning)}
                      className="h-7 w-7 rounded-md border border-slate-200 flex items-center justify-center hover:bg-white transition-colors"
                      title="Show reasoning"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  )}
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => onConfirm(transaction)}
                    disabled={isProcessing}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Confirm
                  </Button>
                  <Button
                    size="sm" variant="outline" className="h-7 w-7 p-0"
                    onClick={() => onReject(transaction.id)}
                    disabled={isProcessing}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {/* Expandable reasoning */}
              {showReasoning && match.reasoning.length > 1 && (
                <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-0.5">
                  {match.reasoning.map((step, i) => (
                    <p key={i} className="text-[11px] text-slate-500">
                      <span className="text-slate-400 font-mono mr-1">{i + 1}.</span> {step}
                    </p>
                  ))}
                </div>
              )}
              {match.fxDetails && (
                <div className="mt-1.5 text-[10px] text-purple-600 flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  {match.fxDetails.fromCurrency} → {match.fxDetails.toCurrency} @ {match.fxDetails.rate.toFixed(4)}
                </div>
              )}
            </div>
          )}

          {(isBankFee || isTransfer) && match && (
            <p className="text-[11px] text-slate-400 mt-0.5 italic">{match.reasoning[0]}</p>
          )}

          {isAutoConfirmed && match && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-600">
              <Zap className="h-3 w-3" />
              Auto-matched to {match.documentNumber} ({match.confidence}%)
            </div>
          )}

          {!match && !isMatched && (
            <Button
              size="sm" variant="ghost" className="h-6 text-[11px] text-slate-400 mt-1 px-2"
              onClick={() => onCategorize(transaction.id)}
            >
              <Tag className="h-3 w-3 mr-1" /> Categorize
            </Button>
          )}
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className={cn(
            "text-sm font-semibold tabular-nums",
            isCredit ? "text-emerald-600" : (isBankFee || isTransfer) ? "text-slate-400" : "text-slate-900"
          )}>
            {isCredit ? "+" : "-"}{formatCurrency(Math.abs(transaction.amount), transaction.currency || "USD")}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CONFIRM MATCH MODAL
// ============================================

function ConfirmMatchModal({
  open,
  onOpenChange,
  transaction,
  onConfirm,
  isProcessing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionWithMatch | null;
  onConfirm: () => void;
  isProcessing: boolean;
}) {
  if (!transaction || !transaction.match) return null;
  const match = transaction.match;
  const isCredit = transaction.type === "credit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Confirm Match
          </DialogTitle>
          <DialogDescription>Link this transaction to the document</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-slate-50 border">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Transaction</div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{transaction.description}</p>
                <p className="text-sm text-slate-500">{formatFullDate(transaction.date)}</p>
              </div>
              <div className={cn("text-lg font-bold", isCredit ? "text-emerald-600" : "text-slate-900")}>
                {isCredit ? "+" : "-"}{formatCurrency(Math.abs(transaction.amount), transaction.currency)}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Link2 className="h-5 w-5 text-purple-600" />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              {match.documentType === "invoice" ? "Invoice" : "Bill"}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{match.documentNumber}</p>
                <p className="text-sm text-slate-500">{match.counterpartyName}</p>
              </div>
              <Badge className={cn(match.confidence >= 80 ? "bg-emerald-600" : "bg-amber-500")}>
                {match.confidence}%
              </Badge>
            </div>
          </div>

          {match.fxDetails && (
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
              <div className="flex items-center gap-2 text-sm text-purple-700">
                <RefreshCw className="h-4 w-4" />
                <span className="font-medium">Currency Conversion</span>
              </div>
              <div className="text-sm text-purple-600 mt-1">
                {formatCurrency(Math.abs(transaction.amount), match.fxDetails.fromCurrency)}
                {" × "}{match.fxDetails.rate.toFixed(4)}
                {" = "}{formatCurrency(match.fxDetails.convertedAmount, match.fxDetails.toCurrency)}
              </div>
            </div>
          )}

          {match.reasoning.length > 0 && (
            <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
              <p className="text-xs font-medium text-indigo-700 flex items-center gap-1.5 mb-1.5">
                <Brain className="h-3.5 w-3.5" /> AI Reasoning
              </p>
              <div className="space-y-0.5">
                {match.reasoning.map((step, i) => (
                  <p key={i} className="text-xs text-indigo-600">
                    {i + 1}. {step}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700">
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Confirm Match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function ReconciliationPage() {
  const { user } = useAuth();

  const { openDrawer: openUploadDrawer } = useUploadState();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionWithMatch[]>([]);
  const [invoices, setInvoices] = useState<OutgoingInvoice[]>([]);
  const [bills, setBills] = useState<IncomingBill[]>([]);
  const [activeTab, setActiveTab] = useState<"unmatched" | "suggested" | "matched" | "all">("unmatched");

  // Confirm modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithMatch | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Pipeline state — now with REAL streaming
  const [isReconciling, setIsReconciling] = useState(false);
  const [streamEvents, setStreamEvents] = useState<ProgressEvent[]>([]);
  const [streamStats, setStreamStats] = useState<{ totalTransactions: number; totalBills: number; totalInvoices: number } | null>(null);
  const [pipelineResult, setPipelineResult] = useState<ReconcileResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedInterval = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const unsubProgressRef = useRef<(() => void) | null>(null);

  // Load transactions
  useEffect(() => {
    if (!user?.id) return;

    const txQuery = query(
      collection(db, "transactions"),
      where("userId", "==", user.id),
      orderBy("date", "desc"),
      limit(200)
    );

    const unsubTx = onSnapshot(txQuery, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as TransactionWithMatch[];
      setTransactions(prev => {
        const matchMap = new Map(prev.filter(t => t.match).map(t => [t.id, t.match]));
        return txs.map(tx => ({
          ...tx,
          match: matchMap.get(tx.id) || undefined,
        }));
      });
      setLoading(false);
    });

    const invoicesQuery = query(
      collection(db, "invoices"),
      where("userId", "==", user.id),
      orderBy("invoiceDate", "desc")
    );

    const unsubInvoices = onSnapshot(invoicesQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          documentNumber: data.documentNumber || data.invoiceNumber || "Unknown",
          documentDate: data.documentDate || data.invoiceDate,
          amountRemaining: data.amountRemaining ?? data.amountDue ?? data.total ?? 0,
          customerName: data.customerName || data.counterpartyName || "Unknown",
          total: data.total || 0,
          currency: data.currency || "USD",
        };
      }) as OutgoingInvoice[];
      setInvoices(docs);
    });

    const billsQuery = query(
      collection(db, "bills"),
      where("userId", "==", user.id),
      orderBy("documentDate", "desc")
    );

    const unsubBills = onSnapshot(billsQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as IncomingBill[];
      setBills(docs);
    });

    return () => {
      unsubTx();
      unsubInvoices();
      unsubBills();
    };
  }, [user?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubProgressRef.current) unsubProgressRef.current();
      if (elapsedInterval.current) clearInterval(elapsedInterval.current);
    };
  }, []);

  // Run the unified reconciliation pipeline — with REAL streaming
  const handleReconcile = useCallback(async () => {
    if (!user?.id) return;

    const unmatchedTxs = transactions.filter(tx =>
      (!tx.reconciliationStatus || tx.reconciliationStatus === "unmatched") && !tx.match
    );

    if (unmatchedTxs.length === 0) {
      toast.info("No unmatched transactions to process");
      return;
    }

    // Generate a unique progressId for this run
    const progressId = `recon_${user.id.slice(0, 8)}_${Date.now()}`;

    setIsReconciling(true);
    setStreamEvents([]);
    setStreamStats(null);
    setPipelineResult(null);
    setElapsedMs(0);

    // Start timer
    startTimeRef.current = Date.now();
    elapsedInterval.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);

    // Start listening to the progress document BEFORE calling the function
    const progressDocRef = doc(db, "reconciliation_runs", progressId);
    let prevEventCount = 0;

    unsubProgressRef.current = onSnapshot(progressDocRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();

      if (data.totalTransactions) {
        setStreamStats({
          totalTransactions: data.totalTransactions,
          totalBills: data.totalBills || 0,
          totalInvoices: data.totalInvoices || 0,
        });
      }

      if (data.events && Array.isArray(data.events)) {
        // Only set the new events (Firestore sends the full array each time)
        if (data.events.length > prevEventCount) {
          prevEventCount = data.events.length;
          setStreamEvents([...data.events]);
        }
      }
    });

    try {
      const reconcile = httpsCallable(functions, "reconcileAll", { timeout: 540000 });
      
      // Auto-chaining loop: process batches until done
      let cursor: string | undefined;
      let batchNumber = 0;
      let accumulatedStats: any = undefined;
      let totalMatches: TransactionMatch[] = [];
      let finalData: ReconcileResult | null = null;

      while (true) {
        const result = await reconcile({
          // Only send IDs on the first batch; subsequent batches use cursor
          ...(batchNumber === 0 ? { transactionIds: unmatchedTxs.map(tx => tx.id) } : {}),
          progressId,
          autoConfirmThreshold: 93,
          cursor,
          batchNumber,
          accumulatedStats,
        });

        const data = result.data as ReconcileResult & {
          hasMore?: boolean;
          cursor?: string;
          batchNumber?: number;
          batchProcessed?: number;
          totalProcessedSoFar?: number;
        };

        // Accumulate matches across batches
        if (data.matches?.length > 0) {
          totalMatches = [...totalMatches, ...data.matches];
          
          // Apply this batch's matches to the UI immediately
          setTransactions(prev => prev.map(tx => {
            const match = data.matches.find(m => m.transactionId === tx.id);
            if (!match) return tx;
            return {
              ...tx,
              match,
              ...(match.autoConfirmed ? { reconciliationStatus: "matched" as any } : {}),
            };
          }));
        }

        finalData = { ...data, matches: totalMatches };
        accumulatedStats = data.stats;

        // Check if there are more batches to process
        if (data.hasMore && data.cursor) {
          cursor = data.cursor;
          batchNumber = (data.batchNumber ?? batchNumber) + 1;
          // Brief pause between batches
          await new Promise(r => setTimeout(r, 500));
        } else {
          break; // All done
        }
      }

      // Stop timer
      if (elapsedInterval.current) {
        clearInterval(elapsedInterval.current);
        elapsedInterval.current = null;
      }
      if (finalData) {
        setElapsedMs(finalData.processingTimeMs);
        setPipelineResult(finalData);
      }

      // Switch to suggested tab if there are suggestions
      const suggestions = totalMatches.filter(
        m => m.classification === "payment_match" && !m.autoConfirmed
      );
      if (suggestions.length > 0) {
        setActiveTab("suggested");
      }

      const stats = finalData?.stats;
      const batchInfo = batchNumber > 0 ? ` (${batchNumber + 1} batches)` : "";
      toast.success(
        `Done${batchInfo}! ${stats?.autoConfirmed || 0} auto-confirmed, ${(stats?.aiMatches || 0) + (stats?.deepMatches || 0)} suggestions, ${stats?.bankFees || 0} bank fees identified.`
      );
    } catch (error: any) {
      console.error("Reconciliation error:", error);
      toast.error(error.message || "Reconciliation failed");
      if (elapsedInterval.current) {
        clearInterval(elapsedInterval.current);
        elapsedInterval.current = null;
      }
    }

    setIsReconciling(false);

    // Clean up progress listener after a delay (let final events arrive)
    setTimeout(() => {
      if (unsubProgressRef.current) {
        unsubProgressRef.current();
        unsubProgressRef.current = null;
      }
    }, 2000);
  }, [user?.id, transactions]);

  // Confirm match
  const handleConfirmClick = useCallback((tx: TransactionWithMatch) => {
    setSelectedTransaction(tx);
    setConfirmModalOpen(true);
  }, []);

  const handleConfirmMatch = useCallback(async () => {
    if (!user?.id || !selectedTransaction || !selectedTransaction.match) return;

    setIsConfirming(true);

    try {
      const confirmMatch = httpsCallable(functions, "confirmMatchV2");
      await confirmMatch({
        transactionId: selectedTransaction.id,
        documentId: selectedTransaction.match.documentId,
        documentType: selectedTransaction.match.documentType,
        matchConfidence: selectedTransaction.match.confidence,
        matchMethod: `ai_${selectedTransaction.match.thinkingLevel}`,
        fxRate: selectedTransaction.match.fxDetails?.rate,
      });

      setTransactions(prev => prev.map(tx =>
        tx.id === selectedTransaction.id
          ? { ...tx, reconciliationStatus: "matched" as any, match: { ...tx.match!, autoConfirmed: true } }
          : tx
      ));

      setConfirmModalOpen(false);
      setSelectedTransaction(null);
      toast.success("Match confirmed! Pattern memory updated.");
    } catch (error: any) {
      console.error("Confirm error:", error);
      toast.error(error.message || "Failed to confirm match");
    }

    setIsConfirming(false);
  }, [user?.id, selectedTransaction]);

  const handleReject = useCallback((txId: string) => {
    setTransactions(prev => prev.map(tx =>
      tx.id === txId ? { ...tx, match: undefined } : tx
    ));
    toast.info("Suggestion dismissed");
  }, []);

  const handleCategorize = useCallback(async (txId: string) => {
    if (!user?.id) return;
    try {
      const categorize = httpsCallable(functions, "categorizeTransactionV2");
      await categorize({ transactionId: txId, category: "other" });
      setTransactions(prev => prev.map(tx =>
        tx.id === txId ? { ...tx, reconciliationStatus: "categorized" as any } : tx
      ));
      toast.success("Transaction categorized");
    } catch (error: any) {
      toast.error(error.message || "Failed to categorize");
    }
  }, [user?.id]);

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    const isBankFee = tx.match?.classification === "bank_fee";
    const isTransfer = tx.match?.classification === "transfer";
    const isPaymentMatch = tx.match?.classification === "payment_match" && !tx.match.autoConfirmed;

    if (activeTab === "unmatched") {
      return (!tx.reconciliationStatus || tx.reconciliationStatus === "unmatched")
        && !tx.match && !isBankFee && !isTransfer;
    }
    if (activeTab === "suggested") {
      return (isPaymentMatch || isBankFee || isTransfer) && tx.reconciliationStatus !== "matched";
    }
    if (activeTab === "matched") {
      return tx.reconciliationStatus === "matched" || tx.match?.autoConfirmed;
    }
    return true;
  });

  const unmatchedCount = transactions.filter(tx =>
    (!tx.reconciliationStatus || tx.reconciliationStatus === "unmatched") && !tx.match
  ).length;

  const suggestedCount = transactions.filter(tx => {
    const isPaymentMatch = tx.match?.classification === "payment_match" && !tx.match.autoConfirmed;
    const isBankFee = tx.match?.classification === "bank_fee";
    const isTransfer = tx.match?.classification === "transfer";
    return (isPaymentMatch || isBankFee || isTransfer) && tx.reconciliationStatus !== "matched";
  }).length;

  const matchedCount = transactions.filter(tx =>
    tx.reconciliationStatus === "matched" || tx.match?.autoConfirmed
  ).length;

  if (loading) {
    return (
      <>
        <Header title="Reconciliation" />
        <div className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-28 bg-slate-200 rounded-lg" />
              ))}
            </div>
            <div className="h-12 bg-slate-200 rounded-lg" />
            <div className="h-96 bg-slate-200 rounded-lg" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Reconciliation" />
      <div className="p-4 space-y-4">
        <StatsCards transactions={transactions} bills={bills} invoices={invoices} />

        {/* Warning: No documents to match against */}
        {transactions.length > 0 && bills.length === 0 && invoices.length === 0 && !isReconciling && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900">No invoices or bills uploaded</h4>
              <p className="text-xs text-amber-700 mt-0.5">
                AI found invoice references in your bank statements but can't match them to actual documents. 
                Upload your invoices and bills to enable full automatic matching.
              </p>
              <div className="flex gap-2 mt-3">
                <Button 
                  size="sm" variant="outline" 
                  className="h-7 text-xs border-amber-300 hover:bg-amber-100"
                  onClick={() => openUploadDrawer("invoice")}
                >
                  <FileCheck className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                  Upload Invoices
                </Button>
                <Button 
                  size="sm" variant="outline" 
                  className="h-7 text-xs border-amber-300 hover:bg-amber-100"
                  onClick={() => openUploadDrawer("bill")}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-orange-600" />
                  Upload Bills
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* AI Reasoning Stream — THE SHOWPIECE */}
        <ReasoningStream
          isRunning={isReconciling}
          events={streamEvents}
          stats={streamStats}
          result={pipelineResult}
          elapsedMs={elapsedMs}
          onClose={() => {
            setStreamEvents([]);
            setPipelineResult(null);
          }}
        />

        {/* Visual Results Summary — appears after reconciliation */}
        {!isReconciling && pipelineResult && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200">
                  <Brain className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">AI Reconciliation Results</h3>
                  <p className="text-xs text-slate-500">
                    {pipelineResult.stats.totalTransactions} transactions processed in {(pipelineResult.processingTimeMs / 1000).toFixed(1)}s
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-900">{pipelineResult.stats.matchRate}%</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Match Rate</div>
              </div>
            </div>

            {/* Match rate progress bar */}
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden mb-4">
              <div className="h-full flex">
                <div
                  className="bg-emerald-500 transition-all duration-1000"
                  style={{ width: `${(pipelineResult.stats.autoConfirmed / Math.max(pipelineResult.stats.totalTransactions, 1)) * 100}%` }}
                  title="Auto-confirmed"
                />
                <div
                  className="bg-purple-500 transition-all duration-1000"
                  style={{ width: `${((pipelineResult.stats.aiMatches + pipelineResult.stats.deepMatches) / Math.max(pipelineResult.stats.totalTransactions, 1)) * 100}%` }}
                  title="AI suggestions"
                />
                <div
                  className="bg-slate-300 transition-all duration-1000"
                  style={{ width: `${(pipelineResult.stats.bankFees / Math.max(pipelineResult.stats.totalTransactions, 1)) * 100}%` }}
                  title="Bank fees"
                />
                <div
                  className="bg-amber-400 transition-all duration-1000"
                  style={{ width: `${(pipelineResult.stats.needsReview / Math.max(pipelineResult.stats.totalTransactions, 1)) * 100}%` }}
                  title="Needs review"
                />
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">{pipelineResult.stats.autoConfirmed}</div>
                  <div className="text-[10px] text-slate-500">Auto-confirmed</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-purple-500 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">{pipelineResult.stats.aiMatches + pipelineResult.stats.deepMatches}</div>
                  <div className="text-[10px] text-slate-500">AI Suggestions</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-slate-300 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">{pipelineResult.stats.bankFees}</div>
                  <div className="text-[10px] text-slate-500">Bank Fees</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-amber-400 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">{pipelineResult.stats.needsReview}</div>
                  <div className="text-[10px] text-slate-500">Needs Review</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">{pipelineResult.stats.noMatch}</div>
                  <div className="text-[10px] text-slate-500">No Match</div>
                </div>
              </div>
            </div>

            {/* AI Pipeline Steps */}
            {pipelineResult.steps.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Pipeline Steps</div>
                <div className="flex gap-2">
                  {pipelineResult.steps.map((step, i) => (
                    <div key={i} className={cn(
                      "flex-1 p-2 rounded-lg border text-center",
                      step.status === "completed" ? "bg-emerald-50 border-emerald-200" :
                      step.status === "skipped" ? "bg-slate-50 border-slate-200 opacity-50" :
                      "bg-purple-50 border-purple-200"
                    )}>
                      <div className="text-[10px] font-medium text-slate-700 capitalize">
                        {step.name.replace(/_/g, " ")}
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">{step.count}</div>
                      <div className="text-[9px] text-slate-400">{(step.timeMs / 1000).toFixed(1)}s</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Patterns learned */}
            {pipelineResult.patternsLearned.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                <Brain className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-[11px] text-purple-600 font-medium">
                  Patterns learned: {pipelineResult.patternsLearned.join(", ")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList>
              <TabsTrigger value="unmatched" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Unmatched
                {unmatchedCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">{unmatchedCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="suggested" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                AI Suggestions
                {suggestedCount > 0 && (
                  <Badge className="ml-1 text-[10px] bg-purple-600">{suggestedCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="matched" className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Matched
                {matchedCount > 0 && (
                  <Badge variant="outline" className="ml-1 text-[10px]">{matchedCount}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Upload
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openUploadDrawer("statement")}>
                  <Building2 className="h-4 w-4 mr-2 text-cyan-600" />
                  Bank Statement
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openUploadDrawer("invoice")}>
                  <FileCheck className="h-4 w-4 mr-2 text-emerald-600" />
                  Invoice
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openUploadDrawer("bill")}>
                  <FileSpreadsheet className="h-4 w-4 mr-2 text-orange-600" />
                  Bill
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={handleReconcile}
              disabled={isReconciling || unmatchedCount === 0}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-200"
            >
              {isReconciling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              {isReconciling ? "AI is thinking..." : "Match All with AI"}
            </Button>
          </div>
        </div>

        {/* Transaction List */}
        <Card>
          <div className="max-h-[calc(100vh-420px)] overflow-auto">
            {filteredTransactions.length === 0 ? (
              <div className="p-12 text-center">
                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  {activeTab === "matched" ? (
                    <CheckCircle2 className="h-6 w-6 text-slate-400" />
                  ) : activeTab === "suggested" ? (
                    <Sparkles className="h-6 w-6 text-slate-400" />
                  ) : (
                    <CreditCard className="h-6 w-6 text-slate-400" />
                  )}
                </div>
                <p className="text-sm font-medium text-slate-900">
                  {activeTab === "matched"
                    ? "No matched transactions yet"
                    : activeTab === "suggested"
                    ? "No AI suggestions yet — run Match All"
                    : "All transactions have been processed!"
                  }
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {activeTab === "unmatched" && transactions.length > 0
                    ? "Click 'Match All with AI' to start"
                    : "Upload bank statements and documents to get started"
                  }
                </p>
                {activeTab === "unmatched" && unmatchedCount === 0 && suggestedCount > 0 && (
                  <Button
                    variant="outline" size="sm" className="mt-4"
                    onClick={() => setActiveTab("suggested")}
                  >
                    View Suggestions
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                )}
              </div>
            ) : (
              filteredTransactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  onConfirm={handleConfirmClick}
                  onReject={handleReject}
                  onCategorize={handleCategorize}
                  isProcessing={isConfirming}
                />
              ))
            )}
          </div>
        </Card>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{filteredTransactions.length} {activeTab} transactions</span>
          <div className="flex items-center gap-4">
            <span>{bills.length} bills</span>
            <span>{invoices.length} invoices</span>
            {pipelineResult && (
              <span className="text-purple-600 flex items-center gap-1">
                <Brain className="h-3 w-3" />
                {pipelineResult.model}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      <ConfirmMatchModal
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        transaction={selectedTransaction}
        onConfirm={handleConfirmMatch}
        isProcessing={isConfirming}
      />

    </>
  );
}
