"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { collection, addDoc, serverTimestamp, Timestamp, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
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
type DrawerStep = "upload" | "identifying" | "confirm_type" | "extracting" | "preview" | "complete";

interface IdentifyResult {
  detectedType: "bank_statement" | "invoice" | "bill" | "receipt" | "vendor_list" | "invoice_list" | "payment_record" | "other";
  confidence: number;
  detectedBank?: string;
  detectedVendor?: string;
  detectedCustomer?: string;
  currency?: string;
  pageCount?: number;
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: DocumentType;
  onUploadComplete?: () => void;
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
    title: "Upload Bank Statements",
    subtitle: "Import your bank statements",
    description: "Upload PDF or image bank statements and we'll automatically extract all transactions, dates, and balances.",
    features: [
      "Extracts all transactions automatically",
      "Detects account numbers & bank details",
      "Supports multi-page statements",
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
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-4">
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
            <span className="text-xs font-mono text-slate-500">Gemini 3 Flash — Document Analysis</span>
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
        className="p-4 font-mono text-[11px] leading-[1.6] max-h-[280px] overflow-y-auto scroll-smooth"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
      >
        {/* Init line */}
        <div className="text-slate-400 mb-2">
          <span className="text-cyan-600">$</span> smartinvoice scan {fileName} --engine=gemini-3-flash
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
// UPLOAD DRAWER COMPONENT
// ============================================

export function UploadDrawer({ 
  open, 
  onOpenChange, 
  defaultType = "statement",
  onUploadComplete,
}: UploadDrawerProps) {
  const { user } = useAuth();
  const { isAtLimit, pagesUsed, pagesLimit } = useUsageStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [processingStage, setProcessingStage] = useState("");
  
  // AI Thinking terminal state
  const [thinkingLines, setThinkingLines] = useState<ThinkingLine[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);
  
  // Use persistent state from context
  const { 
    state: uploadState, 
    setFileStates, 
    setStep: setCurrentStep, 
    setSelectedType,
    setSavedCount, 
    setSkippedCount,
    resetState,
  } = useUploadState();
  
  const fileStates = uploadState.fileStates;
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
  const allScanned = fileStates.length > 0 && fileStates.every(f => 
    f.status === "scanned" || f.status === "error" || f.status === "wrong_type" || f.status === "needs_rules_confirmation"
  );
  
  // Files with wrong detected type
  const wrongTypeFiles = fileStates.filter(f => f.status === "wrong_type");
  
  // Files needing CSV parsing rules confirmation (CSV files with new rules)
  const filesNeedingRulesConfirmation = useMemo(() => {
    return scannedFiles.filter(f => 
      f.extractedData?.csvParsingRulesStatus === "new" && 
      f.file.name.toLowerCase().endsWith(".csv")
    );
  }, [scannedFiles]);
  
  // Files needing bank identification (bank name not in CSV)
  const filesNeedingBankId = useMemo(() => {
    return scannedFiles.filter(f => 
      f.extractedData?.needsBankIdentification === true ||
      f.extractedData?.bankName === "Unknown Bank"
    );
  }, [scannedFiles]);
  
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
    
    // Helper to normalize bank names for consistent grouping
    const normalizeBankName = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/\./g, '') // Remove periods (N.V. -> NV)
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    };
    
    validScannedFiles.forEach(file => {
      const bankName = file.extractedData?.bankName || "Unknown Bank";
      const accountNumber = file.extractedData?.accountNumber || "Unknown";
      // Use normalized bank name for grouping key to handle variations like "N.V." vs "NV"
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
      
      // Update period range
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
  }, [validScannedFiles]);
  
  // For backward compatibility - use first group as aggregate (for single-bank uploads)
  const aggregateData = groupedByAccount.length > 0 ? groupedByAccount[0] : null;
  
  // Check if we have multiple different banks/accounts
  const hasMultipleBanks = groupedByAccount.length > 1;

