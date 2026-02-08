"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  ArrowRight,
  X,
  Sparkles,
  Receipt,
  Trash2,
  Eye,
  XCircle,
  FileSpreadsheet,
  Table,
} from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { storage, functions } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// ============================================
// TYPES
// ============================================

type FileStatus = "pending" | "uploading" | "scanning" | "saving" | "completed" | "failed";

interface FileUploadState {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  error: string | null;
  result: InvoiceScanResult | null;
  invoiceId: string | null;
}

interface InvoiceScanResult {
  vendorName: string;
  vendorAddress?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
  currency: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    confidence: number;
  }>;
  // For CSV files with multiple invoices
  invoices?: Array<Record<string, any>>;
  summary?: {
    totalRows?: number;
    totalInvoices?: number;
    totalAmount?: number;
    currencies?: string[];
    vendors?: string[];
  };
  documentStructure?: string;
  confidence: number;
  warnings: string[];
  pageCount: number;
  inputTokens: number;
  outputTokens: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getCurrencySymbol = (currencyCode: string): string => {
  const symbols: Record<string, string> = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'AUD': 'A$', 'CAD': 'C$',
    'CHF': 'Fr', 'AWG': 'Afl.', 'NZD': 'NZ$', 'SGD': 'S$', 'HKD': 'HK$',
  };
  return symbols[currencyCode?.toUpperCase()] || currencyCode || '$';
};

