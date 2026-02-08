"use client";

import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Bot,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Brain,
  Zap,
  RefreshCw,
  ChevronRight,
  FileText,
  CreditCard,
  TrendingUp,
  Clock,
  DollarSign,
  Loader2,
  AlertTriangle,
  Link2,
  History,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface AISuggestion {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  vendorName: string;
  invoiceAmount: number;
  invoiceCurrency: string;
  
  suggestedMatch?: {
    transactionId: string;
    transactionDescription: string;
    transactionAmount: number;
    transactionCurrency: string;
    transactionDate: string;
  };
  
  confidence: number;
  matchType: "exact" | "partial" | "combined" | "fx_converted" | "pattern_based";
  
  reasons: string[];
  warnings: string[];
  
  // Pattern-based insights
  usedPattern?: {
    patternId: string;
    confidence: number;
    insight: string; // e.g., "Based on 12 previous matches with this vendor"
  };
  
  // Agent investigation results
  agentInvestigated?: boolean;
  agentExplanation?: string;
}

interface VendorPattern {
  id: string;
  vendorName: string;
  confidence: number;
  matchCount: number;
  paymentProcessor?: string;
  typicalPaymentDelay?: number;
  transactionKeywords: string[];
  vendorAliases: string[];
}

interface AISuggestionsPanelProps {
  suggestions: AISuggestion[];
  onConfirmMatch: (invoiceId: string, transactionId: string) => void;
  onInvestigate: (invoiceId: string) => void;
  onDismiss: (suggestionId: string) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AISuggestionsPanel({
  suggestions,
  onConfirmMatch,
  onInvestigate,
  onDismiss,
  isLoading = false,
  onRefresh,
}: AISuggestionsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Group by confidence level
  const highConfidence = suggestions.filter(s => s.confidence >= 85);
  const mediumConfidence = suggestions.filter(s => s.confidence >= 60 && s.confidence < 85);
  const lowConfidence = suggestions.filter(s => s.confidence < 60);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return "text-emerald-600 bg-emerald-100";
    if (confidence >= 60) return "text-amber-600 bg-amber-100";
    return "text-slate-600 bg-slate-100";
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 85) return <CheckCircle2 className="h-4 w-4" />;
    if (confidence >= 60) return <AlertCircle className="h-4 w-4" />;
    return <HelpCircle className="h-4 w-4" />;
  };

  const getMatchTypeLabel = (type: AISuggestion["matchType"]) => {
    switch (type) {
      case "exact": return "Exact Match";
      case "partial": return "Partial Payment";
      case "combined": return "Combined Payment";
      case "fx_converted": return "FX Converted";
      case "pattern_based": return "Pattern Match";
      default: return "Match";
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  };

  return (
    <Card className="border-purple-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">AI Match Suggestions</CardTitle>
              <CardDescription className="text-xs">
                {suggestions.length} potential matches found
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {highConfidence.length > 0 && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8"
                onClick={() => {
                  highConfidence.forEach(s => {
                    if (s.suggestedMatch) {
                      onConfirmMatch(s.invoiceId, s.suggestedMatch.transactionId);
                    }
                  });
                }}
              >
                <Zap className="h-3 w-3 mr-1" />
                Confirm All High ({highConfidence.length})
              </Button>
            )}
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-8"
              >
                <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
            <p className="text-sm text-slate-500">Analyzing transactions...</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">All caught up!</p>
              <p className="text-xs text-slate-500">No new suggestions at this time</p>
            </div>
          </div>
        ) : (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-xs text-emerald-600 font-medium">High Confidence</p>
                  <p className="text-lg font-bold text-emerald-700">{highConfidence.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-xs text-amber-600 font-medium">Review Needed</p>
                  <p className="text-lg font-bold text-amber-700">{mediumConfidence.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                <HelpCircle className="h-4 w-4 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-600 font-medium">Investigate</p>
                  <p className="text-lg font-bold text-slate-700">{lowConfidence.length}</p>
                </div>
              </div>
            </div>

            {/* Suggestion List */}
            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  isExpanded={expandedId === suggestion.id}
                  onToggle={() => setExpandedId(expandedId === suggestion.id ? null : suggestion.id)}
                  onConfirm={() => suggestion.suggestedMatch && onConfirmMatch(suggestion.invoiceId, suggestion.suggestedMatch.transactionId)}
                  onInvestigate={() => onInvestigate(suggestion.invoiceId)}
                  onDismiss={() => onDismiss(suggestion.id)}
                  formatCurrency={formatCurrency}
                  getConfidenceColor={getConfidenceColor}
                  getConfidenceIcon={getConfidenceIcon}
                  getMatchTypeLabel={getMatchTypeLabel}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// SUGGESTION CARD
// ============================================

interface SuggestionCardProps {
  suggestion: AISuggestion;
  isExpanded: boolean;
  onToggle: () => void;
  onConfirm: () => void;
  onInvestigate: () => void;
  onDismiss: () => void;
  formatCurrency: (amount: number, currency: string) => string;
  getConfidenceColor: (confidence: number) => string;
  getConfidenceIcon: (confidence: number) => React.ReactNode;
  getMatchTypeLabel: (type: AISuggestion["matchType"]) => string;
}

function SuggestionCard({
  suggestion,
  isExpanded,
  onToggle,
  onConfirm,
  onInvestigate,
  onDismiss,
  formatCurrency,
  getConfidenceColor,
  getConfidenceIcon,
  getMatchTypeLabel,
}: SuggestionCardProps) {
  const cardId = `suggestion-${suggestion.id}`;
  const contentId = `suggestion-content-${suggestion.id}`;

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-all",
        suggestion.confidence >= 85 && "border-emerald-200 bg-emerald-50/30",
        suggestion.confidence >= 60 && suggestion.confidence < 85 && "border-amber-200 bg-amber-50/30",
        suggestion.confidence < 60 && "border-slate-200 bg-slate-50/30",
      )}
      role="region"
      aria-labelledby={cardId}
    >
      {/* Header - Always visible */}
      <button
        id={cardId}
        onClick={onToggle}
        className="w-full p-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={contentId}
      >
        {/* Confidence Badge */}
        <div className={cn("flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", getConfidenceColor(suggestion.confidence))}>
          {getConfidenceIcon(suggestion.confidence)}
          {suggestion.confidence}%
        </div>

        {/* Invoice Info */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900">#{suggestion.invoiceNumber}</span>
            <span className="text-xs text-slate-500">{suggestion.vendorName}</span>
          </div>
          <p className="text-xs text-slate-500">
            {formatCurrency(suggestion.invoiceAmount, suggestion.invoiceCurrency)}
            {suggestion.suggestedMatch && (
              <>
                <ArrowRight className="inline h-3 w-3 mx-1" />
                {suggestion.suggestedMatch.transactionDescription.slice(0, 30)}
                {suggestion.suggestedMatch.transactionDescription.length > 30 && "..."}
              </>
            )}
          </p>
        </div>

        {/* Match Type Badge */}
        <Badge variant="secondary" className="text-xs">
          {getMatchTypeLabel(suggestion.matchType)}
        </Badge>

        {/* Pattern Indicator */}
        {suggestion.usedPattern && (
          <div className="flex items-center gap-1 text-purple-600" title={suggestion.usedPattern.insight}>
            <Brain className="h-4 w-4" />
          </div>
        )}

        <ChevronRight className={cn("h-4 w-4 text-slate-400 transition-transform", isExpanded && "rotate-90")} aria-hidden="true" />
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div id={contentId} className="px-3 pb-3 space-y-3 border-t" role="region" aria-label={`Details for invoice ${suggestion.invoiceNumber}`}>
          {/* Invoice & Transaction Side by Side */}
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div className="p-2 rounded bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-600">Invoice</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">#{suggestion.invoiceNumber}</p>
              <p className="text-xs text-slate-500">{suggestion.vendorName}</p>
              <p className="text-sm font-bold text-slate-900 mt-1">
                {formatCurrency(suggestion.invoiceAmount, suggestion.invoiceCurrency)}
              </p>
            </div>

            {suggestion.suggestedMatch && (
              <div className="p-2 rounded bg-emerald-50">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600">Transaction</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {suggestion.suggestedMatch.transactionDescription}
                </p>
                <p className="text-xs text-slate-500">{suggestion.suggestedMatch.transactionDate}</p>
                <p className="text-sm font-bold text-emerald-700 mt-1">
                  {formatCurrency(suggestion.suggestedMatch.transactionAmount, suggestion.suggestedMatch.transactionCurrency)}
                </p>
              </div>
            )}
          </div>

          {/* Reasons */}
          {suggestion.reasons.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Match Reasons</p>
              <div className="flex flex-wrap gap-1">
                {suggestion.reasons.map((reason, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {suggestion.warnings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Warnings</p>
              <div className="flex flex-wrap gap-1">
                {suggestion.warnings.map((warning, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">
                    <AlertTriangle className="h-3 w-3" />
                    {warning}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pattern Insight */}
          {suggestion.usedPattern && (
            <div className="p-2 rounded-lg bg-purple-50 border border-purple-100">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-700">Pattern-Based Match</span>
                <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                  {suggestion.usedPattern.confidence}% pattern confidence
                </Badge>
              </div>
              <p className="text-xs text-purple-600 mt-1">
                <Lightbulb className="inline h-3 w-3 mr-1" />
                {suggestion.usedPattern.insight}
              </p>
            </div>
          )}

          {/* Agent Explanation */}
          {suggestion.agentInvestigated && suggestion.agentExplanation && (
            <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
              <div className="flex items-center gap-2 mb-1">
                <Bot className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-medium text-indigo-700">AI Agent Analysis</span>
              </div>
              <p className="text-xs text-indigo-600">{suggestion.agentExplanation}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            {suggestion.suggestedMatch && (
              <Button
                size="sm"
                onClick={onConfirm}
                className={cn(
                  "flex-1",
                  suggestion.confidence >= 85 && "bg-emerald-600 hover:bg-emerald-700",
                  suggestion.confidence < 85 && "bg-slate-600 hover:bg-slate-700",
                )}
              >
                <Link2 className="h-3 w-3 mr-1" />
                Confirm Match
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onInvestigate}
              className="border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <Bot className="h-3 w-3 mr-1" />
              Investigate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-slate-500 hover:text-slate-700"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// VENDOR PATTERNS PANEL
// ============================================

interface VendorPatternsPanelProps {
  patterns: VendorPattern[];
  onEditPattern: (patternId: string) => void;
  onAddAlias: (patternId: string, alias: string) => void;
}

export function VendorPatternsPanel({ patterns, onEditPattern, onAddAlias }: VendorPatternsPanelProps) {
  return (
    <Card role="region" aria-label="Learned Vendor Patterns">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center" aria-hidden="true">
            <History className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Learned Vendor Patterns</CardTitle>
            <CardDescription className="text-xs">
              {patterns.length} vendors with known payment behaviors
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {patterns.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-500" role="status">
            <Brain className="h-8 w-8 mx-auto mb-2 text-slate-300" aria-hidden="true" />
            <p>No patterns learned yet</p>
            <p className="text-xs">Patterns are learned automatically as you confirm matches</p>
          </div>
        ) : (
          <div className="space-y-2" role="list" aria-label="Vendor patterns">
            {patterns.slice(0, 5).map((pattern) => (
              <button
                key={pattern.id}
                className="w-full text-left p-3 rounded-lg border hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                onClick={() => onEditPattern(pattern.id)}
                onKeyDown={(e) => e.key === "Enter" && onEditPattern(pattern.id)}
                aria-label={`Edit pattern for ${pattern.vendorName}, ${pattern.matchCount} matches`}
                role="listitem"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-900">{pattern.vendorName}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {pattern.matchCount} matches
                    </Badge>
                    <Progress value={pattern.confidence} className="w-16 h-1.5" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {pattern.paymentProcessor && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      <CreditCard className="h-3 w-3" />
                      {pattern.paymentProcessor}
                    </span>
                  )}
                  {pattern.typicalPaymentDelay && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      <Clock className="h-3 w-3" />
                      ~{pattern.typicalPaymentDelay} days
                    </span>
                  )}
                  {pattern.vendorAliases.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                      <TrendingUp className="h-3 w-3" />
                      +{pattern.vendorAliases.length} aliases
                    </span>
                  )}
                </div>

                {pattern.transactionKeywords.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    Keywords: {pattern.transactionKeywords.slice(0, 4).join(", ")}
                    {pattern.transactionKeywords.length > 4 && "..."}
                  </div>
                )}
              </button>
            ))}

            {patterns.length > 5 && (
              <button 
                className="w-full py-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                aria-label={`View all ${patterns.length} vendor patterns`}
              >
                View all {patterns.length} patterns →
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
