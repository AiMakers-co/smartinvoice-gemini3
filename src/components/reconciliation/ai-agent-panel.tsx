"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Brain,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  CreditCard,
  Zap,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface AgentResult {
  status: "match_found" | "explanation_found" | "no_resolution" | "needs_human";
  confidence: number;
  explanation: string;
  suggestedAction: "confirm_match" | "split_payment" | "mark_partial" | "investigate" | "ignore";
  matchedTransactions?: Array<{
    transactionId: string;
    amount: number;
    description: string;
    contribution: string;
  }>;
  relatedDocuments?: Array<{
    type: "credit_note" | "refund" | "fee" | "fx_adjustment";
    id: string;
    amount: number;
    description: string;
  }>;
  reasoning: string[];
}

interface InvoiceForInvestigation {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  total: number;
  currency: string;
  invoiceDate: string;
}

interface AIAgentPanelProps {
  invoice: InvoiceForInvestigation;
  suspectedTransaction?: {
    id: string;
    description: string;
    amount: number;
    currency: string;
  };
  discrepancyType: "amount_mismatch" | "vendor_mismatch" | "no_match_found" | "date_anomaly" | "currency_mismatch" | "partial_payment";
  onMatchConfirmed?: (invoiceId: string, transactionIds: string[]) => void;
  onActionTaken?: (action: string) => void;
}

// ============================================
// COMPONENT
// ============================================

