"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
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

interface Invoice {
  id: string;
  userId: string;
  originalFileName?: string;
  sourceFileName?: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  mimeType?: string;
  status: string;
  pageCount?: number;
  confidence?: number;
  documentType?: string;
  documentNumber?: string;
  invoiceNumber?: string;
  vendorName?: string;
  vendorAddress?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  customerName?: string;
  customerAddress?: string;
  subject?: string;
  description?: string;
  purchaseOrder?: string;
  documentDate?: Timestamp | Date;
  invoiceDate?: Timestamp | Date;
  dueDate?: Timestamp | Date;
  total: number;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  amountDue?: number;
  amountRemaining?: number;
  amountPaid?: number;
  currency: string;
  paymentStatus?: "unpaid" | "partial" | "paid";
  lineItemCount?: number;
  lineItems?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    amount: number;
  }>;
  warnings?: string[];
  createdAt?: Timestamp | Date;
  processedAt?: Timestamp | Date;
  uploadedAt?: Timestamp | Date;
  // Import metadata
  importedFromFile?: boolean;
  sourceRowIndex?: number;
  additionalFields?: Record<string, any>;
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

function isOverdue(dueDate: Date | Timestamp | undefined | null, status?: string): boolean {
  if (!dueDate || status === "paid") return false;
  const d = dueDate instanceof Timestamp ? dueDate.toDate() : new Date(dueDate);
  return d < new Date();
}

