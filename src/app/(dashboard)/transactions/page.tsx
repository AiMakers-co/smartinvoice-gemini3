"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Filter,
  Calendar,
  Building2,
  Download,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  PiggyBank,
  Briefcase,
  Banknote,
  X,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Plus,
  Loader2,
} from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp, startAfter, getDocs, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ExportDialog } from "@/components/export";
import { UploadDrawer } from "@/components/upload/upload-drawer";
import { searchTransactions } from "@/lib/algolia";
import type { Transaction, BankAccount } from "@/types";

// ============================================
// TYPES
// ============================================

interface TransactionWithAccount extends Transaction {
  account?: BankAccount;
}

// ============================================
// ACCOUNT ICONS
// ============================================

const accountTypeIcons = {
  checking: CreditCard,
  savings: PiggyBank,
  credit: CreditCard,
  investment: Briefcase,
  other: Banknote,
};

// ============================================
// DATE RANGE OPTIONS
// ============================================

const dateRangeOptions = [
  { label: "All Time", value: "all" },
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 3 Months", value: "3_months" },
  { label: "Last 6 Months", value: "6_months" },
  { label: "This Year", value: "this_year" },
  { label: "Last Year", value: "last_year" },
];

// ============================================
// TRANSACTION ROW COMPONENT
// ============================================

interface TransactionRowProps {
  transaction: TransactionWithAccount;
  isExpanded: boolean;
  onToggle: () => void;
}

