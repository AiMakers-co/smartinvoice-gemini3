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
  Package,
} from "lucide-react";
import { doc, getDoc, deleteDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Invoice, InvoiceLineItem } from "@/types";

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

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) {
      setLoading(false);
      return;
    }

    const loadInvoice = async () => {
      try {
        setLoading(true);
        const invoiceDoc = await getDoc(doc(db, "invoices", id));
        if (invoiceDoc.exists()) {
          const invoiceData = { id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice;
          setInvoice(invoiceData);
          
          // Load line items
          const lineItemsQuery = query(
            collection(db, "invoice_line_items"),
            where("invoiceId", "==", id)
          );
          const lineItemsSnapshot = await getDocs(lineItemsQuery);
          const lineItemsData = lineItemsSnapshot.docs.map(doc => doc.data()) as InvoiceLineItem[];
          setLineItems(lineItemsData);
        }
      } catch (error) {
        console.error("Error loading invoice:", error);
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [user, id]);

  const handleDelete = async () => {
    if (!invoice) return;
    
    if (!confirm(`Delete invoice #${invoice.invoiceNumber}?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "invoices", invoice.id));
      router.push("/invoices/list");
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
          <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full" />
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
            <Button onClick={() => router.push("/invoices/list")} className="mt-4">
              Back to Invoices
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Invoice Details" />

      <div className="flex-1 p-4 overflow-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/invoices/list")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>

        <div className="space-y-4">
          {/* Invoice Header Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{invoice.vendorName || "Unknown Vendor"}</h2>
                    <p className="text-sm text-slate-600">
                      Invoice #{invoice.invoiceNumber}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={invoice.status === "completed" ? "default" : "secondary"}>
                    {invoice.status}
                  </Badge>
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
                  <p className="text-sm font-semibold text-slate-900">{formatDate(invoice.invoiceDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Due Date</p>
                  <p className="text-sm font-semibold text-slate-900">{formatDate(invoice.dueDate)}</p>
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
                  <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Subtotal</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(invoice.subtotal || invoice.total, invoice.currency)}
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
                      {formatDate(invoice.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Line Items Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-slate-600" />
                <CardTitle className="text-base">Line Items ({invoice.lineItemCount || lineItems.length || 0})</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {lineItems.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">
                    {invoice.lineItemCount && invoice.lineItemCount > 0 
                      ? `${invoice.lineItemCount} line items not loaded`
                      : "No line items extracted"
                    }
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs text-right">Qty</TableHead>
                      <TableHead className="text-xs text-right">Unit Price</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-sm">{item.description}</TableCell>
                        <TableCell className="text-sm text-right">{item.quantity}</TableCell>
                        <TableCell className="text-sm text-right">
                          {formatCurrency(item.unitPrice, invoice.currency)}
                        </TableCell>
                        <TableCell className="text-sm text-right font-semibold">
                          {formatCurrency(item.amount, invoice.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Additional Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Additional Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {invoice.customerName && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Bill To</p>
                    <p className="text-sm text-slate-900">{invoice.customerName}</p>
                    {invoice.customerAddress && (
                      <p className="text-xs text-slate-600 mt-0.5">{invoice.customerAddress}</p>
                    )}
                  </div>
                )}
                {invoice.purchaseOrder && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Purchase Order</p>
                    <p className="text-sm text-slate-900">{invoice.purchaseOrder}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">File</p>
                  <p className="text-sm text-slate-900">{invoice.originalFileName}</p>
                  <p className="text-xs text-slate-500">{invoice.pageCount} page{invoice.pageCount !== 1 ? "s" : ""}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Processing</p>
                  <p className="text-sm text-slate-900">{invoice.processingTimeMs || 0}ms</p>
                </div>
              </div>

              {/* Warnings */}
              {invoice.warnings && invoice.warnings.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Warnings
                  </p>
                  <ul className="space-y-1">
                    {invoice.warnings.map((warning, index) => (
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
