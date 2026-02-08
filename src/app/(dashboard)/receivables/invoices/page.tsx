"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileCheck,
  Search,
  MoreHorizontal,
  Eye,
  Link2,
  Plus,
  Building2,
  CheckCircle2,
  Circle,
  Sparkles,
  RefreshCw,
  Wand2,
} from "lucide-react";
import { OutgoingInvoice } from "@/types/documents";
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
    year: "numeric",
  }).format(date);
}

function getPaymentStatusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Paid</Badge>;
    case "partial":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Partial</Badge>;
    case "overdue":
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Overdue</Badge>;
    default:
      return <Badge variant="secondary">Unpaid</Badge>;
  }
}

function getReconciliationBadge(status: string | undefined) {
  switch (status) {
    case "matched":
      return (
        <div className="flex items-center gap-1 text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span className="text-xs">Matched</span>
        </div>
      );
    case "suggested":
      return (
        <div className="flex items-center gap-1 text-amber-600">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="text-xs">Suggested</span>
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-1 text-slate-400">
          <Circle className="h-3.5 w-3.5" />
          <span className="text-xs">Unmatched</span>
        </div>
      );
  }
}

function getAgingBadge(bucket: string | undefined) {
  switch (bucket) {
    case "current":
      return <span className="text-emerald-600 text-xs">Current</span>;
    case "1-30":
      return <span className="text-amber-600 text-xs">1-30 days</span>;
    case "31-60":
      return <span className="text-orange-600 text-xs">31-60 days</span>;
    case "61-90":
      return <span className="text-red-500 text-xs">61-90 days</span>;
    case "90+":
      return <span className="text-red-700 text-xs font-semibold">90+ days</span>;
    default:
      return null;
  }
}

// ============================================
// EMPTY STATE - Just empty table
// ============================================

