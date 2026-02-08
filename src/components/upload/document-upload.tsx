"use client";

import { useState, useRef, useCallback } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { collection, addDoc, doc, onSnapshot, serverTimestamp, Timestamp } from "firebase/firestore";
import { db, storage, functions } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

export type DocumentType = "statement" | "invoice" | "bill";

type FileStep = "uploading" | "scanning" | "processing" | "completed" | "failed";

interface FileUploadState {
  id: string;
  file: File;
  step: FileStep;
  progress: number;
  error: string | null;
  fileUrl: string | null;
  documentId: string | null;
  itemCount: number;
}

interface DocumentUploadConfig {
  type: DocumentType;
  title: string;
  subtitle: string;
  dropzoneText: string;
  storagePath: string;
  collection: string;
  processFunction?: string;
  acceptedTypes?: string;
  accentColor?: string;
}

const DEFAULT_CONFIGS: Record<DocumentType, DocumentUploadConfig> = {
  statement: {
    type: "statement",
    title: "Upload Bank Statement",
    subtitle: "Drop files here or click to browse",
    dropzoneText: "Drop bank statements here",
    storagePath: "statements",
    collection: "statements",
    processFunction: "extractTransactions",
    acceptedTypes: ".pdf,.png,.jpg,.jpeg,.csv,.xlsx",
    accentColor: "cyan",
  },
  invoice: {
    type: "invoice",
    title: "Upload Invoices",
    subtitle: "Upload invoices you've sent to customers",
    dropzoneText: "Drop invoices here",
    storagePath: "documents/invoices",
    collection: "documents",
    processFunction: "processInvoice",
    acceptedTypes: ".pdf,.png,.jpg,.jpeg,.csv,.xlsx",
    accentColor: "emerald",
  },
  bill: {
    type: "bill",
    title: "Upload Bills",
    subtitle: "Upload bills from your vendors",
    dropzoneText: "Drop vendor bills here",
    storagePath: "documents/bills",
    collection: "documents",
    processFunction: "processBill",
    acceptedTypes: ".pdf,.png,.jpg,.jpeg,.csv,.xlsx",
    accentColor: "orange",
  },
};

// ============================================
// HELPERS
// ============================================

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

const getAccentClasses = (color: string, isDragging: boolean) => {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    cyan: { bg: "bg-cyan-50", border: "border-cyan-500", text: "text-cyan-600" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-500", text: "text-emerald-600" },
    orange: { bg: "bg-orange-50", border: "border-orange-500", text: "text-orange-600" },
    purple: { bg: "bg-purple-50", border: "border-purple-500", text: "text-purple-600" },
  };
  const c = colors[color] || colors.cyan;
  return isDragging ? `${c.border} ${c.bg}` : "border-slate-200 hover:border-slate-300 bg-white";
};

const getIconClasses = (color: string, isDragging: boolean) => {
  const colors: Record<string, { active: string; inactive: string }> = {
    cyan: { active: "bg-cyan-500 text-white", inactive: "bg-cyan-100 text-cyan-600" },
    emerald: { active: "bg-emerald-500 text-white", inactive: "bg-emerald-100 text-emerald-600" },
    orange: { active: "bg-orange-500 text-white", inactive: "bg-orange-100 text-orange-600" },
    purple: { active: "bg-purple-500 text-white", inactive: "bg-purple-100 text-purple-600" },
  };
  const c = colors[color] || colors.cyan;
  return isDragging ? c.active : c.inactive;
};

// ============================================
// MAIN COMPONENT
// ============================================