  // Debug logging
  if (scannedFiles.length > 0) {
    console.log("=== GROUPED DATA DEBUG ===");
    console.log("Groups count:", groupedByAccount.length);
    groupedByAccount.forEach((g, i) => {
      console.log(`Group ${i}: ${g.bankName} (${g.accountNumber}) - ${g.files.length} files`);
    });
    console.log("==========================");
  }

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
      onOpenChange(false);
    }, 500);
  }, [onOpenChange]);

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
      addThinkingLine("analyze", "Initializing Gemini 3 Flash with thinking...");
      addThinkingLine("info", "Mode: ThinkingLevel=LOW, structured JSON output");
      addThinkingLine("search", "Scanning first page for document signatures...");
      addThinkingLine("search", "Looking for: bank logos, invoice headers, transaction tables...");
      addThinkingLine("template", "Classifying document type with confidence scoring...");
      
      updateFileState({ status: "identifying" });
      
      const mimeType = getMimeType(fileState.file);
      const identifyFn = httpsCallable(functions, "identifyDocumentType", { timeout: 60000 });
      
      const identifyResult = await identifyFn({ 
        fileUrl: url, 
        mimeType,
        fileName: fileState.file.name 
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
      if (identified.detectedVendor) {
        addThinkingLine("match", `Vendor: ${identified.detectedVendor}`);
      }
      if (identified.detectedCustomer) {
        addThinkingLine("match", `Customer: ${identified.detectedCustomer}`);
      }
      if (identified.currency) {
        addThinkingLine("info", `Currency: ${identified.currency}`);
      }
      
      addThinkingLine("info", identified.reasoning);
      addThinkingLine("warning", "⏸  Waiting for user confirmation...");
      
      // Map detected type to our DocumentType
      let mappedType: DocumentType = "statement";
      if (identified.detectedType === "bank_statement") mappedType = "statement";
      else if (identified.detectedType === "invoice") mappedType = "invoice";
      else if (identified.detectedType === "bill") mappedType = "bill";
      
      updateFileState({ 
        status: "type_confirmed",
        identifyResult: identified,
        confirmedType: mappedType,
      });

    } catch (err) {
      console.error("=== IDENTIFICATION ERROR ===");
      console.error("Full error:", err);
      console.error("Error code:", (err as any)?.code);
      console.error("Error message:", (err as any)?.message);
      console.error("============================");
      
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
  }, [user?.id, setFileStates]);

  // PHASE 2: Extract Full Data (after type confirmation)
  const extractFile = useCallback(async (fileState: ContextFileUploadState, index: number) => {
    if (!user?.id || !fileState.confirmedType) return;
    
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
    setProcessingStage("");
    
    // Initialize file states
    const initialStates: ContextFileUploadState[] = files.map(file => ({
      file,
      status: "pending",
    }));
    setFileStates(initialStates);
    
    // Process files sequentially for better UX (user sees progress)
    for (let i = 0; i < files.length; i++) {
      await identifyFile(initialStates[i], i);
    }
    
    setCurrentStep("confirm_type");
  }, [user?.id, identifyFile, setFileStates, setCurrentStep]);

  // Extract all confirmed files - PHASE 2
  const extractAllFiles = useCallback(async () => {
    setThinkingLines([]);
    setElapsedMs(0);
    startTimeRef.current = Date.now();
    setCurrentStep("extracting");

    // Process all confirmed files
    const confirmedFiles = fileStates.filter(f => f.status === "type_confirmed");
    for (let i = 0; i < confirmedFiles.length; i++) {
      const originalIndex = fileStates.indexOf(confirmedFiles[i]);
      await extractFile(confirmedFiles[i], originalIndex);
    }
    
    setCurrentStep("preview");
  }, [fileStates, extractFile]);

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
    setProcessingStage("Confirming parsing rules...");
    
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
    setProcessingStage("");
  }, [user?.id, filesNeedingRulesConfirmation, setFileStates]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelect(e.dataTransfer.files);
  }, [handleFilesSelect]);

  // Save all documents (only valid ones)
  const handleSaveAll = async () => {
    console.log("=== SAVE ALL CLICKED ===");
    console.log("user?.id:", user?.id);
    console.log("validScannedFiles.length:", validScannedFiles.length);
    console.log("problemFiles.length:", problemFiles.length);
    console.log("scannedFiles.length:", scannedFiles.length);
    console.log("selectedType:", selectedType);
    console.log("config.collection:", config.collection);
    
    if (!user?.id || validScannedFiles.length === 0) {
      console.warn("Early return - no user or no valid files!");
      return;
    }

    setCurrentStep("processing");
    setProcessingStage(`Saving ${config.title.toLowerCase()}s...`);
    setSavingProgress(0);

    try {
      // For statements with multiple banks, create/find accounts for each group
      const accountIdMap: Record<string, string> = {}; // key -> accountId
      
      if (selectedType === "statement" && groupedByAccount.length > 0) {
        setProcessingStage(`Setting up ${groupedByAccount.length} account(s)...`);
        
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
        
        console.log("Created/found accounts:", accountIdMap);
      }

      // Save each statement (with deduplication)
      let savedCount = 0;
      let skippedCount = 0;
      
      // Helper to normalize bank names (same as grouping logic)
      const normalizeBankName = (name: string): string => {
        return name
          .toLowerCase()
          .replace(/\./g, '') // Remove periods (N.V. -> NV)
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
      };
      
      for (let i = 0; i < validScannedFiles.length; i++) {
        const fileState = validScannedFiles[i];
        const extracted = fileState.extractedData!;
        
        // Determine which account this file belongs to (use normalized bank name)
        const normalizedBankName = normalizeBankName(extracted.bankName || "Unknown Bank");
        const fileKey = `${normalizedBankName}|${extracted.accountNumber || "Unknown"}`;
        const accountId = accountIdMap[fileKey] || null;
        
        setProcessingStage(`Checking ${i + 1} of ${validScannedFiles.length}...`);
        setSavingProgress(((i + 0.5) / validScannedFiles.length) * 100);

        // Deduplication check for statements
        if (selectedType === "statement" && extracted.periodStart && extracted.periodEnd) {
          const dupeQuery = query(
            collection(db, "statements"),
            where("userId", "==", user.id),
            where("accountNumber", "==", extracted.accountNumber),
            where("periodStart", "==", Timestamp.fromDate(new Date(extracted.periodStart))),
            where("periodEnd", "==", Timestamp.fromDate(new Date(extracted.periodEnd)))
          );
          const existingStatements = await getDocs(dupeQuery);
          
          if (!existingStatements.empty) {
            console.log(`Skipping duplicate statement: ${extracted.periodStart} - ${extracted.periodEnd}`);
            skippedCount++;
            continue; // Skip this file
          }
        }
        
        // Deduplication check for bills - by documentNumber + vendorName + total
        if (selectedType === "bill" && extracted.documentNumber && extracted.documentNumber !== "Unknown") {
          const dupeQuery = query(
            collection(db, "bills"),
            where("userId", "==", user.id),
            where("documentNumber", "==", extracted.documentNumber),
            where("vendorName", "==", extracted.vendorName || "Unknown"),
            where("total", "==", extracted.total || 0)
          );
          const existingBills = await getDocs(dupeQuery);
          
          if (!existingBills.empty) {
            console.log(`Skipping duplicate bill: ${extracted.documentNumber} from ${extracted.vendorName}`);
            skippedCount++;
            continue; // Skip this file
          }
        }
        
        // Deduplication check for invoices - by documentNumber + customerName + total
        if (selectedType === "invoice" && extracted.documentNumber && extracted.documentNumber !== "Unknown") {
          const dupeQuery = query(
            collection(db, "invoices"),
            where("userId", "==", user.id),
            where("documentNumber", "==", extracted.documentNumber),
            where("customerName", "==", extracted.customerName || "Unknown"),
            where("total", "==", extracted.total || 0)
          );
          const existingInvoices = await getDocs(dupeQuery);
          
          if (!existingInvoices.empty) {
            console.log(`Skipping duplicate invoice: ${extracted.documentNumber} from ${extracted.customerName}`);
            skippedCount++;
            continue; // Skip this file
          }
        }

        setProcessingStage(`Saving ${savedCount + 1}...`);
        setSavingProgress(((i + 1) / validScannedFiles.length) * 100);

        // For CSV/Excel files with parsing rules, use extractInvoices function
        const isCSVFile = extracted.isCSV && extracted.csvParsingRules && (selectedType === "invoice" || selectedType === "bill");
        
        console.log("=== SAVE CHECK ===");
        console.log("extracted.isCSV:", extracted.isCSV);
        console.log("extracted.csvParsingRules:", extracted.csvParsingRules);
        console.log("selectedType:", selectedType);
        console.log("isCSVFile:", isCSVFile);
        console.log("=================");
        
        if (isCSVFile && fileState.fileUrl) {
          console.log("CSV file detected with parsing rules - calling extractInvoices");
          const extractFn = httpsCallable(functions, "extractInvoices", { timeout: 300000 });
          const mimeType = getMimeType(fileState.file);
          
          try {
            const extractResult = await extractFn({
              fileUrl: fileState.fileUrl,
              mimeType,
              parsingRules: extracted.csvParsingRules,
            });
            
            const result = extractResult.data as { invoiceCount: number; summary?: { totalAmount?: number } };
            console.log(`Extracted ${result.invoiceCount} invoices from CSV`);
            savedCount += result.invoiceCount;
          } catch (extractErr) {
            console.error("Extract invoices error:", extractErr);
            throw extractErr;
          }
        } else {
          // Standard single document save (PDF, image, etc.)
          const docData: any = {
            userId: user.id,
            originalFileName: fileState.file.name,
            fileUrl: fileState.fileUrl,
            fileType: fileState.file.name.split('.').pop()?.toLowerCase() || "pdf",
            fileSize: fileState.file.size,
            mimeType: getMimeType(fileState.file),
            status: "pending_extraction",
            pageCount: extracted.pageCount || 1,
            confidence: extracted.confidence || 0,
            transactionCount: 0,
            createdAt: serverTimestamp(),
            uploadedAt: serverTimestamp(),
          };

          if (selectedType === "statement") {
            docData.accountId = accountId;
            docData.bankName = extracted.bankName || "Unknown";
            docData.accountNumber = extracted.accountNumber || "";
            docData.currency = extracted.currency || "USD";
            docData.periodStart = extracted.periodStart ? Timestamp.fromDate(new Date(extracted.periodStart)) : null;
            docData.periodEnd = extracted.periodEnd ? Timestamp.fromDate(new Date(extracted.periodEnd)) : null;
            docData.openingBalance = extracted.openingBalance;
            docData.closingBalance = extracted.closingBalance;
          } else if (selectedType === "invoice") {
            docData.direction = "outgoing";
            docData.documentType = "invoice";
            docData.documentNumber = extracted.documentNumber || "";
            docData.customerName = extracted.customerName || "Unknown";
            docData.documentDate = extracted.documentDate ? Timestamp.fromDate(new Date(extracted.documentDate)) : serverTimestamp();
            docData.dueDate = extracted.dueDate ? Timestamp.fromDate(new Date(extracted.dueDate)) : null;
            docData.total = extracted.total || 0;
            docData.amountRemaining = extracted.total || 0;
            docData.currency = extracted.currency || "USD";
            docData.reconciliationStatus = "unmatched";
            docData.paymentStatus = "unpaid";
          } else if (selectedType === "bill") {
            docData.direction = "incoming";
            docData.documentType = "bill";
            docData.documentNumber = extracted.documentNumber || "";
            docData.vendorName = extracted.vendorName || "Unknown";
            docData.documentDate = extracted.documentDate ? Timestamp.fromDate(new Date(extracted.documentDate)) : serverTimestamp();
            docData.dueDate = extracted.dueDate ? Timestamp.fromDate(new Date(extracted.dueDate)) : null;
            docData.total = extracted.total || 0;
            docData.amountRemaining = extracted.total || 0;
            docData.currency = extracted.currency || "USD";
            docData.reconciliationStatus = "unmatched";
            docData.paymentStatus = "unpaid";
          }

          console.log(`Saving to ${config.collection}:`, docData);
          const docRef = await addDoc(collection(db, config.collection), docData);
          console.log(`Saved doc ID: ${docRef.id}`);
          savedCount++;
        }
      }
      
      // Store counts for completion message
      setSavedCount(savedCount);
      setSkippedCount(skippedCount);
      setCurrentStep("complete");
      onUploadComplete?.();

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
          "fixed top-0 right-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-2xl",
          "flex flex-col",
          "transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isVisible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
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
                <h2 className="text-sm font-semibold text-slate-900">{config.title}</h2>
                <p className="text-xs text-slate-500">{config.subtitle}</p>
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
            <div className="p-5 h-full flex flex-col">
              {/* AI Thinking Terminal */}
              {thinkingLines.length > 0 && (
                <AIThinkingTerminal
                  lines={thinkingLines}
                  isRunning={processingFiles.length > 0}
                  fileName={fileStates[0]?.file.name || "document"}
                  elapsedMs={elapsedMs}
                />
              )}
            </div>
          )}

          {/* STEP: Confirm Type (User confirmation) */}
          {currentStep === "confirm_type" && (
            <div className="p-5 h-full flex flex-col space-y-4">
              {/* Show thinking terminal if we have lines */}
              {thinkingLines.length > 0 && (
                <AIThinkingTerminal
                  lines={thinkingLines}
                  isRunning={false}
                  fileName={fileStates[0]?.file.name || "document"}
                  elapsedMs={elapsedMs}
                />
              )}
              
              {fileStates.map((fs, idx) => {
                // Show error state
                if (fs.status === "error") {
                  return (
                    <div key={idx} className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-red-800">{fs.file.name}</p>
                          <p className="text-xs text-red-600">{fs.error || "Failed to identify"}</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => identifyFile(fs, idx)}
                        variant="outline"
                        size="sm"
                        className="border-red-200 text-red-700 hover:bg-red-100"
                      >
                        Retry
                      </Button>
                    </div>
                  );
                }
                
                if (!fs.identifyResult) return null;
                
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
                
                const Icon = typeIcons[fs.identifyResult.detectedType] || FileText;
                
                return (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    {/* Header strip */}
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                      <div className="p-2 bg-cyan-50 rounded-lg">
                        <Brain className="h-4 w-4 text-cyan-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">AI Detection Result</p>
                        <h3 className="text-sm font-semibold text-slate-900 truncate">{fs.file.name}</h3>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Detection Result */}
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-cyan-50 rounded-xl">
                          <Icon className="h-7 w-7 text-cyan-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-lg font-bold text-slate-900">{typeLabels[fs.identifyResult.detectedType]}</p>
                          <p className="text-sm text-slate-500">{Math.round(fs.identifyResult.confidence * 100)}% confident</p>
                        </div>
                        {fs.identifyResult.confidence >= 0.8 && (
                          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-700">
                            High confidence
                          </div>
                        )}
                      </div>
                      
                      {/* Details */}
                      {(fs.identifyResult.detectedBank || fs.identifyResult.detectedVendor || fs.identifyResult.detectedCustomer || fs.identifyResult.currency) && (
                        <div className="grid grid-cols-2 gap-2">
                          {fs.identifyResult.detectedBank && (
                            <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl">
                              <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Bank</p>
                                <p className="text-xs font-semibold text-slate-800 truncate">{fs.identifyResult.detectedBank}</p>
                              </div>
                            </div>
                          )}
                          {fs.identifyResult.detectedVendor && (
                            <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl">
                              <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Vendor</p>
                                <p className="text-xs font-semibold text-slate-800 truncate">{fs.identifyResult.detectedVendor}</p>
                              </div>
                            </div>
                          )}
                          {fs.identifyResult.detectedCustomer && (
                            <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl">
                              <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Customer</p>
                                <p className="text-xs font-semibold text-slate-800 truncate">{fs.identifyResult.detectedCustomer}</p>
                              </div>
                            </div>
                          )}
                          {fs.identifyResult.currency && (
                            <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl">
                              <DollarSign className="h-4 w-4 text-slate-400 shrink-0" />
                              <div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Currency</p>
                                <p className="text-xs font-semibold text-slate-800">{fs.identifyResult.currency}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Reasoning */}
                      {fs.identifyResult.reasoning && (
                        <div className="p-3 bg-slate-50 rounded-xl">
                          <p className="text-[11px] leading-relaxed text-slate-600">
                            {fs.identifyResult.reasoning}
                          </p>
                        </div>
                      )}
                      
                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          onClick={() => extractAllFiles()}
                          className="flex-1 bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-all duration-200 h-11"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Confirm & Extract
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            // TODO: Allow user to change type
                            toast.error("Type override coming soon");
                          }}
                          className="border-slate-200 text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all duration-200 h-11"
                        >
                          Change Type
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* STEP: Extracting (Phase 2) */}
          {currentStep === "extracting" && (
            <div className="p-5 h-full flex flex-col">
              {/* AI Thinking Terminal */}
              {thinkingLines.length > 0 && (
                <AIThinkingTerminal
                  lines={thinkingLines}
                  isRunning={processingFiles.length > 0}
                  fileName={fileStates[0]?.file.name || "document"}
                  elapsedMs={elapsedMs}
                />
              )}
            </div>
          )}

          {/* STEP: Processing (Legacy - keep for now) */}
          {currentStep === "processing" && (
            <div className="p-5 h-full flex flex-col">
              {/* AI Thinking Terminal - this shows all the detail */}
              {thinkingLines.length > 0 && (
                <AIThinkingTerminal
                  lines={thinkingLines}
                  isRunning={processingFiles.length > 0}
                  fileName={fileStates[0]?.file.name || "document"}
                  elapsedMs={elapsedMs}
                />
              )}

              {/* Simple file status list - no redundant headers */}
              {fileStates.length > 0 && (
                <div className="space-y-2 overflow-y-auto flex-1 min-h-0 mt-4">
                  {fileStates.map((fs, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center gap-3 p-3 bg-white border rounded-lg"
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                        fs.status === "scanned" && "bg-emerald-100 text-emerald-600",
                        fs.status === "wrong_type" && "bg-cyan-100 text-cyan-600",
                        fs.status === "error" && "bg-red-100 text-red-600",
                        fs.status === "scanning" && "bg-slate-100 text-slate-600",
                        fs.status === "uploading" && "bg-slate-100 text-slate-600",
                        fs.status === "pending" && "bg-slate-50 text-slate-400"
                      )}>
                        {fs.status === "scanned" && <Check className="h-4 w-4" />}
                        {fs.status === "wrong_type" && <FileSpreadsheet className="h-4 w-4" />}
                        {fs.status === "error" && <X className="h-4 w-4" />}
                        {fs.status === "scanning" && <Loader2 className="h-4 w-4 animate-spin" />}
                        {fs.status === "uploading" && <Upload className="h-4 w-4" />}
                        {fs.status === "pending" && <FileText className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{fs.file.name}</p>
                        <p className={cn(
                          "text-xs",
                          fs.status === "scanned" && "text-emerald-600",
                          fs.status === "wrong_type" && "text-cyan-600",
                          fs.status === "error" && "text-red-600",
                          (fs.status === "pending" || fs.status === "uploading" || fs.status === "scanning") && "text-slate-400"
                        )}>
                          {fs.status === "pending" && "Queued"}
                          {fs.status === "uploading" && "Uploading..."}
                          {fs.status === "scanning" && "Analyzing..."}
                          {fs.status === "wrong_type" && "Bank statement detected"}
                          {fs.status === "scanned" && (
                            selectedType === "statement" 
                              ? `${fs.extractedData?.transactionCount || 0} transactions`
                              : `${fs.extractedData?.currency || 'USD'} ${fs.extractedData?.total?.toLocaleString() || 0}`
                          )}
                          {fs.status === "error" && (fs.error || "Failed")}
                        </p>
                      </div>
                      {fs.status === "scanned" && fs.extractedData?.confidence && (
                        <span className="text-xs text-slate-400">
                          {Math.round((fs.extractedData.confidence || 0) * 100)}%
                        </span>
                      )}
                    </div>
                  ))}
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

              {/* AI Detection Summary Card */}
              {scannedFiles.length > 0 && scannedFiles[0].extractedData?.detectedType && (
                <div className="mb-4 shrink-0">
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                    {/* Subtle gradient overlay */}
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
                              {Math.round((scannedFiles[0].extractedData.confidence || 0.85) * 100)}% confident
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mb-3">
                            {scannedFiles[0].extractedData.detectedType === "bank_statement" && "These appear to be bank statements"}
                            {scannedFiles[0].extractedData.detectedType === "invoice" && "These appear to be invoices"}
                            {!["bank_statement", "invoice"].includes(scannedFiles[0].extractedData.detectedType!) && `Detected as: ${scannedFiles[0].extractedData.detectedType}`}
                          </p>
                          
                          {/* Quick stats */}
                          <div className="grid grid-cols-2 gap-2">
                            {scannedFiles[0].extractedData.bankName && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Building2 className="h-3 w-3 text-cyan-600" />
                                <span className="text-slate-600 font-medium">{scannedFiles[0].extractedData.bankName}</span>
                              </div>
                            )}
                            {scannedFiles[0].extractedData.transactionCount && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Zap className="h-3 w-3 text-cyan-600" />
                                <span className="text-slate-600">{scannedFiles[0].extractedData.transactionCount} transactions</span>
                              </div>
                            )}
                            {scannedFiles[0].extractedData.vendorName && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Building2 className="h-3 w-3 text-cyan-600" />
                                <span className="text-slate-600 font-medium">{scannedFiles[0].extractedData.vendorName}</span>
                              </div>
                            )}
                            {scannedFiles[0].extractedData.total && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Sparkles className="h-3 w-3 text-cyan-600" />
                                <span className="text-slate-600 font-medium">
                                  {scannedFiles[0].extractedData.currency} {scannedFiles[0].extractedData.total.toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Action hint */}
                      <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                        <p className="text-[10px] text-slate-500">
                          {wrongTypeFiles.length > 0 
                            ? "⚠️ Some files detected as different type — see below"
                            : "✓ All files match expected type"}
                        </p>
                        {wrongTypeFiles.length === 0 && (
                          <span className="text-[10px] text-emerald-600 font-medium">Ready to save</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
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
                              const isRetrying = fileStates[fileIdx]?.status === "scanning" || fileStates[fileIdx]?.status === "uploading";
                              return (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                  <span className="text-amber-700 flex items-center gap-2">
                                    {isRetrying && <Loader2 className="h-3 w-3 animate-spin" />}
                                    {pf.file.name}
                                  </span>
                                  <button
                                    onClick={() => {
                                      if (fileIdx >= 0 && !isRetrying) {
                                        console.log(`Retrying scan for ${pf.file.name}...`);
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
                  {selectedType === "statement" && groupedByAccount.length > 0 && (
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
                            "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold",
                            groupIdx === 0 && "bg-cyan-100 text-cyan-700",
                            groupIdx === 1 && "bg-purple-100 text-purple-700",
                            groupIdx === 2 && "bg-amber-100 text-amber-700",
                            groupIdx >= 3 && "bg-slate-200 text-slate-600"
                          )}>
                            {groupIdx + 1}
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
                        fs.status === "scanned" && "bg-emerald-100 text-emerald-600",
                        fs.status === "error" && "bg-red-100 text-red-600"
                      )}>
                        {fs.status === "scanned" && <Check className="h-3.5 w-3.5" />}
                        {fs.status === "error" && <X className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{fs.file.name}</p>
                        {fs.status === "scanned" && fs.extractedData && (
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
                      {fs.status === "scanned" && (
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
                    {expandedFileIndex === idx && fs.status === "scanned" && fs.extractedData && (
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
                  {savedCount} {getDocTypeName(selectedType, savedCount)} Saved!
                </h3>
                <p className="text-sm text-slate-500 mb-2">
                  {selectedType === "statement" 
                    ? (groupedByAccount.length > 1 
                        ? `Saved to ${groupedByAccount.length} accounts • Extracting transactions...`
                        : "Transaction extraction is running in the background")
                    : `Your ${getDocTypeName(selectedType, savedCount).toLowerCase()} ${savedCount !== 1 ? "are" : "is"} ready for review`
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
              Powered by Google Gemini 3 Flash with multimodal vision
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

        {/* Footer - Processing step */}
        {currentStep === "processing" && (
          <div className="px-5 py-4 border-t shrink-0 bg-white">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <Loader2 className="h-4 w-4 text-cyan-600 animate-spin" />
              <span className="text-xs font-semibold text-slate-900">
                {scannedFiles.length} / {fileStates.length}
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
                  Save {validScannedFiles.length} {getDocTypeName(selectedType, validScannedFiles.length)}
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
