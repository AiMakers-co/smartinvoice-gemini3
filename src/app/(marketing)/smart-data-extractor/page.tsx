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
  Loader2,
  Table,
  FileText,
  ArrowRight,
  Brain,
  Zap,
  Eye,
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
  | "discovering_headers"
  | "extracting"
  | "complete"
  | "error"
  | "rate_limited";

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
  bankName?: string;
  bankCountry?: string;
  accountNumber?: string;
  accountHolderName?: string;
  accountType?: string;
  currency?: string;
  periodStart?: string;
  periodEnd?: string;
  openingBalance?: number;
  closingBalance?: number;
  totalCredits?: number;
  totalDebits?: number;
  transactionCount?: number;
  supplierName?: string;
  supplierAddress?: string;
  customerName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  paymentTerms?: string;
  merchantName?: string;
  merchantAddress?: string;
  receiptDate?: string;
  receiptNumber?: string;
  paymentMethod?: string;
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
      currentStep === "analyzing" || currentStep === "discovering_headers" ? 1 :
      currentStep === "extracting" ? 2 :
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
// DEMO TOOL SECTION
// ============================================

function DemoToolSection() {
  const brand = useBrand();
  const [step, setStep] = useState<DemoStep>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleHeaders, setVisibleHeaders] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hasUsedDemo, setHasUsedDemo] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const headerAnimationRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Bypass demo limit on localhost
    const localhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    setIsLocalhost(localhost);
    
    if (!localhost) {
      const used = localStorage.getItem("smart-extractor-demo-used");
      if (used) setHasUsedDemo(true);
    }
    return () => { if (headerAnimationRef.current) clearTimeout(headerAnimationRef.current); };
  }, []);

  const reset = useCallback(() => {
    setStep("idle");
    setFile(null);
    setResult(null);
    setError(null);
    setVisibleHeaders(0);
    setProgress(0);
    if (headerAnimationRef.current) clearTimeout(headerAnimationRef.current);
  }, []);

  const animateHeaders = useCallback((headers: Pdf2SheetHeader[]) => {
    setVisibleHeaders(0);
    let index = 0;
    const animate = () => {
      if (index < headers.length) {
        setVisibleHeaders(index + 1);
        index++;
        headerAnimationRef.current = setTimeout(animate, 200);
      } else {
        setTimeout(() => { setStep("extracting"); animateExtraction(); }, 600);
      }
    };
    headerAnimationRef.current = setTimeout(animate, 400);
  }, []);

  const animateExtraction = useCallback(() => {
    setProgress(0);
    let p = 0;
    const interval = setInterval(() => {
      p += Math.random() * 15 + 5;
      if (p >= 100) {
        p = 100;
        clearInterval(interval);
        setStep("complete");
        setFile(null);
      }
      setProgress(Math.min(p, 100));
    }, 200);
  }, []);

  const processFile = useCallback(async (uploadedFile: File) => {
    setFile(uploadedFile);
    setError(null);
    setResult(null);
    setVisibleHeaders(0);
    setProgress(0);

    setStep("uploading");
    await new Promise(r => setTimeout(r, 500));
    setStep("reading");
    await new Promise(r => setTimeout(r, 800));
    setStep("analyzing");

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(uploadedFile);
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      const response = await fetch("/api/demo/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData: base64, mimeType: uploadedFile.type }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 429) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data: ExtractResult = await response.json();

      if (response.status === 429) {
        setStep("rate_limited");
        setResult(data);
        return;
      }

      if (!data.success) {
        throw new Error(data.error || "Extraction failed");
      }

      if (!data.headers || data.headers.length === 0) {
        throw new Error("No tabular data found in document");
      }

      setResult(data);
      // Only track usage on non-localhost
      const localhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (!localhost) {
        localStorage.setItem("smart-extractor-demo-used", "true");
        setHasUsedDemo(true);
      }
      setStep("discovering_headers");
      animateHeaders(data.headers);
    } catch (err) {
      console.error("Demo extraction error:", err);
      if (err instanceof Error && err.name === "AbortError") {
        setError("Request timed out. Please try a smaller file.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
      setStep("error");
    }
  }, [animateHeaders]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => { if (files[0]) processFile(files[0]); },
    accept: { "application/pdf": [".pdf"], "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
    disabled: !["idle", "complete", "error", "rate_limited"].includes(step),
  });

  const getDocTypeStyle = (docType?: string) => {
    const type = (docType || "").toLowerCase();
    if (type.includes("bank") || type.includes("statement")) return { color: "#0891B2", label: "Bank Statement" };
    if (type.includes("invoice")) return { color: "#7C3AED", label: "Invoice" };
    if (type.includes("receipt")) return { color: "#059669", label: "Receipt" };
    if (type.includes("bill")) return { color: "#DC2626", label: "Bill" };
    return { color: "#6B7280", label: docType || "Document" };
  };

  const formatCurrency = (value?: number, curr?: string) => {
    if (value === undefined || value === null) return null;
    
    // Map currency codes to symbols
    const currencySymbols: Record<string, string> = {
      USD: "$", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$",
      JPY: "¥", CNY: "¥", CHF: "CHF ", INR: "₹", KRW: "₩",
      BRL: "R$", MXN: "MX$", SGD: "S$", HKD: "HK$", NZD: "NZ$",
      SEK: "kr ", NOK: "kr ", DKK: "kr ", ZAR: "R", ANG: "ƒ",
      AED: "د.إ", THB: "฿", PLN: "zł", CZK: "Kč", ILS: "₪",
    };
    
    const symbol = curr ? (currencySymbols[curr.toUpperCase()] || `${curr} `) : "$";
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
            <div className="p-6 flex flex-col relative" style={{ minHeight: "440px" }}>
            
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

                {/* Demo used overlay - hidden on localhost */}
                {hasUsedDemo && !isLocalhost && (
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-50/95 backdrop-blur-sm rounded-lg border border-amber-200/60">
                    <span className="text-sm text-amber-700">Demo limit reached</span>
                    <span className="text-amber-400">•</span>
                    <span className="text-sm text-amber-600">You can still try again</span>
                  </div>
                )}
              </div>
            )}

            {/* PROCESSING */}
            {(step === "uploading" || step === "reading" || step === "analyzing") && (
              <div className="h-full flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: `${brand.colors.primary}10` }}>
                  {step === "uploading" && <Upload className="w-7 h-7 animate-pulse" style={{ color: brand.colors.primary }} />}
                  {step === "reading" && <Eye className="w-7 h-7 animate-pulse" style={{ color: brand.colors.primary }} />}
                  {step === "analyzing" && <Brain className="w-7 h-7 animate-pulse" style={{ color: brand.colors.primary }} />}
                </div>
                <p className="font-semibold text-slate-900 mb-1">
                  {step === "uploading" && "Uploading..."}
                  {step === "reading" && "Reading document..."}
                  {step === "analyzing" && "Analyzing structure..."}
                </p>
                <p className="text-sm text-slate-500">
                  {step === "uploading" && "Transferring securely"}
                  {step === "reading" && "AI scanning content"}
                  {step === "analyzing" && "Detecting tables & columns"}
                </p>
              </div>
            )}

            {/* DISCOVERING HEADERS */}
            {step === "discovering_headers" && result?.headers && (() => {
              const docStyle = getDocTypeStyle(result.documentType);
              const title = result.bankName || result.supplierName || result.merchantName || docStyle.label;
              return (
                <div className="h-full flex flex-col">
                  <div className="text-center mb-4">
                    <div className="flex items-center justify-center gap-2 text-emerald-600 text-sm mb-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-medium">Document identified</span>
                    </div>
                    <p className="font-bold text-lg text-slate-900">{title}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-700">Columns found</span>
                      <span className="text-xs text-slate-500">{visibleHeaders}/{result.headers.length}</span>
                    </div>
                    <div className="h-1 bg-slate-200 rounded-full mb-4 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(visibleHeaders / result.headers.length) * 100}%`, backgroundColor: docStyle.color }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {result.headers.map((header, index) => (
                        <div key={header.name} className={`p-2 rounded-lg bg-white border text-sm transition-all ${index < visibleHeaders ? "opacity-100 border-slate-200" : "opacity-0"}`}>
                          <span className="font-medium text-slate-900 truncate block">{header.name}</span>
                          <span className="text-[10px] text-slate-500 capitalize">{header.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* EXTRACTING */}
            {step === "extracting" && (
              <div className="h-full flex flex-col items-center justify-center py-8">
                <Loader2 className="w-10 h-10 animate-spin mb-4" style={{ color: brand.colors.primary }} />
                <p className="font-semibold text-slate-900 mb-1">Extracting data...</p>
                <p className="text-sm text-slate-500 mb-4">{result?.headers?.length || 0} columns</p>
                <div className="w-48">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: brand.colors.primary }} />
                  </div>
                  <p className="text-xs text-slate-400 text-center mt-2">{Math.round(progress)}%</p>
                </div>
              </div>
            )}

            {/* COMPLETE */}
            {step === "complete" && result?.rows && result?.headers && (() => {
              const docStyle = getDocTypeStyle(result.documentType);
              const title = result.bankName || result.supplierName || result.merchantName || docStyle.label;
              const isBankStatement = (result.documentType || "").toLowerCase().includes("bank");
              const isInvoice = (result.documentType || "").toLowerCase().includes("invoice");
              
              return (
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ backgroundColor: `${docStyle.color}08` }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${docStyle.color}15` }}>
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{title}</p>
                      <p className="text-xs text-slate-500">
                        {result.rows.length} rows extracted
                        {result.currency && <span className="ml-2 text-slate-400">• {result.currency}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {isBankStatement && result.openingBalance !== undefined && (
                      <div className="bg-slate-50 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-slate-500 uppercase">Opening</p>
                        <p className="font-semibold text-sm text-slate-900">{formatCurrency(result.openingBalance, result.currency)}</p>
                      </div>
                    )}
                    {isBankStatement && result.closingBalance !== undefined && (
                      <div className="bg-slate-50 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-slate-500 uppercase">Closing</p>
                        <p className="font-semibold text-sm text-slate-900">{formatCurrency(result.closingBalance, result.currency)}</p>
                      </div>
                    )}
                    {isInvoice && result.totalAmount !== undefined && (
                      <div className="bg-purple-50 rounded-lg p-2 text-center col-span-3">
                        <p className="text-[10px] text-purple-600 uppercase">Total</p>
                        <p className="font-bold text-purple-700">{formatCurrency(result.totalAmount, result.currency)}</p>
                      </div>
                    )}
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500 uppercase">Rows</p>
                      <p className="font-semibold text-sm text-slate-900">{result.rows.length}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500 uppercase">Columns</p>
                      <p className="font-semibold text-sm text-slate-900">{result.headers.length}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500 uppercase">Confidence</p>
                      <p className="font-semibold text-sm text-slate-900">{Math.round((result.confidence || 0) * 100)}%</p>
                    </div>
                  </div>

                  <div className="flex-1 border rounded-lg overflow-hidden mb-4">
                    <div className="overflow-auto" style={{ maxHeight: "180px" }}>
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            {result.headers.slice(0, 5).map((h) => (
                              <th key={h.name} className="px-3 py-2 text-left font-medium text-slate-600 truncate">{h.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {result.rows.slice(0, 6).map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              {result.headers!.slice(0, 5).map((h) => (
                                <td key={h.name} className="px-3 py-1.5 text-slate-700 truncate max-w-[120px]">{String(row[h.name] || "—").slice(0, 25)}</td>
                              ))}
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

            {/* RATE LIMITED */}
            {step === "rate_limited" && (
              <div className="h-full flex flex-col items-center justify-center py-8 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: `${brand.colors.primary}15` }}>
                  <Sparkles className="w-7 h-7" style={{ color: brand.colors.primary }} />
                </div>
                <p className="font-semibold text-slate-900 mb-1">Demo limit reached</p>
                <p className="text-sm text-slate-500 mb-4 max-w-xs">Sign up for unlimited extractions</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={reset}>Try later</Button>
                  <Link href="/login">
                    <Button size="sm" style={{ backgroundColor: brand.colors.primary }} className="text-white">Sign up <ArrowRight className="w-4 h-4 ml-1" /></Button>
                  </Link>
                </div>
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