function getPaymentStatusBadge(status?: string, overdue?: boolean) {
  if (overdue) {
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Overdue</Badge>;
  }
  switch (status) {
    case "paid":
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Paid</Badge>;
    case "partial":
      return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Partial</Badge>;
    default:
      return <Badge variant="secondary">Unpaid</Badge>;
  }
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function ReceivablesInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !invoiceId) {
      setLoading(false);
      return;
    }

    const loadInvoice = async () => {
      try {
        setLoading(true);
        const invoiceDoc = await getDoc(doc(db, "invoices", invoiceId));
        if (invoiceDoc.exists()) {
          setInvoice({ id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice);
        }
      } catch (error) {
        console.error("Error loading invoice:", error);
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [user, invoiceId]);

  const handleDelete = async () => {
    if (!invoice) return;
    
    const invoiceNum = invoice.invoiceNumber || invoice.documentNumber || invoice.originalFileName;
    if (!confirm(`Delete invoice "${invoiceNum}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "invoices", invoice.id));
      router.push("/receivables/invoices");
    } catch (error) {
      console.error("Error deleting invoice:", error);
      alert("Failed to delete invoice. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Invoice Details" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Invoice Details" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">Invoice not found</p>
            <Button onClick={() => router.push("/receivables/invoices")} className="mt-4">
              Back to Invoices
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const invoiceDate = invoice.invoiceDate || invoice.documentDate;
  const invoiceNum = invoice.invoiceNumber || invoice.documentNumber;
  const overdue = isOverdue(invoice.dueDate, invoice.paymentStatus);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Invoice Details" />

      <div className="flex-1 p-4 overflow-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/receivables/invoices")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>

        <div className="space-y-4">
          {/* Overdue Warning */}
          {overdue && (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <Clock className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-800">This invoice is overdue</p>
                <p className="text-xs text-red-700">Due date was {formatDate(invoice.dueDate)}</p>
              </div>
            </div>
          )}

          {/* Invoice Header Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{invoice.customerName || invoice.vendorName || "Unknown"}</h2>
                    <p className="text-sm text-slate-600">
                      {invoiceNum ? `Invoice #${invoiceNum}` : invoice.originalFileName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getPaymentStatusBadge(invoice.paymentStatus, overdue)}
                  {invoice.fileUrl && (
                    <Button variant="outline" size="sm" onClick={() => window.open(invoice.fileUrl, "_blank")}>
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

              {/* Invoice Details Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Amount</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(invoice.total, invoice.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Invoice Date</p>
                  <p className="text-sm font-semibold text-slate-900">{formatDate(invoiceDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Due Date</p>
                  <p className={`text-sm font-semibold ${overdue ? "text-red-600" : "text-slate-900"}`}>
                    {formatDate(invoice.dueDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Currency</p>
                  <p className="text-sm font-semibold text-slate-900">{invoice.currency}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards Row */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Amount Due</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(invoice.amountRemaining ?? invoice.total, invoice.currency)}
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
                      {((invoice.confidence || 0) * 100).toFixed(0)}%
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
                      {formatDate(invoice.uploadedAt || invoice.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Breakdown Card */}
          {(invoice.subtotal || invoice.taxAmount) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Financial Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {invoice.subtotal !== undefined && invoice.subtotal !== null && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-600">Subtotal</span>
                      <span className="text-sm font-medium">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                    </div>
                  )}
                  {invoice.taxAmount !== undefined && invoice.taxAmount !== null && (
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-600">
                        Tax {invoice.taxRate ? `(${invoice.taxRate}%)` : ""}
                      </span>
                      <span className="text-sm font-medium">{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2 pt-3">
                    <span className="text-sm font-semibold text-slate-900">Total</span>
                    <span className="text-lg font-bold text-slate-900">{formatCurrency(invoice.total, invoice.currency)}</span>
                  </div>
                  {(invoice.amountPaid ?? 0) > 0 && (
                    <>
                      <div className="flex justify-between items-center py-2 border-t border-slate-200">
                        <span className="text-sm text-emerald-600">Amount Paid</span>
                        <span className="text-sm font-medium text-emerald-600">
                          -{formatCurrency(invoice.amountPaid, invoice.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 bg-slate-50 -mx-6 px-6 rounded">
                        <span className="text-sm font-semibold text-slate-900">Balance Due</span>
                        <span className="text-lg font-bold text-slate-900">
                          {formatCurrency(invoice.amountDue ?? invoice.amountRemaining ?? invoice.total, invoice.currency)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Description/Notes Card */}
          {(invoice.description || invoice.subject || invoice.purchaseOrder) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description & Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {invoice.description && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Description</p>
                      <p className="text-sm text-slate-900">{invoice.description}</p>
                    </div>
                  )}
                  {invoice.subject && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Subject</p>
                      <p className="text-sm text-slate-900">{invoice.subject}</p>
                    </div>
                  )}
                  {invoice.purchaseOrder && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Purchase Order</p>
                      <p className="text-sm text-slate-900 font-mono">{invoice.purchaseOrder}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Line Items Card */}
          {invoice.lineItems && invoice.lineItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Line Items ({invoice.lineItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {invoice.lineItems.map((item, index) => (
                    <div key={index} className="flex justify-between items-start py-2 border-b border-slate-100 last:border-0">
                      <div className="flex-1">
                        <p className="text-sm text-slate-900">{item.description}</p>
                        {item.quantity && item.unitPrice && (
                          <p className="text-xs text-slate-500">
                            {item.quantity} × {formatCurrency(item.unitPrice, invoice.currency)}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-900 ml-4">
                        {formatCurrency(item.amount, invoice.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Customer/Vendor Info Card */}
          {(invoice.customerName || invoice.vendorName) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Parties</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {invoice.customerName && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Customer (Bill To)</p>
                      <p className="text-sm font-medium text-slate-900">{invoice.customerName}</p>
                      {invoice.customerAddress && (
                        <p className="text-xs text-slate-600 mt-1">{invoice.customerAddress}</p>
                      )}
                    </div>
                  )}
                  {invoice.vendorName && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Vendor (From)</p>
                      <p className="text-sm font-medium text-slate-900">{invoice.vendorName}</p>
                      {invoice.vendorAddress && (
                        <p className="text-xs text-slate-600 mt-1">{invoice.vendorAddress}</p>
                      )}
                      {invoice.vendorEmail && (
                        <p className="text-xs text-slate-600">{invoice.vendorEmail}</p>
                      )}
                      {invoice.vendorPhone && (
                        <p className="text-xs text-slate-600">{invoice.vendorPhone}</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Source/Import Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Source Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(invoice.originalFileName || invoice.sourceFileName) && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Source File</p>
                    <p className="text-sm text-slate-900 break-all">
                      {decodeURIComponent(invoice.originalFileName || invoice.sourceFileName || "").split("/").pop()}
                    </p>
                    {invoice.pageCount && (
                      <p className="text-xs text-slate-500">{invoice.pageCount} page{invoice.pageCount !== 1 ? "s" : ""}</p>
                    )}
                  </div>
                )}
                {invoice.importedFromFile && invoice.sourceRowIndex !== undefined && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Row in Source File</p>
                    <p className="text-sm text-slate-900 font-mono">Row {invoice.sourceRowIndex + 1}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Processing Status</p>
                  <Badge variant="secondary">{invoice.status}</Badge>
                </div>
                {invoice.confidence !== undefined && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Extraction Confidence</p>
                    <p className="text-sm text-slate-900">{((invoice.confidence || 0) * 100).toFixed(0)}%</p>
                  </div>
                )}
                {invoice.processedAt && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Processed</p>
                    <p className="text-sm text-slate-900">{formatDate(invoice.processedAt)}</p>
                  </div>
                )}
                {invoice.createdAt && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Created</p>
                    <p className="text-sm text-slate-900">{formatDate(invoice.createdAt)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Additional Fields Card (for any extra data from import) */}
          {invoice.additionalFields && Object.keys(invoice.additionalFields).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Additional Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(invoice.additionalFields).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                        {key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())}
                      </p>
                      <p className="text-sm text-slate-900">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warnings */}
          {invoice.warnings && invoice.warnings.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Warnings
                </p>
                <ul className="space-y-1">
                  {invoice.warnings.map((warning, index) => (
                    <li key={index} className="text-xs text-amber-800">• {warning}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
