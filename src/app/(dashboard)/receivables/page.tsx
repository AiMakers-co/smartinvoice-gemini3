"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  FileCheck,
  CreditCard,
  ChevronRight,
  Bot,
  Plus,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Transaction } from "@/types";
import { OutgoingInvoice } from "@/types/documents";
import { Header } from "@/components/layout/header";

// ============================================
// HELPERS
// ============================================

function formatCurrency(amount: number | undefined | null, currency: string = "USD") {
  if (amount === undefined || amount === null || isNaN(amount)) return `${currency} 0.00`;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(timestamp: Timestamp | undefined) {
  if (!timestamp) return "-";
  const date = timestamp.toDate();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

// ============================================
// UNMATCHED INVOICE CARD
// ============================================

function UnmatchedInvoiceCard({
  invoice,
  onManualMatch,
  onInvestigate,
}: {
  invoice: OutgoingInvoice;
  onManualMatch: (invoiceId: string) => void;
  onInvestigate: (invoiceId: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
          <FileCheck className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-900">
            #{invoice.documentNumber}
          </p>
          <p className="text-[10px] text-slate-500">
            {invoice.customerName} • {formatCurrency(invoice.total, invoice.currency)}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onInvestigate(invoice.id)}
        >
          <Bot className="h-3 w-3 mr-1" />
          Find
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onManualMatch(invoice.id)}
        >
          Manual
        </Button>
      </div>
    </div>
  );
}

// ============================================
// RECENT CREDIT CARD
// ============================================

function RecentCreditCard({
  transaction,
  isSelected,
  onSelect,
}: {
  transaction: Transaction;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onSelect(transaction.id)}
      className={cn(
        "flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors",
        isSelected 
          ? "border-emerald-500 bg-emerald-50" 
          : "hover:bg-slate-50"
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center",
          isSelected ? "bg-emerald-100" : "bg-slate-100"
        )}>
          <CreditCard className={cn(
            "h-4 w-4",
            isSelected ? "text-emerald-600" : "text-slate-400"
          )} />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-900 truncate max-w-[160px]">
            {transaction.description}
          </p>
          <p className="text-[10px] text-slate-500">
            {formatDate(transaction.date)}
          </p>
        </div>
      </div>
      
      <span className="text-xs font-semibold text-emerald-600">
        +{formatCurrency(transaction.amount, transaction.currency)}
      </span>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ReceivablesOverviewPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [unmatchedInvoices, setUnmatchedInvoices] = useState<OutgoingInvoice[]>([]);
  const [recentCredits, setRecentCredits] = useState<Transaction[]>([]);
  const [selectedCredit, setSelectedCredit] = useState<string | null>(null);

  // Stats by currency
  const [allInvoices, setAllInvoices] = useState<OutgoingInvoice[]>([]);

  // Load data
  useEffect(() => {
    if (!user?.id) return;

    // Load all invoices for stats
    const allInvoicesQuery = query(
      collection(db, "invoices"),
      where("userId", "==", user.id),
      orderBy("invoiceDate", "desc")
    );

    const unsubAll = onSnapshot(
      allInvoicesQuery, 
      (snapshot) => {
        const docs = snapshot.docs.map(doc => {
          const data = doc.data();
          // Normalize field names - handle both old and new naming conventions
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
        
        setAllInvoices(docs);
        const unmatched = docs.filter(d => d.reconciliationStatus === "unmatched");
        setUnmatchedInvoices(unmatched);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading invoices:", error);
        setLoading(false);
      }
    );

    // Load recent credit transactions (incoming payments)
    const creditsQuery = query(
      collection(db, "transactions"),
      where("userId", "==", user.id),
      where("type", "==", "credit"),
      orderBy("date", "desc")
    );

    const unsubCredits = onSnapshot(
      creditsQuery, 
      (snapshot) => {
        const txs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Transaction[];
        setRecentCredits(txs.slice(0, 20));
      },
      (error) => {
        console.error("Error loading credits:", error);
      }
    );

    return () => {
      unsubAll();
      unsubCredits();
    };
  }, [user?.id]);

  // Calculate multi-currency stats
  const unmatchedByCurrency = unmatchedInvoices.reduce((acc, inv) => {
    const currency = inv.currency || "USD";
    acc[currency] = (acc[currency] || 0) + (inv.amountRemaining || 0);
    return acc;
  }, {} as Record<string, number>);

  const matchedCount = allInvoices.filter(d => d.reconciliationStatus === "matched").length;

  // Investigate with AI
  const handleInvestigate = (invoiceId: string) => {
    router.push(`/receivables/invoices/${invoiceId}?investigate=true`);
  };

  // Manual match
  const handleManualMatch = (invoiceId: string) => {
    router.push(`/receivables/invoices/${invoiceId}?match=true`);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Receivables Overview" />
        <div className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-64 bg-slate-200 rounded" />
            <div className="h-12 bg-slate-200 rounded-lg" />
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 h-80 bg-slate-200 rounded-lg" />
              <div className="h-80 bg-slate-200 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Receivables Overview" />
      <div className="flex-1 p-4 overflow-auto space-y-4">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Accounts Receivable</h2>
            <p className="text-xs text-slate-500">Track payments from your customers</p>
          </div>
          <Button 
            onClick={() => router.push("/receivables/invoices")}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Invoice
          </Button>
        </div>

        {/* Compact Summary Bar - Multi-currency */}
        <div className="bg-white border rounded-lg">
          <div className="flex items-center divide-x overflow-x-auto">
            <div className="px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Total</div>
              <div className="text-base font-bold">{allInvoices.length}</div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Unmatched</div>
              <div className="text-base font-bold text-amber-600">{unmatchedInvoices.length}</div>
            </div>
            
            {/* Outstanding by currency */}
            {Object.entries(unmatchedByCurrency).length > 0 ? (
              Object.entries(unmatchedByCurrency).map(([currency, amount]) => (
                <div key={currency} className="px-3 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">
                    Awaiting ({currency})
                  </div>
                  <div className="text-base font-bold text-red-600">{formatCurrency(amount, currency)}</div>
                </div>
              ))
            ) : (
              <div className="px-3 py-2">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Awaiting</div>
                <div className="text-base font-bold text-red-600">$0.00</div>
              </div>
            )}
            
            <div className="px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Matched</div>
              <div className="text-base font-bold text-emerald-600">{matchedCount}</div>
            </div>
            
            <div className="px-3 py-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => router.push("/reconciliation")}
              >
                <TrendingUp className="h-3 w-3 mr-1.5" />
                Reconciliation Hub
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Unmatched Invoices */}
          <div className="col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900">Unmatched Invoices</h3>
                {unmatchedInvoices.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{unmatchedInvoices.length}</Badge>
                )}
              </div>
              <Button
                variant="link"
                size="sm"
                className="h-6 text-xs"
                onClick={() => router.push("/receivables/invoices?status=unmatched")}
              >
                View All
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>

            {unmatchedInvoices.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <p className="text-sm text-slate-900 font-medium">All caught up!</p>
                  <p className="text-xs text-slate-500 mt-1">
                    All invoices have been matched to payments
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => router.push("/receivables/invoices")}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Upload Invoices
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-1.5">
                {unmatchedInvoices.slice(0, 10).map((invoice) => (
                  <UnmatchedInvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    onManualMatch={handleManualMatch}
                    onInvestigate={handleInvestigate}
                  />
                ))}
                {unmatchedInvoices.length > 10 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => router.push("/receivables/invoices?status=unmatched")}
                  >
                    View {unmatchedInvoices.length - 10} more
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Recent Credits */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-slate-900">Recent Payments</h3>
            </div>

            <Card>
              <CardContent className="p-3">
                {recentCredits.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No recent credits found
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {recentCredits.slice(0, 8).map((tx) => (
                      <RecentCreditCard
                        key={tx.id}
                        transaction={tx}
                        isSelected={selectedCredit === tx.id}
                        onSelect={setSelectedCredit}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-[10px] text-slate-400 text-center">
              Click a payment to manually match to an invoice
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
