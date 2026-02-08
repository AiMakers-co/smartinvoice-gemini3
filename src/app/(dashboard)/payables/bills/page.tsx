"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, onSnapshot, Timestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileSpreadsheet,
  Search,
  MoreHorizontal,
  Eye,
  Link2,
  Plus,
  Building2,
  Trash2,
  AlertTriangle,
  Copy,
} from "lucide-react";
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
            <TableHead className="text-xs">Bill #</TableHead>
            <TableHead className="text-xs">Vendor</TableHead>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Due Date</TableHead>
            <TableHead className="text-xs text-right">Amount</TableHead>
            <TableHead className="text-xs">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={6} className="h-32 text-center text-sm text-slate-400">
              No bills yet
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

export default function PayablesBillsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [bills, setBills] = useState<IncomingBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  
  // Upload
  const { openDrawer: openUploadDrawer } = useUploadState();
  
  // Duplicate management state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [deletingDuplicates, setDeletingDuplicates] = useState(false);

  // Load bills
  useEffect(() => {
    if (!user?.id) return;

    const q = query(
      collection(db, "bills"),
      where("userId", "==", user.id),
      orderBy("documentDate", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as IncomingBill[];
      setBills(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

  // Calculate stats - grouped by currency
  const owedByCurrency = bills
    .filter(bill => bill.paymentStatus !== "paid")
    .reduce((acc, bill) => {
      const currency = bill.currency || "USD";
      acc[currency] = (acc[currency] || 0) + (bill.amountRemaining ?? 0);
      return acc;
    }, {} as Record<string, number>);

  const paidByCurrency = bills
    .filter(bill => bill.paymentStatus === "paid")
    .reduce((acc, bill) => {
      const currency = bill.currency || "USD";
      acc[currency] = (acc[currency] || 0) + (bill.total ?? 0);
      return acc;
    }, {} as Record<string, number>);

  const stats = {
    overdueCount: bills.filter(bill => bill.agingBucket && bill.agingBucket !== "current" && bill.paymentStatus !== "paid").length,
    billCount: bills.length,
  };

  // Find duplicates - bills with same documentNumber + vendorName + total
  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, IncomingBill[]>();
    
    bills.forEach(bill => {
      // Create a key from documentNumber + vendorName + total
      const key = `${bill.documentNumber || "none"}|${bill.vendorName || "unknown"}|${bill.total || 0}`;
      const existing = groups.get(key) || [];
      existing.push(bill);
      groups.set(key, existing);
    });
    
    // Only return groups with duplicates (more than 1 item)
    const duplicates: { key: string; bills: IncomingBill[] }[] = [];
    groups.forEach((billGroup, key) => {
      if (billGroup.length > 1) {
        duplicates.push({ key, bills: billGroup });
      }
    });
    
    return duplicates;
  }, [bills]);

  const totalDuplicates = duplicateGroups.reduce((sum, g) => sum + g.bills.length - 1, 0);

  // Delete all duplicates (keep oldest)
  const handleDeleteAllDuplicates = async () => {
    if (!confirm(`Delete ${totalDuplicates} duplicate bill(s)? This keeps the oldest version of each.\n\nThis action cannot be undone.`)) {
      return;
    }
    
    setDeletingDuplicates(true);
    try {
      for (const group of duplicateGroups) {
        // Sort by createdAt, keep oldest
        const sorted = [...group.bills].sort((a, b) => 
          (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0)
        );
        
        // Delete all except the first (oldest)
        for (let i = 1; i < sorted.length; i++) {
          await deleteDoc(doc(db, "bills", sorted[i].id));
        }
      }
      setDuplicateDialogOpen(false);
    } catch (error) {
      console.error("Error deleting duplicates:", error);
      alert("Failed to delete some duplicates. Please try again.");
    } finally {
      setDeletingDuplicates(false);
    }
  };

  // Filter and sort
  const filteredBills = bills
    .filter(bill => {
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        return (
          bill.documentNumber?.toLowerCase().includes(search) ||
          bill.vendorName?.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .filter(bill => {
      if (statusFilter === "all") return true;
      return bill.paymentStatus === statusFilter;
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
        case "due-date":
          return (a.dueDate?.toMillis() || 0) - (b.dueDate?.toMillis() || 0);
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
      <Header title="Payables - Bills" />
      <div className="p-4 space-y-4">
        {/* Header Row with Add Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Your Bills</h2>
            <p className="text-xs text-slate-500">{bills.length} bill{bills.length !== 1 ? 's' : ''} uploaded</p>
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
            {/* Owed by currency */}
            {Object.entries(owedByCurrency).length > 0 ? (
              Object.entries(owedByCurrency).map(([currency, amount]) => (
                <div key={`owed-${currency}`} className="px-3 py-2 min-w-0">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">
                    Owed ({currency})
                  </div>
                  <div className="text-base font-bold text-red-600">{formatCurrency(amount, currency)}</div>
                </div>
              ))
            ) : (
              <div className="px-3 py-2">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Total Owed</div>
                <div className="text-base font-bold text-red-600">$0.00</div>
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
              <div className="text-base font-bold text-amber-600">{stats.overdueCount}</div>
            </div>
            {totalDuplicates > 0 && (
              <div className="px-3 py-2">
                <div className="text-[9px] uppercase tracking-wider text-red-600 font-medium">Duplicates</div>
                <div className="text-base font-bold text-red-600">{totalDuplicates}</div>
              </div>
            )}
            <div className="px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Total</div>
              <div className="text-base font-bold">{stats.billCount}</div>
            </div>
          </div>
        </div>

        {/* Duplicate Warning Banner */}
        {totalDuplicates > 0 && (
          <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <Copy className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {totalDuplicates} duplicate bill{totalDuplicates !== 1 ? 's' : ''} found
                </p>
                <p className="text-xs text-amber-700">
                  {duplicateGroups.length} group{duplicateGroups.length !== 1 ? 's' : ''} of bills with matching invoice numbers
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={() => setDuplicateDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Review & Remove
            </Button>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search bills..."
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
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest</SelectItem>
              <SelectItem value="date-asc">Oldest</SelectItem>
              <SelectItem value="due-date">Due Date</SelectItem>
              <SelectItem value="amount-desc">Highest $</SelectItem>
              <SelectItem value="amount-asc">Lowest $</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bills Table */}
        {bills.length === 0 ? (
          <EmptyState />
        ) : filteredBills.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-500">No bills match your filters</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Bill #</TableHead>
                  <TableHead className="text-xs">Vendor</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Due Date</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs text-right">Paid</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Aging</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.map((bill) => (
                  <TableRow 
                    key={bill.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/payables/bills/${bill.id}`)}
                  >
                    <TableCell className="font-medium text-xs">
                      {bill.documentNumber || "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        {bill.vendorName || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(bill.documentDate)}</TableCell>
                    <TableCell className="text-xs">{formatDate(bill.dueDate)}</TableCell>
                    <TableCell className="text-right font-medium text-xs">
                      {formatCurrency(bill.total, bill.currency)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600 text-xs">
                      {formatCurrency(bill.amountPaid || 0, bill.currency)}
                    </TableCell>
                    <TableCell>{getPaymentStatusBadge(bill.paymentStatus)}</TableCell>
                    <TableCell>{getAgingBadge(bill.agingBucket)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-xs" onClick={() => router.push(`/payables/bills/${bill.id}`)}>
                            <Eye className="h-3.5 w-3.5 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs" onClick={() => router.push(`/reconciliation`)}>
                            <Link2 className="h-3.5 w-3.5 mr-2" />
                            Record Payment
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

      {/* Duplicate Management Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Duplicate Bills Found
            </DialogTitle>
            <DialogDescription>
              Found {totalDuplicates} duplicate bill{totalDuplicates !== 1 ? 's' : ''} in {duplicateGroups.length} group{duplicateGroups.length !== 1 ? 's' : ''}. 
              You can remove duplicates while keeping the oldest version of each.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {duplicateGroups.map((group, idx) => {
              const [docNum, vendor, total] = group.key.split("|");
              return (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {docNum !== "none" ? `#${docNum}` : "No Invoice #"} - {vendor}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(parseFloat(total))} • {group.bills.length} copies
                      </p>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {group.bills.length - 1} duplicate{group.bills.length > 2 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {group.bills
                      .sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0))
                      .map((bill, billIdx) => (
                        <div 
                          key={bill.id} 
                          className={`flex items-center justify-between text-xs p-2 rounded ${
                            billIdx === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"
                          }`}
                        >
                          <span className={billIdx === 0 ? "text-emerald-700" : "text-red-700"}>
                            {billIdx === 0 ? "✓ Keep (oldest)" : "✕ Remove"}: {bill.originalFileName}
                          </span>
                          <span className="text-slate-500">
                            {bill.createdAt?.toDate().toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAllDuplicates}
              disabled={deletingDuplicates}
            >
              {deletingDuplicates ? (
                <>Removing...</>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove {totalDuplicates} Duplicate{totalDuplicates !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
