"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { useBrand } from "@/hooks/use-brand";
import { BrandLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  FileText,
  ArrowRight,
  Brain,
  Zap,
  FileType,
  Shield,
  Sparkles,
  Check,
  Clock,
  Settings,
  BarChart3,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface Pdf2SheetHeader {
  name: string;
  type: "string" | "number" | "date" | "currency" | "boolean";
  description?: string;
  example?: string;
}

type DemoStep = 
  | "idle"
  | "uploading"
  | "reading"
  | "analyzing"
  | "complete"
  | "error"
;

interface DocumentMetadataItem {
  label: string;
  value: string;
  category: "entity" | "reference" | "date" | "financial" | "payment" | "tax" | "contact" | "other";
}

interface ExtractResult {
  success: boolean;
  documentType?: string;
  headers?: Pdf2SheetHeader[];
  rows?: Record<string, unknown>[];
  confidence?: number;
  warnings?: string[];
  rowCount?: number;
  remaining?: number;
  error?: string;
  signupUrl?: string;
  pageCount?: number;
  // Dynamic metadata from AI
  metadata?: DocumentMetadataItem[];
  // Backward-compat convenience fields
  currency?: string;
  supplierName?: string;
  bankName?: string;
  totalAmount?: number;
}

// ============================================
// HERO SECTION
// ============================================

function HeroSection() {
  const brand = useBrand();

  return (
    <section className="relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0">
        <div 
          className="absolute top-20 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: brand.colors.primary }}
        />
        <div 
          className="absolute bottom-20 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-10"
          style={{ backgroundColor: "#F59E0B" }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 lg:pt-28 lg:pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div>
            <div 
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6 bg-white/10 text-white/90"
            >
              <Zap className="w-3.5 h-3.5" />
              Free Demo - No signup required
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
              Turn any document into 
              <span className="block" style={{ color: brand.colors.primary }}>structured data</span>
            </h1>
            
            <p className="text-lg text-slate-300 mb-8 max-w-lg">
              Upload a bank statement, invoice, or receipt. Our AI extracts tables, identifies columns, and exports clean spreadsheets in seconds.
            </p>

            <div className="flex flex-wrap gap-4 mb-8">
              <Link href="#demo">
                <Button 
                  size="lg"
                  className="text-white"
                  style={{ backgroundColor: brand.colors.primary }}
                >
                  Try it free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/features">
                <Button variant="ghost" size="lg" className="border border-white/30 !text-white hover:bg-white/10">
                  Learn more
                </Button>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Files auto-deleted</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Results in seconds</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>No signup needed</span>
              </div>
            </div>
          </div>

          {/* Right - Hero image */}
          <div className="relative hidden lg:block">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              <Image
                src="/marketing/extractor/hero-main.png"
                alt="Smart Data Extractor"
                width={600}
                height={400}
                className="w-full h-auto"
                priority
              />
            </div>
            {/* Floating badge */}
            <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">12 rows extracted</p>
                <p className="text-xs text-slate-500">98% confidence</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// STEP INDICATOR
// ============================================

const WORKFLOW_STEPS = [
  { id: "upload", label: "Upload" },
  { id: "analyze", label: "Analyze" },
  { id: "extract", label: "Extract" },
  { id: "download", label: "Download" },
];

function StepIndicator({ currentStep }: { currentStep: DemoStep }) {
  const brand = useBrand();
  
  const getStepStatus = (stepId: string) => {
    const stepMap: Record<string, number> = { upload: 0, analyze: 1, extract: 2, download: 3 };
    const currentStepNum = 
      currentStep === "idle" ? -1 :
      currentStep === "uploading" || currentStep === "reading" ? 0 :
      currentStep === "analyzing" ? 1 :
      currentStep === "complete" ? 3 : -1;
    
    const thisStepNum = stepMap[stepId];
    if (currentStepNum > thisStepNum) return "complete";
    if (currentStepNum === thisStepNum) return "active";
    return "pending";
  };
  
  return (
    <div className="flex items-center">
      {WORKFLOW_STEPS.map((step, index) => {
        const status = getStepStatus(step.id);
        const isLast = index === WORKFLOW_STEPS.length - 1;
        
        return (
          <div key={step.id} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
            {/* Step */}
            <div className="flex flex-col items-center">
              <div 
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all
                  ${status === "complete" ? "bg-emerald-500 text-white" : ""}
                  ${status === "active" ? "text-white shadow-lg ring-4 ring-primary/20" : ""}
                  ${status === "pending" ? "bg-slate-100 text-slate-400 border-2 border-slate-200" : ""}`}
                style={status === "active" ? { backgroundColor: brand.colors.primary } : {}}
              >
                {status === "complete" ? <Check className="w-4 h-4 stroke-[3]" /> : index + 1}
              </div>
              <span className={`mt-1.5 text-xs font-medium ${
                status === "complete" ? "text-emerald-600" :
                status === "active" ? "text-slate-900" : "text-slate-400"
              }`}>
                {step.label}
              </span>
            </div>
            
            {/* Connector line */}
            {!isLast && (
              <div className="flex-1 mx-3">
                <div className={`h-0.5 w-full transition-colors ${status === "complete" ? "bg-emerald-500" : "bg-slate-200"}`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// THINKING TERMINAL (same style as dashboard)
// ============================================

interface ThinkingLine {
  text: string;
  type: "step" | "analyze" | "search" | "match" | "confirm" | "classify" | "info" | "learn";
}

function DemoTerminal({
  lines,
  isRunning,
  elapsedMs,
}: {
  lines: ThinkingLine[];
  isRunning: boolean;
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
      case "learn": return "text-emerald-600";
      default: return "text-slate-500";
    }
  };

  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-500">Gemini 3 Flash</span>
            {isRunning && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] text-emerald-600 font-mono">LIVE</span>
              </span>
            )}
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-400">{(elapsedMs / 1000).toFixed(1)}s</span>
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className="flex-1 p-3 font-mono text-[10px] leading-[1.7] overflow-y-auto"
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
              <div key={idx} className={`font-mono ${style}`}>
                <div className="border-b border-slate-100 pb-0.5 mb-0.5">
                  {icon} {line.text}
                </div>
              </div>
            );
          }

          return (
            <div
              key={idx}
              className={`font-mono animate-in fade-in slide-in-from-bottom-1 duration-200 ${style}`}
            >
              {icon} {line.text}
            </div>
          );
        })}

        {isRunning && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-purple-600">$</span>
            <span className="w-1.5 h-3.5 bg-purple-400 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// DEMO TOOL SECTION
// ============================================

function DemoToolSection() {
  const brand = useBrand();
  const [step, setStep] = useState<DemoStep>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasUsedDemo, setHasUsedDemo] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  // Terminal state
  const [terminalLines, setTerminalLines] = useState<ThinkingLine[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);
  const thinkingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const localhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    setIsLocalhost(localhost);
    if (!localhost) {
      const used = localStorage.getItem("smart-extractor-demo-used");
      if (used) setHasUsedDemo(true);
    }
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      if (thinkingIntervalRef.current) clearTimeout(thinkingIntervalRef.current);
    };
  }, []);

  const startTimer = () => {
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    elapsedRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);
  };

  const stopTimer = () => {
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
  };

  const addLine = (text: string, type: ThinkingLine["type"] = "info") => {
    setTerminalLines(prev => [...prev, { text, type }]);
  };

  const addLineDelayed = (text: string, type: ThinkingLine["type"], delayMs: number): Promise<void> => {
    return new Promise(resolve => {
      thinkingIntervalRef.current = setTimeout(() => {
        setTerminalLines(prev => [...prev, { text, type }]);
        resolve();
      }, delayMs);
    });
  };

  // Simulated thinking lines that appear while waiting for API
  const simulateThinking = (fileName: string, fileSize: number, mimeType: string) => {
    const thinkingSteps = [
      { text: "DOCUMENT UPLOAD", type: "step" as const, delay: 0 },
      { text: `Received: ${fileName}`, type: "analyze" as const, delay: 150 },
      { text: `File size: ${(fileSize / 1024).toFixed(0)} KB • Type: ${mimeType || "application/pdf"}`, type: "search" as const, delay: 100 },
      { text: "Encoding to base64 for secure transfer...", type: "search" as const, delay: 200 },
      { text: "Upload complete — sending to AI", type: "confirm" as const, delay: 300 },
      { text: "AI DOCUMENT ANALYSIS", type: "step" as const, delay: 400 },
      { text: "Initializing Gemini 3 Flash with vision capabilities...", type: "analyze" as const, delay: 200 },
      { text: "Model: gemini-3-flash • Mode: multimodal vision", type: "search" as const, delay: 120 },
      { text: "Output: structured JSON with dynamic metadata", type: "search" as const, delay: 100 },
      { text: "Scanning document for tables, headers, and structure...", type: "analyze" as const, delay: 600 },
      { text: "Detecting row/column boundaries and data types...", type: "search" as const, delay: 800 },
      { text: "Extracting ALL key metadata from document...", type: "search" as const, delay: 600 },
      { text: "Identifying entities, dates, financial data, references...", type: "search" as const, delay: 700 },
      { text: "Detecting currency symbols and codes...", type: "search" as const, delay: 500 },
      { text: "Classifying document type...", type: "search" as const, delay: 600 },
      { text: "Extracting tabular data rows...", type: "analyze" as const, delay: 800 },
      { text: "Validating extracted values...", type: "search" as const, delay: 600 },
      { text: "Cross-referencing metadata with table structure...", type: "search" as const, delay: 700 },
    ];

    let totalDelay = 0;
    for (const step of thinkingSteps) {
      totalDelay += step.delay;
      const d = totalDelay;
      setTimeout(() => {
        setTerminalLines(prev => [...prev, { text: step.text, type: step.type }]);
      }, d);
    }
  };

  const reset = useCallback(() => {
    setStep("idle");
    setFile(null);
    setResult(null);
    setError(null);
    setTerminalLines([]);
    setElapsedMs(0);
    stopTimer();
    if (thinkingIntervalRef.current) clearTimeout(thinkingIntervalRef.current);
  }, []);

  const processFile = useCallback(async (uploadedFile: File) => {
    setFile(uploadedFile);
    setError(null);
    setResult(null);
    setTerminalLines([]);
    startTimer();
    setStep("analyzing");

    // Start terminal simulation
    simulateThinking(uploadedFile.name, uploadedFile.size, uploadedFile.type);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(uploadedFile);
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch("/api/demo/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData: base64, mimeType: uploadedFile.type }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data: ExtractResult = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Extraction failed");
      }

      if (!data.headers || data.headers.length === 0) {
        throw new Error("No tabular data found in document");
      }

      // Reveal results in terminal
      const revealResults = async () => {
        const docTypeLabel = (data.documentType || "Document").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        await addLineDelayed("STRUCTURE DETECTION", "step", 200);
        await addLineDelayed(`Classified as: ${docTypeLabel}`, "confirm", 150);
        await addLineDelayed(`Confidence: ${Math.round((data.confidence || 0) * 100)}%`, "confirm", 100);

        // Reveal metadata
        const metadata = data.metadata || [];
        if (metadata.length > 0) {
          await addLineDelayed("DOCUMENT METADATA", "step", 200);
          await addLineDelayed(`Found ${metadata.length} key fields on document:`, "analyze", 120);
          const categoryIcon: Record<string, string> = {
            entity: "🏢", reference: "🔗", date: "📅", financial: "💰",
            payment: "🏦", tax: "📋", contact: "📍", other: "📎",
          };
          for (const item of metadata) {
            const icon = categoryIcon[item.category] || "📎";
            await addLineDelayed(`${icon} ${item.label}: ${item.value}`, "match", 50 + Math.random() * 50);
          }
        }

        // Reveal headers
        await addLineDelayed("COLUMN DISCOVERY", "step", 200);
        await addLineDelayed(`Detected ${data.headers!.length} columns:`, "analyze", 120);
        for (let i = 0; i < data.headers!.length; i++) {
          const h = data.headers![i];
          const typeLabel = h.type === "currency" ? "💰 currency" : h.type === "date" ? "📅 date" : h.type === "number" ? "🔢 number" : "📝 text";
          await addLineDelayed(`Column ${i + 1}: ${h.name} [${typeLabel}]`, "match", 60);
        }

        // Rows extracted
        await addLineDelayed("DATA EXTRACTION", "step", 200);
        await addLineDelayed(`Extracted ${data.rows?.length || 0} rows from document`, "confirm", 100);
        if (data.rows && data.rows.length > 0 && data.headers) {
          const firstRow = data.rows[0];
          const previewCols = data.headers.slice(0, 3);
          const preview = previewCols.map(h => `${h.name}: ${firstRow[h.name] ?? "—"}`).join(" • ");
          await addLineDelayed(`Row 1: ${preview}`, "search", 80);
        }
        if (data.warnings && data.warnings.length > 0) {
          for (const w of data.warnings) {
            await addLineDelayed(`⚠ ${w}`, "classify", 60);
          }
        }
        await addLineDelayed("ANALYSIS COMPLETE", "step", 200);
        await addLineDelayed("Ready — review results below", "confirm", 100);

        stopTimer();
        setResult(data);
        
        // Track usage
        const localhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        if (!localhost) {
          localStorage.setItem("smart-extractor-demo-used", "true");
          setHasUsedDemo(true);
        }

        // Short pause then show results
        await new Promise(r => setTimeout(r, 600));
        setStep("complete");
      };

      revealResults();
    } catch (err) {
      stopTimer();
      console.error("Demo extraction error:", err);
      const msg = err instanceof Error && err.name === "AbortError"
        ? "Request timed out. Please try a smaller file."
        : (err instanceof Error ? err.message : "Something went wrong");
      addLine(`✗ Error: ${msg}`, "classify");
      setError(msg);
      setStep("error");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => { if (files[0]) processFile(files[0]); },
    accept: { "application/pdf": [".pdf"], "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
    disabled: !["idle", "complete", "error"].includes(step),
  });

  const getDocTypeStyle = (docType?: string) => {
    const type = (docType || "").toLowerCase();
    if (type.includes("bank") || type.includes("statement")) return { color: "#0891B2", label: "Bank Statement" };
    if (type.includes("invoice")) return { color: "#7C3AED", label: "Invoice" };
    if (type.includes("receipt")) return { color: "#059669", label: "Receipt" };
    if (type.includes("bill")) return { color: "#DC2626", label: "Bill" };
    return { color: "#6B7280", label: docType || "Document" };
  };

  const formatCurrency = (value: number, curr?: string): string => {
    const currencySymbols: Record<string, string> = {
      USD: "$", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$",
      JPY: "¥", CNY: "¥", CHF: "CHF ", INR: "₹", KRW: "₩",
      BRL: "R$", MXN: "MX$", SGD: "S$", HKD: "HK$", NZD: "NZ$",
      SEK: "kr ", NOK: "kr ", DKK: "kr ", ZAR: "R", ANG: "ƒ",
      AED: "د.إ", THB: "฿", PLN: "zł", CZK: "Kč", ILS: "₪",
      TRY: "₺", RUB: "₽", HUF: "Ft", RON: "lei",
    };
    const symbol = curr ? (currencySymbols[curr.toUpperCase()] || `${curr} `) : "";
    return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const exportToCSV = () => {
    if (!result?.rows || !result?.headers) return;
    const headerNames = result.headers.map(h => h.name);
    const csvRows = [
      headerNames.join(","),
      ...result.rows.map(row => headerNames.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(","))
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extracted_data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    if (!result?.rows || !result?.headers) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(result.rows);
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `extracted_data.xlsx`);
  };

  return (
    <section id="demo" className="py-16 lg:py-24 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-5 gap-12 lg:gap-16 items-center">
          
          {/* Left side - Marketing copy */}
          <div className="lg:col-span-2">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-6 leading-tight">
              See it in action.
              <span className="block text-slate-500 font-normal text-2xl lg:text-3xl mt-2">
                Upload any document.
              </span>
            </h2>
            
            <div className="space-y-4 mb-8">
              {[
                { title: "Bank statements", desc: "From any bank, any format" },
                { title: "Invoices & bills", desc: "Suppliers, vendors, utilities" },
                { title: "Receipts", desc: "Expenses, purchases, payments" },
                { title: "Financial reports", desc: "Tables, schedules, summaries" },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-6 text-sm text-slate-500 mb-8">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Files auto-deleted</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span>Results in seconds</span>
              </div>
            </div>

            <Link href="/login">
              <Button size="lg" className="bg-primary text-white hover:bg-primary/90">
                Start free trial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Right side - Demo Card */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative">
            {/* Background watermark */}
            <div className="absolute bottom-24 right-8 opacity-[0.04] pointer-events-none scale-[2.5]">
              <BrandLogo size="lg" showText={false} />
            </div>
            
            {/* Step indicator */}
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <StepIndicator currentStep={step} />
            </div>
            
            {/* Content */}
            <div className="p-6 flex flex-col relative" style={{ minHeight: "600px" }}>
            
            {/* IDLE */}
            {step === "idle" && (
              <div
                {...getRootProps()}
                className={`flex-1 relative rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all
                  ${isDragActive ? "bg-cyan-50 border-2 border-cyan-400" : "bg-slate-50 border-2 border-dashed border-slate-200 hover:border-slate-300"}`}
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: `${brand.colors.primary}10` }}>
                  <Upload className="w-8 h-8" style={{ color: brand.colors.primary }} />
                </div>
                <p className="text-xl font-semibold text-slate-900 mb-2">{isDragActive ? "Drop to extract" : "Drop your file here"}</p>
                <p className="text-slate-500 mb-8">or <span className="underline underline-offset-2">browse files</span></p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <FileText className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-slate-600">PDF</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <FileType className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-slate-600">PNG</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-lg border border-slate-200 shadow-sm">
                    <FileType className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-slate-600">JPG</span>
                  </div>
                </div>

              </div>
            )}

            {/* PROCESSING — AI THINKING TERMINAL */}
            {(step === "uploading" || step === "reading" || step === "analyzing") && (
              <DemoTerminal
                lines={terminalLines}
                isRunning={true}
                elapsedMs={elapsedMs}
              />
            )}

            {/* COMPLETE */}
            {step === "complete" && result?.rows && result?.headers && (() => {
              const docStyle = getDocTypeStyle(result.documentType);
              const entityMeta = result.metadata?.find(m => m.category === "entity");
              const title = entityMeta?.value || result.bankName || result.supplierName || docStyle.label;
              const currencyMeta = result.metadata?.find(m => m.label.toLowerCase().includes("currency"));
              const detectedCurrency = currencyMeta?.value || result.currency;
              
              // Category colors for metadata pills
              const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
                entity: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
                reference: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
                date: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
                financial: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
                payment: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
                tax: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
                contact: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
                other: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
              };
              
              return (
                <div className="h-full flex flex-col">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-3 p-3 rounded-xl" style={{ backgroundColor: `${docStyle.color}08` }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${docStyle.color}15` }}>
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{title}</p>
                      <p className="text-xs text-slate-500">
                        {result.rows.length} rows extracted
                        {detectedCurrency && <span className="ml-2 text-slate-400">• {detectedCurrency}</span>}
                        {result.confidence && <span className="ml-2 text-slate-400">• {Math.round(result.confidence * 100)}%</span>}
                      </p>
                    </div>
                  </div>

                  {/* Dynamic metadata pills */}
                  {result.metadata && result.metadata.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {result.metadata.slice(0, 12).map((item, idx) => {
                        const colors = categoryColors[item.category] || categoryColors.other;
                        return (
                          <span
                            key={idx}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] ${colors.bg} ${colors.text} ${colors.border}`}
                          >
                            <span className="font-medium">{item.label}:</span>
                            <span className="truncate max-w-[120px]">{item.value}</span>
                          </span>
                        );
                      })}
                      {result.metadata.length > 12 && (
                        <span className="text-[10px] text-slate-400 self-center">+{result.metadata.length - 12} more</span>
                      )}
                    </div>
                  )}

                  {/* Data table */}
                  <div className="flex-1 border rounded-lg overflow-hidden mb-4">
                    <div className="overflow-auto" style={{ maxHeight: "500px" }}>
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            {result.headers.slice(0, 5).map((h) => (
                              <th key={h.name} className="px-3 py-2 text-left font-medium text-slate-600 truncate">
                                {h.name}
                                {h.type === "currency" && detectedCurrency && (
                                  <span className="ml-1 text-[9px] text-slate-400 font-normal">({detectedCurrency})</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {result.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              {result.headers!.slice(0, 5).map((h) => {
                                const val = row[h.name];
                                let display = val === null || val === undefined ? "—" : String(val).slice(0, 25);
                                // Format currency values
                                if (h.type === "currency" && val !== null && val !== undefined && val !== "" && val !== "-") {
                                  const num = typeof val === "number" ? val : parseFloat(String(val));
                                  if (!isNaN(num)) {
                                    display = formatCurrency(num, detectedCurrency);
                                  }
                                }
                                return (
                                  <td key={h.name} className={`px-3 py-1.5 truncate max-w-[120px] ${h.type === "currency" ? "text-slate-900 font-medium tabular-nums" : "text-slate-700"}`}>
                                    {display}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Download actions */}
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <button 
                      onClick={exportToCSV}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download CSV
                    </button>
                    <button 
                      onClick={exportToExcel}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors"
                      style={{ backgroundColor: brand.colors.primary }}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Download Excel
                    </button>
                  </div>
                  
                  {/* Try another */}
                  <button 
                    onClick={reset}
                    className="w-full mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Extract another document →
                  </button>
                </div>
              );
            })()}

            {/* ERROR */}
            {step === "error" && (
              <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
                  <AlertCircle className="w-7 h-7 text-red-500" />
                </div>
                <p className="font-semibold text-slate-900 mb-1">Extraction failed</p>
                <p className="text-sm text-slate-500 mb-4 max-w-xs">{error || "Try a different document"}</p>
                <Button variant="outline" size="sm" onClick={reset}>Try again</Button>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Files auto-deleted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>Results in seconds</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Powered by</span>
              <BrandLogo size="sm" showText={true} className="opacity-70" />
            </div>
          </div>
        </div>
        </div>

      </div>
    </section>
  );
}

// ============================================
// FEATURES SECTION
// ============================================

function FeaturesSection() {
  const brand = useBrand();
  
  const features = [
    {
      icon: Brain,
      title: "AI-Powered Detection",
      description: "Automatically identifies document type, detects tables, and extracts column headers without any configuration.",
    },
    {
      icon: Zap,
      title: "Instant Results",
      description: "Get structured data in seconds. No waiting, no manual data entry, no spreadsheet formatting.",
    },
    {
      icon: Shield,
      title: "Privacy First",
      description: "Your files are processed securely and automatically deleted. We never store your documents.",
    },
    {
      icon: FileSpreadsheet,
      title: "Export Anywhere",
      description: "Download as CSV or Excel. Ready to import into your accounting software or spreadsheets.",
    },
    {
      icon: Settings,
      title: "Zero Configuration",
      description: "No templates to set up. Works with any bank, any invoice format, any receipt layout.",
    },
    {
      icon: BarChart3,
      title: "Rich Metadata",
      description: "Extracts totals, dates, account numbers, and other key information automatically.",
    },
  ];

  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Why choose Smart Data Extractor?</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            The fastest way to turn documents into spreadsheets
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="p-6 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${brand.colors.primary}10` }}>
                  <Icon className="w-6 h-6" style={{ color: brand.colors.primary }} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================
// CTA SECTION
// ============================================

function CTASection() {
  const brand = useBrand();

  return (
    <section className="py-16 lg:py-24 bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to automate your data entry?</h2>
        <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
          Sign up for free and get unlimited extractions, bulk processing, and auto-categorization.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/login">
            <Button size="lg" className="text-white" style={{ backgroundColor: brand.colors.primary }}>
              Start free trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="ghost" size="lg" className="border border-white/30 !text-white hover:bg-white/10">
              View pricing
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ============================================
// PAGE EXPORT
// ============================================

export default function SmartDataExtractorPage() {
  return (
    <>
      <HeroSection />
      <DemoToolSection />
      <FeaturesSection />
      <CTASection />
    </>
  );
}
