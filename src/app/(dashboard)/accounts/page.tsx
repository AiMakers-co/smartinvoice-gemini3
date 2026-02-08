"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CreditCard,
  PiggyBank,
  Briefcase,
  Banknote,
  Plus,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  FileText,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  Archive,
  Edit2,
  Trash2,
  Eye,
  Upload,
  X,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Hash,
  Check,
} from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp, doc, updateDoc, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, storage, functions } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadDrawer } from "@/components/upload/upload-drawer";
import type { BankAccount, Statement, Transaction } from "@/types";

// ============================================
// TOAST NOTIFICATION COMPONENT
// ============================================

interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

function ToastNotification({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className={`
      flex items-center gap-3 p-4 rounded-lg shadow-lg border animate-in slide-in-from-top-2
      ${toast.type === "success" ? "bg-green-50 border-green-200 text-green-900" : ""}
      ${toast.type === "error" ? "bg-red-50 border-red-200 text-red-900" : ""}
      ${toast.type === "info" ? "bg-blue-50 border-blue-200 text-blue-900" : ""}
    `}>
      {toast.type === "success" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
      {toast.type === "error" && <AlertTriangle className="h-5 w-5 text-red-600" />}
      {toast.type === "info" && <AlertTriangle className="h-5 w-5 text-blue-600" />}
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ============================================
// ACCOUNT TYPE ICONS & COLORS
// ============================================

const accountTypeConfig = {
  checking: { icon: CreditCard, color: "bg-blue-100 text-blue-600", label: "Checking" },
  savings: { icon: PiggyBank, color: "bg-green-100 text-green-600", label: "Savings" },
  credit: { icon: CreditCard, color: "bg-purple-100 text-purple-600", label: "Credit" },
  investment: { icon: Briefcase, color: "bg-amber-100 text-amber-600", label: "Investment" },
  other: { icon: Banknote, color: "bg-slate-100 text-slate-600", label: "Other" },
};

// ============================================
// ACCOUNT CARD COMPONENT
// ============================================

interface AccountReconStats {
  matched: number;
  unmatched: number;
  suggested: number;
  total: number;
}

interface AccountCardProps {
  account: BankAccount;
  recentActivity?: {
    lastStatement?: Statement;
    monthlyChange?: { credits: number; debits: number };
  };
  reconStats?: AccountReconStats;
  isProcessing?: boolean;
  processingCount?: number;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onUpload: () => void;
}

function AccountCard({ account, recentActivity, reconStats, isProcessing, processingCount, onSelect, onEdit, onArchive, onUpload }: AccountCardProps) {
  const router = useRouter();
  const config = accountTypeConfig[account.accountType] || accountTypeConfig.other;
  const Icon = config.icon;

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: account.currency || "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return "—";
    return timestamp.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div
      className={`border rounded-xl bg-white hover:border-slate-300 transition-all cursor-pointer group ${isProcessing ? 'border-cyan-300 bg-cyan-50/30' : 'border-slate-200'}`}
      onClick={onSelect}
    >
      <div className="p-4">
        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 bg-cyan-50 border border-cyan-200 rounded-lg">
            <Loader2 className="h-3 w-3 text-cyan-600 animate-spin" />
            <span className="text-[10px] font-medium text-cyan-700">
              Extracting from {processingCount} statement{processingCount !== 1 ? 's' : ''}...
            </span>
          </div>
        )}
        
        {/* Top row: icon + name + menu */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 truncate">{account.accountNickname}</h3>
            <p className="text-xs text-slate-500">{account.bankName} &middot; ****{account.accountNumber?.slice(-4)}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); router.push(`/accounts/${account.id}`); }}>
                <Eye className="h-3 w-3 mr-1.5" /> View
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onUpload(); }}>
                <Upload className="h-3 w-3 mr-1.5" /> Upload
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit2 className="h-3 w-3 mr-1.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-xs text-red-600" onClick={(e) => { e.stopPropagation(); onArchive(); }}>
                <Archive className="h-3 w-3 mr-1.5" /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Balance */}
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-0.5">Balance</p>
          <p className="text-lg font-semibold text-slate-900">{formatCurrency(account.balance)}</p>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>{account.statementCount || 0} stmt</span>
          <span>&middot;</span>
          <span>{account.transactionCount || 0} txn</span>
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{account.currency || "USD"}</span>
        </div>

        {/* Reconciliation status */}
        {reconStats && reconStats.total > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-500">Reconciliation</span>
              <span className="text-[10px] font-semibold text-slate-700">
                {Math.round((reconStats.matched / reconStats.total) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-emerald-500"
                style={{ width: `${(reconStats.matched / reconStats.total) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-[10px]">
              <span className="text-emerald-600">{reconStats.matched} matched</span>
              {reconStats.unmatched > 0 && (
                <span className="text-amber-500">{reconStats.unmatched} pending</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer with activity */}
      {recentActivity?.monthlyChange && (recentActivity.monthlyChange.credits > 0 || recentActivity.monthlyChange.debits > 0) && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-slate-100 text-xs">
          <span className="text-emerald-600 font-medium">+{formatCurrency(recentActivity.monthlyChange.credits)}</span>
          <span className="text-red-500 font-medium">&minus;{formatCurrency(recentActivity.monthlyChange.debits)}</span>
          <span className="text-slate-400 ml-auto text-[10px]">{formatDate(account.lastStatementDate)}</span>
        </div>
      )}
    </div>
  );
}

// ============================================
// UPLOAD TYPES & HELPERS
// ============================================

type FileStep = "uploading" | "scanning" | "confirm_account" | "extracting" | "review" | "completed" | "failed";

interface ScanResult {
  bankName: string;
  bankCountry?: string;
  accountNumber: string;
  accountType: string;
  accountHolderName?: string;
  currency: string;
  periodStart?: string;
  periodEnd?: string;
  documentType: string;
  pageCount: number;
  confidence: number;
  warnings: string[];
}

interface FileUploadState {
  id: string;
  file: File;
  step: FileStep;
  progress: number;
  error: string | null;
  scanResult: ScanResult | null;
  fileUrl: string | null;
  matchedAccount: BankAccount | null;
  selectedAccountId: string | null;
  customBankName: string | null;
  statementId: string | null;
  transactionCount: number;
  duplicatesSkipped: number;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

const getMimeType = (file: File): string => {
  if (file.type) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'csv': return 'text/csv';
    case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    default: return 'application/octet-stream';
  }
};

// ============================================
// INLINE UPLOAD COMPONENT
// ============================================

interface InlineUploadProps {
  accounts: BankAccount[];
  userId: string;
  onUploadComplete: () => void;
  preSelectedAccountId?: string | null;
}

function InlineUpload({ accounts, userId, onUploadComplete, preSelectedAccountId }: InlineUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileUploadState[]>([]);

  // Cloud Functions
  const scanDocument = async (fileUrl: string, mimeType: string): Promise<ScanResult> => {
    const fn = httpsCallable(functions, "scanDocument", { timeout: 120000 });
    const result = await fn({ fileUrl, mimeType });
    return result.data as ScanResult;
  };

  const createAccount = async (scanResult: ScanResult, overrides?: { bankName?: string }): Promise<string> => {
    const fn = httpsCallable(functions, "createAccountFromScan", { timeout: 30000 });
    const result = await fn({ scanResult, overrides });
    return (result.data as { accountId: string }).accountId;
  };

  const extractTransactions = async (statementId: string, accountId: string, fileUrl: string, mimeType: string) => {
    const fn = httpsCallable(functions, "extractTransactions", { timeout: 300000 });
    await fn({ statementId, accountId, fileUrl, mimeType });
  };

  const updateFile = useCallback((id: string, updates: Partial<FileUploadState>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const processFile = useCallback(async (fileState: FileUploadState) => {
    const { id, file } = fileState;

    try {
      // 1. Upload to Storage
      updateFile(id, { step: "uploading", progress: 20 });
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `statements/${userId}/temp/${fileName}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);
      updateFile(id, { progress: 40, fileUrl });

      // 2. Scan document
      updateFile(id, { step: "scanning", progress: 50 });
      const mimeType = getMimeType(file);
      const scanResult = await scanDocument(fileUrl, mimeType);
      updateFile(id, { progress: 70, scanResult });

      // 3. Match or create account
      let accountId: string;
      
      if (preSelectedAccountId) {
        // User pre-selected an account
        accountId = preSelectedAccountId;
      } else {
        // Try to find matching account
        const matchedAccount = accounts.find(
          acc => acc.accountNumber === scanResult.accountNumber && acc.currency === scanResult.currency
        );
        
        if (matchedAccount) {
          accountId = matchedAccount.id;
          updateFile(id, { matchedAccount, selectedAccountId: matchedAccount.id });
        } else {
          // Create new account
          accountId = await createAccount(scanResult);
        }
      }

      // 4. Create statement and extract
      updateFile(id, { step: "extracting", progress: 80, selectedAccountId: accountId });
      
      const statementRef = await addDoc(collection(db, "statements"), {
        userId,
        accountId,
        originalFileName: file.name,
        fileUrl,
        fileType: file.name.split('.').pop()?.toLowerCase() || "pdf",
        fileSize: file.size,
        mimeType: getMimeType(file),
        status: "uploaded",
        periodStart: scanResult.periodStart ? Timestamp.fromDate(new Date(scanResult.periodStart)) : null,
        periodEnd: scanResult.periodEnd ? Timestamp.fromDate(new Date(scanResult.periodEnd)) : null,
        pageCount: scanResult.pageCount || 1,
        confidence: scanResult.confidence,
        scanModel: "gemini-2.5-pro",
        warnings: scanResult.warnings || [],
        extractionProgress: 0,
        createdAt: serverTimestamp(),
      });

      updateFile(id, { statementId: statementRef.id });

      // Trigger extraction
      await extractTransactions(statementRef.id, accountId, fileUrl, getMimeType(file));

      // Listen for completion
      const unsubscribe = onSnapshot(doc(db, "statements", statementRef.id), (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        const progress = 80 + (data.extractionProgress || 0) * 20;
        updateFile(id, { progress: Math.floor(progress) });

        if (data.status === "completed" || data.status === "needs_review") {
          unsubscribe();
          updateFile(id, {
            step: "completed",
            progress: 100,
            transactionCount: data.transactionCount || 0,
            duplicatesSkipped: data.duplicatesSkipped || 0,
          });
          onUploadComplete();
        } else if (data.status === "failed") {
          unsubscribe();
          updateFile(id, {
            step: "failed",
            error: data.errorMessage || "Extraction failed",
          });
        }
      });

    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      updateFile(id, {
        step: "failed",
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }, [userId, accounts, preSelectedAccountId, updateFile, onUploadComplete]);

  const handleFilesSelect = useCallback((selectedFiles: FileList | File[]) => {
    const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.csv', '.xlsx'];
    
    const newFiles: FileUploadState[] = Array.from(selectedFiles)
      .filter(file => {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        return validExtensions.includes(ext);
      })
      .filter(file => file.size <= 50 * 1024 * 1024)
      .map(file => ({
        id: generateId(),
        file,
        step: "uploading" as FileStep,
        progress: 0,
        error: null,
        scanResult: null,
        fileUrl: null,
        matchedAccount: null,
        selectedAccountId: preSelectedAccountId || null,
        customBankName: null,
        statementId: null,
        transactionCount: 0,
        duplicatesSkipped: 0,
      }));

    if (newFiles.length === 0) return;

    setFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach(f => processFile(f));
  }, [processFile, preSelectedAccountId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelect(e.dataTransfer.files);
  }, [handleFilesSelect]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const activeFiles = files.filter(f => f.step !== "completed");
  const completedFiles = files.filter(f => f.step === "completed");

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer
          ${isDragging ? "border-cyan-500 bg-cyan-50" : "border-slate-200 hover:border-slate-300 bg-white"}
        `}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFilesSelect(e.target.files)}
        />
        
        <div className="flex items-center gap-4">
          <div className={`
            h-12 w-12 rounded-xl flex items-center justify-center transition-colors
            ${isDragging ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-500"}
          `}>
            <Upload className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">
              {isDragging ? "Drop files now" : "Drop bank statements here"}
            </p>
            <p className="text-xs text-slate-500">
              PDF, PNG, JPG, CSV, Excel • Max 50MB
            </p>
            </div>
          <Button variant="outline" size="sm" className="shrink-0">
            Browse
          </Button>
          </div>
        </div>

      {/* Active Uploads */}
      {activeFiles.length > 0 && (
        <div className="space-y-2">
          {activeFiles.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-3 bg-white border rounded-lg">
              <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-slate-500" />
                </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{f.file.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={f.progress} className="h-1.5 flex-1" />
                  <span className="text-xs text-slate-500 shrink-0">
                    {f.step === "uploading" && "Uploading..."}
                    {f.step === "scanning" && "Scanning..."}
                    {f.step === "extracting" && "Extracting..."}
                    {f.step === "failed" && <span className="text-red-600">{f.error}</span>}
                  </span>
                </div>
              </div>
              {f.step === "failed" && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeFile(f.id)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
                </div>
          ))}
                </div>
      )}

      {/* Completed */}
      {completedFiles.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-900">
            {completedFiles.length} file{completedFiles.length > 1 ? 's' : ''} processed • 
            {completedFiles.reduce((sum, f) => sum + f.transactionCount, 0)} transactions added
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="ml-auto text-green-700 hover:text-green-800"
            onClick={() => setFiles([])}
          >
            Clear
          </Button>
          </div>
        )}
    </div>
  );
}

// ============================================
// EMPTY STATE
// ============================================

interface EmptyStateProps {
  onUpload: () => void;
}

function EmptyState({ onUpload }: EmptyStateProps) {
  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Bank Accounts</h2>
          <p className="text-xs text-slate-500">Connect and manage your bank accounts</p>
      </div>
        <Button onClick={onUpload} className="bg-cyan-600 hover:bg-cyan-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Account
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
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Balance</div>
            <div className="text-base font-bold">$0.00</div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Statements</div>
            <div className="text-base font-bold">0</div>
          </div>
          <div className="px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Transactions</div>
            <div className="text-base font-bold">0</div>
          </div>
        </div>
      </div>
      
      {/* Empty Content */}
      <Card>
        <CardContent className="p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-cyan-50 flex items-center justify-center mx-auto mb-3">
            <Building2 className="h-6 w-6 text-cyan-600" />
          </div>
          <p className="text-sm font-medium text-slate-900 mb-1">No accounts yet</p>
          <p className="text-xs text-slate-500 mb-4">Upload a bank statement to automatically create an account</p>
          <Button variant="outline" size="sm" onClick={onUpload}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add your first account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function AccountsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountActivity, setAccountActivity] = useState<Record<string, { monthlyChange?: { credits: number; debits: number } }>>({});
  const [accountReconStats, setAccountReconStats] = useState<Record<string, AccountReconStats>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  
  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadForAccountId, setUploadForAccountId] = useState<string | null>(null);
  
  // Edit dialog state
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [editForm, setEditForm] = useState({ bankName: "", accountNickname: "", accountType: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
    actionLabel: string;
    variant: "default" | "destructive";
  }>({ open: false, title: "", description: "", action: () => {}, actionLabel: "", variant: "default" });
  
  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Processing statements state (for showing extraction in progress)
  const [processingStatements, setProcessingStatements] = useState<Record<string, number>>({});
  
  // Handle upload complete - refresh accounts
  const handleUploadComplete = useCallback(() => {
    showToast("success", "Statement processed successfully");
  }, []);
  
  const showToast = (type: Toast["type"], message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
  };
  
  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Load accounts
  useEffect(() => {
    if (!user?.id) return;

    const accountsQuery = query(
      collection(db, "accounts"),
      where("userId", "==", user.id),
      where("isArchived", "==", false),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      accountsQuery, 
      (snapshot) => {
      const accountsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as BankAccount[];
      
      setAccounts(accountsData);
      setLoading(false);

      // Load monthly activity for each account
      accountsData.forEach(account => {
        loadMonthlyActivity(account.id);
      });
      },
      (error) => {
        console.error("Error loading accounts:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.id]);

  // Listen for processing statements
  useEffect(() => {
    if (!user?.id) return;

    const processingQuery = query(
      collection(db, "statements"),
      where("userId", "==", user.id),
      where("status", "in", ["pending_extraction", "extracting", "uploaded"])
    );

    const unsubscribe = onSnapshot(processingQuery, (snapshot) => {
      const byAccount: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const accountId = data.accountId;
        if (accountId) {
          byAccount[accountId] = (byAccount[accountId] || 0) + 1;
        }
      });
      setProcessingStatements(byAccount);
    });

    return () => unsubscribe();
  }, [user?.id]);

  // Load transaction totals for an account (from most recent statement)
  const loadMonthlyActivity = async (accountId: string) => {
    if (!user?.id) return;

    // Get all transactions for this account - include userId for security rules
    const txQuery = query(
      collection(db, "transactions"),
      where("userId", "==", user.id),
      where("accountId", "==", accountId),
      orderBy("date", "desc"),
      limit(200) // Get more transactions to ensure we capture the full statement
    );

    onSnapshot(
      txQuery, 
      (snapshot) => {
      let credits = 0;
      let debits = 0;
      let matched = 0, unmatched = 0, suggested = 0;

      snapshot.docs.forEach(doc => {
        const tx = doc.data() as any;
        if (tx.type === "credit") credits += tx.amount;
        else debits += tx.amount;

        // Reconciliation status
        const status = tx.reconciliationStatus || (tx.reconciled ? "matched" : "unmatched");
        if (status === "matched" || status === "categorized") matched++;
        else if (status === "suggested") suggested++;
        else unmatched++;
      });

      setAccountActivity(prev => ({
        ...prev,
        [accountId]: { monthlyChange: { credits, debits } },
      }));
      setAccountReconStats(prev => ({
        ...prev,
        [accountId]: { matched, unmatched, suggested, total: snapshot.docs.length },
      }));
      },
      (error) => {
        console.error("Error loading monthly activity:", error);
      }
    );
  };

  // Open edit dialog
  const handleEditAccount = (account: BankAccount) => {
    setEditingAccount(account);
    setEditForm({
      bankName: account.bankName || "",
      accountNickname: account.accountNickname || "",
      accountType: account.accountType || "checking",
    });
    setMergeTargetId(null); // Reset merge selection
  };

  // Save account changes
  const handleSaveAccount = async () => {
    if (!editingAccount) return;
    
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "accounts", editingAccount.id), {
        bankName: editForm.bankName,
        accountNickname: editForm.accountNickname,
        accountType: editForm.accountType,
      });
      showToast("success", `Account "${editForm.accountNickname}" updated successfully`);
      setEditingAccount(null);
    } catch (error) {
      console.error("Error updating account:", error);
      showToast("error", "Failed to update account. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Archive account - show confirmation
  const handleArchiveAccount = (account: BankAccount) => {
    setConfirmDialog({
      open: true,
      title: "Archive Account",
      description: `Are you sure you want to archive "${account.accountNickname}"? This will hide it from your accounts list. You can restore it later from settings.`,
      actionLabel: "Archive",
      variant: "destructive",
      action: async () => {
        try {
          await updateDoc(doc(db, "accounts", account.id), {
            isArchived: true,
          });
          showToast("success", `"${account.accountNickname}" has been archived`);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        } catch (error) {
          console.error("Error archiving account:", error);
          showToast("error", "Failed to archive account. Please try again.");
        }
      },
    });
  };

  // Start merge confirmation
  const handleStartMerge = () => {
    if (!editingAccount || !mergeTargetId) return;
    
    const targetAccount = accounts.find(a => a.id === mergeTargetId);
    if (!targetAccount) return;
    
    setConfirmDialog({
      open: true,
      title: "Merge Accounts",
      description: `This will move all ${editingAccount.statementCount || 0} statements and ${editingAccount.transactionCount || 0} transactions from "${editingAccount.accountNickname}" to "${targetAccount.accountNickname}". The original account will be archived.`,
      actionLabel: "Merge Accounts",
      variant: "destructive",
      action: () => executeMerge(targetAccount),
    });
  };
  
  // Execute the merge
  const executeMerge = async (targetAccount: BankAccount) => {
    if (!editingAccount) return;
    
    setConfirmDialog(prev => ({ ...prev, open: false }));
    setIsMerging(true);
    
    try {
      // Update all statements to point to the new account
      const statementsQuery = query(
        collection(db, "statements"),
        where("accountId", "==", editingAccount.id)
      );
      const statementsSnapshot = await getDocs(statementsQuery);
      
      for (const statementDoc of statementsSnapshot.docs) {
        await updateDoc(doc(db, "statements", statementDoc.id), {
          accountId: mergeTargetId,
        });
      }
      
      // Update all transactions to point to the new account
      const txQuery = query(
        collection(db, "transactions"),
        where("accountId", "==", editingAccount.id)
      );
      const txSnapshot = await getDocs(txQuery);
      
      for (const txDoc of txSnapshot.docs) {
        await updateDoc(doc(db, "transactions", txDoc.id), {
          accountId: mergeTargetId,
        });
      }
      
      // Update target account stats
      await updateDoc(doc(db, "accounts", mergeTargetId!), {
        statementCount: (targetAccount.statementCount || 0) + (editingAccount.statementCount || 0),
        transactionCount: (targetAccount.transactionCount || 0) + (editingAccount.transactionCount || 0),
      });
      
      // Archive the old account
      await updateDoc(doc(db, "accounts", editingAccount.id), {
        isArchived: true,
        mergedInto: mergeTargetId,
      });
      
      showToast("success", `Successfully merged into "${targetAccount.accountNickname}"`);
      setEditingAccount(null);
      setMergeTargetId(null);
    } catch (error) {
      console.error("Error merging accounts:", error);
      showToast("error", "Failed to merge accounts. Please try again.");
    } finally {
      setIsMerging(false);
    }
  };

  // Filter accounts
  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = searchQuery === "" || 
      account.accountNickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.bankName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === "all" || account.accountType === filterType;

    return matchesSearch && matchesType;
  });

  // Calculate totals - grouped by currency
  const balancesByCurrency = accounts.reduce((acc, account) => {
    const currency = account.currency || "USD";
    if (!acc[currency]) {
      acc[currency] = 0;
    }
    acc[currency] += account.balance || 0;
    return acc;
  }, {} as Record<string, number>);
  
  const totalTransactions = accounts.reduce((sum, acc) => sum + (acc.transactionCount || 0), 0);
  const totalStatements = accounts.reduce((sum, acc) => sum + (acc.statementCount || 0), 0);
  
  // Format currency with symbol
  const formatCurrencyTotal = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <Header title="Bank Accounts" />

      <div className="flex-1 px-6 py-5 overflow-auto">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-10 w-10 rounded-lg bg-slate-200 mb-4" />
                  <div className="h-6 w-32 bg-slate-200 rounded mb-2" />
                  <div className="h-4 w-24 bg-slate-100 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState onUpload={() => setUploadModalOpen(true)} />
        ) : (
          <div className="space-y-5">
            {/* Header Row */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Your Accounts</h2>
                <p className="text-sm text-slate-500">{accounts.length} account{accounts.length !== 1 ? 's' : ''} connected</p>
              </div>
              <Button 
                onClick={() => { setUploadForAccountId(null); setUploadModalOpen(true); }}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Account
              </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-6 gap-3">
              <div className="border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500">Accounts</p>
                <p className="text-xl font-semibold text-slate-900 mt-1">{accounts.length}</p>
              </div>
              {Object.entries(balancesByCurrency).map(([currency, balance]) => (
                <div key={currency} className="border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-500">{currency} Balance</p>
                  <p className="text-xl font-semibold text-slate-900 mt-1">{formatCurrencyTotal(balance, currency)}</p>
                </div>
              ))}
              <div className="border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500">Statements</p>
                <p className="text-xl font-semibold text-slate-900 mt-1">{totalStatements}</p>
              </div>
              <div className="border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500">Transactions</p>
                <p className="text-xl font-semibold text-slate-900 mt-1">{totalTransactions.toLocaleString()}</p>
                <p className="text-[10px] text-emerald-600 font-medium mt-0.5">AI extracted</p>
              </div>
              <div className="border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500">Reconciled</p>
                <p className="text-xl font-semibold text-slate-900 mt-1">
                  {(() => {
                    const allStats = Object.values(accountReconStats);
                    const totalM = allStats.reduce((s, r) => s + r.matched, 0);
                    const totalT = allStats.reduce((s, r) => s + r.total, 0);
                    return totalT > 0 ? `${Math.round((totalM / totalT) * 100)}%` : "--";
                  })()}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {(() => {
                    const totalU = Object.values(accountReconStats).reduce((s, r) => s + r.unmatched, 0);
                    return totalU > 0 ? `${totalU} unmatched` : "all matched";
                  })()}
                </p>
              </div>
            </div>

            {/* Search & Filter */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Filter className="h-3.5 w-3.5 mr-1.5" />
                    {filterType === "all" ? "All Types" : accountTypeConfig[filterType as keyof typeof accountTypeConfig]?.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-xs" onClick={() => setFilterType("all")}>
                    All Types
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {Object.entries(accountTypeConfig).map(([key, config]) => (
                    <DropdownMenuItem key={key} className="text-xs" onClick={() => setFilterType(key)}>
                      <config.icon className="h-3.5 w-3.5 mr-2" />
                      {config.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Account Cards Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {filteredAccounts.map(account => (
                <AccountCard
                  key={account.id}
                  account={account}
                  recentActivity={accountActivity[account.id]}
                  reconStats={accountReconStats[account.id]}
                  isProcessing={!!processingStatements[account.id]}
                  processingCount={processingStatements[account.id] || 0}
                  onSelect={() => router.push(`/accounts/${account.id}`)}
                  onEdit={() => handleEditAccount(account)}
                  onArchive={() => handleArchiveAccount(account)}
                  onUpload={() => { setUploadForAccountId(account.id); setUploadModalOpen(true); }}
                />
              ))}
            </div>

            {filteredAccounts.length === 0 && accounts.length > 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500">No accounts match your search</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Account Dialog */}
      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Edit Account
            </DialogTitle>
            <DialogDescription>
              Update the account details below. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name</Label>
              {/* Quick select from existing banks or type custom */}
              <Select
                value={editForm.bankName}
                onValueChange={(value) => {
                  if (value !== "__custom__") {
                    setEditForm(prev => ({ ...prev, bankName: value }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select or type bank name" />
                </SelectTrigger>
                <SelectContent>
                  {/* Get unique bank names from existing accounts */}
                  {Array.from(new Set(accounts.map(a => a.bankName).filter(Boolean))).map((bankName) => (
                    <SelectItem key={bankName} value={bankName}>
                      {bankName}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">
                    <span className="text-slate-500">Type custom name...</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {/* Show input for custom bank name if selected or if current value isn't in the list */}
              {(!accounts.some(a => a.bankName === editForm.bankName) || editForm.bankName === "__custom__") && (
                <Input
                  id="bankName"
                  value={editForm.bankName === "__custom__" ? "" : editForm.bankName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, bankName: e.target.value }))}
                  placeholder="Enter custom bank name"
                  className="mt-2"
                />
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="accountNickname">Account Nickname</Label>
              <Input
                id="accountNickname"
                value={editForm.accountNickname}
                onChange={(e) => setEditForm(prev => ({ ...prev, accountNickname: e.target.value }))}
                placeholder="e.g., Main Checking"
              />
              <p className="text-xs text-slate-500">A friendly name to identify this account</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="accountType">Account Type</Label>
              <Select
                value={editForm.accountType}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, accountType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Checking</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="credit">Credit Card</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Merge with another account */}
            {accounts.filter(a => a.id !== editingAccount?.id).length > 0 && (
              <div className="pt-4 border-t space-y-2">
                <Label className="text-amber-700">Merge Into Another Account</Label>
                <p className="text-xs text-slate-500">
                  Move all statements and transactions to a different account
                </p>
                <Select
                  value={mergeTargetId || ""}
                  onValueChange={(value) => setMergeTargetId(value || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account to merge into..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts
                      .filter(a => a.id !== editingAccount?.id)
                      .map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.bankName} - ****{acc.accountNumber?.slice(-4)} ({acc.transactionCount || 0} txns)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {mergeTargetId && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="w-full"
                    onClick={handleStartMerge}
                    disabled={isMerging}
                  >
                    {isMerging ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Merging...
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                        Merge Into Selected Account
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAccount(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveAccount} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {confirmDialog.title}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {confirmDialog.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button 
              variant={confirmDialog.variant} 
              onClick={confirmDialog.action}
            >
              {confirmDialog.actionLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Drawer */}
      <UploadDrawer
        open={uploadModalOpen}
        onOpenChange={(open) => { 
          setUploadModalOpen(open); 
          if (!open) setUploadForAccountId(null); 
        }}
        defaultType="statement"
        onUploadComplete={handleUploadComplete}
      />

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
          {toasts.map(toast => (
            <ToastNotification 
              key={toast.id} 
              toast={toast} 
              onDismiss={() => dismissToast(toast.id)} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
