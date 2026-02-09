"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { collection, addDoc, serverTimestamp, Timestamp, query, where, getDocs, updateDoc, doc, writeBatch } from "firebase/firestore";
import { db, storage, functions } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag, FieldTag } from "@/components/ui/tag";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  Receipt,
  Building2,
  Sparkles,
  FileCheck,
  AlertCircle,
  Eye,
  ArrowLeft,
  Check,
  List,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Files,
  FileSpreadsheet,
  Terminal,
  Search,
  Brain,
  Zap,
  FileSearch,
  DollarSign,
  ShieldAlert,
  Ban,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useUsageStatus } from "@/components/ui/usage-warning";
import { useUploadState, FileUploadState as ContextFileUploadState } from "@/hooks/use-upload-state";
import { UpgradePrompt } from "@/components/ui/upgrade-prompt";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

export type DocumentType = "statement" | "invoice" | "bill";
type DrawerStep = "upload" | "identifying" | "confirm_type" | "extracting" | "saving" | "preview" | "complete";

interface IdentifyResult {
  detectedType: "bank_statement" | "invoice" | "bill" | "receipt" | "vendor_list" | "invoice_list" | "payment_record" | "other";
  confidence: number;
  detectedBank?: string;
  detectedVendor?: string;
  detectedCustomer?: string;
  currency?: string;
  pageCount?: number;
  invoiceFrom?: string;   // Company that issued the document
  invoiceTo?: string;     // Company that received / must pay
  reasoning: string;
  suggestions: string[];
  inputTokens: number;
  outputTokens: number;
}

interface SampleTransaction {
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
}

interface CSVParsingRules {
  id?: string;
  bankIdentifier?: string;
  bankDisplayName?: string;
  headerRow?: number;
  dataStartRow?: number;
  dateColumn?: string | number;
  dateFormat?: string;
  descriptionColumn?: string | number;
  amountColumn?: string | number;
  debitColumn?: string | number;
  creditColumn?: string | number;
  balanceColumn?: string | number;
  sampleHeaders?: string[];
  sampleRow?: string[];
}

interface ExtractedData {
  documentNumber?: string;
  customerName?: string;
  vendorName?: string;
  subject?: string;
  total?: number;
  currency?: string;
  documentDate?: string;
  dueDate?: string;
  // Bank/payment details (can appear on invoices too!)
  bankName?: string;
  bankNameRaw?: string;
  bankIdentifier?: string;
  bankCountry?: string;
  needsBankIdentification?: boolean;
  accountNumber?: string;
  accountHolderName?: string;
  routingNumber?: string;
  swiftBic?: string;
  iban?: string;
  // Bank statement specific
  periodStart?: string;
  periodEnd?: string;
  openingBalance?: number;
  closingBalance?: number;
  transactionCount?: number;
  sampleTransactions?: SampleTransaction[];
  // CSV Parsing Rules
  csvParsingRulesId?: string;
  csvParsingRulesStatus?: "existing" | "new" | "none";
  csvParsingRules?: CSVParsingRules;
  // Invoice specific
  lineItems?: Array<{ description: string; amount: number; quantity?: number }>;
  confidence?: number;
  pageCount?: number;
  // AI-detected document type
  detectedType?: "invoice" | "bank_statement" | "receipt" | "expense_report" | "other";
  detectionMessage?: string;
  // CSV/Excel file flag
  isCSV?: boolean;
}

interface UploadDrawerProps {
  defaultType?: DocumentType;
}

// ============================================
// CONFIG - Custom content per document type
// ============================================

const TYPE_CONFIG: Record<DocumentType, {
  label: string;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  icon: React.ComponentType<{ className?: string }>;
  tagVariant: "cyan" | "emerald" | "orange";
  storagePath: string;
  collection: string;
  acceptedTypes: string;
  fileTypes: { label: string; variant: "danger" | "purple" | "success" | "emerald" }[];
  extractedFields: { key: string; label: string }[];
}> = {
  statement: {
    label: "Bank Statement",
    title: "Upload Documents",
    subtitle: "Drop anything — our AI will figure it out",
    description: "Upload statements, invoices, bills, or receipts. AI automatically identifies the document type and extracts the right data.",
    features: [
      "AI identifies document type automatically",
      "Extracts transactions, line items & totals",
      "Supports statements, invoices, bills & more",
    ],
    icon: Building2,
    tagVariant: "cyan",
    storagePath: "statements",
    collection: "statements",
    acceptedTypes: ".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls",
    fileTypes: [
      { label: "PDF", variant: "danger" },
      { label: "PNG", variant: "purple" },
      { label: "JPG", variant: "success" },
      { label: "CSV", variant: "emerald" },
      { label: "Excel", variant: "emerald" },
    ],
    extractedFields: [
      { key: "bankName", label: "Bank" },
      { key: "accountNumber", label: "Account #" },
      { key: "accountHolderName", label: "Account Holder" },
      { key: "currency", label: "Currency" },
      { key: "periodStart", label: "Period Start" },
      { key: "periodEnd", label: "Period End" },
    ],
  },
  invoice: {
    label: "Invoice",
    title: "Upload Invoice",
    subtitle: "Import customer invoices",
    description: "Upload invoices you've sent to customers. We'll extract all details for tracking payments and receivables.",
    features: [
      "Extracts line items & totals",
      "Captures customer & payment details",
      "Tracks due dates automatically",
    ],
    icon: Receipt,
    tagVariant: "emerald",
    storagePath: "invoices",
    collection: "invoices",
    acceptedTypes: ".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls",
    fileTypes: [
      { label: "PDF", variant: "danger" },
      { label: "PNG", variant: "purple" },
      { label: "JPG", variant: "success" },
      { label: "CSV", variant: "emerald" },
      { label: "Excel", variant: "emerald" },
    ],
    extractedFields: [
      { key: "documentNumber", label: "Invoice #" },
      { key: "customerName", label: "Customer" },
      { key: "total", label: "Amount" },
      { key: "currency", label: "Currency" },
      { key: "documentDate", label: "Invoice Date" },
      { key: "dueDate", label: "Due Date" },
    ],
  },
  bill: {
    label: "Bill",
    title: "Upload Bill",
    subtitle: "Import bills & expenses",
    description: "Upload bills, invoices, or expense receipts you need to pay. We'll extract vendor details, amounts, and due dates.",
    features: [
      "Extracts vendor & payment info",
      "Captures line items & totals",
      "Detects wrong document types",
    ],
    icon: FileText,
    tagVariant: "orange",
    storagePath: "bills",
    collection: "bills",
    acceptedTypes: ".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls",
    fileTypes: [
      { label: "PDF", variant: "danger" },
      { label: "PNG", variant: "purple" },
      { label: "JPG", variant: "success" },
      { label: "CSV", variant: "emerald" },
      { label: "Excel", variant: "emerald" },
    ],
    extractedFields: [
      { key: "documentNumber", label: "Bill #" },
      { key: "vendorName", label: "Vendor" },
      { key: "total", label: "Amount" },
      { key: "currency", label: "Currency" },
      { key: "documentDate", label: "Bill Date" },
      { key: "dueDate", label: "Due Date" },
    ],
  },
};

// ============================================
// HELPERS
// ============================================

const getMimeType = (file: File): string => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    csv: "text/csv",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
  };
  return mimeMap[ext || ""] || file.type || "application/octet-stream";
};

const formatCurrency = (amount: number, currency: string = "USD") => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

// Helper to get singular/plural document type name
const getDocTypeName = (type: DocumentType, count: number = 1) => {
  const names: Record<DocumentType, { singular: string; plural: string }> = {
    statement: { singular: "Bank Statement", plural: "Bank Statements" },
    invoice: { singular: "Invoice", plural: "Invoices" },
    bill: { singular: "Bill", plural: "Bills" },
  };
  return count === 1 ? names[type].singular : names[type].plural;
};

// ============================================
// AI THINKING TERMINAL COMPONENT
// ============================================

type ThinkingLineType = "step" | "analyze" | "search" | "match" | "detect" | "template" | "extract" | "confirm" | "info" | "success" | "warning";

interface ThinkingLine {
  type: ThinkingLineType;
  message: string;
  timestamp?: number;
}

function AIThinkingTerminal({
  lines,
  isRunning,
  fileName,
  elapsedMs,
}: {
  lines: ThinkingLine[];
  isRunning: boolean;
  fileName: string;
  elapsedMs: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines.length]);

  const getIcon = (type: ThinkingLineType) => {
    switch (type) {
      case "step": return "▸";
      case "analyze": return "→";
      case "search": return "  ↳";
      case "match": return "  ↳";
      case "detect": return "  ◆";
      case "template": return "  ✦";
      case "extract": return "  ⚡";
      case "confirm": return "  ✓";
      case "success": return "  ✓";
      case "warning": return "  ⚠";
      case "info": return "─";
      default: return " ";
    }
  };

  const getStyle = (type: ThinkingLineType) => {
    switch (type) {
      case "step": return "text-slate-900 font-bold text-[13px] mt-3 first:mt-0";
      case "analyze": return "text-cyan-700 font-medium mt-1.5";
      case "search": return "text-purple-600";
      case "match": return "text-emerald-600";
      case "detect": return "text-amber-600 font-medium";
      case "template": return "text-blue-600";
      case "extract": return "text-pink-600";
      case "confirm": return "text-emerald-600 font-semibold";
      case "success": return "text-emerald-600 font-semibold";
      case "warning": return "text-amber-600";
      case "info": return "text-slate-400 text-[10px]";
      default: return "text-slate-500";
    }
  };

  if (lines.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-amber-400" />
            <div className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-mono text-slate-500">Gemini 3 Pro — Document Analysis</span>
            {isRunning && (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-600 font-mono">LIVE</span>
              </span>
            )}
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-400">{(elapsedMs / 1000).toFixed(1)}s</span>
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className="p-4 font-mono text-[11px] leading-[1.6] flex-1 min-h-0 overflow-y-auto scroll-smooth"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
      >
        {/* Init line */}
        <div className="text-slate-400 mb-2">
          <span className="text-cyan-600">$</span> smartinvoice scan {fileName} --engine=gemini-3-pro
        </div>

        {/* Thinking lines */}
        {lines.map((line, idx) => {
          const icon = getIcon(line.type);
          const style = getStyle(line.type);

          if (line.type === "step") {
            return (
              <div key={idx} className={cn("font-mono", style)}>
                {icon} {line.message}
              </div>
            );
          }

          return (
            <div key={idx} className={cn("font-mono", style)}>
              {icon} {line.message}
            </div>
          );
        })}

        {/* Blinking cursor when running */}
        {isRunning && (
          <span className="inline-block w-2 h-4 bg-cyan-500 ml-1 animate-pulse" />
        )}
      </div>
    </div>
  );
}

// ============================================
// FILE QUEUE PANEL
// ============================================

