"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Download,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  Banknote,
} from "lucide-react";
import { doc, getDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// ============================================
// TYPES
// ============================================

interface Bill {
  id: string;
  userId: string;
  originalFileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  status: string;
  pageCount: number;
  confidence: number;
  documentType: string;
  documentNumber: string;
  vendorName: string;
  vendorAddress?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  customerName?: string;
  customerAddress?: string;
  subject?: string;
  documentDate: Timestamp | Date;
  dueDate?: Timestamp | Date;
  total: number;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  amountRemaining: number;
  currency: string;
  paymentStatus: "unpaid" | "partial" | "paid";
  reconciliationStatus: string;
  bankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
  routingNumber?: string;
  swiftBic?: string;
  iban?: string;
  warnings?: string[];
  createdAt: Timestamp | Date;
  uploadedAt: Timestamp | Date;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatCurrency(amount: number | undefined | null, currency: string = "USD"): string {
  const value = amount ?? 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatDate(timestamp: Timestamp | Date | undefined | null): string {
  if (!timestamp) return "—";
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isOverdue(dueDate: Date | Timestamp | undefined | null, status: string): boolean {
  if (!dueDate || status === "paid") return false;
  const d = dueDate instanceof Timestamp ? dueDate.toDate() : new Date(dueDate);
  return d < new Date();
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

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function BillDetailPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !billId) {
      setLoading(false);
      return;
    }

    const loadBill = async () => {
      try {
        setLoading(true);
        const billDoc = await getDoc(doc(db, "bills", billId));
        if (billDoc.exists()) {
          setBill({ id: billDoc.id, ...billDoc.data() } as Bill);
        }
      } catch (error) {
        console.error("Error loading bill:", error);
      } finally {
        setLoading(false);
      }
    };

    loadBill();
  }, [user, billId]);

  const handleDelete = async () => {
    if (!bill) return;
    
    if (!confirm(`Delete bill "${bill.documentNumber || bill.originalFileName}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "bills", bill.id));
      router.push("/payables/bills");
    } catch (error) {
      console.error("Error deleting bill:", error);
      alert("Failed to delete bill. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Bill Details" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Bill Details" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">Bill not found</p>
            <Button onClick={() => router.push("/payables/bills")} className="mt-4">
              Back to Bills
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const overdue = isOverdue(bill.dueDate, bill.paymentStatus);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Bill Details" />

      <div className="flex-1 p-4 overflow-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/payables/bills")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Bills
        </Button>

        <div className="space-y-4">
          {/* Overdue Warning */}
          {overdue && (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <Clock className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-800">This bill is overdue</p>
                <p className="text-xs text-red-700">Due date was {formatDate(bill.dueDate)}</p>
              </div>
            </div>
          )}

          {/* Bill Header Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{bill.vendorName || "Unknown Vendor"}</h2>
                    <p className="text-sm text-slate-600">
                      {bill.documentNumber ? `#${bill.documentNumber}` : bill.originalFileName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getPaymentStatusBadge(overdue ? "overdue" : bill.paymentStatus)}
                  {bill.fileUrl && (
                    <Button variant="outline" size="sm" onClick={() => window.open(bill.fileUrl, "_blank")}>
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Bill Details Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Amount</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(bill.total, bill.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Bill Date</p>
                  <p className="text-sm font-semibold text-slate-900">{formatDate(bill.documentDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Due Date</p>
                  <p className={`text-sm font-semibold ${overdue ? "text-red-600" : "text-slate-900"}`}>
                    {formatDate(bill.dueDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Currency</p>
                  <p className="text-sm font-semibold text-slate-900">{bill.currency}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards Row */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Amount Due</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(bill.amountRemaining ?? bill.total, bill.currency)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Confidence</p>
                    <p className="text-lg font-bold text-slate-900">
                      {((bill.confidence || 0) * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Uploaded</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatDate(bill.uploadedAt || bill.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Details Card (if bank info exists) */}
          {(bill.bankName || bill.accountNumber || bill.iban) && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-slate-600" />
                  <CardTitle className="text-base">Payment Details</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {bill.bankName && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Bank</p>
                      <p className="text-sm font-semibold text-slate-900">{bill.bankName}</p>
                    </div>
                  )}
                  {bill.accountHolderName && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Account Holder</p>
                      <p className="text-sm font-semibold text-slate-900">{bill.accountHolderName}</p>
                    </div>
                  )}
                  {bill.accountNumber && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Account #</p>
                      <p className="text-sm font-mono font-semibold text-slate-900">{bill.accountNumber}</p>
                    </div>
                  )}
                  {bill.routingNumber && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Routing #</p>
                      <p className="text-sm font-mono font-semibold text-slate-900">{bill.routingNumber}</p>
                    </div>
                  )}
                  {bill.swiftBic && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">SWIFT/BIC</p>
                      <p className="text-sm font-mono font-semibold text-slate-900">{bill.swiftBic}</p>
                    </div>
                  )}
                  {bill.iban && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">IBAN</p>
                      <p className="text-sm font-mono font-semibold text-slate-900">{bill.iban}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Additional Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Additional Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {bill.subject && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Subject</p>
                    <p className="text-sm text-slate-900">{bill.subject}</p>
                  </div>
                )}
                {bill.customerName && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Billed To</p>
                    <p className="text-sm text-slate-900">{bill.customerName}</p>
                    {bill.customerAddress && (
                      <p className="text-xs text-slate-600 mt-0.5">{bill.customerAddress}</p>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">File</p>
                  <p className="text-sm text-slate-900">{bill.originalFileName}</p>
                  <p className="text-xs text-slate-500">{bill.pageCount} page{bill.pageCount !== 1 ? "s" : ""}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Status</p>
                  <Badge variant="secondary">{bill.status}</Badge>
                </div>
              </div>

              {/* Warnings */}
              {bill.warnings && bill.warnings.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Warnings
                  </p>
                  <ul className="space-y-1">
                    {bill.warnings.map((warning, index) => (
                      <li key={index} className="text-xs text-amber-800">• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
