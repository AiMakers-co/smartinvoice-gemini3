"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Download,
  Trash2,
  Eye,
  Building2,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  Plus,
  Calendar,
  Hash,
  Banknote,
  ArrowUpDown,
} from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Transaction } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUploadState } from "@/hooks/use-upload-state";
import type { Statement, BankAccount } from "@/types";

// ============================================
// TYPES
// ============================================

interface StatementWithAccount extends Statement {
  account?: BankAccount;
}

// ============================================
// STATUS CONFIG
// ============================================

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-600 bg-amber-50" },
  pending_extraction: { label: "Processing", icon: Clock, color: "text-blue-600 bg-blue-50" },
  completed: { label: "Completed", icon: CheckCircle, color: "text-green-600 bg-green-50" },
  failed: { label: "Failed", icon: AlertTriangle, color: "text-red-600 bg-red-50" },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatCurrency(amount: number | undefined | null, currency: string = "USD"): string {
  if (amount === undefined || amount === null) return "—";
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date | Timestamp | undefined): string {
  if (!date) return "Unknown";
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFileSize(bytes: number | undefined | null): string {
  if (!bytes || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================
// METADATA PILL COLORS (Smart Extract style)
// ============================================

const pillColors = {
  period: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  financial: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  count: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  file: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
  currency: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
};

// ============================================
// STATEMENT CARD COMPONENT (Smart Extract style)
// ============================================

function StatementCard({
  statement,
  onView,
  onDelete,
}: {
  statement: StatementWithAccount;
  onView: () => void;
  onDelete: () => void;
}) {
  const statusInfo = statusConfig[statement.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;
  const currency = statement.account?.currency || statement.currency || "USD";

  // Build metadata pills
  const pills: { label: string; value: string; color: keyof typeof pillColors }[] = [];

  if (statement.periodStart || statement.periodEnd) {
    pills.push({
      label: "Period",
      value: `${formatDate(statement.periodStart)} → ${formatDate(statement.periodEnd)}`,
      color: "period",
    });
  }

  if (statement.transactionCount) {
    pills.push({
      label: "Transactions",
      value: String(statement.transactionCount),
      color: "count",
    });
  }

  if (statement.openingBalance !== undefined && statement.openingBalance !== null) {
    pills.push({
      label: "Opening",
      value: formatCurrency(statement.openingBalance, currency),
      color: "financial",
    });
  }

  if (statement.closingBalance !== undefined && statement.closingBalance !== null) {
    pills.push({
      label: "Closing",
      value: formatCurrency(statement.closingBalance, currency),
      color: "financial",
    });
  }

  pills.push({ label: "Currency", value: currency, color: "currency" });

  if (statement.fileType) {
    pills.push({ label: "Format", value: statement.fileType.toUpperCase(), color: "file" });
  }

  if (statement.fileSize > 0) {
    pills.push({ label: "Size", value: formatFileSize(statement.fileSize), color: "file" });
  }

  if ((statement.pageCount ?? 0) > 0) {
    pills.push({
      label: "Pages",
      value: `${statement.pageCount}`,
      color: "file",
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <FileText className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-900 truncate">{statement.originalFileName}</p>
          <p className="text-xs text-slate-500">
            Uploaded {formatDate(statement.uploadedAt)}
          </p>
        </div>
        <Badge variant="secondary" className={`${statusInfo.color} text-[10px] shrink-0`}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {statusInfo.label}
        </Badge>
      </div>

      {/* Metadata pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {pills.map((pill, idx) => {
          const colors = pillColors[pill.color];
          return (
            <span
              key={idx}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] ${colors.bg} ${colors.text} ${colors.border}`}
            >
              <span className="font-medium">{pill.label}:</span>
              <span className="truncate max-w-[140px]">{pill.value}</span>
            </span>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={onView}
          className="h-7 text-xs text-slate-600 hover:text-slate-900 px-2"
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          View
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(statement.fileUrl, "_blank")}
          className="h-7 text-xs text-slate-600 hover:text-slate-900 px-2"
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          Download
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Delete
        </Button>
      </div>
    </div>
  );
}

// ============================================
// GROUPED ACCOUNT SECTION COMPONENT
// ============================================

function AccountSection({
  account,
  statements,
  onView,
  onDelete,
}: {
  account: BankAccount;
  statements: StatementWithAccount[];
  onView: (statement: StatementWithAccount) => void;
  onDelete: (statement: StatementWithAccount) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="mb-5">
      {/* Account header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 mb-3 px-1 group"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 flex-shrink-0" />
        )}
        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-4 w-4 text-blue-600" />
        </div>
        <div className="text-left flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-900">{account.bankName}</p>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{account.currency}</span>
            <span className="text-slate-300">•</span>
            <span>****{account.accountNumber?.slice(-4)}</span>
          </div>
        </div>
        <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-[10px]">
          {statements.length} {statements.length === 1 ? "statement" : "statements"}
        </Badge>
      </button>

      {/* Statement cards grid */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pl-7">
          {statements.map((statement) => (
            <StatementCard
              key={statement.id}
              statement={statement}
              onView={() => onView(statement)}
              onDelete={() => onDelete(statement)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// STATEMENT PREVIEW DIALOG (matches pdf2sheet)
// ============================================

function StatementPreviewDialog({
  statement,
  userId,
  open,
  onClose,
}: {
  statement: StatementWithAccount | null;
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(true);

  // Load transactions when statement changes
  useEffect(() => {
    if (!statement || !open) return;
    async function loadTransactions() {
      setLoadingTxns(true);
      try {
        const txQuery = query(
          collection(db, "transactions"),
          where("userId", "==", userId),
          where("statementId", "==", statement!.id),
          orderBy("date", "asc")
        );
        const snap = await getDocs(txQuery);
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)));
      } catch (err) {
        console.error("Failed to load transactions:", err);
      } finally {
        setLoadingTxns(false);
      }
    }
    loadTransactions();
  }, [statement?.id, userId, open]);

  if (!statement) return null;

  const currency = statement.account?.currency || statement.currency || "USD";

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] w-full h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <span className="block">{statement.account?.bankName || statement.originalFileName}</span>
              <span className="text-xs font-normal text-slate-500">
                {statement.pageCount || "—"} pages • {transactions.length} rows
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 mt-4">
          {/* Metadata row — icon + text pairs like pdf2sheet */}
          <div className="flex items-center gap-4 text-sm flex-wrap">
            {statement.account?.bankName && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-slate-400" />
                <span className="font-medium">{statement.account.bankName}</span>
              </div>
            )}
            {(statement.periodStart || statement.periodEnd) && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>{formatDate(statement.periodStart)} — {formatDate(statement.periodEnd)}</span>
              </div>
            )}
            {statement.account?.accountNumber && (
              <div className="flex items-center gap-1.5">
                <Hash className="h-4 w-4 text-slate-400" />
                <span>****{statement.account.accountNumber.slice(-4)}</span>
              </div>
            )}
            {currency && (
              <div className="flex items-center gap-1.5">
                <Banknote className="h-4 w-4 text-slate-400" />
                <span>{currency}</span>
              </div>
            )}
          </div>

          {/* Split view: Original Document | Extracted Data */}
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            {/* Left: Original Document */}
            <div className="border rounded-lg overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b bg-slate-50">
                <span className="text-xs font-medium text-slate-600">Original Document</span>
              </div>
              <div className="flex-1 bg-slate-100">
                {statement.fileUrl ? (
                  <iframe src={statement.fileUrl} className="w-full h-full min-h-[300px]" title="PDF" />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">Preview not available</div>
                )}
              </div>
            </div>

            {/* Right: Extracted Data */}
            <div className="border rounded-lg overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">
                  Extracted Data ({transactions.length} rows)
                </span>
                <Button
                  variant="ghost" size="sm" className="h-6 text-xs"
                  onClick={() => window.open(statement.fileUrl, "_blank")}
                >
                  <Download className="h-3 w-3 mr-1" /> Download
                </Button>
              </div>
              <div className="flex-1 overflow-auto">
                {loadingTxns ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                    <span className="ml-2 text-sm text-slate-500">Loading...</span>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">No data</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium text-slate-500 whitespace-nowrap">Date</th>
                        <th className="px-2 py-1.5 text-left font-medium text-slate-500 whitespace-nowrap">Description</th>
                        <th className="px-2 py-1.5 text-right font-medium text-slate-500 whitespace-nowrap">Amount</th>
                        <th className="px-2 py-1.5 text-right font-medium text-slate-500 whitespace-nowrap">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transactions.map((txn, i) => (
                        <tr key={txn.id || i} className="hover:bg-slate-50">
                          <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">{formatDate(txn.date)}</td>
                          <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap truncate max-w-[200px]" title={txn.description}>
                            {txn.description}
                          </td>
                          <td className={`px-2 py-1.5 text-right font-medium tabular-nums whitespace-nowrap ${
                            txn.type === "credit" ? "text-emerald-700" : "text-red-700"
                          }`}>
                            {txn.type === "credit" ? "+" : "−"}{formatCurrency(Math.abs(txn.amount), currency)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums whitespace-nowrap">
                            {txn.balance != null ? formatCurrency(txn.balance, currency) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// EMPTY STATE COMPONENT
// ============================================

function StatementsEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Bank Statements</h2>
          <p className="text-xs text-slate-500">Upload and manage your bank statements</p>
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
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Transactions</div>
            <div className="text-base font-bold">0</div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Accounts</div>
            <div className="text-base font-bold">0</div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Size</div>
            <div className="text-base font-bold">0 KB</div>
          </div>
        </div>
      </div>
      
      {/* Empty Content */}
      <Card>
        <CardContent className="p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-cyan-50 flex items-center justify-center mx-auto mb-3">
            <FileText className="h-6 w-6 text-cyan-600" />
          </div>
          <p className="text-sm font-medium text-slate-900 mb-1">No statements yet</p>
          <p className="text-xs text-slate-500 mb-4">Upload a bank statement to extract transactions automatically</p>
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

export default function StatementsPage() {
  const { user } = useAuth();
  const { openDrawer: openUploadDrawer } = useUploadState();
  const [statements, setStatements] = useState<StatementWithAccount[]>([]);
  const [accounts, setAccounts] = useState<Record<string, BankAccount>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [previewStatement, setPreviewStatement] = useState<StatementWithAccount | null>(null);

  // Load statements & accounts together
  useEffect(() => {
    if (!user) return;

    // Listen to accounts
    const accountsQuery = query(
      collection(db, "accounts"),
      where("userId", "==", user.id)
    );
    
    let accountsMap: Record<string, BankAccount> = {};

    const unsubAccounts = onSnapshot(accountsQuery, (snapshot) => {
      accountsMap = {};
      snapshot.docs.forEach((doc) => {
        accountsMap[doc.id] = { id: doc.id, ...doc.data() } as BankAccount;
      });
      setAccounts(accountsMap);
    });

    // Listen to statements
    const statementsQuery = query(
      collection(db, "statements"),
      where("userId", "==", user.id),
      orderBy("createdAt", "desc")
    );

    const unsubStatements = onSnapshot(statementsQuery, (snapshot) => {
      const statementsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Normalize field name variants (seed data uses startingBalance/endingBalance)
          openingBalance: data.openingBalance ?? data.startingBalance ?? undefined,
          closingBalance: data.closingBalance ?? data.endingBalance ?? undefined,
          // Ensure fileSize is a number (some demo data may not have it)
          fileSize: data.fileSize || 0,
          // Ensure fileType exists
          fileType: data.fileType || (data.fileName?.endsWith(".csv") ? "csv" : data.fileName?.endsWith(".xlsx") ? "xlsx" : "pdf"),
          account: accountsMap[data.accountId],
        } as StatementWithAccount;
      });

      setStatements(statementsData);
      setLoading(false);
    });

    return () => {
      unsubAccounts();
      unsubStatements();
    };
  }, [user]);

  // Filter statements
  const filteredStatements = statements.filter((statement) => {
    const matchesSearch =
      searchQuery === "" ||
      statement.originalFileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      statement.account?.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      statement.account?.accountNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === "all" || statement.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Group by account ID
  const groupedByAccount = filteredStatements.reduce((acc, statement) => {
    const accountId = statement.accountId || "unknown";
    if (!acc[accountId]) acc[accountId] = [];
    acc[accountId].push(statement);
    return acc;
  }, {} as Record<string, StatementWithAccount[]>);

  // Sort statements within each account by date (newest first)
  Object.values(groupedByAccount).forEach((accountStatements) => {
    accountStatements.sort((a, b) => {
      const dateA = a.uploadedAt instanceof Timestamp ? a.uploadedAt.toMillis() : 0;
      const dateB = b.uploadedAt instanceof Timestamp ? b.uploadedAt.toMillis() : 0;
      return dateB - dateA;
    });
  });

  // Handlers
  const handleView = (statement: StatementWithAccount) => {
    setPreviewStatement(statement);
  };

  const handleDelete = async (statement: StatementWithAccount) => {
    if (!confirm(`Delete "${statement.originalFileName}"?\n\nThis will also delete all ${statement.transactionCount || 0} associated transactions.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "statements", statement.id));
      // Cascade delete will happen automatically via Cloud Function
    } catch (error) {
      console.error("Error deleting statement:", error);
      alert("Failed to delete statement. Please try again.");
    }
  };

  // Stats
  const totalStatements = statements.length;
  const totalTransactions = statements.reduce((sum, s) => sum + (s.transactionCount || 0), 0);
  const totalSize = statements.reduce((sum, s) => sum + (s.fileSize || 0), 0);
  const uniqueAccounts = Object.keys(groupedByAccount).length;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Bank Statements" />

      <div className="flex-1 p-4 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : statements.length === 0 ? (
          <StatementsEmptyState onUpload={() => openUploadDrawer("statement")} />
        ) : (
          <div className="space-y-4">
            {/* Compact Summary Bar */}
            <div className="bg-white border rounded-lg">
              <div className="flex items-center divide-x">
                <div className="flex-1 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Statements</div>
                  <div className="text-base font-bold">{totalStatements}</div>
                </div>
                <div className="flex-1 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Transactions</div>
                  <div className="text-base font-bold">{totalTransactions.toLocaleString()}</div>
                </div>
                <div className="flex-1 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Accounts</div>
                  <div className="text-base font-bold">{uniqueAccounts}</div>
                </div>
                <div className="flex-1 px-3 py-2">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Total Size</div>
                  <div className="text-base font-bold">{formatFileSize(totalSize) || "—"}</div>
                </div>
                <div className="px-3 py-2">
                  <Button size="sm" onClick={() => openUploadDrawer("statement")}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Upload
                  </Button>
                </div>
              </div>
            </div>

            {/* Search & Filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search statements..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-3.5 w-3.5 mr-1.5" />
                    {filterStatus === "all" ? "All" : statusConfig[filterStatus as keyof typeof statusConfig]?.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem className="text-xs" onClick={() => setFilterStatus("all")}>
                    All
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <DropdownMenuItem key={key} className="text-xs" onClick={() => setFilterStatus(key)}>
                      <config.icon className="h-3 w-3 mr-1.5" />
                      {config.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Account Tables */}
            {Object.keys(groupedByAccount).length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-500">No statements match your filters</p>
              </div>
            ) : (
              Object.entries(groupedByAccount).map(([accountId, accountStatements]) => {
                // Use account from state, or from statement's account property, or create placeholder
                const account = accounts[accountId] || accountStatements[0]?.account || {
                  id: accountId,
                  bankName: "Unknown Bank",
                  accountNumber: "Unknown",
                  currency: "USD",
                } as BankAccount;

                return (
                  <AccountSection
                    key={accountId}
                    account={account}
                    statements={accountStatements}
                    onView={handleView}
                    onDelete={handleDelete}
                  />
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Preview dialog */}
      {user && (
        <StatementPreviewDialog
          statement={previewStatement}
          userId={user.id}
          open={!!previewStatement}
          onClose={() => setPreviewStatement(null)}
        />
      )}
    </div>
  );
}
