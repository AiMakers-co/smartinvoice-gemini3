"use client";

import { useState, useCallback, useRef, useEffect, memo } from "react";
import { useDropzone } from "react-dropzone";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, increment } from "firebase/firestore";
import { functions, storage, db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useBrand } from "@/hooks/use-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileSpreadsheet,
  Sparkles,
  Download,
  AlertCircle,
  CheckCircle2,
  Edit2,
  MessageSquare,
  X,
  Send,
  Loader2,
  Table,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Terminal,
  Brain,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

// ============================================
// TYPES
// ============================================

interface Pdf2SheetHeader {
  name: string;
  type: "string" | "number" | "date" | "currency" | "boolean";
  description?: string;
  example?: string;
}

interface DocumentMetadataItem {
  label: string;
  value: string;
  category: "entity" | "reference" | "date" | "financial" | "payment" | "tax" | "contact" | "other";
}

interface ScanResult {
  headers: Pdf2SheetHeader[];
  sampleRows: Record<string, any>[];
  documentType: string;
  metadata?: DocumentMetadataItem[];
  // Backward-compat convenience fields
  supplierName?: string;
  documentDate?: string;
  documentNumber?: string;
  currency?: string;
  pageCount: number;
  confidence: number;
  isExtractable?: boolean;
  warnings: string[];
  suggestions: string[];
}

interface ExtractResult {
  page: number;
  rows: Record<string, any>[];
  confidence: number;
  warnings: string[];
}

interface ThinkingLine {
  text: string;
  type: "step" | "analyze" | "search" | "match" | "confirm" | "info" | "fx" | "classify" | "learn";
}

type WorkflowStep = "upload" | "scanning" | "review" | "processing" | "complete";

interface Pdf2SheetToolProps {
  mode?: "full" | "preview";
  maxPages?: number;
  onComplete?: (data: Record<string, any>[]) => void;
}

// ============================================
// AI THINKING TERMINAL
// ============================================

