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
  FileSpreadsheet,
  ChevronRight,
  Bot,
  MinusCircle,
  Plus,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Transaction } from "@/types";
import { IncomingBill } from "@/types/documents";
import { Header } from "@/components/layout/header";
import { useUploadState } from "@/hooks/use-upload-state";

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
// UNPAID BILL CARD
// ============================================

function UnpaidBillCard({
  bill,
  onManualMatch,
  onInvestigate,
}: {
  bill: IncomingBill;
  onManualMatch: (billId: string) => void;
  onInvestigate: (billId: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
          <FileSpreadsheet className="h-4 w-4 text-red-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-900">
            #{bill.documentNumber}
          </p>
          <p className="text-[10px] text-slate-500">
            {bill.vendorName} • {formatCurrency(bill.total, bill.currency)}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onInvestigate(bill.id)}
        >
          <Bot className="h-3 w-3 mr-1" />
          Find
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onManualMatch(bill.id)}
        >
          Manual
        </Button>
      </div>
    </div>
  );
}

// ============================================
// RECENT DEBIT CARD
// ============================================

function RecentDebitCard({
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
          ? "border-orange-500 bg-orange-50" 
          : "hover:bg-slate-50"
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center",
          isSelected ? "bg-orange-100" : "bg-slate-100"
        )}>
          <MinusCircle className={cn(
            "h-4 w-4",
            isSelected ? "text-orange-600" : "text-slate-400"
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
      
      <span className="text-xs font-semibold text-red-600">
        -{formatCurrency(Math.abs(transaction.amount), transaction.currency)}
      </span>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function PayablesOverviewPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [unpaidBills, setUnpaidBills] = useState<IncomingBill[]>([]);
  const [recentDebits, setRecentDebits] = useState<Transaction[]>([]);
  const [selectedDebit, setSelectedDebit] = useState<string | null>(null);
  const { openDrawer: openUploadDrawer } = useUploadState();

  // Stats
  const [allBills, setAllBills] = useState<IncomingBill[]>([]);

  // Load data
  useEffect(() => {
    if (!user?.id) return;

    // Load all bills for stats
    const allBillsQuery = query(
      collection(db, "bills"),
      where("userId", "==", user.id),
      orderBy("documentDate", "desc")
    );

    const unsubAll = onSnapshot(
      allBillsQuery, 
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as IncomingBill[];
        
        setAllBills(docs);
        const unpaid = docs.filter(d => d.paymentStatus === "unpaid" || d.paymentStatus === "partial");
        setUnpaidBills(unpaid);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading bills:", error);
        setLoading(false);
      }
    );

    // Load recent debit transactions (outgoing payments)
    const debitsQuery = query(
      collection(db, "transactions"),
      where("userId", "==", user.id),
      where("type", "==", "debit"),
      orderBy("date", "desc")
    );

    const unsubDebits = onSnapshot(
      debitsQuery, 
      (snapshot) => {
        const txs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Transaction[];
        setRecentDebits(txs.slice(0, 20));
      },
      (error) => {
        console.error("Error loading debits:", error);
      }
    );

    return () => {
      unsubAll();
      unsubDebits();
    };
  }, [user?.id]);

  // Calculate multi-currency stats
  const owedByCurrency = unpaidBills.reduce((acc, bill) => {
    const currency = bill.currency || "USD";
    acc[currency] = (acc[currency] || 0) + (bill.amountRemaining || 0);
    return acc;
  }, {} as Record<string, number>);

  const paidCount = allBills.filter(d => d.paymentStatus === "paid").length;

  // Investigate with AI
  const handleInvestigate = (billId: string) => {
    router.push(`/payables/bills/${billId}?investigate=true`);
  };

  // Manual match
  const handleManualMatch = (billId: string) => {
    router.push(`/payables/bills/${billId}?match=true`);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Payables Overview" />
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
      <Header title="Payables Overview" />
      <div className="flex-1 p-4 overflow-auto space-y-4">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Accounts Payable</h2>
            <p className="text-xs text-slate-500">Track payments to your vendors</p>
          </div>
          <Button 
            onClick={() => openUploadDrawer("bill")}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Bill
          </Button>
        </div>

        {/* Compact Summary Bar - Multi-currency */}
        <div className="bg-white border rounded-lg">
          <div className="flex items-center divide-x overflow-x-auto">
            <div className="px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Total</div>
              <div className="text-base font-bold">{allBills.length}</div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Unpaid</div>
              <div className="text-base font-bold text-red-600">{unpaidBills.length}</div>
            </div>
            
            {/* Owed by currency */}
            {Object.entries(owedByCurrency).length > 0 ? (
              Object.entries(owedByCurrency).map(([currency, amount]) => (
                <div key={currency} className="px-3 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">
                    Owed ({currency})
                  </div>
                  <div className="text-base font-bold text-amber-600">{formatCurrency(amount, currency)}</div>
                </div>
              ))
            ) : (
              <div className="px-3 py-2">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Owed</div>
                <div className="text-base font-bold text-amber-600">$0.00</div>
              </div>
            )}
            
            <div className="px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Paid</div>
              <div className="text-base font-bold text-emerald-600">{paidCount}</div>
            </div>
            
            <div className="px-3 py-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => router.push("/reconciliation")}
              >
                <TrendingDown className="h-3 w-3 mr-1.5" />
                Reconciliation Hub
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Unpaid Bills */}
          <div className="col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold text-slate-900">Unpaid Bills</h3>
                {unpaidBills.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{unpaidBills.length}</Badge>
                )}
              </div>
              <Button
                variant="link"
                size="sm"
                className="h-6 text-xs"
                onClick={() => router.push("/payables/bills?status=unpaid")}
              >
                View All
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>

            {unpaidBills.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <p className="text-sm text-slate-900 font-medium">All caught up!</p>
                  <p className="text-xs text-slate-500 mt-1">
                    All bills have been paid
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => router.push("/payables/bills")}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Upload Bills
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-1.5">
                {unpaidBills.slice(0, 10).map((bill) => (
                  <UnpaidBillCard
                    key={bill.id}
                    bill={bill}
                    onManualMatch={handleManualMatch}
                    onInvestigate={handleInvestigate}
                  />
                ))}
                {unpaidBills.length > 10 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => router.push("/payables/bills?status=unpaid")}
                  >
                    View {unpaidBills.length - 10} more
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Recent Debits */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MinusCircle className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold text-slate-900">Recent Payments</h3>
            </div>

            <Card>
              <CardContent className="p-3">
                {recentDebits.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No recent debits found
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {recentDebits.slice(0, 8).map((tx) => (
                      <RecentDebitCard
                        key={tx.id}
                        transaction={tx}
                        isSelected={selectedDebit === tx.id}
                        onSelect={setSelectedDebit}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-[10px] text-slate-400 text-center">
              Click a payment to manually match to a bill
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
