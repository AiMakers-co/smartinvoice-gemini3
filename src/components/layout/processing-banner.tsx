"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, FileText, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessingStatement {
  id: string;
  originalFileName: string;
  status: string;
  extractionProgress?: number;
  transactionCount?: number;
}

export function ProcessingBanner() {
  const { user } = useAuth();
  const [processingStatements, setProcessingStatements] = useState<ProcessingStatement[]>([]);
  const [completedStatements, setCompletedStatements] = useState<ProcessingStatement[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    // Listen for statements in processing states
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
      
      // Reset dismissed when new processing starts
      if (statements.length > 0) {
        setDismissed(false);
      }
    });

    return () => unsubscribe();
  }, [user?.id]);

  // Track recently completed statements
  useEffect(() => {
    if (!user?.id) return;

    // Listen for recently completed statements (last 30 seconds)
    const thirtySecondsAgo = new Date(Date.now() - 30000);
    
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
      
      // Only show recently completed (within 10 seconds)
      // We track this client-side since Firestore doesn't have a "recently updated" query
      setCompletedStatements(prev => {
        const newCompleted = statements.filter(s => 
          !prev.some(p => p.id === s.id) && 
          s.transactionCount !== undefined
        );
        
        // Auto-remove after 5 seconds
        if (newCompleted.length > 0) {
          setTimeout(() => {
            setCompletedStatements(current => 
              current.filter(c => !newCompleted.some(n => n.id === c.id))
            );
          }, 5000);
        }
        
        return [...prev, ...newCompleted].slice(-3); // Keep last 3
      });
    });

    return () => unsubscribe();
  }, [user?.id]);

  // Nothing to show
  if (processingStatements.length === 0 && completedStatements.length === 0) {
    return null;
  }

  // User dismissed and nothing is actively processing
  if (dismissed && processingStatements.length === 0) {
    return null;
  }

  const totalProgress = processingStatements.reduce((sum, s) => sum + (s.extractionProgress || 0), 0);
  const avgProgress = processingStatements.length > 0 ? Math.round(totalProgress / processingStatements.length) : 0;

  return (
    <div className="border-b bg-gradient-to-r from-cyan-50 to-blue-50">
      <div className="px-4 py-2">
        {/* Processing statements */}
        {processingStatements.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-cyan-100 flex items-center justify-center">
                <Loader2 className="h-3.5 w-3.5 text-cyan-600 animate-spin" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-cyan-900">
                  Extracting transactions from {processingStatements.length} statement{processingStatements.length !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-1 w-24 bg-cyan-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${avgProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-cyan-600">{avgProgress}%</span>
                </div>
              </div>
            </div>
            
            {/* File list */}
            <div className="flex-1 flex items-center gap-2 overflow-hidden">
              {processingStatements.slice(0, 3).map(s => (
                <div key={s.id} className="flex items-center gap-1 px-2 py-0.5 bg-white/60 rounded text-[10px] text-cyan-700">
                  <FileText className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{s.originalFileName}</span>
                </div>
              ))}
              {processingStatements.length > 3 && (
                <span className="text-[10px] text-cyan-600">+{processingStatements.length - 3} more</span>
              )}
            </div>
          </div>
        )}

        {/* Completed statements */}
        {processingStatements.length === 0 && completedStatements.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-emerald-900">
                Extracted {completedStatements.reduce((sum, s) => sum + (s.transactionCount || 0), 0)} transactions
              </span>
            </div>
            <button 
              onClick={() => setDismissed(true)}
              className="p-1 rounded hover:bg-emerald-100 text-emerald-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
