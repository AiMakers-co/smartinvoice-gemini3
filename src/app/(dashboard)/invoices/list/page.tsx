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
  CheckCircle,
  Clock,
  XCircle,
  User,
  Hash,
  Plus,
  ArrowUpDown,
} from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Invoice } from "@/types";

// ============================================
// STATUS CONFIG
// ============================================

const statusConfig = {
  uploading: { label: "Uploading", icon: Clock, color: "text-slate-600 bg-slate-50" },
  scanning: { label: "Scanning", icon: Clock, color: "text-blue-600 bg-blue-50" },
  processing: { label: "Processing", icon: Clock, color: "text-blue-600 bg-blue-50" },
  completed: { label: "Completed", icon: CheckCircle, color: "text-green-600 bg-green-50" },
  needs_review: { label: "Needs Review", icon: AlertCircle, color: "text-amber-600 bg-amber-50" },
  failed: { label: "Failed", icon: XCircle, color: "text-red-600 bg-red-50" },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Get currency symbol from currency code
function getCurrencySymbol(currencyCode: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'Fr',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'PLN': 'zł',
    'CZK': 'Kč',
    'HUF': 'Ft',
    'RON': 'lei',
    'BGN': 'лв',
    'HRK': 'kn',
    'RUB': '₽',
    'TRY': '₺',
    'BRL': 'R$',
    'MXN': '$',
    'ARS': '$',
    'CLP': '$',
    'COP': '$',
    'ZAR': 'R',
    'KRW': '₩',
    'THB': '฿',
    'SGD': 'S$',
    'MYR': 'RM',
    'IDR': 'Rp',
    'PHP': '₱',
    'VND': '₫',
    'NZD': 'NZ$',
    'HKD': 'HK$',
    'TWD': 'NT$',
    'ILS': '₪',
    'SAR': '﷼',
    'AED': 'د.إ',
    'EGP': '£',
    'NGN': '₦',
    'KES': 'KSh',
    'GHS': '₵',
    'MAD': 'د.م.',
    'TND': 'د.ت',
    'PKR': '₨',
    'BDT': '৳',
    'LKR': '₨',
    'NPR': '₨',
    'MMK': 'K',
    'KHR': '៛',
    'LAK': '₭',
    'AWG': 'Afl.',
  };
  return symbols[currencyCode.toUpperCase()] || currencyCode;
}