// Format currency with proper symbol
const formatCurrency = (amount: number | undefined | null, currency = "USD") => {
  if (amount === undefined || amount === null || isNaN(amount)) return `${currency} 0.00`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

function TransactionRow({ transaction, isExpanded, onToggle }: TransactionRowProps) {
  const formatDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const Icon = transaction.account ? accountTypeIcons[transaction.account.accountType] || Banknote : Banknote;

  return (
    <>
      <tr
        className={`hover:bg-slate-50 cursor-pointer transition-colors ${isExpanded ? "bg-slate-50" : ""}`}
        onClick={onToggle}
      >
        {/* Date */}
        <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap align-top">
          {formatDate(transaction.date)}
        </td>

        {/* Account */}
        <td className="py-3 px-4 align-top">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Icon className="h-3 w-3 text-slate-500" />
            </div>
            <div className="min-w-0">
              <span className="text-sm text-slate-600 block truncate">
                {transaction.account?.accountNickname || transaction.account?.bankName || "Unknown Account"}
              </span>
              {transaction.account && (
                <span className="text-[10px] text-slate-400">
                  ****{transaction.account.accountNumber?.slice(-4)}
                </span>
              )}
            </div>
          </div>
        </td>

        {/* Description - Full text, wraps to multiple lines */}
        <td className="py-3 px-4 align-top">
          <div className="space-y-1">
            <p className="text-sm text-slate-900 leading-relaxed">
              {transaction.description}
            </p>
            <div className="flex items-center gap-2">
              {transaction.category && (
                <Badge variant="secondary" className="text-[10px] h-5">{transaction.category}</Badge>
              )}
              {transaction.needsReview && (
                <Badge variant="outline" className="text-[10px] h-5 text-yellow-600 border-yellow-300">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Review
                </Badge>
              )}
            </div>
          </div>
        </td>

        {/* Amount */}
        <td className="py-3 px-4 text-right whitespace-nowrap align-top">
          <div className="flex items-center justify-end gap-1.5">
            {transaction.type === "credit" ? (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-slate-400" />
            )}
            <span className={`text-sm font-medium ${transaction.type === "credit" ? "text-green-600" : "text-slate-900"}`}>
              {transaction.type === "credit" ? "+" : "-"}{formatCurrency(transaction.amount, transaction.currency)}
            </span>
          </div>
        </td>

        {/* Balance */}
        <td className="py-3 px-4 text-right text-sm text-slate-600 whitespace-nowrap align-top">
          {transaction.balance !== undefined && transaction.balance !== null
            ? `${transaction.currency} ${transaction.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
            : "—"
          }
        </td>

        {/* Expand */}
        <td className="py-3 px-4 text-center align-top">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400 mx-auto" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400 mx-auto" />
          )}
        </td>
      </tr>

      {/* Expanded Details */}
      {isExpanded && (
        <tr className="bg-slate-50 border-b">
          <td colSpan={6} className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-1">Full Description</p>
                <p className="text-xs text-slate-900">{transaction.description}</p>
              </div>
              {transaction.reference && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase mb-1">Reference</p>
                  <p className="text-xs text-slate-900 font-mono">{transaction.reference}</p>
                </div>
              )}
              {transaction.merchant && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase mb-1">Merchant</p>
                  <p className="text-xs text-slate-900">{transaction.merchant}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-1">Confidence</p>
                <div className="flex items-center gap-1">
                  {(transaction.confidence || 1) >= 0.9 ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-yellow-500" />
                  )}
                  <p className="text-xs text-slate-900">{Math.round((transaction.confidence || 1) * 100)}%</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-1">Account</p>
                <p className="text-xs text-slate-900">
                  {transaction.account?.bankName} • ****{transaction.account?.accountNumber?.slice(-4)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-1">Statement ID</p>
                <p className="text-xs text-slate-900 font-mono truncate">{transaction.statementId}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============================================
// TRANSACTIONS EMPTY STATE
// ============================================

function TransactionsEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Transactions</h2>
          <p className="text-xs text-slate-500">View and manage all your bank transactions</p>
        </div>
        <Button onClick={onUpload} className="bg-cyan-600 hover:bg-cyan-700">
          <Plus className="h-4 w-4 mr-2" />
          Upload Statement
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="bg-white border rounded-lg">
        <div className="flex items-center divide-x">
          <div className="px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Total</div>
            <div className="text-base font-bold">0</div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Credits</div>
            <div className="text-base font-bold text-emerald-600">$0.00</div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Debits</div>
            <div className="text-base font-bold">$0.00</div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Net</div>
            <div className="text-base font-bold">$0.00</div>
          </div>
        </div>
      </div>
      
      {/* Empty Content */}
      <Card>
        <CardContent className="p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-cyan-50 flex items-center justify-center mx-auto mb-3">
            <FileText className="h-6 w-6 text-cyan-600" />
          </div>
          <p className="text-sm font-medium text-slate-900 mb-1">No transactions yet</p>
          <p className="text-xs text-slate-500 mb-4">Upload a bank statement to see your transactions</p>
          <Button variant="outline" size="sm" onClick={onUpload}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Upload your first statement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<TransactionWithAccount[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [transactionType, setTransactionType] = useState<string>("all");

  // Pagination
  const [pageSize] = useState(1000);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [allTransactions, setAllTransactions] = useState<TransactionWithAccount[]>([]);

  // Algolia search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TransactionWithAccount[] | null>(null);
  const [searchTotalHits, setSearchTotalHits] = useState(0);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Total count (for display)
  const [totalTransactionCount, setTotalTransactionCount] = useState<number | null>(null);

  // Smart Export Dialog
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Load accounts first (include ALL accounts, even archived, for transaction display)
  useEffect(() => {
    if (!user) return;

    const accountsQuery = query(
      collection(db, "accounts"),
      where("userId", "==", user.id)
    );

    const unsubscribe = onSnapshot(accountsQuery, (snapshot) => {
      const accountsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BankAccount[];
      setAccounts(accountsData);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch total transaction count
  useEffect(() => {
    if (!user) return;

    const fetchTotalCount = async () => {
      try {
        let countQuery = query(
          collection(db, "transactions"),
          where("userId", "==", user.id)
        );

        // Apply account filter if selected
        if (selectedAccount !== "all") {
          countQuery = query(
            collection(db, "transactions"),
            where("userId", "==", user.id),
            where("accountId", "==", selectedAccount)
          );
        }

        const snapshot = await getCountFromServer(countQuery);
        setTotalTransactionCount(snapshot.data().count);
      } catch (error) {
        console.error("Error fetching transaction count:", error);
      }
    };

    fetchTotalCount();
  }, [user, selectedAccount]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Algolia search effect
  useEffect(() => {
    if (!user?.id || !debouncedSearchQuery.trim()) {
      setSearchResults(null);
      setSearchTotalHits(0);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      try {
        // Build filters for Algolia
        let filters = "";
        if (selectedAccount !== "all") {
          filters = `accountId:"${selectedAccount}"`;
        }

        const result = await searchTransactions(debouncedSearchQuery, user.id, {
          filters,
          hitsPerPage: 200, // Get more results for search
        });

        // Map Algolia hits to TransactionWithAccount
        const mappedResults = result.hits.map((hit: any) => {
          const account = accounts.find(a => a.id === hit.accountId);
          return {
            id: hit.objectID,
            description: hit.description || "",
            amount: hit.amount || 0,
            type: hit.type || "debit",
            date: hit.date ? new Timestamp(hit.date._seconds || Math.floor(hit.date / 1000), hit.date._nanoseconds || 0) : Timestamp.now(),
            balance: hit.balance,
            currency: hit.currency || "USD",
            category: hit.category,
            reference: hit.reference,
            merchant: hit.merchant,
            accountId: hit.accountId,
            statementId: hit.statementId,
            userId: hit.userId,
            confidence: hit.confidence,
            needsReview: hit.needsReview,
            account,
          } as TransactionWithAccount;
        });

        setSearchResults(mappedResults);
        setSearchTotalHits(result.nbHits || 0);
      } catch (error) {
        console.error("Algolia search error:", error);
        // Fallback to local filtering if Algolia fails
        setSearchResults(null);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchQuery, user?.id, selectedAccount, accounts]);

  // Load transactions
  useEffect(() => {
    if (!user) return;

    // Reset pagination when filters change
    setLastDoc(null);
    setAllTransactions([]);

    let txQuery = query(
      collection(db, "transactions"),
      where("userId", "==", user.id),
      orderBy("date", "desc"),
      limit(pageSize)
    );

    // Filter by account
    if (selectedAccount !== "all") {
      txQuery = query(
        collection(db, "transactions"),
        where("userId", "==", user.id),
        where("accountId", "==", selectedAccount),
        orderBy("date", "desc"),
        limit(pageSize)
      );
    }

    const unsubscribe = onSnapshot(txQuery, (snapshot) => {
      const txData = snapshot.docs.map(doc => {
        const data = doc.data() as Transaction;
        const account = accounts.find(a => a.id === data.accountId);
        return {
          ...data,
          id: doc.id,
          account,
        } as TransactionWithAccount;
      });

      setTransactions(txData);
      setAllTransactions(txData);
      setHasMore(snapshot.docs.length === pageSize);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, selectedAccount, accounts, pageSize]);

  // Load more transactions
  const loadMoreTransactions = async () => {
    if (!user || !lastDoc || loadingMore) return;

    setLoadingMore(true);

    let txQuery = query(
      collection(db, "transactions"),
      where("userId", "==", user.id),
      orderBy("date", "desc"),
      startAfter(lastDoc),
      limit(pageSize)
    );

    if (selectedAccount !== "all") {
      txQuery = query(
        collection(db, "transactions"),
        where("userId", "==", user.id),
        where("accountId", "==", selectedAccount),
        orderBy("date", "desc"),
        startAfter(lastDoc),
        limit(pageSize)
      );
    }

    const snapshot = await getDocs(txQuery);
    const newTxData = snapshot.docs.map(doc => {
      const data = doc.data() as Transaction;
      const account = accounts.find(a => a.id === data.accountId);
      return {
        ...data,
        id: doc.id,
        account,
      } as TransactionWithAccount;
    });

    setAllTransactions(prev => [...prev, ...newTxData]);
    setTransactions(prev => [...prev, ...newTxData]);
    setHasMore(snapshot.docs.length === pageSize);
    setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
    setLoadingMore(false);
  };

  // Calculate date range filter
  const getDateRange = (range: string): { start: Date; end: Date } | null => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    switch (range) {
      case "this_month":
        return { start: new Date(year, month, 1), end: now };
      case "last_month":
        return { start: new Date(year, month - 1, 1), end: new Date(year, month, 0) };
      case "3_months":
        return { start: new Date(year, month - 3, 1), end: now };
      case "6_months":
        return { start: new Date(year, month - 6, 1), end: now };
      case "this_year":
        return { start: new Date(year, 0, 1), end: now };
      case "last_year":
        return { start: new Date(year - 1, 0, 1), end: new Date(year - 1, 11, 31) };
      default:
        return null;
    }
  };

  // Filter transactions - use Algolia results when searching, otherwise filter locally
  const filteredTransactions = useMemo(() => {
    // If we have Algolia search results, use those
    if (searchResults !== null && debouncedSearchQuery.trim()) {
      let filtered = [...searchResults];
      
      // Apply date range filter to search results
      const dateFilter = getDateRange(dateRange);
      if (dateFilter) {
        filtered = filtered.filter(tx => {
          const txDate = tx.date?.toDate?.() || new Date();
          return txDate >= dateFilter.start && txDate <= dateFilter.end;
        });
      }

      // Apply type filter to search results
      if (transactionType !== "all") {
        filtered = filtered.filter(tx => tx.type === transactionType);
      }

      return filtered;
    }

    // Otherwise, filter from loaded transactions
    let filtered = [...allTransactions];

    // Date range filter
    const dateFilter = getDateRange(dateRange);
    if (dateFilter) {
      filtered = filtered.filter(tx => {
        const txDate = tx.date.toDate();
        return txDate >= dateFilter.start && txDate <= dateFilter.end;
      });
    }

    // Transaction type filter
    if (transactionType !== "all") {
      filtered = filtered.filter(tx => tx.type === transactionType);
    }

    return filtered;
  }, [allTransactions, searchResults, debouncedSearchQuery, dateRange, transactionType]);

  // Calculate summary stats grouped by currency
  const summaryStats = useMemo(() => {
    // Group by currency
    const byCurrency: Record<string, { credits: number; debits: number }> = {};
    
    for (const tx of filteredTransactions) {
      const currency = tx.currency || "USD";
      if (!byCurrency[currency]) {
        byCurrency[currency] = { credits: 0, debits: 0 };
      }
      if (tx.type === "credit") {
        byCurrency[currency].credits += tx.amount;
      } else {
        byCurrency[currency].debits += tx.amount;
      }
    }
    
    // Get primary currency (most transactions)
    const currencies = Object.keys(byCurrency);
    const primaryCurrency = currencies.length > 0 
      ? currencies.reduce((a, b) => {
          const countA = filteredTransactions.filter(t => (t.currency || "USD") === a).length;
          const countB = filteredTransactions.filter(t => (t.currency || "USD") === b).length;
          return countA >= countB ? a : b;
        })
      : "USD";
    
    const totals = byCurrency[primaryCurrency] || { credits: 0, debits: 0 };
    
    return { 
      credits: totals.credits, 
      debits: totals.debits, 
      net: totals.credits - totals.debits, 
      loadedCount: filteredTransactions.length,
      currency: primaryCurrency,
      hasMultipleCurrencies: currencies.length > 1,
      byCurrency,
    };
  }, [filteredTransactions]);

  // Toggle expanded row
  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Export to CSV (quick export)
  const exportToCSV = () => {
    const headers = ["Date", "Account", "Description", "Type", "Amount", "Balance", "Category", "Reference"];
    const rows = filteredTransactions.map(tx => [
      tx.date.toDate().toISOString().split("T")[0],
      tx.account?.accountNickname || "",
      `"${tx.description.replace(/"/g, '""')}"`,
      tx.type,
      tx.type === "credit" ? tx.amount : -tx.amount,
      tx.balance || "",
      tx.category || "",
      tx.reference || "",
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle smart export
  const handleSmartExport = (csvData: string, filename: string) => {
    const blob = new Blob([csvData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Prepare transactions for export dialog (convert Timestamps to plain objects)
  const transactionsForExport = useMemo(() => {
    return filteredTransactions.map(tx => ({
      date: tx.date.toDate().toISOString().split("T")[0],
      description: tx.description,
      amount: tx.type === "credit" ? tx.amount : -tx.amount,
      balance: tx.balance || 0,
      type: tx.type,
      category: tx.category || "",
      vendor: tx.description.split(" ")[0] || "", // Simple vendor extraction
      reference: tx.reference || "",
      bankName: tx.account?.bankName || "",
      accountNumber: tx.account?.accountNumber || "",
      currency: tx.account?.currency || "USD",
    }));
  }, [filteredTransactions]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setSelectedAccount("all");
    setDateRange("all");
    setTransactionType("all");
  };

  const hasActiveFilters = searchQuery || selectedAccount !== "all" || dateRange !== "all" || transactionType !== "all";

  // Show empty state when no transactions at all
  if (!loading && allTransactions.length === 0) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Transactions" />
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          <TransactionsEmptyState onUpload={() => setUploadModalOpen(true)} />
        </div>
        <ExportDialog
          open={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          transactions={transactionsForExport}
          onExport={handleSmartExport}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Transactions" />

      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        {/* Compact Summary Bar */}
        <div className="bg-white border rounded-lg mb-4">
          <div className="flex items-center divide-x">
            <div className="flex-1 px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Transactions</div>
              <div className="text-base font-bold">
                {debouncedSearchQuery.trim() 
                  ? searchTotalHits.toLocaleString()
                  : (totalTransactionCount ?? summaryStats.loadedCount).toLocaleString()
                }
              </div>
              {!debouncedSearchQuery.trim() && totalTransactionCount !== null && summaryStats.loadedCount < totalTransactionCount && (
                <div className="text-[9px] text-slate-400">{summaryStats.loadedCount} loaded</div>
              )}
            </div>
            <div className="flex-1 px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Credits</div>
              {summaryStats.hasMultipleCurrencies ? (
                <div className="text-xs space-y-0.5">
                  {Object.entries(summaryStats.byCurrency).slice(0, 2).map(([currency, totals]) => (
                    <div key={currency} className="text-green-600 font-semibold">+{formatCurrency(totals.credits, currency)}</div>
                  ))}
                </div>
              ) : (
                <div className="text-base font-bold text-green-600">+{formatCurrency(summaryStats.credits, summaryStats.currency)}</div>
              )}
            </div>
            <div className="flex-1 px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Debits</div>
              {summaryStats.hasMultipleCurrencies ? (
                <div className="text-xs space-y-0.5">
                  {Object.entries(summaryStats.byCurrency).slice(0, 2).map(([currency, totals]) => (
                    <div key={currency} className="text-slate-700 font-semibold">-{formatCurrency(totals.debits, currency)}</div>
                  ))}
                </div>
              ) : (
                <div className="text-base font-bold text-slate-700">-{formatCurrency(summaryStats.debits, summaryStats.currency)}</div>
              )}
            </div>
            <div className="flex-1 px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Net</div>
              {summaryStats.hasMultipleCurrencies ? (
                <div className="text-xs space-y-0.5">
                  {Object.entries(summaryStats.byCurrency).slice(0, 2).map(([currency, totals]) => {
                    const net = totals.credits - totals.debits;
                    return (
                      <div key={currency} className={`font-semibold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {net >= 0 ? "+" : ""}{formatCurrency(net, currency)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={`text-base font-bold ${summaryStats.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {summaryStats.net >= 0 ? "+" : ""}{formatCurrency(summaryStats.net, summaryStats.currency)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            {isSearching ? (
              <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-500 animate-spin" />
            ) : (
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            )}
            <Input
              placeholder="Search all transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
            {searchQuery && searchResults !== null && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                {searchTotalHits.toLocaleString()} found
              </span>
            )}
          </div>

              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <Building2 className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Accounts</SelectItem>
              {accounts.filter(a => !a.isArchived).map(account => (
                <SelectItem key={account.id} value={account.id} className="text-xs">
                  {account.accountNickname || account.bankName || `****${account.accountNumber?.slice(-4)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              {dateRangeOptions.map(option => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
                </SelectContent>
              </Select>

          <Select value={transactionType} onValueChange={setTransactionType}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
                <SelectContent>
              <SelectItem value="all" className="text-xs">All Types</SelectItem>
              <SelectItem value="credit" className="text-xs">Credits Only</SelectItem>
              <SelectItem value="debit" className="text-xs">Debits Only</SelectItem>
                </SelectContent>
              </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          )}

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs" onClick={() => setShowExportDialog(true)}>
                <Sparkles className="h-3.5 w-3.5 mr-2" />
                Smart Export (Custom Headers)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs" onClick={exportToCSV}>
                <FileSpreadsheet className="h-3.5 w-3.5 mr-2" />
                Quick Export (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
            </div>

        {/* Transactions Table */}
        <Card className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
                {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-600 rounded-full mx-auto mb-2" />
                <p className="text-xs text-slate-500">Loading transactions...</p>
              </div>
                ) : filteredTransactions.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600 mb-1">No Transactions Found</p>
                <p className="text-xs text-slate-500">
                  {hasActiveFilters ? "Try adjusting your filters" : "Upload a statement to see transactions"}
                </p>
              </div>
            ) : (
              <table className="w-full table-fixed">
                <thead className="bg-slate-50 sticky top-0 border-b">
                  <tr>
                    <th className="py-3 px-4 text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider" style={{ width: "110px" }}>Date</th>
                    <th className="py-3 px-4 text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider" style={{ width: "160px" }}>Account</th>
                    <th className="py-3 px-4 text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="py-3 px-4 text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider" style={{ width: "140px" }}>Amount</th>
                    <th className="py-3 px-4 text-right text-[10px] font-medium text-slate-500 uppercase tracking-wider" style={{ width: "150px" }}>Balance</th>
                    <th className="py-3 px-4" style={{ width: "50px" }}></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTransactions.map(tx => (
                    <TransactionRow
                      key={tx.id}
                      transaction={tx}
                      isExpanded={expandedIds.has(tx.id)}
                      onToggle={() => toggleExpanded(tx.id)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Pagination Info */}
        {filteredTransactions.length > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {searchResults !== null && debouncedSearchQuery.trim() ? (
                <>
                  Showing {filteredTransactions.length} of {searchTotalHits.toLocaleString()} results
                  <span className="ml-2 text-cyan-600">• Powered by Algolia</span>
                </>
              ) : (
                <>
                  Showing {filteredTransactions.length} of {totalTransactionCount?.toLocaleString() ?? "..."} transactions
                </>
              )}
            </span>
            {!debouncedSearchQuery.trim() && hasMore && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-xs"
                onClick={loadMoreTransactions}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <div className="animate-spin h-3 w-3 border-2 border-slate-300 border-t-slate-600 rounded-full mr-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    Load More
                    <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Smart Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        transactions={transactionsForExport}
        onExport={handleSmartExport}
      />

      {/* Upload Drawer */}
      <UploadDrawer
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        defaultType="statement"
      />
    </div>
  );
}