function FileQueuePanel({ fileStates, currentIndex, phase }: { fileStates: ContextFileUploadState[]; currentIndex?: number; phase?: "identifying" | "extracting" }) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  if (fileStates.length <= 1) return null;

  const getTypeLabel = (detectedType?: string): { label: string; color: string; bg: string; border: string } => {
    switch (detectedType) {
      case "bank_statement": case "statement": return { label: "Statement", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" };
      case "invoice": return { label: "Invoice (A/R)", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" };
      case "bill": return { label: "Bill (A/P)", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" };
      case "receipt": case "payment_record": return { label: "Receipt", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" };
      case "expense_report": return { label: "Expense", color: "text-pink-700", bg: "bg-pink-50", border: "border-pink-200" };
      default: return { label: "Document", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" };
    }
  };

  const getStatusInfo = (status: string, detectedType?: string) => {
    const typeInfo = getTypeLabel(detectedType);
    switch (status) {
      case "pending": return { icon: FileText, color: "text-slate-400", bg: "bg-slate-50", label: "Queued" };
      case "uploading": return { icon: Upload, color: "text-blue-500", bg: "bg-blue-50", label: "Uploading..." };
      case "identifying": return { icon: Loader2, color: "text-cyan-600", bg: "bg-cyan-50", label: "Identifying...", spin: true };
      case "type_confirmed": return { icon: Check, color: "text-emerald-600", bg: "bg-emerald-50", label: typeInfo.label };
      case "extracting": return { icon: Loader2, color: "text-blue-600", bg: "bg-blue-50", label: `Extracting...`, spin: true };
      case "extracted": return { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: typeInfo.label };
      case "rejected": return { icon: Ban, color: "text-red-500", bg: "bg-red-50", label: "Rejected" };
      case "error": return { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50", label: "Error" };
      default: return { icon: FileText, color: "text-slate-400", bg: "bg-slate-50", label: status };
    }
  };

  // Categorize files
  const activeFiles: Array<{ fs: ContextFileUploadState; idx: number }> = [];
  const pendingFiles: Array<{ fs: ContextFileUploadState; idx: number }> = [];
  const typeGroups: Record<string, Array<{ fs: ContextFileUploadState; idx: number; confidence: number }>> = {};

  fileStates.forEach((fs, idx) => {
    const isActive = fs.status === "identifying" || fs.status === "uploading" || fs.status === "extracting";
    const isPending = fs.status === "pending";
    const isIdentified = fs.status === "type_confirmed" || fs.status === "extracted";

    if (isActive) {
      activeFiles.push({ fs, idx });
    } else if (isPending) {
      pendingFiles.push({ fs, idx });
    } else if (isIdentified) {
      const dt = fs.identifyResult?.detectedType || fs.confirmedType || "other";
      const typeKey = getTypeLabel(dt).label;
      if (!typeGroups[typeKey]) typeGroups[typeKey] = [];
      typeGroups[typeKey].push({ fs, idx, confidence: fs.identifyResult?.confidence || 0 });
    } else {
      // rejected, error, etc
      const typeKey = "__other__";
      if (!typeGroups[typeKey]) typeGroups[typeKey] = [];
      typeGroups[typeKey].push({ fs, idx, confidence: 0 });
    }
  });

  const identifiedCount = phase === "extracting"
    ? fileStates.filter(f => f.status === "extracted").length
    : fileStates.filter(f => f.status === "type_confirmed" || f.status === "extracting" || f.status === "extracted").length;
  const typeSummary = Object.entries(typeGroups)
    .filter(([k]) => k !== "__other__")
    .map(([t, files]) => `${files.length} ${t}${files.length !== 1 ? "s" : ""}`)
    .join(", ");

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderFileRow = (fs: ContextFileUploadState, origIdx: number) => {
    const detectedType = fs.identifyResult?.detectedType || fs.confirmedType;
    const info = getStatusInfo(fs.status, detectedType) as any;
    const StatusIcon = info.icon;
    const isActive = origIdx === currentIndex;

    return (
      <div key={origIdx} className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 transition-colors",
        isActive && "bg-cyan-50/50",
      )}>
        <div className={cn("h-5 w-5 rounded flex items-center justify-center shrink-0", info.bg)}>
          <StatusIcon className={cn("h-3 w-3", info.color, info.spin && "animate-spin")} />
        </div>
        <p className="text-[10px] text-slate-600 truncate flex-1 min-w-0">{fs.file.name}</p>
        {fs.identifyResult && fs.status !== "rejected" && (
          <span className="text-[9px] font-mono text-slate-400 shrink-0">
            {Math.round(fs.identifyResult.confidence * 100)}%
          </span>
        )}
        {!fs.identifyResult && (
          <span className={cn("text-[9px] shrink-0", info.color)}>{info.label}</span>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <List className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Document Queue</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {identifiedCount}/{fileStates.length}
          </span>
        </div>
        {typeSummary && (
          <p className="text-[10px] text-slate-400 mt-0.5 pl-5.5">{typeSummary}</p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col" style={{ scrollbarWidth: "thin" }}>
        {/* Active files (always visible at top) */}
        {activeFiles.map(({ fs, idx }) => renderFileRow(fs, idx))}

        {/* Pending / queued files (always visible, right after active) */}
        {pendingFiles.length > 0 && (
          <div>
            {activeFiles.length > 0 && (
              <div className="px-3 py-1.5 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Queued
                </span>
                <span className="text-[9px] font-mono text-slate-400 ml-2">{pendingFiles.length}</span>
              </div>
            )}
            {pendingFiles.map(({ fs, idx }) => renderFileRow(fs, idx))}
          </div>
        )}

        {/* Other (rejected, error) */}
        {typeGroups["__other__"] && typeGroups["__other__"].length > 0 && (
          <div>
            <div className="px-3 py-1.5 border-t border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">
                Issues ({typeGroups["__other__"].length})
              </span>
            </div>
            {typeGroups["__other__"].map(({ fs, idx }) => renderFileRow(fs, idx))}
          </div>
        )}

        {/* Type groups */}
        {Object.entries(typeGroups)
          .filter(([k]) => k !== "__other__")
          .sort(([a], [b]) => {
            const order: Record<string, number> = { Statement: 0, Invoice: 1, Bill: 2, Receipt: 3, Expense: 4 };
            return (order[a] ?? 99) - (order[b] ?? 99);
          })
          .map(([typeKey, files]) => {
            const isCollapsed = collapsedGroups[typeKey] ?? false;
            const typeInfo = getTypeLabel(files[0]?.fs.identifyResult?.detectedType || files[0]?.fs.confirmedType);
            const avgConf = files.length > 0
              ? Math.round(files.reduce((s, f) => s + f.confidence, 0) / files.length * 100)
              : 0;

            return (
              <div key={`group-${typeKey}`}>
                <button
                  onClick={() => toggleGroup(typeKey)}
                  className="w-full px-3 py-2 flex items-center gap-2 border-t border-slate-100 hover:bg-slate-50/80 transition-colors"
                >
                  {isCollapsed
                    ? <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
                    : <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                  }
                  <span className={cn("text-[10px] font-bold", typeInfo.color)}>
                    {typeKey}s
                  </span>
                  <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full", typeInfo.bg, typeInfo.color)}>
                    {files.length}
                  </span>
                  <span className="flex-1" />
                  <span className="text-[9px] font-mono text-slate-400">
                    avg {avgConf}%
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="border-t border-slate-50">
                    {files.map(({ fs, idx }) => renderFileRow(fs, idx))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ============================================
// UPLOAD DRAWER COMPONENT
// ============================================

export function UploadDrawer({ 
  defaultType = "statement",
}: UploadDrawerProps) {
  const { user } = useAuth();
  const { isAtLimit, pagesUsed, pagesLimit } = useUsageStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  
  // AI Thinking terminal state
  const [thinkingLines, setThinkingLines] = useState<ThinkingLine[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);
  // Accumulates company names discovered from bank statements during batch identification
  const discoveredCompanyNamesRef = useRef<Set<string>>(new Set());
  const extractionRunningRef = useRef(false);
  
  // Use persistent state from context
  const { 
    state: uploadState, 
    setFileStates, 
    setStep: setCurrentStep, 
    setSelectedType,
    setSavedCount, 
    setSkippedCount,
    resetState,
    isDrawerOpen: open,
    closeDrawer,
    onCompleteRef,
  } = useUploadState();
  
  const fileStates = uploadState.fileStates;
  const fileStatesRef = useRef(fileStates);
  fileStatesRef.current = fileStates;
  const currentStep = uploadState.step;
  const selectedType = uploadState.selectedType || defaultType;
  const savedCount = uploadState.savedCount;
  const skippedCount = uploadState.skippedCount;
  
  const [expandedFileIndex, setExpandedFileIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingProgress, setSavingProgress] = useState(0);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [confirmingRules, setConfirmingRules] = useState(false);

  const config = TYPE_CONFIG[selectedType];
  const Icon = config.icon;

  // Computed values
  const scannedFiles = fileStates.filter(f => f.status === "extracted");
  const confirmedFiles = fileStates.filter(f => f.status === "type_confirmed");
  const errorFiles = fileStates.filter(f => f.status === "error");
  const processingFiles = fileStates.filter(f => 
    f.status === "uploading" || 
    f.status === "identifying" || 
    f.status === "extracting"
  );
  // Files with wrong detected type (used in preview step)
  const wrongTypeFiles = fileStates.filter(f => f.status === "wrong_type");
  
  // Rejected files (not relevant to SmartInvoice)
  const rejectedFiles = fileStates.filter(f => f.status === "rejected");
  
  // Files needing CSV parsing rules confirmation (CSV files with new rules)
  const filesNeedingRulesConfirmation = useMemo(() => {
    return scannedFiles.filter(f => 
      f.extractedData?.csvParsingRulesStatus === "new" && 
      f.file.name.toLowerCase().endsWith(".csv")
    );
  }, [scannedFiles]);
  
  // Files needing bank identification — only relevant for STATEMENT files
  const filesNeedingBankId = useMemo(() => {
    return scannedFiles.filter(f => {
      const ft = f.confirmedType || selectedType;
      if (ft !== "statement") return false; // invoices/bills don't need bank ID
      return f.extractedData?.needsBankIdentification === true ||
        f.extractedData?.bankName === "Unknown Bank";
    });
  }, [scannedFiles, selectedType]);
  
  // Check if we can proceed with save (all CSV rules must be confirmed)
  const hasUnconfirmedRules = filesNeedingRulesConfirmation.length > 0;
  const hasUnidentifiedBanks = filesNeedingBankId.length > 0;
  
  // All scanned files are valid - user paid for processing, let them save and edit later
  // Only truly failed files (status === "error") are excluded
  const { validScannedFiles, problemFiles } = useMemo(() => {
    // All scanned files are valid - extraction may have partial data but that's OK
    const valid = scannedFiles.filter(f => f.extractedData);
    const problems = scannedFiles.filter(f => !f.extractedData);
    
    if (problems.length > 0) {
      console.warn("Files without extractedData:", problems.map(f => f.file.name));
    }
    
    return { validScannedFiles: valid, problemFiles: problems };
  }, [scannedFiles]);

  // Group valid scanned files by bank/account - create unique key from bankName + accountNumber
  // Only group STATEMENT files by bank/account — invoices and bills don't need account grouping
  const statementFiles = useMemo(() => 
    validScannedFiles.filter(f => (f.confirmedType || selectedType) === "statement"),
    [validScannedFiles, selectedType]
  );
  const invoiceFiles = useMemo(() => 
    validScannedFiles.filter(f => (f.confirmedType || selectedType) === "invoice"),
    [validScannedFiles, selectedType]
  );
  const billFiles = useMemo(() => 
    validScannedFiles.filter(f => (f.confirmedType || selectedType) === "bill"),
    [validScannedFiles, selectedType]
  );

  const groupedByAccount = useMemo(() => {
    const groups: Record<string, {
      key: string;
      bankName: string;
      bankCountry: string;
      accountNumber: string;
      accountHolderName: string;
      currency: string;
      files: typeof scannedFiles;
      periodStart: string;
      periodEnd: string;
      totalTransactions: number;
      totalPages: number;
    }> = {};
    
    const normalizeBankName = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    // ONLY group statement files — invoices/bills don't have bank accounts
    statementFiles.forEach(file => {
      const bankName = file.extractedData?.bankName || "Unknown Bank";
      const accountNumber = file.extractedData?.accountNumber || "Unknown";
      const normalizedBankName = normalizeBankName(bankName);
      const key = `${normalizedBankName}|${accountNumber}`;
      
      if (!groups[key]) {
        groups[key] = {
          key,
          bankName,
          bankCountry: file.extractedData?.bankCountry || "",
          accountNumber,
          accountHolderName: file.extractedData?.accountHolderName || "",
          currency: file.extractedData?.currency || "USD",
          files: [],
          periodStart: "",
          periodEnd: "",
          totalTransactions: 0,
          totalPages: 0,
        };
      }
      
      groups[key].files.push(file);
      
      const ps = file.extractedData?.periodStart || "";
      const pe = file.extractedData?.periodEnd || "";
      if (ps && (!groups[key].periodStart || ps < groups[key].periodStart)) {
        groups[key].periodStart = ps;
      }
      if (pe && (!groups[key].periodEnd || pe > groups[key].periodEnd)) {
        groups[key].periodEnd = pe;
      }
      
      groups[key].totalTransactions += file.extractedData?.transactionCount || 0;
      groups[key].totalPages += file.extractedData?.pageCount || 1;
    });
    
    return Object.values(groups);
  }, [statementFiles]);
  
  
  // Check if we have multiple different banks/accounts
  const hasMultipleBanks = groupedByAccount.length > 1;


  // Handle mount/unmount with animation
  useEffect(() => {
    if (open) {
      setIsMounted(true);
      // Only reset local UI state, NOT the persistent upload state
      setExpandedFileIndex(null);
      setError(null);
      setSavingProgress(0);
      
      // Sync the type from props - if different type, reset files
      if (uploadState.selectedType !== defaultType) {
        // Different document type requested - start fresh
        setSelectedType(defaultType);
        if (uploadState.fileStates.length > 0) {
          setFileStates([]);
          setCurrentStep("upload");
        }
      }
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
    }
  }, [open, defaultType, uploadState.selectedType, uploadState.fileStates.length, setSelectedType, setFileStates, setCurrentStep]);

  // Handle close with animation - state persists in context, so just close
  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => {
      setIsMounted(false);
      closeDrawer();
    }, 500);
  }, [closeDrawer]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) handleClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, handleClose]);

  // PHASE 1: Upload + Identify Type
  const identifyFile = useCallback(async (fileState: ContextFileUploadState, index: number) => {
    if (!user?.id) return;
    
    const updateFileState = (updates: Partial<ContextFileUploadState>) => {
      setFileStates(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
    };

    const addThinkingLine = (type: ThinkingLineType, message: string) => {
      setThinkingLines(prev => [...prev, { type, message, timestamp: Date.now() }]);
    };

    // Start elapsed timer
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      elapsedRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 100);
    }

    try {
      // Step 1: Upload to Storage
      addThinkingLine("step", "DOCUMENT UPLOAD");
      addThinkingLine("analyze", `Reading ${fileState.file.name}...`);
      const fileSize = (fileState.file.size / 1024 / 1024).toFixed(2);
      const fileExt = fileState.file.name.split('.').pop()?.toUpperCase();
      addThinkingLine("info", `Format: ${fileExt}, Size: ${fileSize}MB`);
      
      updateFileState({ status: "uploading" });
      const fileName = `${Date.now()}_${fileState.file.name}`;
      const filePath = `temp/${user.id}/${fileName}`;  // Use temp path for identification phase
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, fileState.file);
      const url = await getDownloadURL(storageRef);
      updateFileState({ fileUrl: url });
      
      addThinkingLine("confirm", "Upload complete");

      // Step 2: Identify Document Type (FAST - first page only)
      addThinkingLine("step", "AI CLASSIFICATION");
      addThinkingLine("analyze", "Initializing Gemini 3 Pro with thinking...");
      addThinkingLine("info", "Mode: ThinkingLevel=MEDIUM, structured JSON output");
      addThinkingLine("search", "Scanning first page for document signatures...");
      addThinkingLine("search", "Looking for: bank logos, invoice headers, transaction tables...");
      addThinkingLine("template", "Classifying document type with confidence scoring...");
      
      updateFileState({ status: "identifying" });
      
      const mimeType = getMimeType(fileState.file);
      const identifyFn = httpsCallable(functions, "identifyDocumentType", { timeout: 60000 });
      
      // Resolve all known company names: profile + aliases + discovered from bank statements
      const primaryName = (user as any)?.companyName || null;
      const aliases: string[] = (user as any)?.companyAliases || [];
      const discoveredNames = [...discoveredCompanyNamesRef.current];
      
      // Combine all known names (deduped)
      const allNames = [...new Set([primaryName, ...aliases, ...discoveredNames].filter(Boolean))];
      const companyName = allNames.length > 0 ? allNames.join(" / ") : null;
      
      const identifyResult = await identifyFn({ 
        fileUrl: url, 
        mimeType,
        fileName: fileState.file.name,
        // Pass all known company names so AI can determine invoice direction
        companyName,
      });
      
      const identified = identifyResult.data as IdentifyResult;
      
      // Show detection
      addThinkingLine("step", "DOCUMENT IDENTIFICATION");
      
      const typeLabels: Record<string, string> = {
        bank_statement: "Bank Statement",
        invoice: "Invoice (Outgoing/A/R)",
        bill: "Bill (Incoming/A/P)",
        receipt: "Receipt",
        invoice_list: "Invoice List (CSV)",
        vendor_list: "Vendor List",
        payment_record: "Payment Record",
        other: "Unknown Document Type",
      };
      
      addThinkingLine("detect", `Detected: ${typeLabels[identified.detectedType]} (${Math.round(identified.confidence * 100)}% confident)`);
      
      if (identified.detectedBank) {
        addThinkingLine("match", `Bank: ${identified.detectedBank}`);
      }
      // Show invoice direction info
      if (identified.invoiceFrom) {
        addThinkingLine("match", `From: ${identified.invoiceFrom}`);
      }
      if (identified.invoiceTo) {
        addThinkingLine("match", `To: ${identified.invoiceTo}`);
      }
      if (identified.detectedVendor && !identified.invoiceFrom) {
        addThinkingLine("match", `Vendor: ${identified.detectedVendor}`);
      }
      if (identified.detectedCustomer && !identified.invoiceTo) {
        addThinkingLine("match", `Customer: ${identified.detectedCustomer}`);
      }
      if (identified.currency) {
        addThinkingLine("info", `Currency: ${identified.currency}`);
      }
      
      addThinkingLine("info", identified.reasoning);
      
      // Determine if this document is relevant to SmartInvoice
      const rejectedTypes = ["other", "vendor_list"];
      const isRejected = rejectedTypes.includes(identified.detectedType) || 
        (identified.detectedType === "other" && identified.confidence < 0.5);
      
      if (isRejected) {
        addThinkingLine("warning", "⚠  Document type not supported by SmartInvoice");
        addThinkingLine("info", "SmartInvoice processes: Bank Statements, Invoices, and Bills");
        addThinkingLine("warning", "✗  This document has been rejected");
        
        updateFileState({
          status: "rejected",
          identifyResult: identified,
          error: `Not a supported document type. Detected: ${typeLabels[identified.detectedType] || "Unknown"}. SmartInvoice only processes bank statements, invoices, and bills.`,
        });
        return;
      }
      
      addThinkingLine("warning", "⏸  Waiting for user confirmation...");
      
      // Map detected type to our DocumentType
      let mappedType: DocumentType = "statement";
      if (identified.detectedType === "bank_statement") mappedType = "statement";
      else if (identified.detectedType === "invoice" || identified.detectedType === "invoice_list") mappedType = "invoice";
      else if (identified.detectedType === "bill" || identified.detectedType === "receipt") mappedType = "bill";
      else if (identified.detectedType === "payment_record") mappedType = "statement";
      
      // If bank statement, capture account holder name for subsequent invoice direction detection
      if (identified.detectedType === "bank_statement" && identified.detectedCustomer) {
        discoveredCompanyNamesRef.current.add(identified.detectedCustomer);
      }
      
      updateFileState({ 
        status: "type_confirmed",
        identifyResult: identified,
        confirmedType: mappedType,
      });

    } catch (err) {
      console.error("Identification error:", (err as any)?.message || err);
      
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorCode = (err as any)?.code || "";
      
      addThinkingLine("warning", `❌ Error: ${errorCode ? `[${errorCode}] ` : ""}${errorMessage}`);
      
      updateFileState({ 
        status: "error", 
        error: errorMessage 
      });
    } finally {
      // Stop elapsed timer
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
    }
  }, [user?.id, (user as any)?.companyName, (user as any)?.companyAliases, setFileStates]);

  // PHASE 2: Extract Full Data (after type confirmation)
  const extractFile = useCallback(async (fileState: ContextFileUploadState, index: number) => {
    if (!user?.id || !fileState.confirmedType) return;
    // Guard: skip if already extracting or done
    if (fileState.status === "extracting" || fileState.status === "extracted") return;
    
    const updateFileState = (updates: Partial<ContextFileUploadState>) => {
      setFileStates(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
    };

    const addThinkingLine = (type: ThinkingLineType, message: string) => {
      setThinkingLines(prev => [...prev, { type, message, timestamp: Date.now() }]);
    };

    try {
      const fileExt = fileState.file.name.split('.').pop()?.toUpperCase() || "PDF";
      const fileSizeMB = (fileState.file.size / 1024 / 1024).toFixed(2);
      const typeLabel = fileState.confirmedType === "statement" ? "Bank Statement" : fileState.confirmedType === "invoice" ? "Invoice" : "Document";

      addThinkingLine("step", "PREPARING EXTRACTION");
      addThinkingLine("analyze", `Document type: ${typeLabel}`);
      addThinkingLine("info", `File: ${fileState.file.name} (${fileExt}, ${fileSizeMB}MB)`);
      
      updateFileState({ status: "extracting" });
      
      const config = TYPE_CONFIG[fileState.confirmedType];
      const mimeType = getMimeType(fileState.file);
      
      // Move file to proper storage location
      addThinkingLine("analyze", "Uploading to secure storage...");
      const finalFileName = `${Date.now()}_${fileState.file.name}`;
      const finalPath = `${config.storagePath}/${user.id}/${finalFileName}`;
      const finalRef = ref(storage, finalPath);
      await uploadBytes(finalRef, fileState.file);
      const finalUrl = await getDownloadURL(finalRef);
      addThinkingLine("confirm", "File secured in cloud storage");
      
      // Call appropriate scanner
      const scanFnName = fileState.confirmedType === "statement" ? "scanDocument" : "scanInvoice";
      const scanFn = httpsCallable(functions, scanFnName, { timeout: 300000 });
      
      addThinkingLine("step", "GEMINI 3 EXTRACTION");
      addThinkingLine("analyze", "Initializing Gemini 3 Flash with structured output...");
      addThinkingLine("info", "Mode: responseMimeType=application/json, temperature=0");
      
      if (fileState.confirmedType === "statement") {
        addThinkingLine("extract", "Scanning for transaction table structure...");
        addThinkingLine("search", "Looking for dates, descriptions, amounts, balances...");
        addThinkingLine("search", "Detecting account number, bank name, currency...");
        addThinkingLine("search", "Identifying statement period and balance figures...");
      } else {
        addThinkingLine("extract", "Scanning for invoice/bill structure...");
        addThinkingLine("search", "Looking for line items, totals, tax amounts...");
        addThinkingLine("search", "Detecting vendor, customer, due date...");
      }
      
      addThinkingLine("template", "Sending to Gemini 3 Flash for deep extraction...");
      
      const scanResult = await scanFn({ fileUrl: finalUrl, mimeType });
      const scanData = scanResult.data as any;
      
      addThinkingLine("step", "PROCESSING RESULTS");
      
      // Build extracted data
      const extracted: ExtractedData = {
        documentNumber: scanData.invoiceNumber || scanData.documentNumber || "",
        customerName: scanData.customerName || "",
        vendorName: scanData.vendorName || "",
        total: scanData.total || 0,
        documentDate: scanData.invoiceDate || scanData.documentDate || "",
        dueDate: scanData.dueDate || "",
        bankName: scanData.bankName || "",
        accountNumber: scanData.accountNumber || "",
        currency: scanData.currency || "USD",
        periodStart: scanData.periodStart || "",
        periodEnd: scanData.periodEnd || "",
        openingBalance: scanData.openingBalance,
        closingBalance: scanData.closingBalance,
        transactionCount: scanData.transactionCount || 0,
        sampleTransactions: scanData.sampleTransactions || [],
        confidence: scanData.confidence || 0,
        pageCount: scanData.pageCount || 1,
        detectedType: scanData.detectedType,
      };
      
      // Rich result output
      if (extracted.bankName) {
        addThinkingLine("detect", `Bank: ${extracted.bankName}`);
      }
      if (extracted.accountNumber && extracted.accountNumber !== "Unknown") {
        addThinkingLine("detect", `Account: ****${extracted.accountNumber.slice(-4)}`);
      }
      if (extracted.currency) {
        addThinkingLine("info", `Currency: ${extracted.currency}`);
      }
      if (extracted.periodStart && extracted.periodEnd) {
        addThinkingLine("info", `Period: ${extracted.periodStart} → ${extracted.periodEnd}`);
      }
      if (extracted.openingBalance !== undefined && extracted.closingBalance !== undefined) {
        addThinkingLine("match", `Opening: ${extracted.currency} ${extracted.openingBalance?.toLocaleString()} → Closing: ${extracted.currency} ${extracted.closingBalance?.toLocaleString()}`);
      }
      if ((extracted.transactionCount ?? 0) > 0) {
        addThinkingLine("success", `Found ${extracted.transactionCount} transactions`);
      }
      if ((extracted.pageCount ?? 0) > 1) {
        addThinkingLine("info", `Processed ${extracted.pageCount} pages`);
      }
      addThinkingLine("confirm", `Extraction complete — ${Math.round((extracted.confidence || 0) * 100)}% confidence`);
      
      updateFileState({ 
        status: "extracted",
        extractedData: extracted,
        fileUrl: finalUrl,
      });

    } catch (err) {
      console.error("=== EXTRACTION ERROR ===", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      addThinkingLine("warning", `❌ Extraction failed: ${errorMessage}`);
      updateFileState({ status: "error", error: errorMessage });
    }
  }, [user?.id, setFileStates]);

  // Process all files - PHASE 1 (Identify)
  // Prioritizes likely bank statements first so account holder names
  // are available as company context for invoice direction detection
  const identifyAllFiles = useCallback(async (files: File[]) => {
    if (!user?.id) return;
    
    // Reset thinking state
    setThinkingLines([]);
    setElapsedMs(0);
    startTimeRef.current = 0;
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
    
    setCurrentStep("identifying");
    
    // Clear previously discovered names for fresh batch
    discoveredCompanyNamesRef.current.clear();
    
    // Sort files: likely bank statements first, then everything else
    // This ensures account holder names are available for invoice direction detection
    const statementPatterns = /\b(statement|bank|rbc|chase|hsbc|citi|wells|boa|ing|abn|rabo)\b/i;
    const monthPatterns = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(uary|ruary|ch|il|e|ust|tember|ober|ember)?\.(pdf|csv|xlsx?)$/i;
    
    const sortedFiles = [...files].sort((a, b) => {
      const aIsStatement = statementPatterns.test(a.name) || monthPatterns.test(a.name);
      const bIsStatement = statementPatterns.test(b.name) || monthPatterns.test(b.name);
      if (aIsStatement && !bIsStatement) return -1;
      if (!aIsStatement && bIsStatement) return 1;
      return 0;
    });
    
    // Initialize file states in sorted order
    const initialStates: ContextFileUploadState[] = sortedFiles.map(file => ({
      file,
      status: "pending",
    }));
    setFileStates(initialStates);
    
    // Process files with limited parallelism (5 at a time)
    const CONCURRENCY = 5;
    for (let i = 0; i < sortedFiles.length; i += CONCURRENCY) {
      const batch = [];
      for (let j = i; j < Math.min(i + CONCURRENCY, sortedFiles.length); j++) {
        batch.push(identifyFile(initialStates[j], j));
      }
      await Promise.all(batch);
    }
    
    // POST-IDENTIFICATION RECONCILIATION
    // Now that ALL files are identified, look at the full picture and auto-correct directions.
    // Bank statements reveal the user's company name → use it to fix any invoice/bill misclassifications.
    
    // Build company identity signals from: user profile + discovered bank statement holders
    const companySignals = new Set<string>();
    if ((user as any)?.companyName) companySignals.add((user as any).companyName.toLowerCase().trim());
    for (const alias of ((user as any)?.companyAliases || [])) {
      if (alias) companySignals.add(alias.toLowerCase().trim());
    }
    for (const name of discoveredCompanyNamesRef.current) {
      companySignals.add(name.toLowerCase().trim());
    }
    
    if (companySignals.size > 0) {
      const normalize = (s: string) => s.toLowerCase().replace(/\b(bv|b\.v\.|nv|n\.v\.|ltd|llc|inc|corp|gmbh|sa|s\.a\.|sl|s\.l\.|srl|s\.r\.l\.|plc|co|pty|pvt)\b/gi, "").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
      const matchesCompany = (name: string | null | undefined) => {
        if (!name) return false;
        const norm = normalize(name);
        return [...companySignals].some(signal => {
          const normSignal = normalize(signal);
          return norm === normSignal || norm.includes(normSignal) || normSignal.includes(norm);
        });
      };
      
      // First pass: figure out which files need flipping (read-only scan via updater)
      const flipsNeeded = new Set<number>();
      const flipDirections = new Map<number, "bill" | "invoice">();
      let totalFiles = 0;
      
      setFileStates(prev => {
        totalFiles = prev.length;
        prev.forEach((f, idx) => {
          if (f.status !== "type_confirmed" || !f.identifyResult) return;
          const ir = f.identifyResult;
          const dt = ir.detectedType;
          if (dt !== "invoice" && dt !== "bill") return;
          
          const fromName = ir.invoiceFrom || ir.detectedVendor;
          const toName = ir.invoiceTo || ir.detectedCustomer;
          
          if (dt === "invoice" && matchesCompany(toName) && !matchesCompany(fromName)) {
            flipsNeeded.add(idx);
            flipDirections.set(idx, "bill");
          } else if (dt === "bill" && matchesCompany(fromName) && !matchesCompany(toName)) {
            flipsNeeded.add(idx);
            flipDirections.set(idx, "invoice");
          }
        });
        
        // Apply flips in a single pass
        if (flipsNeeded.size === 0) return prev;
        return prev.map((f, idx) => {
          const newType = flipDirections.get(idx);
          if (!newType || !f.identifyResult) return f;
          return {
            ...f,
            confirmedType: newType as DocumentType,
            identifyResult: { ...f.identifyResult, detectedType: newType as any },
          };
        });
      });
      
      // Terminal feedback — outside setFileStates to avoid cross-component setState
      if (flipsNeeded.size > 0) {
        console.log(`[SmartInvoice] Post-identification reconciliation: flipped ${flipsNeeded.size} document(s) based on company identity signals`);
        setThinkingLines(lines => [
          ...lines,
          { type: "step" as ThinkingLineType, message: "SMART DIRECTION RECONCILIATION", timestamp: Date.now() },
          { type: "analyze" as ThinkingLineType, message: `Cross-referencing ${companySignals.size} company identity signals across ${totalFiles} documents...`, timestamp: Date.now() },
          { type: "success" as ThinkingLineType, message: `Auto-corrected ${flipsNeeded.size} document${flipsNeeded.size !== 1 ? "s" : ""} — invoice/bill direction fixed based on company identity match`, timestamp: Date.now() },
        ]);
      }
    }
    
    setCurrentStep("confirm_type");
  }, [user?.id, identifyFile, setFileStates, setCurrentStep]);

  // Extract all confirmed files - PHASE 2 (parallel batches)
  const extractAllFiles = useCallback(async () => {
    // Guard: prevent double-execution (e.g. React StrictMode, accidental double-click)
    if (extractionRunningRef.current) {
      console.warn("[extractAllFiles] Already running — skipping duplicate call");
      return;
    }
    extractionRunningRef.current = true;

    setThinkingLines([]);
    setElapsedMs(0);
    startTimeRef.current = Date.now();
    setCurrentStep("extracting");

    // Snapshot file states from ref (always latest) — avoids stale closures
    const currentFiles = fileStatesRef.current;
    const confirmed = currentFiles.filter(f => f.status === "type_confirmed");

    if (confirmed.length === 0) {
      extractionRunningRef.current = false;
      setCurrentStep("preview");
      return;
    }

    const toProcess = confirmed.map(f => ({
      fileState: f,
      originalIndex: currentFiles.indexOf(f),
    }));

    console.log(`[extractAllFiles] Processing ${toProcess.length} files (indices: ${toProcess.map(t => t.originalIndex).join(",")})`);

    try {
      const EXTRACT_CONCURRENCY = 4;
      for (let i = 0; i < toProcess.length; i += EXTRACT_CONCURRENCY) {
        const batch = toProcess.slice(i, i + EXTRACT_CONCURRENCY);
        await Promise.allSettled(
          batch.map(({ fileState, originalIndex }) => extractFile(fileState, originalIndex))
        );
      }
    } finally {
      extractionRunningRef.current = false;
    }

    setCurrentStep("preview");
  }, [extractFile, setCurrentStep]);

  // Handle file selection - with hard stop if at limit
  const handleFilesSelect = useCallback((selectedFiles: FileList | File[]) => {
    // HARD STOP: Don't process if at limit
    if (isAtLimit) {
      setShowUpgradePrompt(true);
      return;
    }
    
    const validExtensions = config.acceptedTypes.split(',');
    const validFiles = Array.from(selectedFiles).filter(f => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      return validExtensions.includes(ext) && f.size <= 50 * 1024 * 1024;
    });
    
    if (validFiles.length > 0) {
      identifyAllFiles(validFiles);
    }
  }, [config.acceptedTypes, identifyAllFiles, isAtLimit]);

  // Confirm CSV parsing rules for all files that need it
  const confirmAllParsingRules = useCallback(async () => {
    if (!user?.id || filesNeedingRulesConfirmation.length === 0) return;
    
    setConfirmingRules(true);
    
    try {
      // Get unique rule IDs to confirm
      const ruleIds = new Set<string>();
      filesNeedingRulesConfirmation.forEach(f => {
        if (f.extractedData?.csvParsingRulesId) {
          ruleIds.add(f.extractedData.csvParsingRulesId);
        }
      });
      
      // Confirm each unique rule
      const confirmFn = httpsCallable(functions, "confirmCSVParsingRules");
      for (const rulesId of ruleIds) {
        await confirmFn({ rulesId });
      }
      
      // Update file states to mark rules as confirmed
      setFileStates(prev => prev.map(f => {
        if (f.extractedData?.csvParsingRulesStatus === "new") {
          return {
            ...f,
            extractedData: {
              ...f.extractedData,
              csvParsingRulesStatus: "existing" as const,
            },
          };
        }
        return f;
      }));
      
      toast.success("Parsing rules confirmed! You can now save.");
    } catch (err) {
      console.error("Failed to confirm rules:", err);
      toast.error("Failed to confirm parsing rules");
    }
    
    setConfirmingRules(false);
  }, [user?.id, filesNeedingRulesConfirmation, setFileStates]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelect(e.dataTransfer.files);
  }, [handleFilesSelect]);

  // Save all documents (only valid ones)
  const handleSaveAll = async () => {
    
    if (!user?.id || validScannedFiles.length === 0) {
      return;
    }

    setCurrentStep("saving");
    setSavingProgress(0);

    try {
      // Auto-manage company identity from bank statement account holders
      if (groupedByAccount.length > 0) {
        const existingName = (user as any)?.companyName || "";
        const existingAliases: string[] = (user as any)?.companyAliases || [];
        const allKnownNames = new Set([existingName, ...existingAliases].filter(Boolean).map(n => n.toLowerCase().trim()));
        
        const newNames: string[] = [];
        for (const group of groupedByAccount) {
          if (group.accountHolderName && !allKnownNames.has(group.accountHolderName.toLowerCase().trim())) {
            newNames.push(group.accountHolderName);
            allKnownNames.add(group.accountHolderName.toLowerCase().trim());
          }
        }
        
        if (newNames.length > 0) {
          try {
            const updates: Record<string, any> = {};
            if (!existingName) {
              // First time — set the primary company name
              updates.companyName = newNames[0];
              if (newNames.length > 1) {
                updates.companyAliases = [...existingAliases, ...newNames.slice(1)];
              }
              toast.success(`Company detected: "${newNames[0]}"`);
            } else {
              // Already have a primary — add new names as aliases
              updates.companyAliases = [...existingAliases, ...newNames];
              toast.info(`New company alias${newNames.length > 1 ? "es" : ""} added: ${newNames.join(", ")}`);
            }
            await updateDoc(doc(db, "users", user.id), updates);
          } catch { /* non-critical */ }
        }
      }

      // For statements with multiple banks, create/find accounts for each group
      const accountIdMap: Record<string, string> = {}; // key -> accountId
      
      // Create/find accounts for any statement files (even in mixed uploads)
      if (groupedByAccount.length > 0) {
        
        for (const group of groupedByAccount) {
          // Check if account exists
          const accountQuery = query(
            collection(db, "accounts"),
            where("userId", "==", user.id),
            where("accountNumber", "==", group.accountNumber)
          );
          const existingAccounts = await getDocs(accountQuery);
          
          if (!existingAccounts.empty) {
            accountIdMap[group.key] = existingAccounts.docs[0].id;
            // Update account nickname if missing
            const existingAccount = existingAccounts.docs[0].data();
            if (!existingAccount.accountNickname) {
              await updateDoc(doc(db, "accounts", accountIdMap[group.key]), {
                accountNickname: (existingAccount.accountNumber && existingAccount.accountNumber !== "Unknown")
                  ? `${existingAccount.bankName || group.bankName} ****${existingAccount.accountNumber.slice(-4)}`
                  : (existingAccount.bankName || group.bankName),
              });
            }
          } else {
            // Create new account
            const lastFileInGroup = group.files[group.files.length - 1];
            const accountDoc = await addDoc(collection(db, "accounts"), {
              userId: user.id,
              bankName: group.bankName,
              accountNumber: group.accountNumber,
              accountHolderName: group.accountHolderName,
              accountNickname: group.accountNumber && group.accountNumber !== "Unknown" 
                ? `${group.bankName} ****${group.accountNumber.slice(-4)}`
                : group.bankName,
              currency: group.currency,
              accountType: "checking",
              currentBalance: lastFileInGroup?.extractedData?.closingBalance || 0,
              isArchived: false,
              createdAt: serverTimestamp(),
            });
            accountIdMap[group.key] = accountDoc.id;
          }
        }
        
      }

      // Save documents with deduplication — parallel dedup checks, batched writes
      let savedCount = 0;
      let skippedCount = 0;

      const normalizeBankName = (name: string): string => {
        return name.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
      };

      // PHASE A: Run all dedup checks in parallel (fast)
      setSavingProgress(5);
      const DEDUP_BATCH = 10;
      const dedupResults: boolean[] = new Array(validScannedFiles.length).fill(false); // true = duplicate

      for (let i = 0; i < validScannedFiles.length; i += DEDUP_BATCH) {
        const batch = validScannedFiles.slice(i, i + DEDUP_BATCH);
        const checks = batch.map(async (fileState, batchIdx) => {
          const idx = i + batchIdx;
          const extracted = fileState.extractedData!;
          const fileType = fileState.confirmedType || selectedType;

          if (fileType === "statement" && extracted.periodStart && extracted.periodEnd) {
            const dupeQuery = query(
              collection(db, "statements"),
              where("userId", "==", user.id),
              where("accountNumber", "==", extracted.accountNumber),
              where("periodStart", "==", Timestamp.fromDate(new Date(extracted.periodStart))),
              where("periodEnd", "==", Timestamp.fromDate(new Date(extracted.periodEnd)))
            );
            const existing = await getDocs(dupeQuery);
            if (!existing.empty) dedupResults[idx] = true;
          } else if (fileType === "bill" && extracted.documentNumber && extracted.documentNumber !== "Unknown") {
            const dupeQuery = query(
              collection(db, "bills"),
              where("userId", "==", user.id),
              where("documentNumber", "==", extracted.documentNumber),
              where("vendorName", "==", extracted.vendorName || "Unknown"),
              where("total", "==", extracted.total || 0)
            );
            const existing = await getDocs(dupeQuery);
            if (!existing.empty) dedupResults[idx] = true;
          } else if (fileType === "invoice" && extracted.documentNumber && extracted.documentNumber !== "Unknown") {
            const dupeQuery = query(
              collection(db, "invoices"),
              where("userId", "==", user.id),
              where("documentNumber", "==", extracted.documentNumber),
              where("customerName", "==", extracted.customerName || "Unknown"),
              where("total", "==", extracted.total || 0)
            );
            const existing = await getDocs(dupeQuery);
            if (!existing.empty) dedupResults[idx] = true;
          }
        });
        await Promise.allSettled(checks);
        setSavingProgress(5 + ((i + batch.length) / validScannedFiles.length) * 30);
      }

      skippedCount = dedupResults.filter(Boolean).length;

      // PHASE B: Save non-duplicate files in batches using writeBatch (max 500 per batch)
      const toSave = validScannedFiles.filter((_, idx) => !dedupResults[idx]);
      const csvFiles: Array<{ fileState: typeof validScannedFiles[0]; fileType: string }> = [];

      // Separate CSV files (need individual Cloud Function calls) from standard saves
      const standardFiles: Array<{ fileState: typeof validScannedFiles[0]; fileType: string; fileConfig: typeof config }> = [];

      for (const fileState of toSave) {
        const extracted = fileState.extractedData!;
        const fileType = fileState.confirmedType || selectedType;
        const fileConfig = TYPE_CONFIG[fileType] || config;
        const isCSVFile = extracted.isCSV && extracted.csvParsingRules && (fileType === "invoice" || fileType === "bill");

        if (isCSVFile && fileState.fileUrl) {
          csvFiles.push({ fileState, fileType });
        } else {
          standardFiles.push({ fileState, fileType, fileConfig });
        }
      }

      // Save standard files in writeBatch groups of 400 (leave headroom under 500 limit)
      const WRITE_BATCH_SIZE = 400;
      for (let i = 0; i < standardFiles.length; i += WRITE_BATCH_SIZE) {
        const chunk = standardFiles.slice(i, i + WRITE_BATCH_SIZE);
        const batch = writeBatch(db);

        for (const { fileState, fileType } of chunk) {
          const extracted = fileState.extractedData!;
          const normalizedBankName = normalizeBankName(extracted.bankName || "Unknown Bank");
          const fileKey = `${normalizedBankName}|${extracted.accountNumber || "Unknown"}`;
          const accountId = accountIdMap[fileKey] || null;

          const targetCollection = fileType === "statement" ? "statements"
            : fileType === "invoice" ? "invoices"
            : fileType === "bill" ? "bills"
            : "documents";

          const docRef = doc(collection(db, targetCollection));
          const docData: any = {
            userId: user.id,
            originalFileName: fileState.file.name,
            fileUrl: fileState.fileUrl,
            fileType: fileState.file.name.split('.').pop()?.toLowerCase() || "pdf",
            fileSize: fileState.file.size,
            mimeType: getMimeType(fileState.file),
            status: fileType === "statement" ? "pending_extraction" : "completed",
            pageCount: extracted.pageCount || 1,
            confidence: extracted.confidence || 0,
            transactionCount: 0,
            createdAt: serverTimestamp(),
            uploadedAt: serverTimestamp(),
          };

          if (fileType === "statement") {
            docData.accountId = accountId;
            docData.bankName = extracted.bankName || "Unknown";
            docData.accountNumber = extracted.accountNumber || "";
            docData.currency = extracted.currency || "USD";
            docData.periodStart = extracted.periodStart ? Timestamp.fromDate(new Date(extracted.periodStart)) : null;
            docData.periodEnd = extracted.periodEnd ? Timestamp.fromDate(new Date(extracted.periodEnd)) : null;
            docData.openingBalance = extracted.openingBalance;
            docData.closingBalance = extracted.closingBalance;
          } else if (fileType === "invoice") {
            docData.direction = "outgoing";
            docData.documentType = "invoice";
            docData.documentNumber = extracted.documentNumber || "";
            docData.customerName = extracted.customerName || "Unknown";
            docData.vendorName = extracted.vendorName || "";
            docData.documentDate = extracted.documentDate ? Timestamp.fromDate(new Date(extracted.documentDate)) : serverTimestamp();
            docData.dueDate = extracted.dueDate ? Timestamp.fromDate(new Date(extracted.dueDate)) : null;
            docData.total = extracted.total || 0;
            docData.amountRemaining = extracted.total || 0;
            docData.currency = extracted.currency || "USD";
            docData.lineItems = extracted.lineItems || [];
            docData.reconciliationStatus = "unmatched";
            docData.paymentStatus = "unpaid";
          } else if (fileType === "bill") {
            docData.direction = "incoming";
            docData.documentType = "bill";
            docData.documentNumber = extracted.documentNumber || "";
            docData.vendorName = extracted.vendorName || "Unknown";
            docData.customerName = extracted.customerName || "";
            docData.documentDate = extracted.documentDate ? Timestamp.fromDate(new Date(extracted.documentDate)) : serverTimestamp();
            docData.dueDate = extracted.dueDate ? Timestamp.fromDate(new Date(extracted.dueDate)) : null;
            docData.total = extracted.total || 0;
            docData.amountRemaining = extracted.total || 0;
            docData.currency = extracted.currency || "USD";
            docData.lineItems = extracted.lineItems || [];
            docData.reconciliationStatus = "unmatched";
            docData.paymentStatus = "unpaid";
          }

          batch.set(docRef, docData);
        }

        await batch.commit();
        savedCount += chunk.length;
        setSavingProgress(35 + ((i + chunk.length) / Math.max(toSave.length, 1)) * 55);
      }

      // Handle CSV files sequentially (each requires a Cloud Function call)
      for (let i = 0; i < csvFiles.length; i++) {
        const { fileState } = csvFiles[i];
        const extracted = fileState.extractedData!;
        const extractFn = httpsCallable(functions, "extractInvoices", { timeout: 300000 });
        const mimeType = getMimeType(fileState.file);

        const extractResult = await extractFn({
          fileUrl: fileState.fileUrl,
          mimeType,
          parsingRules: extracted.csvParsingRules,
        });

        const result = extractResult.data as { invoiceCount: number; summary?: { totalAmount?: number } };
        savedCount += result.invoiceCount;
        setSavingProgress(90 + ((i + 1) / csvFiles.length) * 10);
      }
      
      // Store counts for completion message
      setSavedCount(savedCount);
      setSkippedCount(skippedCount);
      setCurrentStep("complete");
      onCompleteRef.current?.();

    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "Failed to save documents");
      setCurrentStep("preview");
    }
  };

  // Remove file from batch
  const removeFile = (index: number) => {
    setFileStates(prev => prev.filter((_, i) => i !== index));
    if (fileStates.length <= 1) {
      setCurrentStep("upload");
    }
  };

  if (!isMounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 z-40",
          "transition-opacity duration-500 ease-out",
          isVisible ? "opacity-100" : "opacity-0"
        )}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 w-full max-w-4xl bg-white shadow-2xl",
          "flex flex-col",
          "transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isVisible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header — dynamically reflects detected document types */}
        <div className="px-5 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center",
                config.tagVariant === "cyan" && "bg-cyan-100 text-cyan-600",
                config.tagVariant === "emerald" && "bg-emerald-100 text-emerald-600",
                config.tagVariant === "orange" && "bg-orange-100 text-orange-600",
              )}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {(() => {
                    // Once we have identified files, show a smart title
                    const identifiedFiles = fileStates.filter(f => f.identifyResult?.detectedType);
                    if (identifiedFiles.length === 0) return config.title;
                    const types = new Set(identifiedFiles.map(f => f.identifyResult!.detectedType));
                    if (types.size === 1) {
                      const t = [...types][0];
                      if (t === "bank_statement" || t === "statement") return "Upload Bank Statements";
                      if (t === "invoice") return "Upload Invoices";
                      if (t === "bill") return "Upload Bills";
                      return config.title;
                    }
                    return "Upload Documents";
                  })()}
                </h2>
                <p className="text-xs text-slate-500">
                  {(() => {
                    const identifiedFiles = fileStates.filter(f => f.identifyResult?.detectedType);
                    if (identifiedFiles.length === 0) return config.subtitle;
                    const counts: Record<string, number> = {};
                    identifiedFiles.forEach(f => {
                      const dt = f.identifyResult!.detectedType;
                      const lbl = dt === "bank_statement" || dt === "statement" ? "statement" : dt === "invoice" ? "invoice" : dt === "bill" ? "bill" : dt;
                      counts[lbl] = (counts[lbl] || 0) + 1;
                    });
                    const parts = Object.entries(counts).map(([t, c]) => `${c} ${t}${c !== 1 ? "s" : ""}`);
                    return `AI detected ${parts.join(", ")}`;
                  })()}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content - scrollable area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* STEP: Upload */}
          {currentStep === "upload" && (
            <div className="p-5 h-full">
              {isAtLimit ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                  </div>
                  {/* Beautiful upgrade CTA */}
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-violet-600 p-6 text-white mb-4">
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-white/20 rounded-lg">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-medium text-white/80">Page limit reached</span>
                      </div>
                      <h3 className="text-lg font-bold mb-1">Unlock More Processing Power</h3>
                      <p className="text-sm text-white/80 mb-4">
                        You&apos;ve used all {pagesLimit} pages. Upgrade to continue with AI-powered extraction.
                      </p>
                      <div className="h-2 bg-white/20 rounded-full mb-4 overflow-hidden">
                        <div className="h-full w-full bg-white rounded-full" />
                      </div>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowUpgradePrompt(true)}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    View Upgrade Options
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Drop zone */}
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
                      isDragging 
                        ? "border-slate-400 bg-slate-50" 
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={config.acceptedTypes}
                      className="hidden"
                      multiple
                      onChange={(e) => e.target.files && handleFilesSelect(e.target.files)}
                    />
                    
                    <div className={cn(
                      "h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-3 transition-colors",
                      isDragging ? "bg-slate-200 text-slate-600" : "bg-slate-100 text-slate-400"
                    )}>
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 mb-1">
                      Drop files here or click to browse
                    </p>
                    <p className="text-xs text-slate-400">
                      {config.fileTypes.map(ft => ft.label).join(", ")} • Up to 50MB per file
                    </p>
                  </div>

                  {/* How it works */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">How it works</h4>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">1</div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">Upload your documents</p>
                          <p className="text-xs text-slate-500">Drag & drop or browse for PDF, images, or scans</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">2</div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">AI extracts the data</p>
                          <p className="text-xs text-slate-500">We read vendor details, amounts, dates, and line items</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">3</div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">Review and save</p>
                          <p className="text-xs text-slate-500">Check the extracted data, then save to your account</p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* STEP: Identifying (Phase 1) */}
          {currentStep === "identifying" && (
            <div className="p-5 h-full flex gap-3 min-h-0">
              {/* AI Thinking Terminal — fixed 2/3, same height as queue */}
              <div className="w-2/3 shrink-0 min-w-0 flex flex-col h-full">
                {thinkingLines.length > 0 && (
                  <AIThinkingTerminal
                    lines={thinkingLines}
                    isRunning={processingFiles.length > 0}
                    fileName={processingFiles[0]?.file.name || fileStates[0]?.file.name || "document"}
                    elapsedMs={elapsedMs}
                  />
                )}
              </div>
              {/* File Queue — fixed 1/3, same height as terminal */}
              <div className="w-1/3 shrink-0 min-w-0 h-full">
                <FileQueuePanel 
                  fileStates={fileStates} 
                  currentIndex={fileStates.findIndex(f => f.status === "identifying" || f.status === "uploading")}
                />
              </div>
            </div>
          )}

          {/* STEP: Confirm Type (User confirmation) */}
          {currentStep === "confirm_type" && (() => {
            // Group confirmed files by detected type for summary
            const typeGroups: Record<string, ContextFileUploadState[]> = {};
            const typeLabels: Record<string, string> = {
              bank_statement: "Bank Statement",
              invoice: "Invoice (Outgoing A/R)",
              bill: "Bill (Incoming A/P)",
              receipt: "Receipt → Bill",
              invoice_list: "Invoice List",
              vendor_list: "Vendor List",
              payment_record: "Payment Record",
              other: "Unknown",
            };
            const typeIcons: Record<string, any> = {
              bank_statement: FileText,
              invoice: ArrowUpRight,
              bill: ArrowDownRight,
              receipt: Receipt,
              invoice_list: FileSpreadsheet,
              vendor_list: Building2,
              payment_record: CheckCircle2,
              other: Files,
            };
            
            confirmedFiles.forEach(fs => {
              const t = fs.identifyResult?.detectedType || "other";
              if (!typeGroups[t]) typeGroups[t] = [];
              typeGroups[t].push(fs);
            });
            
            // Collect unique banks/vendors/currencies
            const banks = new Set<string>();
            const currencies = new Set<string>();
            confirmedFiles.forEach(fs => {
              if (fs.identifyResult?.detectedBank) banks.add(fs.identifyResult.detectedBank);
              if (fs.identifyResult?.currency) currencies.add(fs.identifyResult.currency);
            });
            
            const avgConfidence = confirmedFiles.length > 0
              ? confirmedFiles.reduce((sum, f) => sum + (f.identifyResult?.confidence || 0), 0) / confirmedFiles.length
              : 0;

            return (
              <div className="p-5 h-full flex flex-col space-y-4">
                {/* Terminal 2/3 + Queue 1/3 side by side */}
                <div className="flex gap-3 flex-1 min-h-0">
                  {/* AI Thinking Terminal — fixed 2/3, same height as queue */}
                  <div className="w-2/3 shrink-0 min-w-0 flex flex-col h-full">
                    {thinkingLines.length > 0 ? (
                      <AIThinkingTerminal
                        lines={thinkingLines}
                        isRunning={false}
                        fileName={fileStates[0]?.file.name || "document"}
                        elapsedMs={elapsedMs}
                      />
                    ) : (
                      <AIThinkingTerminal
                        lines={[
                          { type: "success", message: `Identified ${confirmedFiles.length} document${confirmedFiles.length !== 1 ? "s" : ""}` },
                          ...(rejectedFiles.length > 0 ? [{ type: "warning" as const, message: `${rejectedFiles.length} rejected (unsupported type)` }] : []),
                          ...(errorFiles.length > 0 ? [{ type: "warning" as const, message: `${errorFiles.length} failed to identify` }] : []),
                          { type: "info", message: "Waiting for confirmation to extract..." },
                        ]}
                        isRunning={false}
                        fileName={`${fileStates.length} documents`}
                        elapsedMs={elapsedMs}
                      />
                    )}
                  </div>
                  {/* File Queue — fixed 1/3, same height as terminal */}
                  <div className="w-1/3 shrink-0 min-w-0 h-full">
                    <FileQueuePanel fileStates={fileStates} />
                  </div>
                </div>
                
                {/* Status banners */}
                {confirmedFiles.length === 0 && rejectedFiles.length > 0 && errorFiles.length === 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 text-center">
                    <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
                      <ShieldAlert className="h-6 w-6 text-amber-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-amber-900 mb-1">No supported documents found</h3>
                    <p className="text-xs text-amber-700 mb-4">
                      None of the uploaded files are bank statements, invoices, or bills. Please upload relevant financial documents.
                    </p>
                    <Button
                      onClick={() => { resetState(); setThinkingLines([]); }}
                      className="bg-slate-900 text-white hover:bg-slate-800"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                )}
                
                {(rejectedFiles.length > 0 && confirmedFiles.length > 0) && (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg shrink-0">
                    <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700">
                      <strong>{rejectedFiles.length}</strong> {rejectedFiles.length === 1 ? "file" : "files"} rejected (not a supported document type)
                    </p>
                  </div>
                )}
                
                {errorFiles.length > 0 && (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg shrink-0">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <p className="text-xs text-red-700">
                      <strong>{errorFiles.length}</strong> {errorFiles.length === 1 ? "file" : "files"} failed to identify
                    </p>
                  </div>
                )}
                
                {/* Company name prompt — compact with AI suggestions */}
                {confirmedFiles.length > 0 && !((user as any)?.companyName) && 
                  confirmedFiles.some(f => f.identifyResult?.detectedType === "invoice" || f.identifyResult?.detectedType === "bill") && (() => {
                    // Collect AI-detected name suggestions from the batch with fuzzy dedup
                    const rawNames: string[] = [];
                    for (const f of confirmedFiles) {
                      const ir = f.identifyResult;
                      const ed = f.extractedData;
                      if (ed?.accountHolderName) rawNames.push(ed.accountHolderName);
                      if (ir?.invoiceFrom) rawNames.push(ir.invoiceFrom);
                      if (ir?.invoiceTo) rawNames.push(ir.invoiceTo);
                      if (ir?.detectedVendor) rawNames.push(ir.detectedVendor);
                      if (ir?.detectedCustomer) rawNames.push(ir.detectedCustomer);
                    }
                    // Fuzzy dedup: strip common suffixes and compare normalized forms
                    const normalize = (s: string) => s.toLowerCase()
                      .replace(/\b(b\.?v\.?|n\.?v\.?|ltd\.?|llc\.?|inc\.?|corp\.?|gmbh|s\.?a\.?|s\.?l\.?|s\.?r\.?l\.?|plc\.?|co\.?|pty\.?|pvt\.?)\b/gi, "")
                      .replace(/[.,\-_&()]/g, " ")
                      .replace(/\s+/g, " ")
                      .trim();
                    const seen = new Map<string, string>(); // normalized → longest original
                    for (const name of rawNames.filter(Boolean)) {
                      const norm = normalize(name);
                      if (!norm) continue;
                      const existing = seen.get(norm);
                      // If a normalized match exists, keep the longer (more complete) version
                      if (!existing || name.length > existing.length) {
                        seen.set(norm, name);
                      }
                      // Also check if one normalized form contains another
                      let isDuplicate = false;
                      for (const [existingNorm, existingName] of seen.entries()) {
                        if (existingNorm === norm) continue;
                        if (existingNorm.includes(norm) || norm.includes(existingNorm)) {
                          // Keep the longer one
                          const longer = name.length >= existingName.length ? name : existingName;
                          const longerNorm = name.length >= existingName.length ? norm : existingNorm;
                          const shorterNorm = name.length >= existingName.length ? existingNorm : norm;
                          seen.delete(shorterNorm);
                          seen.set(longerNorm, longer);
                          isDuplicate = true;
                          break;
                        }
                      }
                      if (!isDuplicate && !seen.has(norm)) {
                        seen.set(norm, name);
                      }
                    }
                    const uniqueSuggestions = Array.from(seen.values()).slice(0, 5);
                    
                    const saveName = async (name: string) => {
                      if (name && user?.id) {
                        try {
                          await updateDoc(doc(db, "users", user.id), { companyName: name });
                          toast.success(`Company set to "${name}"`);
                        } catch (err) {
                          console.error("Failed to save company name:", err);
                        }
                      }
                    };
                    
                    return (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50/80 shrink-0">
                        <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span className="text-[11px] text-blue-800 font-medium shrink-0">Your company?</span>
                        {uniqueSuggestions.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                            {uniqueSuggestions.map((name) => (
                              <button
                                key={name}
                                onClick={() => saveName(name)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-blue-200 text-[10px] font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors truncate max-w-[160px]"
                              >
                                <Sparkles className="h-2.5 w-2.5 shrink-0" />
                                {name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <Input
                            placeholder="Type company name..."
                            className="h-6 text-[10px] flex-1 bg-white min-w-[120px]"
                            onBlur={async (e) => saveName(e.target.value.trim())}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          />
                        )}
                      </div>
                    );
                  })()}

                {/* AI Detection Summary — two-column layout */}
                {confirmedFiles.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden shrink-0">
                    {/* Header */}
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                      <div className="p-2 bg-cyan-50 rounded-lg">
                        <Brain className="h-4 w-4 text-cyan-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">AI Detection Summary</p>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {confirmedFiles.length} {confirmedFiles.length === 1 ? "document" : "documents"} identified
                        </h3>
                      </div>
                      {avgConfidence >= 0.8 && (
                        <div className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[10px] font-semibold text-emerald-700">
                          {Math.round(avgConfidence * 100)}% avg confidence
                        </div>
                      )}
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Two-column grid: types + metadata */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Left column: Type breakdown */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Document Types</p>
                          {Object.entries(typeGroups).map(([type, files]) => {
                            const TypeIcon = typeIcons[type] || FileText;
                            const canFlipDirection = type === "invoice" || type === "bill";
                            const flipTarget = type === "invoice" ? "bill" : "invoice";
                            const flipLabel = type === "invoice" ? "Wrong direction — these are incoming bills (A/P)" : "Wrong direction — these are outgoing invoices (A/R)";
                            // Collect unique from/to across ALL files in this group
                            const uniqueFroms = new Set<string>();
                            const uniqueTos = new Set<string>();
                            files.forEach(f => {
                              if (f.identifyResult?.invoiceFrom) uniqueFroms.add(f.identifyResult.invoiceFrom);
                              if (f.identifyResult?.invoiceTo) uniqueTos.add(f.identifyResult.invoiceTo);
                            });
                            const invoiceFrom = uniqueFroms.size === 1 ? [...uniqueFroms][0] : (uniqueFroms.size > 1 ? `${uniqueFroms.size} different senders` : null);
                            const invoiceTo = uniqueTos.size === 1 ? [...uniqueTos][0] : (uniqueTos.size > 1 ? `${uniqueTos.size} different recipients` : null);
                            
                            return (
                              <div key={type} className="p-2.5 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-1.5 bg-white rounded-lg border border-slate-200 shrink-0">
                                    <TypeIcon className="h-3.5 w-3.5 text-cyan-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">
                                      {files.length} × {typeLabels[type] || type}
                                    </p>
                                    {type === "bank_statement" && banks.size > 0 && (
                                      <p className="text-[10px] text-slate-500 truncate">
                                        {Array.from(banks).join(", ")}
                                      </p>
                                    )}
                                    {(invoiceFrom || invoiceTo) && (
                                      <p className="text-[10px] text-slate-500 truncate">
                                        {invoiceFrom && `From: ${invoiceFrom}`}
                                        {invoiceFrom && invoiceTo && " → "}
                                        {invoiceTo && `To: ${invoiceTo}`}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    {Math.round((files.reduce((s, f) => s + (f.identifyResult?.confidence || 0), 0) / files.length) * 100)}%
                                  </span>
                                </div>
                                {/* Flip direction button */}
                                {canFlipDirection && (
                                  <button
                                    onClick={() => {
                                      // Flip all files of this type to the opposite
                                      setFileStates(prev => prev.map(f => {
                                        if (f.status !== "type_confirmed") return f;
                                        const fType = f.identifyResult?.detectedType;
                                        if (fType !== type) return f;
                                        const newMapped = flipTarget as DocumentType;
                                        return {
                                          ...f,
                                          confirmedType: newMapped,
                                          identifyResult: f.identifyResult ? {
                                            ...f.identifyResult,
                                            detectedType: flipTarget,
                                          } : undefined,
                                        };
                                      }));
                                    }}
                                    className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-500 hover:border-cyan-400 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                    {flipLabel}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Right column: Detected metadata */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Detected Details</p>
                          {Array.from(banks).map(b => (
                            <div key={b} className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl">
                              <div className="p-1.5 bg-white rounded-lg border border-slate-200 shrink-0">
                                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] text-slate-400 font-medium">Bank</p>
                                <p className="text-sm font-semibold text-slate-900 truncate">{b}</p>
                              </div>
                            </div>
                          ))}
                          {Array.from(currencies).map(c => (
                            <div key={c} className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl">
                              <div className="p-1.5 bg-white rounded-lg border border-slate-200 shrink-0">
                                <DollarSign className="h-3.5 w-3.5 text-slate-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] text-slate-400 font-medium">Currency</p>
                                <p className="text-sm font-semibold text-slate-900">{c}</p>
                              </div>
                            </div>
                          ))}
                          {banks.size === 0 && currencies.size === 0 && (
                            <div className="p-2.5 bg-slate-50 rounded-xl text-center">
                              <p className="text-xs text-slate-400">Details extracted on confirm</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Actions — full width */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => extractAllFiles()}
                          className="flex-1 bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-all duration-200 h-11"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Confirm & Extract {confirmedFiles.length > 1 ? `All ${confirmedFiles.length}` : ""}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            toast.error("Type override coming soon");
                          }}
                          className="border-slate-200 text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all duration-200 h-11"
                        >
                          Change Type
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* STEP: Extracting (Phase 2) */}
          {currentStep === "extracting" && (
            <div className="p-5 h-full flex gap-3 min-h-0">
              {/* AI Thinking Terminal — fixed 2/3, same height as queue */}
              <div className="w-2/3 shrink-0 min-w-0 flex flex-col h-full">
                {thinkingLines.length > 0 && (
                  <AIThinkingTerminal
                    lines={thinkingLines}
                    isRunning={processingFiles.length > 0}
                    fileName={processingFiles[0]?.file.name || fileStates[0]?.file.name || "document"}
                    elapsedMs={elapsedMs}
                  />
                )}
              </div>
              {/* File Queue — fixed 1/3, same height as terminal */}
              <div className="w-1/3 shrink-0 min-w-0 h-full">
                <FileQueuePanel
                  fileStates={fileStates}
                  currentIndex={fileStates.findIndex(f => f.status === "extracting")}
                  phase="extracting"
                />
              </div>
            </div>
          )}

          {/* STEP: Saving to Firestore */}
          {currentStep === "saving" && (
            <div className="p-5 h-full flex flex-col items-center justify-center text-center">
              <div className="h-14 w-14 rounded-2xl bg-cyan-50 flex items-center justify-center mb-4">
                <Loader2 className="h-7 w-7 text-cyan-600 animate-spin" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">Saving documents</h3>
              <p className="text-sm text-slate-500 mb-4">
                {savingProgress <= 35
                  ? `Checking ${validScannedFiles.length} documents for duplicates...`
                  : `Writing ${validScannedFiles.length} documents to your account...`}
              </p>
              {savingProgress > 0 && (
                <div className="w-full max-w-xs">
                  <Progress value={savingProgress} className="h-2" />
                  <p className="text-xs text-slate-400 mt-2">
                    {savingProgress <= 35 ? "Dedup check" : "Saving"} — {Math.round(savingProgress)}%
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP: Preview (Batch) */}
          {currentStep === "preview" && (
            <div className="p-5 h-full flex flex-col min-h-0">
              {/* Success banner */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg mb-4 shrink-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium text-emerald-700">
                  Scanned {scannedFiles.length} of {fileStates.length} files
                  {errorFiles.length > 0 && ` • ${errorFiles.length} failed`}
                </span>
              </div>

              {/* AI Detection Summary Card — handles mixed uploads */}
              {scannedFiles.length > 0 && (() => {
                // Build per-type summary
                const typeCounts: Record<string, { count: number; totalAmount: number; currency: string; totalTxns: number }> = {};
                scannedFiles.forEach(f => {
                  const t = f.confirmedType || (f.extractedData?.detectedType === "bank_statement" ? "statement" : f.extractedData?.detectedType) || "statement";
                  if (!typeCounts[t]) typeCounts[t] = { count: 0, totalAmount: 0, currency: f.extractedData?.currency || "USD", totalTxns: 0 };
                  typeCounts[t].count++;
                  typeCounts[t].totalAmount += f.extractedData?.total || 0;
                  typeCounts[t].totalTxns += f.extractedData?.transactionCount || 0;
                });
                const avgConfidence = scannedFiles.reduce((s, f) => s + (f.extractedData?.confidence || 0.85), 0) / scannedFiles.length;
                const typeLabelsMap: Record<string, string> = { statement: "Bank Statement", invoice: "Invoice (A/R)", bill: "Bill (A/P)" };
                const typeColors: Record<string, { bg: string; text: string; icon: string }> = {
                  statement: { bg: "bg-cyan-100", text: "text-cyan-700", icon: "text-cyan-600" },
                  invoice: { bg: "bg-emerald-100", text: "text-emerald-700", icon: "text-emerald-600" },
                  bill: { bg: "bg-amber-100", text: "text-amber-700", icon: "text-amber-600" },
                };
                const isMixed = Object.keys(typeCounts).length > 1;
                
                return (
                  <div className="mb-4 shrink-0">
                    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-100/40 to-blue-100/40 rounded-full blur-3xl" />
                      
                      <div className="relative">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
                            <Brain className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-slate-900">AI Detection</h4>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium">
                                {Math.round(avgConfidence * 100)}% confident
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mb-3">
                              {isMixed 
                                ? `Mixed upload: ${Object.entries(typeCounts).map(([t, c]) => `${c.count} ${typeLabelsMap[t] || t}${c.count !== 1 ? "s" : ""}`).join(", ")}`
                                : `${scannedFiles.length} ${typeLabelsMap[Object.keys(typeCounts)[0]] || "document"}${scannedFiles.length !== 1 ? "s" : ""} detected`
                              }
                            </p>
                            
                            {/* Per-type breakdown pills */}
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(typeCounts).map(([t, info]) => {
                                const colors = typeColors[t] || { bg: "bg-slate-100", text: "text-slate-700", icon: "text-slate-600" };
                                return (
                                  <div key={t} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", colors.bg, colors.text)}>
                                    {t === "statement" && <FileSpreadsheet className={cn("h-3 w-3", colors.icon)} />}
                                    {t === "invoice" && <Receipt className={cn("h-3 w-3", colors.icon)} />}
                                    {t === "bill" && <FileText className={cn("h-3 w-3", colors.icon)} />}
                                    {info.count} {typeLabelsMap[t] || t}{info.count !== 1 ? "s" : ""}
                                    {t === "statement" && info.totalTxns > 0 && (
                                      <span className="text-[10px] opacity-70 ml-1">~{info.totalTxns} txns</span>
                                    )}
                                    {(t === "invoice" || t === "bill") && info.totalAmount > 0 && (
                                      <span className="text-[10px] opacity-70 ml-1">{info.currency} {info.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                          <p className="text-[10px] text-slate-500">
                            ✓ All files classified and ready to save
                          </p>
                          <span className="text-[10px] text-emerald-600 font-medium">Ready to save</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto min-h-0 space-y-4">

                {/* Wrong document type - beautifully designed CTA */}
                {wrongTypeFiles.length > 0 && (
                  <div className="relative overflow-hidden rounded-xl border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 p-5">
                    {/* Decorative background */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-300/20 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-300/20 rounded-full blur-3xl" />
                    
                    <div className="relative">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/30">
                          <Brain className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-base font-bold text-slate-900">AI Detected Different Type</h4>
                            <span className="px-2 py-0.5 rounded-full bg-cyan-600 text-white text-[10px] font-bold">
                              BANK STATEMENT
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-4">
                            {wrongTypeFiles.length === 1 
                              ? "This file appears to be a bank statement, not a " 
                              : `${wrongTypeFiles.length} files appear to be bank statements, not `}
                            {selectedType === "bill" ? "bill" : "invoice"}.
                            The AI can process it correctly if you'd like.
                          </p>
                          
                          {/* File chips */}
                          <div className="flex flex-wrap gap-2 mb-4">
                            {wrongTypeFiles.slice(0, 3).map((wf, idx) => (
                              <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-lg border border-cyan-200 shadow-sm">
                                <FileSpreadsheet className="h-3 w-3 text-cyan-600" />
                                <span className="text-xs text-slate-700 font-medium truncate max-w-[140px]">
                                  {wf.file.name}
                                </span>
                                {wf.extractedData?.bankName && (
                                  <span className="text-[10px] text-slate-500">
                                    • {wf.extractedData.bankName}
                                  </span>
                                )}
                              </div>
                            ))}
                            {wrongTypeFiles.length > 3 && (
                              <div className="px-3 py-1.5 bg-white/60 rounded-lg border border-cyan-100">
                                <span className="text-xs text-cyan-600 font-medium">
                                  +{wrongTypeFiles.length - 3} more
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Action buttons */}
                          <div className="flex gap-3">
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-lg shadow-cyan-500/30"
                              onClick={() => {
                                setSelectedType("statement");
                                const filesToReprocess = wrongTypeFiles.map(wf => ({
                                  ...wf,
                                  status: "pending" as const,
                                  extractedData: undefined,
                                  suggestedType: undefined,
                                  error: undefined,
                                }));
                                setFileStates(filesToReprocess);
                                setCurrentStep("upload");
                                setTimeout(() => {
                                  identifyAllFiles(filesToReprocess.map(f => f.file));
                                }, 100);
                              }}
                            >
                              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                              Process as Bank Statement{wrongTypeFiles.length !== 1 ? "s" : ""}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="border border-cyan-200 hover:bg-white/80"
                              onClick={() => {
                                setFileStates(prev => prev.filter(f => f.status !== "wrong_type"));
                              }}
                            >
                              Remove {wrongTypeFiles.length} file{wrongTypeFiles.length !== 1 ? "s" : ""}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                  {/* Problem files warning with retry */}
                  {problemFiles.length > 0 && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-800">
                            {problemFiles.length} file{problemFiles.length !== 1 ? "s" : ""} couldn't be read properly
                          </p>
                          <div className="mt-2 space-y-1">
                            {problemFiles.map((pf, idx) => {
                              const fileIdx = fileStates.findIndex(f => f.file.name === pf.file.name);
                              const isRetrying = fileStates[fileIdx]?.status === "extracting" || fileStates[fileIdx]?.status === "uploading";
                              return (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                  <span className="text-amber-700 flex items-center gap-2">
                                    {isRetrying && <Loader2 className="h-3 w-3 animate-spin" />}
                                    {pf.file.name}
                                  </span>
                                  <button
                                    onClick={() => {
                                      if (fileIdx >= 0 && !isRetrying) {
                                        identifyFile(pf, fileIdx);
                                      }
                                    }}
                                    disabled={isRetrying}
                                    className={cn(
                                      "font-medium",
                                      isRetrying 
                                        ? "text-amber-400 cursor-not-allowed" 
                                        : "text-amber-800 hover:text-amber-900 underline"
                                    )}
                                  >
                                    {isRetrying ? "Scanning..." : "Retry"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Account summary for statements - grouped by bank/account */}
                  {groupedByAccount.length > 0 && (
                    <div className="mb-4 space-y-3">
                    {/* Multi-bank notice */}
                    {hasMultipleBanks && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
                        <span className="text-sm text-blue-700">
                          <span className="font-medium">{groupedByAccount.length} different accounts</span> detected - will create separate accounts
                        </span>
                      </div>
                    )}
                    
                    {/* Account groups */}
                    {groupedByAccount.map((group, groupIdx) => (
                        <div key={group.key} className="p-4 bg-slate-50 rounded-xl border">
                        <div className="flex items-center gap-2 mb-3">
                          <div className={cn(
                            "h-6 w-6 rounded-full flex items-center justify-center",
                            groupIdx === 0 && "bg-cyan-100",
                            groupIdx === 1 && "bg-purple-100",
                            groupIdx === 2 && "bg-amber-100",
                            groupIdx >= 3 && "bg-slate-200"
                          )}>
                            <Building2 className={cn(
                              "h-3.5 w-3.5",
                              groupIdx === 0 && "text-cyan-600",
                              groupIdx === 1 && "text-purple-600",
                              groupIdx === 2 && "text-amber-600",
                              groupIdx >= 3 && "text-slate-500"
                            )} />
                          </div>
                          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                            {group.files.length} Statement{group.files.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-slate-500">Bank</span>
                            <span className="text-sm font-medium text-slate-700">
                              {group.bankName}
                              {group.bankCountry && <span className="text-slate-400 ml-1">({group.bankCountry})</span>}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500">Account #</span>
                            {group.accountNumber === "Unknown" || !group.accountNumber ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  placeholder="Enter account #"
                                  className="h-7 w-36 text-xs font-mono text-right"
                                  onChange={(e) => {
                                    const newAccNum = e.target.value;
                                    // Update all files in this group
                                    setFileStates(prev => prev.map(f => {
                                      if (!f.extractedData) return f;
                                      // Match files belonging to this group by checking bank name
                                      const fBankName = (f.extractedData.bankName || "Unknown Bank").toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
                                      const groupBankName = group.bankName.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
                                      const fAcct = f.extractedData.accountNumber || "Unknown";
                                      if (fBankName === groupBankName && fAcct === "Unknown") {
                                        return {
                                          ...f,
                                          extractedData: {
                                            ...f.extractedData,
                                            accountNumber: newAccNum || "Unknown",
                                          }
                                        };
                                      }
                                      return f;
                                    }));
                                  }}
                                />
                                <span className="text-[10px] text-slate-400">optional</span>
                              </div>
                            ) : (
                              <span className="text-sm font-medium text-slate-700 font-mono">
                                ****{group.accountNumber.slice(-4)}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-slate-500">Currency</span>
                            <span className="text-sm font-medium text-slate-700">{group.currency || "USD"}</span>
                          </div>
                          {group.accountHolderName && (
                            <div className="flex justify-between">
                              <span className="text-sm text-slate-500">Holder</span>
                              <span className="text-sm font-medium text-slate-700">{group.accountHolderName}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-sm text-slate-500">Period</span>
                            <span className="text-sm font-medium text-slate-700">
                              {group.periodStart} → {group.periodEnd}
                            </span>
                          </div>
                          <div className="pt-2 border-t flex justify-between">
                            <span className="text-sm text-slate-500">Transactions</span>
                            <span className="text-sm font-semibold text-cyan-600">~{group.totalTransactions}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Invoice summary */}
                {invoiceFiles.length > 0 && (
                  <div className="mb-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider">
                        {invoiceFiles.length} Invoice{invoiceFiles.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {invoiceFiles.slice(0, 5).map((f, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span className="text-slate-600 truncate max-w-[60%]">{f.extractedData?.customerName || f.file.name}</span>
                          <span className="font-medium text-slate-700">
                            {f.extractedData?.currency || "USD"} {(f.extractedData?.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                      {invoiceFiles.length > 5 && (
                        <div className="text-[10px] text-slate-400 pt-1">
                          + {invoiceFiles.length - 5} more invoices
                        </div>
                      )}
                      <div className="pt-2 border-t border-emerald-200 flex justify-between">
                        <span className="text-sm text-slate-500">Total</span>
                        <span className="text-sm font-semibold text-emerald-600">
                          {(invoiceFiles.reduce((sum, f) => sum + (f.extractedData?.total || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bills summary */}
                {billFiles.length > 0 && (
                  <div className="mb-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center">
                        <FileText className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">
                        {billFiles.length} Bill{billFiles.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {billFiles.slice(0, 5).map((f, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span className="text-slate-600 truncate max-w-[60%]">{f.extractedData?.vendorName || f.file.name}</span>
                          <span className="font-medium text-slate-700">
                            {f.extractedData?.currency || "USD"} {(f.extractedData?.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                      {billFiles.length > 5 && (
                        <div className="text-[10px] text-slate-400 pt-1">
                          + {billFiles.length - 5} more bills
                        </div>
                      )}
                      <div className="pt-2 border-t border-amber-200 flex justify-between">
                        <span className="text-sm text-slate-500">Total</span>
                        <span className="text-sm font-semibold text-amber-600">
                          {(billFiles.reduce((sum, f) => sum + (f.extractedData?.total || 0), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bank Identification Required */}
                {hasUnidentifiedBanks && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-red-800 mb-1">
                          Bank Name Required
                        </h4>
                        <p className="text-xs text-red-700 mb-3">
                          {filesNeedingBankId.length} file(s) don't have a bank name. Please specify the bank for each:
                        </p>
                        <div className="space-y-2">
                          {filesNeedingBankId.map((file, idx) => {
                            const fileIdx = fileStates.indexOf(file);
                            return (
                              <div key={fileIdx} className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
                                <span className="text-xs text-red-700 truncate max-w-[120px]">{file.file.name}</span>
                                <Input
                                  placeholder="Enter bank name..."
                                  className="flex-1 h-8 text-xs"
                                  defaultValue={file.extractedData?.bankName !== "Unknown Bank" ? file.extractedData?.bankName : ""}
                                  onChange={(e) => {
                                    setFileStates(prev => prev.map((f, i) => 
                                      i === fileIdx && f.extractedData
                                        ? { 
                                            ...f, 
                                            extractedData: { 
                                              ...f.extractedData, 
                                              bankName: e.target.value,
                                              needsBankIdentification: false 
                                            } 
                                          }
                                        : f
                                    ));
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Template Learning - Beautiful gradient card */}
                {hasUnconfirmedRules && !hasUnidentifiedBanks && (
                  <div className="relative overflow-hidden rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-5">
                    {/* Animated background */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-purple-300/20 rounded-full blur-3xl animate-pulse" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-300/20 rounded-full blur-3xl animate-pulse delay-1000" />
                    
                    <div className="relative">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/30">
                          <Brain className="h-6 w-6 text-white animate-pulse" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-base font-bold text-slate-900">New Template Detected!</h4>
                            <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center gap-1">
                              <Sparkles className="h-2.5 w-2.5" />
                              AI LEARNING
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-4">
                            AI detected a new CSV format for {filesNeedingRulesConfirmation[0]?.extractedData?.bankName || "this bank"}. 
                            Confirm the column mapping below — future uploads will be <strong>instant</strong>!
                          </p>
                          
                          {/* Column mapping preview */}
                          {filesNeedingRulesConfirmation[0]?.extractedData?.csvParsingRules && (
                            <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-purple-100 shadow-sm mb-4">
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="h-6 w-6 rounded-md bg-purple-100 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-purple-600">D</span>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-[10px]">Date Column</p>
                                    <p className="font-semibold text-slate-900">
                                      {filesNeedingRulesConfirmation[0].extractedData.csvParsingRules.dateColumn}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="h-6 w-6 rounded-md bg-pink-100 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-pink-600">F</span>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-[10px]">Date Format</p>
                                    <p className="font-semibold text-slate-900 font-mono">
                                      {filesNeedingRulesConfirmation[0].extractedData.csvParsingRules.dateFormat}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="h-6 w-6 rounded-md bg-blue-100 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-blue-600">T</span>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-[10px]">Description</p>
                                    <p className="font-semibold text-slate-900">
                                      {filesNeedingRulesConfirmation[0].extractedData.csvParsingRules.descriptionColumn}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="h-6 w-6 rounded-md bg-emerald-100 flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-emerald-600">$</span>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-[10px]">Amount</p>
                                    <p className="font-semibold text-slate-900 text-[11px]">
                                      {filesNeedingRulesConfirmation[0].extractedData.csvParsingRules.amountColumn || 
                                       `${filesNeedingRulesConfirmation[0].extractedData.csvParsingRules.debitColumn} / ${filesNeedingRulesConfirmation[0].extractedData.csvParsingRules.creditColumn}`}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Sample headers */}
                              {filesNeedingRulesConfirmation[0].extractedData.csvParsingRules.sampleHeaders && (
                                <div className="mt-3 pt-3 border-t border-purple-100">
                                  <p className="text-[10px] text-purple-600 mb-1.5 font-medium">Detected Headers:</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {filesNeedingRulesConfirmation[0].extractedData.csvParsingRules.sampleHeaders.slice(0, 8).map((header, idx) => (
                                      <span key={idx} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-mono">
                                        {header}
                                      </span>
                                    ))}
                                    {filesNeedingRulesConfirmation[0].extractedData.csvParsingRules.sampleHeaders.length > 8 && (
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                                        +{filesNeedingRulesConfirmation[0].extractedData.csvParsingRules.sampleHeaders.length - 8} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Info callout */}
                          <div className="flex items-center gap-2 px-3 py-2 bg-purple-100/60 border border-purple-200 rounded-lg mb-4">
                            <Sparkles className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                            <p className="text-xs text-purple-700">
                              <strong>One-time setup:</strong> Once confirmed, this template will be saved and future {filesNeedingRulesConfirmation[0]?.extractedData?.bankName || "bank"} CSVs will extract in seconds.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                  {/* AI Reasoning - collapsible */}
                  {thinkingLines.length > 0 && (
                    <div className="mb-4">
                      <button
                        onClick={() => setExpandedFileIndex(expandedFileIndex === -99 ? null : -99)}
                        className="flex items-center gap-2 w-full text-left mb-2 group"
                      >
                        <Terminal className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">AI Reasoning</span>
                        <span className="text-[10px] text-slate-300 ml-auto">
                          {expandedFileIndex === -99 ? "Hide" : "Show"}
                        </span>
                        {expandedFileIndex === -99 
                          ? <ChevronDown className="h-3 w-3 text-slate-300" />
                          : <ChevronRight className="h-3 w-3 text-slate-300" />
                        }
                      </button>
                      {expandedFileIndex === -99 && (
                        <AIThinkingTerminal
                          lines={thinkingLines}
                          isRunning={false}
                          fileName={fileStates[0]?.file.name || "document"}
                          elapsedMs={elapsedMs}
                        />
                      )}
                    </div>
                  )}

                  {/* Transaction Preview */}
                  {selectedType === "statement" && scannedFiles.length > 0 && scannedFiles[0].extractedData?.sampleTransactions && scannedFiles[0].extractedData.sampleTransactions.length > 0 && (
                    <div className="mb-4 rounded-xl border border-slate-200 overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Transaction Preview</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Showing {Math.min(5, scannedFiles[0].extractedData.sampleTransactions.length)} of ~{scannedFiles[0].extractedData.transactionCount || scannedFiles[0].extractedData.sampleTransactions.length}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {scannedFiles[0].extractedData.sampleTransactions.slice(0, 5).map((txn, txnIdx) => (
                          <div key={txnIdx} className="flex items-center gap-3 px-3 py-2">
                            <span className="text-[10px] text-slate-400 font-mono w-16 shrink-0">{txn.date}</span>
                            <span className="text-xs text-slate-600 truncate flex-1">{txn.description}</span>
                            <span className={cn(
                              "text-xs font-mono font-medium shrink-0",
                              txn.amount >= 0 ? "text-emerald-600" : "text-slate-700"
                            )}>
                              {txn.amount >= 0 ? "+" : ""}{txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* File list */}
                  <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Files className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      {scannedFiles.length} {getDocTypeName(selectedType, scannedFiles.length)}
                    </span>
                  </div>
                  
                  {fileStates.map((fs, idx) => (
                    <div 
                      key={idx} 
                      className={cn(
                        "border rounded-lg overflow-hidden",
                        fs.status === "error" && "border-red-200 bg-red-50"
                      )}
                    >
                      {/* File header */}
                      <div 
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50"
                        onClick={() => setExpandedFileIndex(expandedFileIndex === idx ? null : idx)}
                      >
                      <div className={cn(
                        "h-6 w-6 rounded flex items-center justify-center shrink-0",
                        fs.status === "extracted" && "bg-emerald-100 text-emerald-600",
                        fs.status === "error" && "bg-red-100 text-red-600"
                      )}>
                        {fs.status === "extracted" && <Check className="h-3.5 w-3.5" />}
                        {fs.status === "error" && <X className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{fs.file.name}</p>
                        {fs.status === "extracted" && fs.extractedData && (
                          <p className="text-xs text-slate-400">
                            {selectedType === "statement" 
                              ? `${fs.extractedData.periodStart || ''} • ${fs.extractedData.transactionCount} txns`
                              : `${fs.extractedData.vendorName || 'Unknown'} • ${fs.extractedData.currency || ''} ${fs.extractedData.total?.toLocaleString() || 0}`
                            }
                          </p>
                        )}
                        {fs.status === "error" && (
                          <p className="text-xs text-red-500">{fs.error}</p>
                        )}
                      </div>
                      {fs.status === "extracted" && (
                        expandedFileIndex === idx 
                          ? <ChevronDown className="h-4 w-4 text-slate-400" />
                          : <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                        className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Expanded details - adapts to document type */}
                    {expandedFileIndex === idx && fs.status === "extracted" && fs.extractedData && (
                      <div className="px-3 pb-3 border-t bg-slate-50">
                        <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                          {selectedType === "statement" ? (
                            <>
                              <div>
                                <span className="text-slate-400">Period</span>
                                <p className="font-medium text-slate-700">
                                  {fs.extractedData.periodStart} → {fs.extractedData.periodEnd}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-400">Currency</span>
                                <p className="font-medium text-slate-700">{fs.extractedData.currency}</p>
                              </div>
                              <div>
                                <span className="text-slate-400">Opening</span>
                                <p className="font-medium text-slate-700">
                                  {fs.extractedData.openingBalance?.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-400">Closing</span>
                                <p className="font-medium text-slate-700">
                                  {fs.extractedData.closingBalance?.toLocaleString()}
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <span className="text-slate-400">{selectedType === "bill" ? "Bill #" : "Invoice #"}</span>
                                <p className="font-medium text-slate-700">{fs.extractedData.documentNumber || "-"}</p>
                              </div>
                              <div>
                                <span className="text-slate-400">{selectedType === "bill" ? "Vendor" : "Customer"}</span>
                                <p className="font-medium text-slate-700">
                                  {selectedType === "bill" ? fs.extractedData.vendorName : fs.extractedData.customerName || "-"}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-400">Total</span>
                                <p className="font-medium text-slate-700">
                                  {fs.extractedData.currency} {fs.extractedData.total?.toLocaleString() || "0"}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-400">Due Date</span>
                                <p className="font-medium text-slate-700">{fs.extractedData.dueDate || "-"}</p>
                              </div>
                              {fs.extractedData.bankName && (
                                <div>
                                  <span className="text-slate-400">Pay to Bank</span>
                                  <p className="font-medium text-slate-700">{fs.extractedData.bankName}</p>
                                </div>
                              )}
                              {fs.extractedData.accountNumber && (
                                <div>
                                  <span className="text-slate-400">Account #</span>
                                  <p className="font-medium text-slate-700">{fs.extractedData.accountNumber}</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Transaction preview - only for statements */}
                        {selectedType === "statement" && fs.extractedData.sampleTransactions && fs.extractedData.sampleTransactions.length > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center gap-2 mb-2">
                              <List className="h-3 w-3 text-slate-400" />
                              <span className="text-[10px] font-medium text-slate-400 uppercase">Preview</span>
                            </div>
                            <div className="space-y-1">
                              {fs.extractedData.sampleTransactions.slice(0, 3).map((tx, txIdx) => (
                                <div key={txIdx} className="flex items-center gap-2 text-xs">
                                  <div className={cn(
                                    "h-4 w-4 rounded flex items-center justify-center",
                                    tx.type === "credit" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                                  )}>
                                    {tx.type === "credit" ? <ArrowDownRight className="h-2.5 w-2.5" /> : <ArrowUpRight className="h-2.5 w-2.5" />}
                                  </div>
                                  <span className="flex-1 truncate text-slate-600">{tx.description}</span>
                                  <span className={cn(
                                    "font-medium",
                                    tx.type === "credit" ? "text-emerald-600" : "text-red-600"
                                  )}>
                                    {tx.type === "credit" ? "+" : "-"}{tx.amount?.toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

                {/* Error message */}
                {error && (
                  <div className="mt-3 flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {error}
                  </div>
                )}
              </div>
              {/* End scrollable content */}
            </div>
          )}

          {/* STEP: Complete */}
          {currentStep === "complete" && (
            <div className="p-5 h-full flex flex-col items-center justify-center">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">
                  {savedCount} Document{savedCount !== 1 ? "s" : ""} Saved!
                </h3>
                <p className="text-sm text-slate-500 mb-2">
                  {statementFiles.length > 0 && invoiceFiles.length === 0 && billFiles.length === 0
                    ? (groupedByAccount.length > 1 
                        ? `${statementFiles.length} statements saved to ${groupedByAccount.length} accounts • Full transaction import running in background`
                        : `${statementFiles.length} statement${statementFiles.length !== 1 ? "s" : ""} saved • Full transaction import running in background`)
                    : statementFiles.length === 0 
                      ? `Your ${getDocTypeName(selectedType, savedCount).toLowerCase()} ${savedCount !== 1 ? "are" : "is"} ready for review`
                      : [
                          statementFiles.length > 0 ? `${statementFiles.length} statement${statementFiles.length !== 1 ? "s" : ""} (importing in background)` : "",
                          invoiceFiles.length > 0 ? `${invoiceFiles.length} invoice${invoiceFiles.length !== 1 ? "s" : ""}` : "",
                          billFiles.length > 0 ? `${billFiles.length} bill${billFiles.length !== 1 ? "s" : ""}` : "",
                        ].filter(Boolean).join(", ")
                  }
                </p>
                {skippedCount > 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full mb-4">
                    {skippedCount} duplicate{skippedCount !== 1 ? "s" : ""} skipped (already uploaded)
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      resetState();
                      setCurrentStep("upload");
                    }}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload More
                  </Button>
                  <Button 
                    onClick={() => {
                      resetState();
                      handleClose();
                    }} 
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Identifying step */}
        {currentStep === "identifying" && (
          <div className="px-5 py-4 border-t shrink-0 bg-slate-50">
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">What Gemini 3 is doing</h4>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-slate-100">
                <FileSearch className="h-3.5 w-3.5 text-cyan-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-700">Document Type</p>
                  <p className="text-[10px] text-slate-400">Statement, invoice, or bill</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-slate-100">
                <Building2 className="h-3.5 w-3.5 text-cyan-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-700">Bank / Vendor</p>
                  <p className="text-[10px] text-slate-400">Auto-detected from content</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-slate-100">
                <DollarSign className="h-3.5 w-3.5 text-cyan-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-700">Currency</p>
                  <p className="text-[10px] text-slate-400">Identified automatically</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-slate-100">
                <Sparkles className="h-3.5 w-3.5 text-cyan-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-700">Format Analysis</p>
                  <p className="text-[10px] text-slate-400">Learns your file structure</p>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Powered by Google Gemini 3 Pro with multimodal vision
            </p>
          </div>
        )}

        {/* Footer - Extracting step */}
        {currentStep === "extracting" && (
          <div className="px-5 py-4 border-t shrink-0 bg-slate-50">
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">Now extracting</h4>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-slate-100">
                <List className="h-3.5 w-3.5 text-cyan-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-700">Transactions</p>
                  <p className="text-[10px] text-slate-400">Dates, amounts, descriptions</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-slate-100">
                <Building2 className="h-3.5 w-3.5 text-cyan-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-700">Account Details</p>
                  <p className="text-[10px] text-slate-400">Numbers, holder, bank</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-slate-100">
                <DollarSign className="h-3.5 w-3.5 text-cyan-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-700">Balances</p>
                  <p className="text-[10px] text-slate-400">Opening, closing, running</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-slate-100">
                <Brain className="h-3.5 w-3.5 text-cyan-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-700">Smart Parsing</p>
                  <p className="text-[10px] text-slate-400">AI learns your format</p>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Powered by Google Gemini 3 with structured output
            </p>
          </div>
        )}

        {/* Footer - Saving step */}
        {currentStep === "saving" && (
          <div className="px-5 py-4 border-t shrink-0 bg-white">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <Loader2 className="h-4 w-4 text-cyan-600 animate-spin" />
              <span className="text-xs font-semibold text-slate-900">
                Saving to Firestore...
              </span>
            </div>
          </div>
        )}

        {/* Footer - Upload step */}
        {currentStep === "upload" && !isAtLimit && (
          <div className="px-5 py-4 border-t shrink-0 bg-slate-50">
            <div className="p-4 bg-white rounded-xl border mb-3">
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">Supported formats</h4>
              <div className="grid grid-cols-3 gap-2">
                {config.fileTypes.map((ft) => (
                  <div key={ft.label} className="flex items-center gap-2 text-xs text-slate-600">
                    {ft.label === "CSV" || ft.label === "Excel" ? (
                      <FileSpreadsheet className={`h-4 w-4 ${ft.label === "CSV" ? "text-emerald-500" : "text-emerald-600"}`} />
                    ) : (
                      <FileText className={`h-4 w-4 ${
                        ft.label === "PDF" ? "text-red-500" : 
                        ft.label === "PNG" ? "text-purple-500" : 
                        "text-green-500"
                      }`} />
                    )}
                    <span>{ft.label} {ft.label === "PDF" ? "files" : ft.label === "PNG" || ft.label === "JPG" ? "images" : "files"}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Tip: Clear, high-resolution scans work best for accurate extraction
              </p>
            </div>
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-600">Pages remaining this month</span>
              </div>
              <span className="text-xs font-semibold text-slate-900">
                {Math.max(0, pagesLimit - pagesUsed).toLocaleString()} of {pagesLimit.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Footer - Preview step */}
        {currentStep === "preview" && (
          <div className="px-5 py-4 border-t shrink-0 bg-white">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCurrentStep("upload");
                  setFileStates([]);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              {hasUnidentifiedBanks ? (
                <Button
                  className="flex-1 bg-slate-400 cursor-not-allowed"
                  disabled
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Enter Bank Names First
                </Button>
              ) : hasUnconfirmedRules ? (
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                  onClick={confirmAllParsingRules}
                  disabled={confirmingRules}
                >
                  {confirmingRules ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  {confirmingRules ? "Confirming..." : `Confirm Parsing Rules (${filesNeedingRulesConfirmation.length} files)`}
                </Button>
              ) : (
                <Button
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                  onClick={handleSaveAll}
                  disabled={validScannedFiles.length === 0}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save {validScannedFiles.length} Document{validScannedFiles.length !== 1 ? "s" : ""}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Prompt Modal */}
      <UpgradePrompt
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
        currentPlan="free"
        pagesUsed={pagesUsed}
        pagesLimit={pagesLimit}
        trigger="limit_reached"
      />
    </>
  );
}