const formatCurrency = (amount: number, currencyCode: string): string => {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${amount.toFixed(2)}`;
};

const generateId = () => Math.random().toString(36).substring(2, 15);

// ============================================
// FILE ROW COMPONENT
// ============================================

function FileRow({
  fileState,
  onRemove,
  onRetry,
  onView,
}: {
  fileState: FileUploadState;
  onRemove: () => void;
  onRetry: () => void;
  onView: () => void;
}) {
  const { file, status, progress, error, result } = fileState;

  const statusConfig: Record<FileStatus, { color: string; icon: React.ReactNode; label: string }> = {
    pending: { color: "bg-slate-100 text-slate-600", icon: <FileText className="h-3 w-3" />, label: "Pending" },
    uploading: { color: "bg-blue-100 text-blue-600", icon: <Loader2 className="h-3 w-3 animate-spin" />, label: "Uploading" },
    scanning: { color: "bg-purple-100 text-purple-600", icon: <Loader2 className="h-3 w-3 animate-spin" />, label: "Scanning" },
    saving: { color: "bg-amber-100 text-amber-600", icon: <Loader2 className="h-3 w-3 animate-spin" />, label: "Saving" },
    completed: { color: "bg-green-100 text-green-600", icon: <CheckCircle2 className="h-3 w-3" />, label: "Completed" },
    failed: { color: "bg-red-100 text-red-600", icon: <XCircle className="h-3 w-3" />, label: "Failed" },
  };

  const config = statusConfig[status];
  const isProcessing = ["uploading", "scanning", "saving"].includes(status);

  // Determine file icon based on extension
  const getFileIcon = () => {
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext === "csv") return <Table className="h-5 w-5 text-green-600" />;
    if (ext === "xlsx" || ext === "xls") return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
    return <FileText className="h-5 w-5 text-slate-500" />;
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white border rounded-lg">
      {/* File Icon */}
      <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        {getFileIcon()}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</span>
          {result && (
            <>
              {/* Show invoice count for CSV files with multiple invoices */}
              {result.summary?.totalInvoices && result.summary.totalInvoices > 1 ? (
                <>
                  <span className="text-xs text-slate-300">•</span>
                  <span className="text-xs text-emerald-600 font-medium">
                    {result.summary.totalInvoices} invoices
                  </span>
                  {result.summary.vendors && result.summary.vendors.length > 0 && (
                    <>
                      <span className="text-xs text-slate-300">•</span>
                      <span className="text-xs text-slate-600">
                        {result.summary.vendors.length} vendor{result.summary.vendors.length > 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                  <span className="text-xs text-slate-300">•</span>
                  <span className="text-xs font-medium text-slate-700">
                    {formatCurrency(result.summary.totalAmount || result.total, result.currency)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs text-slate-300">•</span>
                  <span className="text-xs text-slate-600">{result.vendorName}</span>
                  <span className="text-xs text-slate-300">•</span>
                  <span className="text-xs font-medium text-slate-700">
                    {formatCurrency(result.total, result.currency)}
                  </span>
                </>
              )}
            </>
          )}
        </div>
        {isProcessing && (
          <Progress value={progress} className="h-1 mt-2" />
        )}
        {error && (
          <p className="text-xs text-red-600 mt-1 truncate">{error}</p>
        )}
      </div>

      {/* Status Badge */}
      <Badge className={`${config.color} text-xs shrink-0`}>
        {config.icon}
        <span className="ml-1">{config.label}</span>
      </Badge>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {status === "completed" && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onView}>
            <Eye className="h-4 w-4" />
          </Button>
        )}
        {status === "failed" && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onRetry}>
            <Sparkles className="h-4 w-4" />
          </Button>
        )}
        {!isProcessing && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function InvoicesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Cloud Functions
  const scanInvoice = async (fileUrl: string, mimeType: string): Promise<InvoiceScanResult> => {
    const fn = httpsCallable(functions, "scanInvoice", { timeout: 180000 });
    const result = await fn({ fileUrl, mimeType });
    return result.data as InvoiceScanResult;
  };

  const saveInvoice = async (scanResult: InvoiceScanResult, fileUrl: string, fileName: string, fileSize: number) => {
    const fn = httpsCallable(functions, "saveInvoice", { timeout: 60000 });
    const result = await fn({ scanResult, fileUrl, fileName, fileSize, createTemplate: true });
    return result.data as { invoiceId: string };
  };

  // Update a file's state
  const updateFile = (id: string, updates: Partial<FileUploadState>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  // Get proper MIME type for a file (browsers sometimes set wrong MIME types)
  const getFileMimeType = (file: File): string => {
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext === "csv") return "text/csv";
    if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (ext === "xls") return "application/vnd.ms-excel";
    return file.type || "application/pdf";
  };

  // Process a single file
  const processFile = async (fileState: FileUploadState) => {
    const { id, file } = fileState;

    try {
      // Upload to storage
      updateFile(id, { status: "uploading", progress: 20 });
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `invoices/${user!.id}/temp/${fileName}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);

      // Scan with AI - use corrected MIME type
      updateFile(id, { status: "scanning", progress: 50 });
      const mimeType = getFileMimeType(file);
      const scanResult = await scanInvoice(fileUrl, mimeType);

      // Save to Firestore
      updateFile(id, { status: "saving", progress: 80, result: scanResult });
      const { invoiceId } = await saveInvoice(scanResult, fileUrl, file.name, file.size);

      // Complete
      updateFile(id, { status: "completed", progress: 100, invoiceId });

    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      updateFile(id, {
        status: "failed",
        progress: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Process all pending files in parallel
  const processAllFiles = async () => {
    const pendingFiles = files.filter(f => f.status === "pending" || f.status === "failed");
    if (pendingFiles.length === 0) return;

    setIsProcessing(true);

    // Reset failed files to pending
    pendingFiles.forEach(f => {
      if (f.status === "failed") {
        updateFile(f.id, { status: "pending", progress: 0, error: null });
      }
    });

    // Process all in parallel
    await Promise.all(pendingFiles.map(f => processFile(f)));

    setIsProcessing(false);
  };

  // Supported file types for invoices
  const SUPPORTED_MIME_TYPES = [
    "application/pdf",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  
  const isFileSupported = (file: File): boolean => {
    // Check MIME type
    if (SUPPORTED_MIME_TYPES.includes(file.type)) return true;
    // Fallback: check extension for CSV files (some browsers report text/plain)
    const ext = file.name.toLowerCase().split(".").pop();
    return ["csv", "xlsx", "xls"].includes(ext || "");
  };

  // Handle file selection
  const handleFilesSelect = useCallback((selectedFiles: FileList | File[]) => {
    const newFiles: FileUploadState[] = Array.from(selectedFiles)
      .filter(file => isFileSupported(file))
      .filter(file => file.size <= 50 * 1024 * 1024)
      .map(file => ({
        id: generateId(),
        file,
        status: "pending" as FileStatus,
        progress: 0,
        error: null,
        result: null,
        invoiceId: null,
      }));

    if (newFiles.length === 0) return;

    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelect(e.dataTransfer.files);
  }, [handleFilesSelect]);

  // Remove a file
  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // Retry a failed file
  const retryFile = (id: string) => {
    const fileState = files.find(f => f.id === id);
    if (fileState) {
      updateFile(id, { status: "pending", progress: 0, error: null });
      processFile(fileState);
    }
  };

  // Clear all completed
  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== "completed"));
  };

  // Stats
  const stats = {
    total: files.length,
    pending: files.filter(f => f.status === "pending").length,
    processing: files.filter(f => ["uploading", "scanning", "saving"].includes(f.status)).length,
    completed: files.filter(f => f.status === "completed").length,
    failed: files.filter(f => f.status === "failed").length,
    totalValue: files
      .filter(f => f.status === "completed" && f.result)
      .reduce((sum, f) => sum + (f.result?.total || 0), 0),
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Invoice Import" />

      <div className="flex-1 p-4 overflow-auto">
        <div className="space-y-4">

          {/* Upload Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Import Invoices</CardTitle>
              <CardDescription className="text-xs">
                Upload multiple PDF invoices at once. They'll be processed in parallel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop Zone */}
              <div
                className={`
                  relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer
                  ${isDragging ? "border-ormandy-red bg-red-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}
                `}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.csv,.xlsx,.xls"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleFilesSelect(e.target.files)}
                />
                
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className={`h-14 w-14 rounded-full flex items-center justify-center transition-colors ${isDragging ? "bg-ormandy-red" : "bg-slate-100"}`}>
                    <Upload className={`h-7 w-7 ${isDragging ? "text-white" : "text-slate-500"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Drop invoice files here</p>
                    <p className="text-xs text-slate-500 mt-0.5">PDF, CSV, or Excel • Multiple files supported</p>
                  </div>
                </div>
              </div>

              {/* Info Row */}
              <div className="grid gap-3 md:grid-cols-4">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                  <Receipt className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-600">PDF invoices</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                  <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-600">CSV & Excel</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                  <Sparkles className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-600">AI-powered extraction</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-600">Auto vendor detection</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* File Queue */}
          {files.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Upload Queue</CardTitle>
                  <div className="flex items-center gap-2">
                    {stats.completed > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearCompleted} className="text-xs h-7">
                        Clear Completed
                      </Button>
                    )}
                    {(stats.pending > 0 || stats.failed > 0) && !isProcessing && (
                      <Button size="sm" onClick={processAllFiles} className="h-7">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Process {stats.pending + stats.failed} Files
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stats Bar */}
                <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">Total:</span>
                    <span className="text-xs font-medium">{stats.total}</span>
                  </div>
                  {stats.processing > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                      <span className="text-xs text-blue-600">{stats.processing} processing</span>
                    </div>
                  )}
                  {stats.completed > 0 && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      <span className="text-xs text-green-600">{stats.completed} completed</span>
                    </div>
                  )}
                  {stats.failed > 0 && (
                    <div className="flex items-center gap-1.5">
                      <XCircle className="h-3 w-3 text-red-600" />
                      <span className="text-xs text-red-600">{stats.failed} failed</span>
                    </div>
                  )}
                  {stats.totalValue > 0 && (
                    <div className="ml-auto flex items-center gap-1.5">
                      <span className="text-xs text-slate-500">Total Value:</span>
                      <span className="text-sm font-semibold text-slate-900">
                        ${stats.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                {/* File List */}
                <div className="space-y-2">
                  {files.map(fileState => (
                    <FileRow
                      key={fileState.id}
                      fileState={fileState}
                      onRemove={() => removeFile(fileState.id)}
                      onRetry={() => retryFile(fileState.id)}
                      onView={() => router.push(`/invoices/${fileState.invoiceId}`)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          {stats.completed > 0 && (
            <div className="flex justify-center">
              <Button onClick={() => router.push("/invoices/list")}>
                View All Invoices
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Sample Preview - Show when no files */}
          {files.length === 0 && (
            <Card className="opacity-60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">What to Expect</CardTitle>
                <CardDescription className="text-xs">
                  Here's what processed invoices look like after upload
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Sample Stats Bar */}
                <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">Total:</span>
                    <span className="text-xs font-medium">3</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    <span className="text-xs text-green-600">3 completed</span>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">Total Value:</span>
                    <span className="text-sm font-semibold text-slate-900">$12,450.00</span>
                  </div>
                </div>

                {/* Sample File Rows */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">invoice_acme_corp_dec.pdf</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">156 KB</span>
                        <span className="text-xs text-slate-300">•</span>
                        <span className="text-xs text-slate-600">Acme Corporation</span>
                        <span className="text-xs text-slate-300">•</span>
                        <span className="text-xs font-medium text-slate-700">$4,250.00</span>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-600 text-xs shrink-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">aws_monthly_services.pdf</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">89 KB</span>
                        <span className="text-xs text-slate-300">•</span>
                        <span className="text-xs text-slate-600">Amazon Web Services</span>
                        <span className="text-xs text-slate-300">•</span>
                        <span className="text-xs font-medium text-slate-700">$342.50</span>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-600 text-xs shrink-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-white border rounded-lg">
                    <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">consulting_services_q4.pdf</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">234 KB</span>
                        <span className="text-xs text-slate-300">•</span>
                        <span className="text-xs text-slate-600">Smith & Associates</span>
                        <span className="text-xs text-slate-300">•</span>
                        <span className="text-xs font-medium text-slate-700">$7,857.50</span>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-600 text-xs shrink-0">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