export interface DocumentUploadProps {
  userId: string;
  documentType: DocumentType;
  onUploadComplete?: () => void;
  config?: Partial<DocumentUploadConfig>;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

export function DocumentUpload({
  userId,
  documentType,
  onUploadComplete,
  config: customConfig,
  collapsible = false,
  defaultExpanded = true,
  className,
}: DocumentUploadProps) {
  const config = { ...DEFAULT_CONFIGS[documentType], ...customConfig };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const updateFile = useCallback((id: string, updates: Partial<FileUploadState>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const processFile = useCallback(async (fileState: FileUploadState) => {
    const { id, file } = fileState;

    try {
      // 1. Upload to Storage
      updateFile(id, { step: "uploading", progress: 30 });
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${config.storagePath}/${userId}/${fileName}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);
      updateFile(id, { progress: 50, fileUrl });

      // 2. Scan/Process document
      updateFile(id, { step: "scanning", progress: 60 });
      const mimeType = getMimeType(file);
      
      // Call scan function
      const scanFn = httpsCallable(functions, "scanDocument", { timeout: 120000 });
      const scanResult = await scanFn({ fileUrl, mimeType });
      const scanData = scanResult.data as any;
      updateFile(id, { progress: 75 });

      // 3. Create document in Firestore
      updateFile(id, { step: "processing", progress: 85 });
      
      const docData: any = {
        userId,
        originalFileName: file.name,
        fileUrl,
        fileType: file.name.split('.').pop()?.toLowerCase() || "pdf",
        fileSize: file.size,
        mimeType,
        status: "uploaded",
        pageCount: scanData.pageCount || 1,
        confidence: scanData.confidence || 0,
        createdAt: serverTimestamp(),
      };

      // Add type-specific fields
      if (documentType === "statement") {
        docData.periodStart = scanData.periodStart ? Timestamp.fromDate(new Date(scanData.periodStart)) : null;
        docData.periodEnd = scanData.periodEnd ? Timestamp.fromDate(new Date(scanData.periodEnd)) : null;
        docData.bankName = scanData.bankName || "Unknown";
        docData.accountNumber = scanData.accountNumber || "";
        docData.currency = scanData.currency || "USD";
      } else if (documentType === "invoice") {
        docData.direction = "outgoing";
        docData.documentType = "invoice";
        docData.documentNumber = scanData.invoiceNumber || scanData.documentNumber || "";
        docData.customerName = scanData.vendorName || scanData.customerName || "Unknown";
        docData.documentDate = scanData.invoiceDate ? Timestamp.fromDate(new Date(scanData.invoiceDate)) : serverTimestamp();
        docData.dueDate = scanData.dueDate ? Timestamp.fromDate(new Date(scanData.dueDate)) : null;
        docData.total = scanData.total || 0;
        docData.amountRemaining = scanData.total || 0;
        docData.currency = scanData.currency || "USD";
        docData.reconciliationStatus = "unmatched";
        docData.paymentStatus = "unpaid";
      } else if (documentType === "bill") {
        docData.direction = "incoming";
        docData.documentType = "bill";
        docData.documentNumber = scanData.invoiceNumber || scanData.documentNumber || "";
        docData.vendorName = scanData.vendorName || "Unknown";
        docData.documentDate = scanData.invoiceDate ? Timestamp.fromDate(new Date(scanData.invoiceDate)) : serverTimestamp();
        docData.dueDate = scanData.dueDate ? Timestamp.fromDate(new Date(scanData.dueDate)) : null;
        docData.total = scanData.total || 0;
        docData.amountRemaining = scanData.total || 0;
        docData.currency = scanData.currency || "USD";
        docData.reconciliationStatus = "unmatched";
        docData.paymentStatus = "unpaid";
      }

      const docRef = await addDoc(collection(db, config.collection), docData);
      updateFile(id, { documentId: docRef.id });

      // 4. Trigger processing function if specified
      if (config.processFunction && documentType === "statement") {
        try {
          const processFn = httpsCallable(functions, config.processFunction, { timeout: 300000 });
          await processFn({ 
            statementId: docRef.id, 
            fileUrl, 
            mimeType,
          });

          // Listen for completion
          const unsubscribe = onSnapshot(doc(db, config.collection, docRef.id), (snapshot) => {
            const data = snapshot.data();
            if (!data) return;

            const progress = 85 + (data.extractionProgress || 0) * 15;
            updateFile(id, { progress: Math.floor(progress) });

            if (data.status === "completed" || data.status === "needs_review") {
              unsubscribe();
              updateFile(id, {
                step: "completed",
                progress: 100,
                itemCount: data.transactionCount || data.lineItemCount || 1,
              });
              onUploadComplete?.();
            } else if (data.status === "failed") {
              unsubscribe();
              updateFile(id, {
                step: "failed",
                error: data.errorMessage || "Processing failed",
              });
            }
          });
        } catch (error) {
          console.error("Processing function error:", error);
          // Still mark as completed since document was created
          updateFile(id, {
            step: "completed",
            progress: 100,
            itemCount: 1,
          });
          onUploadComplete?.();
        }
      } else {
        // No processing function, mark as completed
        updateFile(id, {
          step: "completed",
          progress: 100,
          itemCount: 1,
        });
        onUploadComplete?.();
      }

    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      updateFile(id, {
        step: "failed",
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }, [userId, config, documentType, updateFile, onUploadComplete]);

  const handleFilesSelect = useCallback((selectedFiles: FileList | File[]) => {
    const validExtensions = (config.acceptedTypes || ".pdf").split(",");
    
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
        fileUrl: null,
        documentId: null,
        itemCount: 0,
      }));

    if (newFiles.length === 0) return;

    setFiles(prev => [...prev, ...newFiles]);
    newFiles.forEach(f => processFile(f));
  }, [config.acceptedTypes, processFile]);

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
  const accentColor = config.accentColor || "cyan";

  // Collapsible header content
  const headerContent = (
    <div className="flex items-center gap-3">
      <div className={cn(
        "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
        getIconClasses(accentColor, expanded)
      )}>
        <Upload className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{config.title}</h3>
        <p className="text-xs text-slate-500">{config.subtitle}</p>
      </div>
    </div>
  );

  // Upload content
  const uploadContent = (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer",
          getAccentClasses(accentColor, isDragging)
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
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFilesSelect(e.target.files)}
        />
        
        <div className="flex items-center gap-4">
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center transition-colors",
            getIconClasses(accentColor, isDragging)
          )}>
            <Upload className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">
              {isDragging ? "Drop files now" : config.dropzoneText}
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
                    {f.step === "processing" && "Processing..."}
                    {f.step === "failed" && <span className="text-red-600">{f.error}</span>}
                  </span>
                </div>
              </div>
              {f.step === "failed" && (
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}>
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
            {completedFiles.length} file{completedFiles.length > 1 ? 's' : ''} processed
            {documentType === "statement" && ` • ${completedFiles.reduce((sum, f) => sum + f.itemCount, 0)} transactions added`}
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

  // Non-collapsible version (just the dropzone)
  if (!collapsible) {
    return (
      <div className={className}>
        {uploadContent}
      </div>
    );
  }

  // Collapsible card version
  return (
    <Card className={cn(expanded && `ring-2 ring-${accentColor}-500 ring-offset-2`, className)}>
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {headerContent}
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </div>
      {expanded && (
        <CardContent className="pt-0 border-t">
          <div className="pt-4">
            {uploadContent}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ============================================
// EMPTY STATE WITH UPLOAD
// ============================================

export interface EmptyStateWithUploadProps {
  userId: string;
  documentType: DocumentType;
  onUploadComplete?: () => void;
  config?: Partial<DocumentUploadConfig>;
  sampleContent?: React.ReactNode;
}

export function EmptyStateWithUpload({
  userId,
  documentType,
  onUploadComplete,
  config: customConfig,
  sampleContent,
}: EmptyStateWithUploadProps) {
  const config = { ...DEFAULT_CONFIGS[documentType], ...customConfig };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const accentColor = config.accentColor || "cyan";

  const handleFileSelect = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      // Upload file
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${config.storagePath}/${userId}/${fileName}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(storageRef);
      const mimeType = getMimeType(file);

      // Scan document
      const scanFn = httpsCallable(functions, "scanDocument", { timeout: 120000 });
      const scanResult = await scanFn({ fileUrl, mimeType });
      const scanData = scanResult.data as any;

      // Create document
      const docData: any = {
        userId,
        originalFileName: file.name,
        fileUrl,
        fileType: file.name.split('.').pop()?.toLowerCase() || "pdf",
        fileSize: file.size,
        mimeType,
        status: "uploaded",
        pageCount: scanData.pageCount || 1,
        confidence: scanData.confidence || 0,
        createdAt: serverTimestamp(),
      };

      if (documentType === "statement") {
        docData.periodStart = scanData.periodStart ? Timestamp.fromDate(new Date(scanData.periodStart)) : null;
        docData.periodEnd = scanData.periodEnd ? Timestamp.fromDate(new Date(scanData.periodEnd)) : null;
        docData.bankName = scanData.bankName || "Unknown";
        docData.accountNumber = scanData.accountNumber || "";
        docData.currency = scanData.currency || "USD";
      } else if (documentType === "invoice") {
        docData.direction = "outgoing";
        docData.documentType = "invoice";
        docData.documentNumber = scanData.invoiceNumber || scanData.documentNumber || "";
        docData.customerName = scanData.vendorName || scanData.customerName || "Unknown";
        docData.documentDate = scanData.invoiceDate ? Timestamp.fromDate(new Date(scanData.invoiceDate)) : serverTimestamp();
        docData.dueDate = scanData.dueDate ? Timestamp.fromDate(new Date(scanData.dueDate)) : null;
        docData.total = scanData.total || 0;
        docData.amountRemaining = scanData.total || 0;
        docData.currency = scanData.currency || "USD";
        docData.reconciliationStatus = "unmatched";
        docData.paymentStatus = "unpaid";
      } else if (documentType === "bill") {
        docData.direction = "incoming";
        docData.documentType = "bill";
        docData.documentNumber = scanData.invoiceNumber || scanData.documentNumber || "";
        docData.vendorName = scanData.vendorName || "Unknown";
        docData.documentDate = scanData.invoiceDate ? Timestamp.fromDate(new Date(scanData.invoiceDate)) : serverTimestamp();
        docData.dueDate = scanData.dueDate ? Timestamp.fromDate(new Date(scanData.dueDate)) : null;
        docData.total = scanData.total || 0;
        docData.amountRemaining = scanData.total || 0;
        docData.currency = scanData.currency || "USD";
        docData.reconciliationStatus = "unmatched";
        docData.paymentStatus = "unpaid";
      }

      const docRef = await addDoc(collection(db, config.collection), docData);

      // Process if needed
      if (config.processFunction && documentType === "statement") {
        const processFn = httpsCallable(functions, config.processFunction, { timeout: 300000 });
        await processFn({ statementId: docRef.id, fileUrl, mimeType });

        const unsubscribe = onSnapshot(doc(db, config.collection, docRef.id), (snapshot) => {
          const data = snapshot.data();
          if (!data) return;
          if (data.status === "completed" || data.status === "needs_review") {
            unsubscribe();
            setIsUploading(false);
            onUploadComplete?.();
          } else if (data.status === "failed") {
            unsubscribe();
            setIsUploading(false);
            setUploadError(data.errorMessage || "Processing failed");
          }
        });
      } else {
        setIsUploading(false);
        onUploadComplete?.();
      }
    } catch (error) {
      console.error("Upload error:", error);
      setIsUploading(false);
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    }
  };

  const handleFilesSelect = (selectedFiles: FileList | File[]) => {
    const validExtensions = (config.acceptedTypes || ".pdf").split(",");
    const file = Array.from(selectedFiles).find(f => {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      return validExtensions.includes(ext) && f.size <= 50 * 1024 * 1024;
    });
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelect(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      {/* Upload CTA Card */}
      <Card
        className={cn(
          "cursor-pointer transition-all",
          isDragging ? `ring-2 ring-${accentColor}-500 ring-offset-2 bg-${accentColor}-50` : "hover:shadow-md"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={config.acceptedTypes}
          className="hidden"
          onChange={(e) => e.target.files && handleFilesSelect(e.target.files)}
        />
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center",
              getIconClasses(accentColor, isDragging)
            )}>
              {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-slate-900">
                {isUploading ? "Processing..." : `Upload ${documentType === "statement" ? "a bank statement" : documentType === "invoice" ? "invoices" : "bills"} to get started`}
              </h3>
              <p className="text-sm text-slate-500">
                {isUploading ? "Scanning and extracting data" : "Drop a PDF, CSV, image, or Excel file here"}
              </p>
            </div>
            {!isUploading && (
              <Button className={cn(
                accentColor === "cyan" && "bg-cyan-600 hover:bg-cyan-700",
                accentColor === "emerald" && "bg-emerald-600 hover:bg-emerald-700",
                accentColor === "orange" && "bg-orange-600 hover:bg-orange-700",
              )}>
                Browse files
              </Button>
            )}
          </div>
          {uploadError && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {uploadError}
              <button onClick={(e) => { e.stopPropagation(); setUploadError(null); }} className="ml-auto">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sample content (faded preview) */}
      {sampleContent}
    </div>
  );
}
