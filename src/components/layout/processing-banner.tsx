"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { 
  Loader2, CheckCircle2, X, ChevronUp, ChevronDown,
  Brain, Sparkles, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessingStatement {
  id: string;
  originalFileName: string;
  status: string;
  extractionProgress?: number;
  transactionCount?: number;
  bankName?: string;
  accountNumber?: string;
  currency?: string;
  pagesTotal?: number;
  pagesCompleted?: number;
  errorMessage?: string;
}

const getPhaseLabel = (status: string, progress: number) => {
  if (status === "pending_extraction") return "Queued";
  if (status === "self_healing") return "Self-healing";
  if (status === "failed") return "Failed";
  if (progress < 10) return "Starting...";
  if (progress < 20) return "Preparing";
  if (progress < 80) return "Extracting";
  if (progress < 90) return "Merging";
  if (progress < 100) return "Finalizing";
  return "Complete";
};

const getPhaseColor = (status: string) => {
  if (status === "failed") return "text-red-600";
  if (status === "self_healing") return "text-amber-600";
  if (status === "completed") return "text-emerald-600";
  return "text-cyan-600";
};

export function ProcessingBanner() {
  const { user } = useAuth();
  const [processingStatements, setProcessingStatements] = useState<ProcessingStatement[]>([]);
  const [completedStatements, setCompletedStatements] = useState<ProcessingStatement[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const processingQuery = query(
      collection(db, "statements"),
      where("userId", "==", user.id),
      where("status", "in", ["pending_extraction", "extracting", "uploaded", "self_healing", "scanning"])
    );

    const unsubscribe = onSnapshot(processingQuery, (snapshot) => {
      const statements = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as ProcessingStatement[];
      
      setProcessingStatements(statements);
      
      if (statements.length > 0) {
        setDismissed(false);
      }
    });

    return () => unsubscribe();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const completedQuery = query(
      collection(db, "statements"),
      where("userId", "==", user.id),
      where("status", "==", "completed")
    );

    const unsubscribe = onSnapshot(completedQuery, (snapshot) => {
      const statements = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as ProcessingStatement[];
      
      setCompletedStatements(prev => {
        const newCompleted = statements.filter(s => 
          !prev.some(p => p.id === s.id) && 
          s.transactionCount !== undefined
        );
        
        if (newCompleted.length > 0) {
          setTimeout(() => {
            setCompletedStatements(current => 
              current.filter(c => !newCompleted.some(n => n.id === c.id))
            );
          }, 8000);
        }
        
        return [...prev, ...newCompleted].slice(-5);
      });
    });

    return () => unsubscribe();
  }, [user?.id]);

  const { avgProgress, totalTransactions, doneCount } = useMemo(() => {
    const total = processingStatements.reduce((sum, s) => sum + (s.extractionProgress || 0), 0);
    const avg = processingStatements.length > 0 ? Math.round(total / processingStatements.length) : 0;
    const txns = processingStatements.reduce((sum, s) => sum + (s.transactionCount || 0), 0);
    const done = processingStatements.filter(s => (s.extractionProgress || 0) >= 100).length;
    return { avgProgress: avg, totalTransactions: txns, doneCount: done };
  }, [processingStatements]);

  // Nothing to show
  if (processingStatements.length === 0 && completedStatements.length === 0) {
    return null;
  }

  if (dismissed && processingStatements.length === 0) {
    return null;
  }

  // Completed state
  if (processingStatements.length === 0 && completedStatements.length > 0) {
    const totalTxns = completedStatements.reduce((sum, s) => sum + (s.transactionCount || 0), 0);
    return (
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="mx-auto max-w-screen-xl px-4 pb-4">
          <div className="bg-white border border-emerald-200 rounded-xl shadow-lg shadow-emerald-100/50 overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">Import complete</p>
                  <p className="text-xs text-emerald-600">
                    {totalTxns.toLocaleString()} transaction{totalTxns !== 1 ? "s" : ""} imported from {completedStatements.length} statement{completedStatements.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setDismissed(true)}
                className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Processing state
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      <div className="mx-auto max-w-screen-xl px-4 pb-4">
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/50 overflow-hidden">
          {/* Full-width progress bar at top of card */}
          <div className="h-1.5 bg-slate-100 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${avgProgress}%` }}
            />
          </div>

          {/* Header row */}
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
              <Brain className="h-4.5 w-4.5 text-cyan-600 animate-pulse" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  Importing transactions
                </p>
                <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-[10px] font-semibold text-cyan-700">
                  {avgProgress}%
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {doneCount} of {processingStatements.length} statement{processingStatements.length !== 1 ? "s" : ""} complete
                {totalTransactions > 0 && ` · ${totalTransactions.toLocaleString()} transactions so far`}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 rounded-lg">
                <Sparkles className="h-3 w-3 text-cyan-600" />
                <span className="text-[10px] font-medium text-slate-600">Gemini 3</span>
              </div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Expanded detail — per-file progress */}
          {expanded && (
            <div className="px-4 pb-3 space-y-1.5">
              <div className="border-t border-slate-100 pt-2.5" />
              {processingStatements.map(s => {
                const progress = s.extractionProgress || 0;
                const phase = getPhaseLabel(s.status, progress);
                const phaseColor = getPhaseColor(s.status);
                const pages = s.pagesTotal ? `${s.pagesCompleted || 0}/${s.pagesTotal} pages` : null;
                
                return (
                  <div key={s.id} className="flex items-center gap-3 group">
                    {/* Status icon */}
                    <div className={cn(
                      "h-6 w-6 rounded-md flex items-center justify-center shrink-0",
                      progress >= 100 ? "bg-emerald-100" :
                      s.status === "failed" ? "bg-red-100" :
                      s.status === "self_healing" ? "bg-amber-100" :
                      "bg-slate-100"
                    )}>
                      {progress >= 100 ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : s.status === "failed" ? (
                        <X className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <Loader2 className="h-3.5 w-3.5 text-cyan-600 animate-spin" />
                      )}
                    </div>
                    
                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-slate-700 truncate">{s.originalFileName}</p>
                        {s.bankName && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400">
                            <Building2 className="h-2.5 w-2.5" />
                            {s.bankName}
                          </span>
                        )}
                      </div>
                      {/* Per-file progress bar */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-700 ease-out",
                              progress >= 100 ? "bg-emerald-500" :
                              s.status === "failed" ? "bg-red-400" :
                              s.status === "self_healing" ? "bg-amber-500" :
                              "bg-cyan-500"
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className={cn("text-[10px] font-mono w-8 text-right shrink-0", phaseColor)}>
                          {progress}%
                        </span>
                      </div>
                    </div>
                    
                    {/* Phase + pages */}
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className={cn("text-[10px] font-medium", phaseColor)}>{phase}</p>
                      {pages && (
                        <p className="text-[10px] text-slate-400">{pages}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