function formatCurrency(amount: number | undefined | null, currency: string = "USD"): string {
  const symbol = getCurrencySymbol(currency);
  const value = amount ?? 0;
  return `${symbol}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date | Timestamp | undefined): string {
  if (!date) return "Unknown";
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================
// INVOICE TABLE ROW COMPONENT
// ============================================

function InvoiceRow({
  invoice,
  onView,
  onDelete,
}: {
  invoice: Invoice;
  onView: () => void;
  onDelete: () => void;
}) {
  const statusInfo = statusConfig[invoice.status as keyof typeof statusConfig] || statusConfig.uploading;
  const StatusIcon = statusInfo.icon;

  return (
    <tr className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
      {/* Invoice Number & File */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-purple-100 flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-900">
              #{invoice.invoiceNumber}
            </p>
            <p className="text-xs text-slate-500 truncate max-w-xs">
              {invoice.originalFileName}
            </p>
          </div>
        </div>
      </td>

      {/* Vendor */}
      <td className="px-4 py-3">
        <p className="font-medium text-sm text-slate-900 truncate max-w-xs">
          {invoice.vendorName}
        </p>
        {invoice.vendorTaxId && (
          <p className="text-xs text-slate-500">Tax ID: {invoice.vendorTaxId}</p>
        )}
      </td>

      {/* Invoice Date */}
      <td className="px-4 py-3">
        <p className="text-sm text-slate-900">
          {formatDate(invoice.invoiceDate)}
        </p>
      </td>

      {/* Due Date */}
      <td className="px-4 py-3">
        <p className="text-sm text-slate-900">
          {invoice.dueDate ? formatDate(invoice.dueDate) : "-"}
        </p>
      </td>

      {/* Line Items */}
      <td className="px-4 py-3 text-center">
        <p className="text-sm font-medium text-slate-900">{invoice.lineItemCount || 0}</p>
      </td>

      {/* Amount */}
      <td className="px-4 py-3 text-right">
        <p className="text-sm font-bold text-slate-900">
          {formatCurrency(invoice.total, invoice.currency)}
        </p>
        {invoice.taxAmount != null && invoice.taxAmount > 0 && (
          <p className="text-xs text-slate-500">
            +{formatCurrency(invoice.taxAmount, invoice.currency)} tax
          </p>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge variant="secondary" className={`${statusInfo.color} text-xs`}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {statusInfo.label}
        </Badge>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onView}
            className="h-8 w-8 p-0"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(invoice.fileUrl, "_blank")}
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
// VENDOR GROUP TABLE COMPONENT
// ============================================

function VendorTable({
  vendorName,
  invoices,
  onView,
  onDelete,
}: {
  vendorName: string;
  invoices: Invoice[];
  onView: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const primaryCurrency = invoices[0]?.currency || "AWG";

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
          <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-purple-600" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-900">{vendorName}</p>
            <p className="text-sm text-slate-600">
              {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"} • {formatCurrency(totalAmount, primaryCurrency)}
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
          {invoices.length}
        </Badge>
      </button>

      {/* Table */}
      {isExpanded && (
        <div className="border-t border-slate-200">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Invoice Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {invoices.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  onView={() => onView(invoice)}
                  onDelete={() => onDelete(invoice)}
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

function InvoicesEmptyState({ onUpload }: { onUpload: () => void }) {
  // Sample invoices - realistic for mid-size US business with multi-currency
  const sampleInvoices: Invoice[] = [
    {
      id: "sample-1",
      userId: "sample",
      invoiceNumber: "INV-2024-0892",
      vendorName: "Amazon Web Services",
      vendorAddress: "410 Terry Ave N, Seattle, WA 98109",
      vendorTaxId: "US-911653725",
      invoiceDate: new Date("2024-12-15") as unknown as Timestamp,
      dueDate: new Date("2025-01-15") as unknown as Timestamp,
      total: 3842.50,
      subtotal: 3584.11,
      taxAmount: 258.39,
      currency: "USD",
      status: "completed",
      lineItemCount: 12,
      fileName: "aws_invoice_dec_2024.pdf",
      originalFileName: "aws_invoice_dec_2024.pdf",
      fileUrl: "#",
      fileSize: 256000,
      fileType: "pdf",
      pageCount: 4,
      createdAt: new Date() as unknown as Timestamp,
      confidence: 0.98,
      needsReview: false,
      warnings: [],
      inputTokens: 1800,
      outputTokens: 650,
      processingTimeMs: 2800,
      reconciliationStatus: "matched",
    },
    {
      id: "sample-2",
      userId: "sample",
      invoiceNumber: "INV-2024-0891",
      vendorName: "Amazon Web Services",
      vendorAddress: "410 Terry Ave N, Seattle, WA 98109",
      vendorTaxId: "US-911653725",
      invoiceDate: new Date("2024-11-15") as unknown as Timestamp,
      dueDate: new Date("2024-12-15") as unknown as Timestamp,
      total: 3156.80,
      subtotal: 2943.74,
      taxAmount: 213.06,
      currency: "USD",
      status: "completed",
      lineItemCount: 11,
      fileName: "aws_invoice_nov_2024.pdf",
      originalFileName: "aws_invoice_nov_2024.pdf",
      fileUrl: "#",
      fileSize: 242000,
      fileType: "pdf",
      pageCount: 4,
      createdAt: new Date() as unknown as Timestamp,
      confidence: 0.97,
      needsReview: false,
      warnings: [],
      inputTokens: 1750,
      outputTokens: 620,
      processingTimeMs: 2600,
      reconciliationStatus: "matched",
    },
    {
      id: "sample-3",
      userId: "sample",
      invoiceNumber: "RE-2024-12847",
      vendorName: "SAP SE",
      vendorAddress: "Dietmar-Hopp-Allee 16, 69190 Walldorf, Germany",
      vendorTaxId: "DE143450894",
      invoiceDate: new Date("2024-12-01") as unknown as Timestamp,
      dueDate: new Date("2025-01-01") as unknown as Timestamp,
      total: 4200.00,
      subtotal: 3529.41,
      taxAmount: 670.59,
      currency: "EUR",
      status: "completed",
      lineItemCount: 3,
      fileName: "sap_enterprise_q4.pdf",
      originalFileName: "sap_enterprise_q4.pdf",
      fileUrl: "#",
      fileSize: 189000,
      fileType: "pdf",
      pageCount: 2,
      createdAt: new Date() as unknown as Timestamp,
      confidence: 0.94,
      needsReview: false,
      warnings: [],
      inputTokens: 1200,
      outputTokens: 420,
      processingTimeMs: 2100,
      reconciliationStatus: "unmatched",
    },
    {
      id: "sample-4",
      userId: "sample",
      invoiceNumber: "INV-78234",
      vendorName: "Salesforce Inc",
      vendorAddress: "415 Mission Street, San Francisco, CA 94105",
      vendorTaxId: "US-943463073",
      invoiceDate: new Date("2024-12-10") as unknown as Timestamp,
      dueDate: new Date("2025-01-10") as unknown as Timestamp,
      total: 2400.00,
      subtotal: 2400.00,
      taxAmount: 0,
      currency: "USD",
      status: "completed",
      lineItemCount: 2,
      fileName: "salesforce_crm_annual.pdf",
      originalFileName: "salesforce_crm_annual.pdf",
      fileUrl: "#",
      fileSize: 112000,
      fileType: "pdf",
      pageCount: 2,
      createdAt: new Date() as unknown as Timestamp,
      confidence: 0.96,
      needsReview: false,
      warnings: [],
      inputTokens: 900,
      outputTokens: 380,
      processingTimeMs: 1900,
      reconciliationStatus: "matched",
    },
    {
      id: "sample-5",
      userId: "sample",
      invoiceNumber: "INV-CA-2024-456",
      vendorName: "Shopify Inc",
      vendorAddress: "150 Elgin Street, Ottawa, ON K2P 1L4, Canada",
      vendorTaxId: "CA-BN123456789",
      invoiceDate: new Date("2024-12-05") as unknown as Timestamp,
      dueDate: new Date("2025-01-05") as unknown as Timestamp,
      total: 1850.00,
      subtotal: 1637.17,
      taxAmount: 212.83,
      currency: "CAD",
      status: "completed",
      lineItemCount: 4,
      fileName: "shopify_plus_dec.pdf",
      originalFileName: "shopify_plus_dec.pdf",
      fileUrl: "#",
      fileSize: 98000,
      fileType: "pdf",
      pageCount: 2,
      createdAt: new Date() as unknown as Timestamp,
      confidence: 0.95,
      needsReview: false,
      warnings: [],
      inputTokens: 1100,
      outputTokens: 440,
      processingTimeMs: 2200,
      reconciliationStatus: "unmatched",
    },
    {
      id: "sample-6",
      userId: "sample",
      invoiceNumber: "INV-2024-7821",
      vendorName: "ADP LLC",
      vendorAddress: "One ADP Boulevard, Roseland, NJ 07068",
      vendorTaxId: "US-221549141",
      invoiceDate: new Date("2024-12-20") as unknown as Timestamp,
      dueDate: new Date("2025-01-05") as unknown as Timestamp,
      total: 1245.00,
      subtotal: 1245.00,
      taxAmount: 0,
      currency: "USD",
      status: "completed",
      lineItemCount: 5,
      fileName: "adp_payroll_services.pdf",
      originalFileName: "adp_payroll_services.pdf",
      fileUrl: "#",
      fileSize: 145000,
      fileType: "pdf",
      pageCount: 3,
      createdAt: new Date() as unknown as Timestamp,
      confidence: 0.97,
      needsReview: false,
      warnings: [],
      inputTokens: 1400,
      outputTokens: 520,
      processingTimeMs: 2400,
      reconciliationStatus: "unmatched",
    },
  ];

  // Group sample invoices by vendor
  const groupedByVendor = sampleInvoices.reduce((acc, invoice) => {
    const vendorName = invoice.vendorName || "Unknown Vendor";
    if (!acc[vendorName]) acc[vendorName] = [];
    acc[vendorName].push(invoice);
    return acc;
  }, {} as Record<string, Invoice[]>);

  const totalInvoices = sampleInvoices.length;
  const totalAmount = sampleInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const uniqueVendors = Object.keys(groupedByVendor).length;
  const totalLineItems = sampleInvoices.reduce((sum, inv) => sum + (inv.lineItemCount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Upload Call to Action */}
      <Card className="border-cyan-200 bg-cyan-50">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-cyan-100 text-cyan-600">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-cyan-900">Upload your first invoice</h3>
              <p className="text-sm text-cyan-700">AI extracts vendor details, line items, and amounts automatically.</p>
            </div>
          </div>
          <Button onClick={onUpload} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Upload Invoice
          </Button>
        </CardContent>
      </Card>

      {/* Sample Summary Cards */}
      <div className="grid gap-3 md:grid-cols-4 opacity-60">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <FileText className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Invoices</p>
                <p className="text-lg font-semibold text-slate-900">{totalInvoices}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Value</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatCurrency(totalAmount, "USD")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Unique Vendors</p>
                <p className="text-lg font-semibold text-slate-900">{uniqueVendors}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Hash className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Line Items</p>
                <p className="text-lg font-semibold text-slate-900">{totalLineItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sample Search & Filter */}
      <div className="flex items-center gap-3 opacity-60">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search invoices, vendors..."
            readOnly
            className="pl-8 h-9"
          />
        </div>
        
        <Button variant="outline" size="sm" className="h-9" disabled>
          <Filter className="h-4 w-4 mr-2" />
          Status: All
        </Button>

        <Button variant="outline" size="sm" className="h-9" disabled>
          <ArrowUpDown className="h-4 w-4 mr-2" />
          Sort: Date
        </Button>

        <Button size="sm" asChild className="h-9" disabled>
          <span>
            <Plus className="h-4 w-4 mr-2" />
            Upload Invoice
          </span>
        </Button>
      </div>

      {/* Sample Vendor-Grouped Tables */}
      <div className="opacity-60">
        {Object.entries(groupedByVendor).map(([vendorName, vendorInvoices]) => (
          <VendorTable
            key={vendorName}
            vendorName={vendorName}
            invoices={vendorInvoices}
            onView={() => {}}
            onDelete={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function InvoicesListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "vendor">("date");

  // Load invoices
  useEffect(() => {
    if (!user) return;

    const invoicesQuery = query(
      collection(db, "invoices"),
      where("userId", "==", user.id),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(invoicesQuery, (snapshot) => {
      const invoicesData = snapshot.docs.map((doc) => {
        const data = doc.data();
        console.log(`[Invoice ${doc.id}] total:`, data.total, 'lineItemCount:', data.lineItemCount, 'currency:', data.currency);
        return {
          id: doc.id,
          ...data,
        };
      }) as Invoice[];

      setInvoices(invoicesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Filter invoices
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      searchQuery === "" ||
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.originalFileName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === "all" || invoice.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Sort invoices
  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    switch (sortBy) {
      case "amount":
        return (b.total || 0) - (a.total || 0);
      case "vendor":
        return a.vendorName.localeCompare(b.vendorName);
      case "date":
      default:
        const dateA = a.invoiceDate instanceof Timestamp ? a.invoiceDate.toMillis() : 0;
        const dateB = b.invoiceDate instanceof Timestamp ? b.invoiceDate.toMillis() : 0;
        return dateB - dateA;
    }
  });

  // Group by vendor
  const groupedByVendor = sortedInvoices.reduce((acc, invoice) => {
    const vendorName = invoice.vendorName || "Unknown Vendor";
    if (!acc[vendorName]) acc[vendorName] = [];
    acc[vendorName].push(invoice);
    return acc;
  }, {} as Record<string, Invoice[]>);

  // Handlers
  const handleView = (invoice: Invoice) => {
    router.push(`/invoices/${invoice.id}`);
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(`Delete invoice #${invoice.invoiceNumber}?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "invoices", invoice.id));
    } catch (error) {
      console.error("Error deleting invoice:", error);
      alert("Failed to delete invoice. Please try again.");
    }
  };

  // Stats
  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const uniqueVendors = Object.keys(groupedByVendor).length;
  const totalLineItems = invoices.reduce((sum, inv) => sum + (inv.lineItemCount || 0), 0);

  // Currency breakdown
  const currencyTotals = invoices.reduce((acc, inv) => {
    const currency = inv.currency || "AWG";
    acc[currency] = (acc[currency] || 0) + (inv.total || 0);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Invoice Management" />

      <div className="flex-1 p-4 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : invoices.length === 0 ? (
          <InvoicesEmptyState onUpload={() => router.push("/invoices")} />
        ) : (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid gap-3 md:grid-cols-4">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Total Invoices</p>
                      <p className="text-lg font-semibold text-slate-900">{totalInvoices}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Total Value</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {Object.keys(currencyTotals).length === 1 
                          ? formatCurrency(totalAmount, Object.keys(currencyTotals)[0])
                          : `${Object.keys(currencyTotals).length} curr.`
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Unique Vendors</p>
                      <p className="text-lg font-semibold text-slate-900">{uniqueVendors}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Hash className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Total Line Items</p>
                      <p className="text-lg font-semibold text-slate-900">{totalLineItems}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Multi-Currency Breakdown */}
            {Object.keys(currencyTotals).length > 1 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Currency Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
                    {Object.entries(currencyTotals)
                      .sort((a, b) => b[1] - a[1])
                      .map(([currency, amount]) => (
                        <div key={currency} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border">
                          <div>
                            <p className="text-xs text-slate-600 font-medium">{currency}</p>
                            <p className="text-sm font-bold text-slate-900">
                              {formatCurrency(amount, currency)}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {invoices.filter(inv => inv.currency === currency).length}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search, Filter & Sort */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search invoices, vendors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <Filter className="h-4 w-4 mr-2" />
                    Status: {filterStatus === "all" ? "All" : statusConfig[filterStatus as keyof typeof statusConfig]?.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => setFilterStatus("all")}>
                    All Invoices
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <DropdownMenuItem key={key} onClick={() => setFilterStatus(key)}>
                      <config.icon className="h-4 w-4 mr-2" />
                      {config.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    Sort: {sortBy === "date" ? "Date" : sortBy === "amount" ? "Amount" : "Vendor"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => setSortBy("date")}>
                    <Calendar className="h-4 w-4 mr-2" />
                    By Date
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("amount")}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    By Amount
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("vendor")}>
                    <Building2 className="h-4 w-4 mr-2" />
                    By Vendor
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button size="sm" asChild className="h-9">
                <a href="/invoices">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Invoice
                </a>
              </Button>
            </div>

            {/* Vendor-Grouped Tables */}
            {Object.keys(groupedByVendor).length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-500">No invoices match your filters</p>
              </div>
            ) : (
              Object.entries(groupedByVendor).map(([vendorName, vendorInvoices]) => (
                <VendorTable
                  key={vendorName}
                  vendorName={vendorName}
                  invoices={vendorInvoices}
                  onView={handleView}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

