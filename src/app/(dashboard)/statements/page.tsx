"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Download,
  Trash2,
  Eye,
  Calendar,
  DollarSign,
  Building2,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  ExternalLink,
  Edit2,
  CheckCircle,
  Clock,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc, Timestamp } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UploadDrawer } from "@/components/upload/upload-drawer";
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
// STATEMENT TABLE ROW COMPONENT
// ============================================

function StatementRow({
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

  return (
    <tr className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
      {/* File Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-blue-100 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-sm text-slate-900 truncate max-w-xs">
              {statement.originalFileName}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              {statement.fileType && (
                <span className="uppercase">{statement.fileType}</span>
              )}
              {statement.fileSize > 0 && (
                <>
                  {statement.fileType && <span>•</span>}
                  <span>{formatFileSize(statement.fileSize)}</span>
                </>
              )}
              {(statement.pageCount ?? 0) > 0 && (
                <>
                  <span>•</span>
                  <span>{statement.pageCount} page{statement.pageCount !== 1 ? "s" : ""}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Period */}
      <td className="px-4 py-3">
        <p className="text-sm text-slate-900">
          {formatDate(statement.periodStart)}
        </p>
        <p className="text-xs text-slate-500">to {formatDate(statement.periodEnd)}</p>
      </td>

      {/* Transactions */}
      <td className="px-4 py-3 text-center">
        <p className="text-sm font-medium text-slate-900">{statement.transactionCount || 0}</p>
      </td>

      {/* Opening Balance */}
      <td className="px-4 py-3 text-right">
        <p className="text-sm font-medium text-slate-900">
          {formatCurrency(statement.openingBalance, statement.account?.currency || statement.currency || "USD")}
        </p>
      </td>

      {/* Closing Balance */}
      <td className="px-4 py-3 text-right">
        <p className="text-sm font-semibold text-slate-900">
          {formatCurrency(statement.closingBalance, statement.account?.currency || statement.currency || "USD")}
        </p>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge variant="secondary" className={`${statusInfo.color} text-xs`}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {statusInfo.label}
        </Badge>
      </td>

      {/* Uploaded */}
      <td className="px-4 py-3">
        <p className="text-xs text-slate-500">{formatDate(statement.uploadedAt)}</p>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onView}
            className="h-8 w-8 p-0"
            title="View Original"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(statement.fileUrl, "_blank")}
            className="h-8 w-8 p-0"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ============================================
// GROUPED ACCOUNT TABLE COMPONENT
// ============================================

function AccountTable({
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
    <Card className="mb-4">
      {/* Header - Clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-slate-600 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 text-slate-600 flex-shrink-0" />
          )}
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-900">{account.bankName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-slate-600">{account.currency}</p>
              <span className="text-slate-400">•</span>
              <p className="text-sm text-slate-500">****{account.accountNumber?.slice(-4)}</p>
            </div>
          </div>
        </div>
        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
          {statements.length} {statements.length === 1 ? "statement" : "statements"}
        </Badge>
      </button>

      {/* Table */}
      {isExpanded && (
        <div className="border-t border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  File Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Txns
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Opening
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Closing
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {statements.map((statement) => (
                <StatementRow
                  key={statement.id}
                  statement={statement}
                  onView={() => onView(statement)}
                  onDelete={() => onDelete(statement)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
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
  const router = useRouter();
  const { user } = useAuth();
  const [statements, setStatements] = useState<StatementWithAccount[]>([]);
  const [accounts, setAccounts] = useState<Record<string, BankAccount>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

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
    window.open(statement.fileUrl, "_blank");
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
          <StatementsEmptyState onUpload={() => setUploadModalOpen(true)} />
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
                  <Button size="sm" onClick={() => setUploadModalOpen(true)}>
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
                  <AccountTable
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

      {/* Upload Drawer */}
      <UploadDrawer
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        defaultType="statement"
      />
    </div>
  );
}