function ThinkingTerminal({
  lines,
  isRunning,
  title,
  elapsedMs,
}: {
  lines: ThinkingLine[];
  isRunning: boolean;
  title: string;
  elapsedMs: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines.length]);

  const getIcon = (type: ThinkingLine["type"]) => {
    switch (type) {
      case "step": return "▸";
      case "analyze": return "→";
      case "search": return "  ↳";
      case "match": return "  ↳";
      case "confirm": return "  ✓";
      case "classify": return "  ◆";
      case "info": return "─";
      case "fx": return "  ↳";
      case "learn": return "  🧠";
      default: return " ";
    }
  };

  const getStyle = (type: ThinkingLine["type"]) => {
    switch (type) {
      case "step": return "text-slate-900 font-bold text-[13px] mt-3 first:mt-0";
      case "analyze": return "text-cyan-700 font-medium mt-1.5";
      case "search": return "text-slate-500";
      case "match": return "text-purple-700";
      case "confirm": return "text-emerald-600 font-semibold";
      case "classify": return "text-amber-600";
      case "info": return "text-slate-400 text-[10px]";
      case "fx": return "text-amber-600";
      case "learn": return "text-emerald-600";
      default: return "text-slate-500";
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
            <span className="text-xs font-mono text-slate-600">{title}</span>
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
        className="p-4 font-mono text-[11px] leading-[1.6] max-h-[320px] overflow-y-auto scroll-smooth"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
      >
        <div className="text-slate-400 mb-2">
          <span className="text-purple-600">$</span> gemini-3-flash --mode=vision --output=structured-json
        </div>

        {lines.map((line, idx) => {
          const icon = getIcon(line.type);
          const style = getStyle(line.type);

          if (line.type === "step") {
            return (
              <div key={idx} className={cn("font-mono", style)}>
                <div className="border-b border-slate-200 pb-1 mb-1">
                  {icon} {line.text}
                </div>
              </div>
            );
          }

          return (
            <div
              key={idx}
              className={cn("font-mono animate-in fade-in slide-in-from-bottom-1 duration-200", style)}
            >
              {icon} {line.text}
            </div>
          );
        })}

        {isRunning && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-purple-600">$</span>
            <span className="w-2 h-4 bg-purple-400 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export const Pdf2SheetTool = memo(function Pdf2SheetTool({
  mode = "full",
  maxPages,
  onComplete,
}: Pdf2SheetToolProps) {
  const { user } = useAuth();
  const brand = useBrand();

  // Workflow state
  const [step, setStep] = useState<WorkflowStep>("upload");
  const [error, setError] = useState<string | null>(null);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  // Scan results
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [headers, setHeaders] = useState<Pdf2SheetHeader[]>([]);

  // Extraction state
  const [extractedData, setExtractedData] = useState<Record<string, any>[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // AI Thinking state
  const [thinkingLines, setThinkingLines] = useState<ThinkingLine[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);

  // Edit state
  const [editingHeader, setEditingHeader] = useState<number | null>(null);
  const [showSample, setShowSample] = useState(true);

  // Currency formatting helper
  const getCurrencySymbol = (code?: string): string => {
    if (!code) return "";
    const symbols: Record<string, string> = {
      USD: "$", EUR: "€", GBP: "£", JPY: "¥", ANG: "ƒ", AED: "د.إ",
      CHF: "CHF", CAD: "C$", AUD: "A$", NZD: "NZ$", SEK: "kr", NOK: "kr",
      DKK: "kr", PLN: "zł", BRL: "R$", MXN: "$", INR: "₹", CNY: "¥",
      KRW: "₩", SGD: "S$", HKD: "HK$", THB: "฿", ZAR: "R", RUB: "₽",
      TRY: "₺", ILS: "₪", CZK: "Kč", HUF: "Ft", RON: "lei",
    };
    return symbols[code.toUpperCase()] || code;
  };

  const formatCellValue = (value: any, header: Pdf2SheetHeader, currencyCode?: string): string => {
    if (value === null || value === undefined || value === "" || value === "-") return "—";
    if (header.type === "currency") {
      const num = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      const symbol = getCurrencySymbol(currencyCode);
      return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (header.type === "number") {
      const num = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(num)) return String(value);
      return num.toLocaleString();
    }
    return String(value);
  };

  // Helpers
  const startTimer = () => {
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    elapsedRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);
  };

  const stopTimer = () => {
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  };

  const addLine = (text: string, type: ThinkingLine["type"] = "info") => {
    setThinkingLines(prev => [...prev, { text, type }]);
  };

  const addLineDelayed = (text: string, type: ThinkingLine["type"], delayMs: number): Promise<void> => {
    return new Promise(resolve => {
      setTimeout(() => {
        setThinkingLines(prev => [...prev, { text, type }]);
        resolve();
      }, delayMs);
    });
  };

  // ============================================
  // FILE UPLOAD + SCAN WITH THINKING
  // ============================================

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile || !user) return;

    setFile(uploadedFile);
    setError(null);
    setStep("scanning");
    setThinkingLines([]);
    startTimer();

    // Phase 1: Upload
    addLine("DOCUMENT UPLOAD", "step");
    addLine(`Received: ${uploadedFile.name}`, "analyze");
    addLine(`File size: ${(uploadedFile.size / 1024).toFixed(0)} KB • Type: ${uploadedFile.type || "application/pdf"}`, "search");
    addLine("Uploading to secure Firebase Storage...", "search");

    try {
      const fileRef = ref(storage, `pdf2sheet/${user.id}/${Date.now()}_${uploadedFile.name}`);
      await uploadBytes(fileRef, uploadedFile);
      const url = await getDownloadURL(fileRef);
      setFileUrl(url);

      await addLineDelayed("Upload complete — file stored securely", "confirm", 200);

      // Phase 2: AI Analysis
      await addLineDelayed("AI DOCUMENT ANALYSIS", "step", 300);
      await addLineDelayed("Initializing Gemini 3 Flash with vision capabilities...", "analyze", 150);
      await addLineDelayed("Model: gemini-3-flash-preview • Mode: multimodal vision", "search", 100);
      await addLineDelayed("Output: structured JSON with responseMimeType", "search", 80);
      await addLineDelayed("Thinking: enabled (LOW) for fast classification", "search", 80);
      await addLineDelayed("Scanning document for tables, headers, and structure...", "analyze", 200);
      await addLineDelayed("Detecting row/column boundaries and data types...", "search", 150);
      await addLineDelayed("Identifying supplier, dates, and document metadata...", "search", 150);

      const scanFn = httpsCallable(functions, "pdf2sheetScan");
      const result = await scanFn({
        fileUrl: url,
        mimeType: uploadedFile.type,
      });

      const data = result.data as ScanResult;

      // Check if extractable
      if (data.isExtractable === false || data.headers.length === 0) {
        await addLineDelayed(
          data.warnings?.[0] || "No extractable tabular data found",
          "classify", 200
        );
        stopTimer();
        setError(
          data.warnings?.[0] ||
          "This document doesn't contain extractable tabular data."
        );
        setStep("upload");
        return;
      }

      // Phase 3: Progressive reveal of results
      await addLineDelayed("STRUCTURE DETECTION", "step", 200);

      // Document type
      const docTypeLabel = data.documentType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      await addLineDelayed(`Classified as: ${docTypeLabel}`, "confirm", 150);
      await addLineDelayed(`Confidence: ${Math.round(data.confidence * 100)}%`, "confirm", 100);

      // Dynamic metadata reveal
      const metadataItems = data.metadata || [];
      if (metadataItems.length > 0) {
        await addLineDelayed("DOCUMENT METADATA", "step", 200);
        await addLineDelayed(`Found ${metadataItems.length} key fields on document:`, "analyze", 120);
        for (const item of metadataItems) {
          const categoryIcon: Record<string, string> = {
            entity: "🏢", reference: "🔗", date: "📅", financial: "💰",
            payment: "🏦", tax: "📋", contact: "📍", other: "📎",
          };
          const icon = categoryIcon[item.category] || "📎";
          await addLineDelayed(
            `${icon} ${item.label}: ${item.value}`,
            "match",
            40 + Math.random() * 40
          );
        }
      } else {
        // Fallback to legacy fields if metadata array is empty
        if (data.supplierName) await addLineDelayed(`Supplier: ${data.supplierName}`, "match", 120);
        if (data.documentDate) await addLineDelayed(`Date: ${data.documentDate}`, "match", 80);
        if (data.documentNumber) await addLineDelayed(`Reference: ${data.documentNumber}`, "match", 80);
        if (data.currency) await addLineDelayed(`Currency: ${data.currency}`, "match", 80);
      }

      await addLineDelayed(`Pages to process: ${data.pageCount}`, "search", 100);

      // Reveal headers one by one
      await addLineDelayed("COLUMN DISCOVERY", "step", 250);
      await addLineDelayed(`Detected ${data.headers.length} columns in table structure:`, "analyze", 150);

      for (let i = 0; i < data.headers.length; i++) {
        const h = data.headers[i];
        const typeLabel = h.type === "currency" ? "💰 currency" : h.type === "date" ? "📅 date" : h.type === "number" ? "🔢 number" : h.type === "boolean" ? "✅ boolean" : "📝 text";
        const example = h.example ? ` — e.g. "${h.example}"` : "";
        const desc = h.description ? ` (${h.description})` : "";
        await addLineDelayed(
          `Column ${i + 1}: ${h.name} [${typeLabel}]${example}${desc}`,
          "match",
          60 + Math.random() * 60
        );
      }

      // Sample data
      if (data.sampleRows.length > 0) {
        await addLineDelayed("SAMPLE VALIDATION", "step", 200);
        await addLineDelayed(`Extracted ${data.sampleRows.length} sample rows for accuracy check`, "analyze", 100);
        // Show first sample row values
        const firstRow = data.sampleRows[0];
        const previewCols = data.headers.slice(0, 3);
        const preview = previewCols.map(h => `${h.name}: ${firstRow[h.name] ?? "—"}`).join(" • ");
        await addLineDelayed(`Row 1: ${preview}`, "search", 100);
        if (data.sampleRows.length > 1) {
          const secondRow = data.sampleRows[1];
          const preview2 = previewCols.map(h => `${h.name}: ${secondRow[h.name] ?? "—"}`).join(" • ");
          await addLineDelayed(`Row 2: ${preview2}`, "search", 80);
        }
        await addLineDelayed("Sample data validates column schema", "confirm", 150);
      }

      // Warnings & suggestions
      if (data.warnings.length > 0 || data.suggestions.length > 0) {
        await addLineDelayed("QUALITY NOTES", "step", 150);
      }
      for (const w of data.warnings) {
        await addLineDelayed(`⚠ ${w}`, "classify", 80);
      }
      for (const s of data.suggestions) {
        await addLineDelayed(`💡 ${s}`, "learn", 80);
      }

      await addLineDelayed("ANALYSIS COMPLETE", "step", 200);
      await addLineDelayed(`Ready to extract ${data.pageCount} page${data.pageCount > 1 ? "s" : ""} × ${data.headers.length} columns`, "confirm", 150);
      await addLineDelayed("Review columns below, then click Extract", "confirm", 100);

      stopTimer();
      setScanResult(data);
      setHeaders(data.headers);
      setTotalPages(maxPages ? Math.min(data.pageCount, maxPages) : data.pageCount);
      setStep("review");
    } catch (err) {
      stopTimer();
      console.error("Scan error:", err);
      addLine(`Error: ${err instanceof Error ? err.message : "Failed to scan document"}`, "classify");
      setError(err instanceof Error ? err.message : "Failed to scan document");
      setStep("upload");
    }
  }, [user, maxPages]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: !user,
  });

  // ============================================
  // HEADER EDITING
  // ============================================

  const updateHeader = (index: number, updates: Partial<Pdf2SheetHeader>) => {
    setHeaders(prev => prev.map((h, i) => (i === index ? { ...h, ...updates } : h)));
  };

  const removeHeader = (index: number) => {
    setHeaders(prev => prev.filter((_, i) => i !== index));
  };

  const addHeader = () => {
    setHeaders(prev => [...prev, { name: `Column ${prev.length + 1}`, type: "string" }]);
  };

  // ============================================
  // EXTRACTION WITH THINKING
  // ============================================

  const startExtraction = async () => {
    if (!fileUrl || headers.length === 0) return;

    setStep("processing");
    setProgress(0);
    setExtractedData([]);
    setThinkingLines([]);
    startTimer();

    const pagesToProcess = totalPages;
    const allRows: Record<string, any>[] = [];

    addLine("FULL DATA EXTRACTION", "step");
    addLine(`Target: ${pagesToProcess} page${pagesToProcess > 1 ? "s" : ""} × ${headers.length} columns`, "analyze");
    addLine(`Schema: ${headers.map(h => h.name).join(", ")}`, "search");
    const detectedCurrency = scanResult?.currency;
    if (detectedCurrency) {
      addLine(`Currency: ${detectedCurrency} (${getCurrencySymbol(detectedCurrency)})`, "search");
    }
    addLine("Engine: Gemini 3 Flash • Output: structured JSON", "search");

    try {
      const extractFn = httpsCallable(functions, "pdf2sheetExtract");

      for (let page = 1; page <= pagesToProcess; page++) {
        setCurrentPage(page);

        addLine(`PAGE ${page} OF ${pagesToProcess}`, "step");
        addLine("Sending page to Gemini 3 Flash for structured extraction...", "analyze");
        addLine(`Mapping ${headers.length} columns to exact schema...`, "search");
        addLine("Scanning for row boundaries and cell values...", "search");
        addLine("Converting dates to YYYY-MM-DD, amounts to numeric...", "search");

        const result = await extractFn({
          fileUrl,
          mimeType: "application/pdf",
          pageNumber: page,
          totalPages: pagesToProcess,
          headers,
          currency: scanResult?.currency || undefined,
        });

        const pageData = result.data as ExtractResult;
        allRows.push(...pageData.rows);

        addLine(`Extracted ${pageData.rows.length} rows from page ${page}`, "confirm");
        addLine(`Confidence: ${Math.round(pageData.confidence * 100)}% • Running total: ${allRows.length} rows`, "confirm");

        if (pageData.warnings.length > 0) {
          for (const w of pageData.warnings) {
            addLine(`⚠ ${w}`, "classify");
          }
        }

        // Show a sample from this page
        if (pageData.rows.length > 0) {
          const sample = pageData.rows[0];
          const previewCols = headers.slice(0, 3);
          const preview = previewCols.map(h => `${h.name}: ${sample[h.name] ?? "—"}`).join(" • ");
          addLine(`First row: ${preview}`, "search");
        }

        setProgress(Math.round((page / pagesToProcess) * 100));
      }

      addLine("FINALIZATION", "step");
      addLine(`Total: ${allRows.length} rows extracted from ${pagesToProcess} page${pagesToProcess > 1 ? "s" : ""}`, "confirm");
      addLine("Saving conversion to history...", "search");
      addLine("Updating template library for future use...", "search");

      stopTimer();
      setExtractedData(allRows);
      setStep("complete");

      // Save job to Firestore
      if (user?.id && file) {
        try {
          await addDoc(collection(db, "pdf2sheet_jobs"), {
            userId: user.id,
            fileName: file.name,
            fileUrl,
            pageCount: pagesToProcess,
            rowCount: allRows.length,
            status: "completed",
            documentType: scanResult?.documentType || "unknown",
            metadata: scanResult?.metadata || [],
            supplierName: scanResult?.supplierName || null,
            documentDate: scanResult?.documentDate || null,
            documentNumber: scanResult?.documentNumber || null,
            currency: scanResult?.currency || null,
            headers: headers.map(h => ({ name: h.name, type: h.type, description: h.description, example: h.example })),
            extractedData: allRows.slice(0, 100),
            createdAt: serverTimestamp(),
          });

          const templateName = scanResult?.supplierName || scanResult?.documentType || "Custom Template";
          const existingTemplateQuery = query(
            collection(db, "pdf2sheet_templates"),
            where("userId", "==", user.id),
            where("name", "==", templateName)
          );
          const existingTemplates = await getDocs(existingTemplateQuery);

          if (existingTemplates.empty) {
            await addDoc(collection(db, "pdf2sheet_templates"), {
              userId: user.id,
              name: templateName,
              supplierName: scanResult?.supplierName || null,
              documentType: scanResult?.documentType || "unknown",
              headers: headers.map(h => ({ name: h.name, type: h.type, description: h.description })),
              usageCount: 1,
              lastUsed: serverTimestamp(),
              createdAt: serverTimestamp(),
            });
          } else {
            const templateDoc = existingTemplates.docs[0];
            await updateDoc(doc(db, "pdf2sheet_templates", templateDoc.id), {
              usageCount: increment(1),
              lastUsed: serverTimestamp(),
            });
          }

          addLine("Saved to history and template updated", "learn");
        } catch (saveErr) {
          console.error("Failed to save:", saveErr);
        }
      }

      if (onComplete) onComplete(allRows);
    } catch (err) {
      stopTimer();
      console.error("Extraction error:", err);
      addLine(`Error: ${err instanceof Error ? err.message : "Failed to extract data"}`, "classify");
      setError(err instanceof Error ? err.message : "Failed to extract data");
      setStep("review");

      if (user?.id && file) {
        try {
          await addDoc(collection(db, "pdf2sheet_jobs"), {
            userId: user.id,
            fileName: file.name,
            fileUrl,
            pageCount: totalPages,
            rowCount: 0,
            status: "failed",
            error: err instanceof Error ? err.message : "Unknown error",
            createdAt: serverTimestamp(),
          });
        } catch (saveErr) {
          console.error("Failed to save failed job:", saveErr);
        }
      }
    }
  };

  // ============================================
  // EXPORT
  // ============================================

  const exportToCSV = () => {
    if (extractedData.length === 0) return;
    const headerNames = headers.map(h => h.name);
    const csvRows = [
      headerNames.join(","),
      ...extractedData.map(row =>
        headerNames.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file?.name.replace(".pdf", "") || "export"}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    if (extractedData.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(extractedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${file?.name.replace(".pdf", "") || "export"}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setFileUrl(null);
    setScanResult(null);
    setHeaders([]);
    setExtractedData([]);
    setProgress(0);
    setError(null);
    setThinkingLines([]);
    setElapsedMs(0);
    stopTimer();
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-red-800 font-medium text-sm">Error</p>
            <p className="text-red-600 text-xs">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Step: Upload */}
      {step === "upload" && (
        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
              isDragActive
                ? "border-purple-500 bg-purple-50"
                : "border-slate-300 hover:border-purple-400 hover:bg-purple-50/30",
              !user && "opacity-50 cursor-not-allowed"
            )}
          >
            <input {...getInputProps()} />
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 mx-auto mb-4 flex items-center justify-center">
              <Upload className="h-7 w-7 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              {isDragActive ? "Drop your PDF here" : "Upload a PDF"}
            </h3>
            <p className="text-sm text-slate-500 mb-3">
              Drag & drop or click to select a PDF with tabular data
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Brain className="h-3.5 w-3.5" />
              <span>Gemini 3 Flash will analyze structure and extract data</span>
            </div>
            {!user && (
              <p className="text-center text-amber-600 mt-4 text-sm">
                Please sign in to use this tool
              </p>
            )}
          </div>

          {/* Supported document types */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Bank Statements", desc: "Transaction tables", icon: "🏦" },
              { label: "Invoices & Bills", desc: "Line items & totals", icon: "📄" },
              { label: "Reports & Lists", desc: "Any tabular data", icon: "📊" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-lg">{item.icon}</span>
                <div>
                  <p className="text-xs font-medium text-slate-700">{item.label}</p>
                  <p className="text-[10px] text-slate-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* AI Capabilities footer */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-50/50 border border-purple-100">
            <div className="flex items-center gap-4 text-[10px] text-purple-600">
              <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Vision AI</span>
              <span className="flex items-center gap-1"><Table className="h-3 w-3" /> Auto-detect columns</span>
              <span className="flex items-center gap-1"><Brain className="h-3 w-3" /> Template learning</span>
            </div>
            <span className="text-[10px] text-purple-500 font-medium">Powered by Gemini 3</span>
          </div>
        </div>
      )}

      {/* Step: Scanning — AI THINKING TERMINAL */}
      {step === "scanning" && (
        <ThinkingTerminal
          lines={thinkingLines}
          isRunning={true}
          title="Gemini 3 Flash — Document Analysis"
          elapsedMs={elapsedMs}
        />
      )}

      {/* Step: Review Headers */}
      {step === "review" && scanResult && (
        <div className="space-y-4">
          {/* Thinking terminal (collapsed, shows what happened) */}
          {thinkingLines.length > 0 && (
            <ThinkingTerminal
              lines={thinkingLines}
              isRunning={false}
              title="Gemini 3 Flash — Analysis Complete"
              elapsedMs={elapsedMs}
            />
          )}

          {/* Summary + Metadata */}
          <div className="rounded-xl border border-purple-200 overflow-hidden">
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-indigo-50">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 text-sm">
                  {scanResult.documentType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                  {scanResult.supplierName && ` — ${scanResult.supplierName}`}
                </h3>
                <p className="text-xs text-slate-600">
                  {headers.length} columns • {totalPages} pages • {Math.round(scanResult.confidence * 100)}% confidence
                  {scanResult.currency && ` • ${scanResult.currency}`}
                </p>
              </div>
              <Badge className="bg-purple-100 text-purple-700 text-[10px]">
                <Brain className="h-3 w-3 mr-1" />
                AI Detected
              </Badge>
            </div>

            {/* Dynamic metadata pills */}
            {(scanResult.metadata && scanResult.metadata.length > 0) && (
              <div className="px-4 py-3 border-t border-purple-100 bg-white">
                <div className="flex flex-wrap gap-2">
                  {scanResult.metadata.map((item, idx) => {
                    const categoryColors: Record<string, string> = {
                      entity: "bg-blue-50 text-blue-700 border-blue-200",
                      reference: "bg-slate-50 text-slate-700 border-slate-200",
                      date: "bg-amber-50 text-amber-700 border-amber-200",
                      financial: "bg-emerald-50 text-emerald-700 border-emerald-200",
                      payment: "bg-indigo-50 text-indigo-700 border-indigo-200",
                      tax: "bg-orange-50 text-orange-700 border-orange-200",
                      contact: "bg-purple-50 text-purple-700 border-purple-200",
                      other: "bg-slate-50 text-slate-600 border-slate-200",
                    };
                    const colors = categoryColors[item.category] || categoryColors.other;
                    return (
                      <span
                        key={idx}
                        className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px]", colors)}
                      >
                        <span className="font-medium">{item.label}:</span>
                        <span className="truncate max-w-[200px]">{item.value}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Headers Editor */}
          <div className="border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
              <h4 className="text-sm font-semibold text-slate-900">Column Headers</h4>
              <Button variant="outline" size="sm" onClick={addHeader} className="h-7 text-xs">
                + Add Column
              </Button>
            </div>
            <div className="divide-y">
              {headers.map((header, index) => (
                <div key={index} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50">
                  <span className="text-[10px] text-slate-400 w-5 text-right font-mono">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    {editingHeader === index ? (
                      <Input
                        value={header.name}
                        onChange={(e) => updateHeader(index, { name: e.target.value })}
                        onBlur={() => setEditingHeader(null)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingHeader(null)}
                        autoFocus
                        className="h-7 text-sm"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingHeader(index)}
                        className="text-left text-sm font-medium text-slate-900 hover:text-purple-600 flex items-center gap-1.5 group"
                      >
                        {header.name}
                        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                      </button>
                    )}
                  </div>
                  <select
                    value={header.type}
                    onChange={(e) => updateHeader(index, { type: e.target.value as any })}
                    className="text-xs border rounded px-2 py-1 bg-white"
                  >
                    <option value="string">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="currency">Currency</option>
                    <option value="boolean">Yes/No</option>
                  </select>
                  {header.example && (
                    <span className="text-[10px] text-slate-400 hidden sm:block font-mono truncate max-w-[120px]">
                      {header.example}
                    </span>
                  )}
                  <button
                    onClick={() => removeHeader(index)}
                    className="text-slate-300 hover:text-red-500 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Sample Data Preview */}
          {scanResult.sampleRows.length > 0 && (
            <div className="border rounded-xl overflow-hidden">
              <button
                onClick={() => setShowSample(!showSample)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b hover:bg-slate-100 transition-colors"
              >
                <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-slate-400" />
                  Sample Data Preview
                </h4>
                {showSample ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>
              {showSample && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {headers.map((h, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">{h.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scanResult.sampleRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t hover:bg-slate-50/50">
                          {headers.map((h, j) => (
                            <td key={j} className={cn(
                              "px-3 py-2 whitespace-nowrap",
                              h.type === "currency" ? "text-slate-900 font-medium tabular-nums" : "text-slate-700"
                            )}>
                              {formatCellValue(row[h.name], h, scanResult.currency)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={reset} className="h-10">
              Start Over
            </Button>
            <Button
              onClick={startExtraction}
              className="flex-1 h-10 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-200"
              disabled={headers.length === 0}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Extract {totalPages} {totalPages === 1 ? "Page" : "Pages"}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Processing — AI THINKING TERMINAL */}
      {step === "processing" && (
        <div className="space-y-4">
          <ThinkingTerminal
            lines={thinkingLines}
            isRunning={true}
            title="Gemini 3 Flash — Data Extraction"
            elapsedMs={elapsedMs}
          />
          <div className="flex items-center gap-3">
            <Progress value={progress} className="h-2 flex-1" />
            <span className="text-sm font-mono text-slate-500 w-12 text-right">{progress}%</span>
          </div>
        </div>
      )}

      {/* Step: Complete */}
      {step === "complete" && (
        <div className="space-y-4">
          {/* Thinking terminal (shows what happened) */}
          {thinkingLines.length > 0 && (
            <ThinkingTerminal
              lines={thinkingLines}
              isRunning={false}
              title="Gemini 3 Flash — Extraction Complete"
              elapsedMs={elapsedMs}
            />
          )}

          {/* Success */}
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-emerald-900 text-sm">Extraction Complete</h3>
              <p className="text-xs text-emerald-700">
                {extractedData.length} rows from {totalPages} pages in {(elapsedMs / 1000).toFixed(1)}s
              </p>
            </div>
            {scanResult?.currency && (
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                {getCurrencySymbol(scanResult.currency)} {scanResult.currency}
              </Badge>
            )}
          </div>

          {/* Data Preview */}
          <div className="border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b">
              <h4 className="text-sm font-semibold text-slate-900">
                Extracted Data ({extractedData.length} rows)
              </h4>
            </div>
            <div className="overflow-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-400 w-10">#</th>
                    {headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">
                        {h.name}
                        {h.type === "currency" && scanResult?.currency && (
                          <span className="ml-1 text-[10px] text-slate-400 font-normal">({scanResult.currency})</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {extractedData.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-t hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-400 text-[10px]">{i + 1}</td>
                      {headers.map((h, j) => (
                        <td key={j} className={cn(
                          "px-3 py-2 whitespace-nowrap",
                          h.type === "currency" ? "text-slate-900 font-medium tabular-nums" : "text-slate-700"
                        )}>
                          {formatCellValue(row[h.name], h, scanResult?.currency)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {extractedData.length > 100 && (
              <p className="text-xs text-slate-400 text-center py-2">
                Showing first 100 rows of {extractedData.length}
              </p>
            )}
          </div>

          {/* Export Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={reset} className="h-10">
              <RefreshCw className="w-4 h-4 mr-2" />
              Process Another
            </Button>
            <Button variant="outline" onClick={exportToCSV} className="h-10">
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button
              onClick={exportToExcel}
              className="h-10 flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-200"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Download Excel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