export function AIAgentPanel({
  invoice,
  suspectedTransaction,
  discrepancyType,
  onMatchConfirmed,
  onActionTaken,
}: AIAgentPanelProps) {
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);

  const handleInvestigate = async () => {
    setIsInvestigating(true);
    setError(null);
    setResult(null);

    try {
      const investigateFn = httpsCallable(functions, "investigateMatch");
      const response = await investigateFn({
        invoiceId: invoice.id,
        transactionId: suspectedTransaction?.id,
        discrepancyType,
      });

      setResult(response.data as AgentResult);
    } catch (err) {
      console.error("Investigation error:", err);
      setError(err instanceof Error ? err.message : "Investigation failed");
    } finally {
      setIsInvestigating(false);
    }
  };

  const handleApplyAction = () => {
    if (!result) return;

    if (result.suggestedAction === "confirm_match" && result.matchedTransactions?.length) {
      onMatchConfirmed?.(invoice.id, result.matchedTransactions.map(t => t.transactionId));
    }
    
    onActionTaken?.(result.suggestedAction);
  };

  const getStatusIcon = (status: AgentResult["status"]) => {
    switch (status) {
      case "match_found":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "explanation_found":
        return <Sparkles className="h-5 w-5 text-amber-500" />;
      case "needs_human":
        return <HelpCircle className="h-5 w-5 text-blue-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-slate-400" />;
    }
  };

  const getStatusLabel = (status: AgentResult["status"]) => {
    switch (status) {
      case "match_found":
        return "Match Found";
      case "explanation_found":
        return "Explanation Found";
      case "needs_human":
        return "Needs Review";
      default:
        return "No Resolution";
    }
  };

  const getActionLabel = (action: AgentResult["suggestedAction"]) => {
    switch (action) {
      case "confirm_match":
        return "Confirm Match";
      case "split_payment":
        return "Split Payment";
      case "mark_partial":
        return "Mark as Partial";
      case "investigate":
        return "Manual Review";
      default:
        return "Ignore";
    }
  };

  const getDiscrepancyLabel = (type: typeof discrepancyType) => {
    switch (type) {
      case "amount_mismatch":
        return "Amount doesn't match";
      case "vendor_mismatch":
        return "Vendor name unclear";
      case "no_match_found":
        return "No matching transaction";
      case "date_anomaly":
        return "Unusual payment date";
      case "currency_mismatch":
        return "Currency difference";
      case "partial_payment":
        return "Possible partial payment";
      default:
        return "Unknown issue";
    }
  };

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-white" role="region" aria-label="AI Match Agent Investigation">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center" aria-hidden="true">
              <Bot className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">AI Match Agent</CardTitle>
              <CardDescription className="text-xs">
                Intelligent investigation of uncertain matches
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
            <Brain className="h-3 w-3 mr-1" aria-hidden="true" />
            Gemini 2.0
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Issue Summary */}
        <div className="p-3 rounded-lg bg-slate-50 border">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded bg-amber-100 flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {getDiscrepancyLabel(discrepancyType)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Invoice #{invoice.invoiceNumber} • {invoice.vendorName} • {invoice.currency} {invoice.total.toLocaleString()}
              </p>
              {suspectedTransaction && (
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  Suspected: {suspectedTransaction.description} • {suspectedTransaction.currency} {suspectedTransaction.amount.toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Investigation Button or Results */}
        {!result && !isInvestigating && !error && (
          <Button 
            onClick={handleInvestigate}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <Search className="h-4 w-4 mr-2" />
            Investigate with AI Agent
          </Button>
        )}

        {isInvestigating && (
          <div className="p-6 flex flex-col items-center gap-3 text-center" role="status" aria-live="polite" aria-busy="true">
            <div className="relative">
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center" aria-hidden="true">
                <Bot className="h-6 w-6 text-purple-600" />
              </div>
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-amber-100 flex items-center justify-center" aria-hidden="true">
                <Loader2 className="h-3 w-3 text-amber-600 animate-spin" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Agent Investigating...</p>
              <p className="text-xs text-slate-500 mt-1">
                Searching transactions, analyzing patterns, checking for credit notes...
              </p>
            </div>
            <div className="flex gap-2 text-xs text-slate-400" aria-hidden="true">
              <span className="animate-pulse">🔍 Searching</span>
              <span>→</span>
              <span className="opacity-50">📊 Analyzing</span>
              <span>→</span>
              <span className="opacity-50">💡 Resolving</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200" role="alert" aria-live="assertive">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <p className="text-sm font-medium">Investigation Failed</p>
            </div>
            <p className="text-xs text-red-600 mt-1">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleInvestigate}
              className="mt-3"
              aria-label="Retry investigation"
            >
              <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
              Retry
            </Button>
          </div>
        )}

        {result && (
          <div className="space-y-4" role="region" aria-live="polite" aria-label="Investigation Results">
            {/* Result Header */}
            <div className={cn(
              "p-4 rounded-lg border",
              result.status === "match_found" && "bg-emerald-50 border-emerald-200",
              result.status === "explanation_found" && "bg-amber-50 border-amber-200",
              result.status === "needs_human" && "bg-blue-50 border-blue-200",
              result.status === "no_resolution" && "bg-slate-50 border-slate-200",
            )}>
              <div className="flex items-start gap-3">
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{getStatusLabel(result.status)}</span>
                    <Badge variant="secondary" className="text-xs">
                      {result.confidence}% confident
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{result.explanation}</p>
                </div>
              </div>
            </div>

            {/* Matched Transactions */}
            {result.matchedTransactions && result.matchedTransactions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Matched Transactions
                </p>
                {result.matchedTransactions.map((tx, i) => (
                  <div 
                    key={tx.transactionId}
                    className="flex items-center justify-between p-2 rounded bg-emerald-50 border border-emerald-200"
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{tx.description}</p>
                        <p className="text-xs text-slate-500">{tx.contribution}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">
                      ${tx.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Related Documents */}
            {result.relatedDocuments && result.relatedDocuments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Related Documents
                </p>
                {result.relatedDocuments.map((doc, i) => (
                  <div 
                    key={doc.id}
                    className="flex items-center justify-between p-2 rounded bg-amber-50 border border-amber-200"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium text-slate-900 capitalize">{doc.type.replace("_", " ")}</p>
                        <p className="text-xs text-slate-500">{doc.description}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-amber-600">
                      ${doc.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Reasoning (Collapsible) */}
            {result.reasoning && result.reasoning.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Brain className="h-3 w-3" />
                    Agent Reasoning ({result.reasoning.length} steps)
                  </span>
                  {showReasoning ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </button>
                {showReasoning && (
                  <div className="p-3 space-y-1 text-xs text-slate-600 font-mono bg-slate-900 text-slate-300 max-h-48 overflow-auto">
                    {result.reasoning.map((step, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-slate-500">{i + 1}.</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action Button */}
            <div className="flex gap-2">
              <Button
                onClick={handleApplyAction}
                className={cn(
                  "flex-1",
                  result.status === "match_found" && "bg-emerald-600 hover:bg-emerald-700",
                  result.status !== "match_found" && "bg-slate-600 hover:bg-slate-700",
                )}
                disabled={result.status === "no_resolution"}
              >
                <Zap className="h-4 w-4 mr-2" />
                {getActionLabel(result.suggestedAction)}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button variant="outline" onClick={handleInvestigate}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// BULK INVESTIGATION COMPONENT
// ============================================

interface BulkInvestigationProps {
  unmatchedCount: number;
  onComplete?: (results: any[]) => void;
}

export function BulkInvestigationButton({ unmatchedCount, onComplete }: BulkInvestigationProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleBulkInvestigate = async () => {
    setIsRunning(true);
    setProgress(0);

    try {
      const investigateFn = httpsCallable(functions, "investigateAllUncertainMatches");
      const response = await investigateFn({});
      
      onComplete?.((response.data as any).results || []);
    } catch (error) {
      console.error("Bulk investigation error:", error);
    } finally {
      setIsRunning(false);
    }
  };

  if (unmatchedCount === 0) return null;

  return (
    <Button
      variant="outline"
      onClick={handleBulkInvestigate}
      disabled={isRunning}
      className="border-purple-200 text-purple-700 hover:bg-purple-50"
    >
      {isRunning ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Investigating {unmatchedCount} invoices...
        </>
      ) : (
        <>
          <Bot className="h-4 w-4 mr-2" />
          AI Investigate All ({unmatchedCount})
        </>
      )}
    </Button>
  );
}