function EmptyState() {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Invoice #</TableHead>
            <TableHead className="text-xs">Customer</TableHead>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Due Date</TableHead>
            <TableHead className="text-xs text-right">Amount</TableHead>
            <TableHead className="text-xs">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={6} className="h-32 text-center text-sm text-slate-400">
              No invoices yet
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ReceivablesInvoicesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<OutgoingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  
  // Upload
  const { openDrawer: openUploadDrawer } = useUploadState();
  
  // Migration state
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);

  // Load invoices
  useEffect(() => {
    if (!user?.id) return;

    const q = query(
      collection(db, "invoices"),
      where("userId", "==", user.id),
      orderBy("invoiceDate", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        // Normalize field names - handle both old and new naming conventions
        return {
          id: doc.id,
          ...data,
          // Map invoiceNumber -> documentNumber if needed
          documentNumber: data.documentNumber || data.invoiceNumber || "Unknown",
          // Map invoiceDate -> documentDate if needed
          documentDate: data.documentDate || data.invoiceDate,
          // Map amountDue -> amountRemaining if needed
          amountRemaining: data.amountRemaining ?? data.amountDue ?? data.total ?? 0,
          // Ensure customerName exists
          customerName: data.customerName || data.counterpartyName || "Unknown",
          // Ensure total is a number
          total: data.total || 0,
          currency: data.currency || "USD",
          // Reconciliation status
          reconciliationStatus: data.reconciliationStatus || "unmatched",
          amountPaid: data.amountPaid ?? 0,
        };
      }) as OutgoingInvoice[];
      setInvoices(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

  // Calculate stats - grouped by currency
  const outstandingByCurrency = invoices
    .filter(inv => inv.paymentStatus !== "paid")
    .reduce((acc, inv) => {
      const currency = inv.currency || "USD";
      acc[currency] = (acc[currency] || 0) + (inv.amountRemaining ?? 0);
      return acc;
    }, {} as Record<string, number>);

  const paidByCurrency = invoices
    .filter(inv => inv.paymentStatus === "paid")
    .reduce((acc, inv) => {
      const currency = inv.currency || "USD";
      acc[currency] = (acc[currency] || 0) + (inv.total ?? 0);
      return acc;
    }, {} as Record<string, number>);

  const stats = {
    overdueCount: invoices.filter(inv => inv.agingBucket && inv.agingBucket !== "current" && inv.paymentStatus !== "paid").length,
    invoiceCount: invoices.length,
    matchedCount: invoices.filter(inv => inv.reconciliationStatus === "matched").length,
    unmatchedCount: invoices.filter(inv => inv.reconciliationStatus !== "matched").length,
  };

  // Migration handler
  const handleMigration = async () => {
    if (!user?.id) return;
    
    setMigrating(true);
    setMigrationResult(null);
    
    try {
      const migrateFn = httpsCallable(functions, "migrateInvoiceReconciliationFields");
      const result = await migrateFn({});
      const data = result.data as { updatedCount: number; skippedCount: number; message: string };
      setMigrationResult(`✓ ${data.message}`);
    } catch (error) {
      console.error("Migration error:", error);
      setMigrationResult("✗ Migration failed. Please try again.");
    } finally {
      setMigrating(false);
    }
  };

  // Filter and sort
  const filteredInvoices = invoices
    .filter(inv => {
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        return (
          inv.documentNumber?.toLowerCase().includes(search) ||
          inv.customerName?.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .filter(inv => {
      if (statusFilter === "all") return true;
      return inv.paymentStatus === statusFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return (b.documentDate?.toMillis() || 0) - (a.documentDate?.toMillis() || 0);
        case "date-asc":
          return (a.documentDate?.toMillis() || 0) - (b.documentDate?.toMillis() || 0);
        case "amount-desc":
          return (b.total ?? 0) - (a.total ?? 0);
        case "amount-asc":
          return (a.total ?? 0) - (b.total ?? 0);
        default:
          return 0;
      }
    });

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-200 rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-slate-200 rounded-lg" />
            ))}
          </div>
          <div className="h-96 bg-slate-200 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <>
      <Header title="Receivables - Invoices" />
      <div className="p-4 space-y-4">
        {/* Header Row with Add Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Your Invoices</h2>
            <p className="text-xs text-slate-500">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} uploaded</p>
          </div>
          <Button 
            onClick={() => openUploadDrawer("invoice")}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Invoice
          </Button>
        </div>

        {/* Compact Summary Bar - Multi-currency */}
        <div className="bg-white border rounded-lg">
          <div className="flex items-center divide-x overflow-x-auto">
            {/* Outstanding by currency */}
            {Object.entries(outstandingByCurrency).length > 0 ? (
              Object.entries(outstandingByCurrency).map(([currency, amount]) => (
                <div key={`outstanding-${currency}`} className="px-3 py-2 min-w-0">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">
                    Outstanding ({currency})
                  </div>
                  <div className="text-base font-bold text-amber-600">{formatCurrency(amount, currency)}</div>
                </div>
              ))
            ) : (
              <div className="px-3 py-2">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Outstanding</div>
                <div className="text-base font-bold text-amber-600">$0.00</div>
              </div>
            )}
            
            {/* Paid by currency */}
            {Object.entries(paidByCurrency).length > 0 ? (
              Object.entries(paidByCurrency).map(([currency, amount]) => (
                <div key={`paid-${currency}`} className="px-3 py-2 min-w-0">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">
                    Paid ({currency})
                  </div>
                  <div className="text-base font-bold text-emerald-600">{formatCurrency(amount, currency)}</div>
                </div>
              ))
            ) : (
              <div className="px-3 py-2">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Paid</div>
                <div className="text-base font-bold text-emerald-600">$0.00</div>
              </div>
            )}
            
            <div className="px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Overdue</div>
              <div className="text-base font-bold text-red-600">{stats.overdueCount}</div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Total</div>
              <div className="text-base font-bold">{stats.invoiceCount}</div>
            </div>
            <div className="px-3 py-2 border-l-2 border-slate-200">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Matched</div>
              <div className="text-base font-bold text-emerald-600">{stats.matchedCount}</div>
            </div>
            <div className="px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Unmatched</div>
              <div className="text-base font-bold text-slate-500">{stats.unmatchedCount}</div>
            </div>
          </div>
        </div>

        {/* Reconciliation Actions */}
        {stats.unmatchedCount > 0 && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                {stats.unmatchedCount} invoice{stats.unmatchedCount !== 1 ? 's' : ''} not matched to bank transactions
              </p>
              <p className="text-xs text-blue-700">
                Match invoices to credit transactions to track which customers have paid
              </p>
            </div>
            <div className="flex gap-2">
              {/* Migration button - only show if there might be missing fields */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleMigration}
                disabled={migrating}
                className="text-xs"
              >
                {migrating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5 mr-1" />
                    Fix Data
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => router.push("/reconciliation")}
                className="bg-blue-600 hover:bg-blue-700 text-xs"
              >
                <Link2 className="h-3.5 w-3.5 mr-1" />
                Start Matching
              </Button>
            </div>
          </div>
        )}
        
        {/* Migration result message */}
        {migrationResult && (
          <div className={`p-2 text-sm rounded ${migrationResult.startsWith('✓') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {migrationResult}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-8 text-xs"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest</SelectItem>
              <SelectItem value="date-asc">Oldest</SelectItem>
              <SelectItem value="amount-desc">Highest $</SelectItem>
              <SelectItem value="amount-asc">Lowest $</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Invoices Table */}
        {invoices.length === 0 ? (
          <EmptyState />
        ) : filteredInvoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-500">No invoices match your filters</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Invoice #</TableHead>
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs text-right">Paid</TableHead>
                  <TableHead className="text-xs">Payment</TableHead>
                  <TableHead className="text-xs">Matched</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow 
                    key={invoice.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/receivables/invoices/${invoice.id}`)}
                  >
                    <TableCell className="font-medium text-xs">
                      {invoice.documentNumber}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        {invoice.customerName || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(invoice.documentDate)}</TableCell>
                    <TableCell className="text-right font-medium text-xs">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600 text-xs">
                      {formatCurrency(invoice.amountPaid || 0, invoice.currency)}
                    </TableCell>
                    <TableCell>{getPaymentStatusBadge(invoice.paymentStatus)}</TableCell>
                    <TableCell>{getReconciliationBadge(invoice.reconciliationStatus)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-xs" onClick={() => router.push(`/receivables/invoices/${invoice.id}`)}>
                            <Eye className="h-3.5 w-3.5 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs" onClick={() => router.push(`/reconciliation`)}>
                            <Link2 className="h-3.5 w-3.5 mr-2" />
                            Match Payment
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

    </>
  );
}
