"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Pdf2SheetTool } from "@/components/pdf2sheet/Pdf2SheetTool";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileSpreadsheet,
  Sparkles,
  Clock,
  FileText,
  Download,
  Table,
  CheckCircle2,
  Brain,
  Building2,
  Calendar,
  Hash,
  Eye,
  Layers,
  Rows3,
} from "lucide-react";
import * as XLSX from "xlsx";

// Types
interface RecentConversion {
  id: string;
  fileName: string;
  fileUrl?: string;
  pageCount: number;
  rowCount: number;
  createdAt: any;
  status: "completed" | "processing" | "failed";
  supplierName?: string;
  documentDate?: string;
  documentNumber?: string;
  headers?: Array<{ name: string; type: string }>;
  extractedData?: Record<string, any>[];
}

interface SavedTemplate {
  id: string;
  name: string;
  supplierName?: string;
  documentType: string;
  headers: Array<{ name: string; type: string; description?: string; example?: string }>;
  usageCount: number;
  lastUsed: any;
  createdAt: any;
}

export default function Pdf2SheetPage() {
  const { user } = useAuth();
  const [recentConversions, setRecentConversions] = useState<RecentConversion[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);
  const [selectedConversion, setSelectedConversion] = useState<RecentConversion | null>(null);

  // Load data
  useEffect(() => {
    if (!user?.id) return;

    const jobsQ = query(
      collection(db, "pdf2sheet_jobs"),
      where("userId", "==", user.id),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubJobs = onSnapshot(jobsQ,
      (snapshot) => {
        setRecentConversions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RecentConversion[]);
      },
      () => console.log("No recent conversions")
    );

    const templatesQ = query(
      collection(db, "pdf2sheet_templates"),
      where("userId", "==", user.id),
      orderBy("lastUsed", "desc"),
      limit(10)
    );

    const unsubTemplates = onSnapshot(templatesQ,
      (snapshot) => {
        setSavedTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SavedTemplate[]);
      },
      () => console.log("No templates")
    );

    return () => { unsubJobs(); unsubTemplates(); };
  }, [user?.id]);

  // Stats
  const completedCount = recentConversions.filter(c => c.status === "completed").length;
  const totalRows = recentConversions.filter(c => c.status === "completed").reduce((sum, c) => sum + (c.rowCount || 0), 0);
  const totalPages = recentConversions.filter(c => c.status === "completed").reduce((sum, c) => sum + (c.pageCount || 0), 0);

  return (
    <div className="flex flex-col h-full bg-white">
      <Header title="Smart Extract" />

      <div className="flex-1 p-4 flex flex-col min-h-0">
        {/* Stats Bar */}
        <div className="grid grid-cols-5 gap-3 mb-4 shrink-0">
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-wide text-slate-500 font-mono font-medium">Conversions</div>
            <div className="text-lg font-bold text-slate-900">{completedCount}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-wide text-slate-500 font-mono font-medium">Pages</div>
            <div className="text-lg font-bold text-cyan-600">{totalPages}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-wide text-slate-500 font-mono font-medium">Rows Extracted</div>
            <div className="text-lg font-bold text-emerald-600">{totalRows.toLocaleString()}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-wide text-slate-500 font-mono font-medium">Templates</div>
            <div className="text-lg font-bold text-purple-600">{savedTemplates.length}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2.5 flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-500" />
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-500 font-mono font-medium">Engine</div>
              <div className="text-xs font-semibold text-purple-600">Gemini 3 Flash</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
          {/* Left — Main Tool */}
          <div className="col-span-2 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5">
              <Pdf2SheetTool mode="full" />
            </div>
          </div>

          {/* Right — Templates & History */}
          <div className="flex flex-col gap-4 min-h-0">
            {/* Templates */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col" style={{ height: "40%" }}>
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-500" />
                  <span className="text-xs font-mono font-semibold uppercase tracking-wide text-slate-700">Templates</span>
                </div>
                {savedTemplates.length > 0 && (
                  <Badge variant="secondary" className="text-[9px]">{savedTemplates.length}</Badge>
                )}
              </div>

              {savedTemplates.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                  <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center mb-2">
                    <Table className="h-5 w-5 text-purple-400" />
                  </div>
                  <p className="text-xs font-medium text-slate-600">No templates yet</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Templates are created automatically</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto divide-y">
                  {savedTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className="w-full flex items-center gap-2.5 p-3 hover:bg-purple-50/50 transition-colors text-left group"
                    >
                      <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-900 truncate">{template.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {template.headers.length} cols • {template.usageCount} uses
                        </p>
                      </div>
                      <Eye className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* History */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col flex-1 min-h-0">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100 shrink-0">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-mono font-semibold uppercase tracking-wide text-slate-700">History</span>
                {recentConversions.length > 0 && (
                  <Badge variant="secondary" className="text-[9px]">{recentConversions.length}</Badge>
                )}
              </div>

              {recentConversions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                  <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center mb-2">
                    <FileSpreadsheet className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-xs font-medium text-slate-600">No conversions yet</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Upload a PDF to get started</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto divide-y">
                  {recentConversions.map((conversion) => (
                    <button
                      key={conversion.id}
                      onClick={() => conversion.status === "completed" && setSelectedConversion(conversion)}
                      className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                          conversion.status === "completed" ? "bg-emerald-100" :
                          conversion.status === "failed" ? "bg-red-100" : "bg-amber-100"
                        }`}>
                          {conversion.status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : conversion.status === "failed" ? (
                            <FileText className="h-4 w-4 text-red-500" />
                          ) : (
                            <Sparkles className="h-4 w-4 text-amber-600 animate-pulse" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-900 truncate">
                            {conversion.supplierName || conversion.fileName}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {conversion.pageCount}p • {conversion.rowCount?.toLocaleString() || 0} rows
                          </p>
                        </div>
                      </div>
                      {conversion.status === "completed" && (
                        <Eye className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Template Detail Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <FileSpreadsheet className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <span className="block">{selectedTemplate?.name}</span>
                <span className="text-xs font-normal text-slate-500">
                  {selectedTemplate?.documentType} • {selectedTemplate?.usageCount} uses
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {selectedTemplate?.supplierName && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-slate-400" />
                <span className="text-slate-600">Supplier:</span>
                <span className="font-medium">{selectedTemplate.supplierName}</span>
              </div>
            )}
            <div className="border border-slate-200 rounded-lg shadow-sm overflow-hidden max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-mono font-medium uppercase tracking-wide text-slate-500 w-8">#</th>
                    <th className="px-3 py-2 text-left text-xs font-mono font-medium uppercase tracking-wide text-slate-500">Column</th>
                    <th className="px-3 py-2 text-left text-xs font-mono font-medium uppercase tracking-wide text-slate-500 w-20">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-mono font-medium uppercase tracking-wide text-slate-500">Example</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedTemplate?.headers.map((h, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{h.name}</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className={`text-[10px] ${
                          h.type === "currency" ? "bg-emerald-100 text-emerald-700" :
                          h.type === "number" ? "bg-blue-100 text-blue-700" :
                          h.type === "date" ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>{h.type}</Badge>
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs font-mono">{h.example || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conversion Detail Dialog */}
      <Dialog open={!!selectedConversion} onOpenChange={() => setSelectedConversion(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] w-full h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FileText className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <span className="block">{selectedConversion?.supplierName || selectedConversion?.fileName}</span>
                <span className="text-xs font-normal text-slate-500">
                  {selectedConversion?.pageCount} pages • {selectedConversion?.rowCount} rows
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col gap-4 mt-4">
            <div className="flex items-center gap-4 text-sm flex-wrap">
              {selectedConversion?.supplierName && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  <span className="font-medium">{selectedConversion.supplierName}</span>
                </div>
              )}
              {selectedConversion?.documentDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>{selectedConversion.documentDate}</span>
                </div>
              )}
              {selectedConversion?.documentNumber && (
                <div className="flex items-center gap-1.5">
                  <Hash className="h-4 w-4 text-slate-400" />
                  <span>{selectedConversion.documentNumber}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
              <div className="border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                  <span className="text-xs font-mono font-medium uppercase tracking-wide text-slate-600">Original Document</span>
                </div>
                <div className="flex-1 bg-slate-100">
                  {selectedConversion?.fileUrl ? (
                    <iframe src={selectedConversion.fileUrl} className="w-full h-full min-h-[300px]" title="PDF" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Preview not available</div>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-mono font-medium uppercase tracking-wide text-slate-600">
                    Extracted Data ({selectedConversion?.extractedData?.length || 0} rows)
                  </span>
                  {selectedConversion?.extractedData && selectedConversion.extractedData.length > 0 && (
                    <Button
                      variant="ghost" size="sm" className="h-6 text-xs"
                      onClick={() => {
                        if (selectedConversion?.extractedData) {
                          const ws = XLSX.utils.json_to_sheet(selectedConversion.extractedData);
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, "Data");
                          XLSX.writeFile(wb, `${selectedConversion.fileName.replace(".pdf", "")}_data.xlsx`);
                        }
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" /> Excel
                    </Button>
                  )}
                </div>
                <div className="flex-1 overflow-auto">
                  {selectedConversion?.extractedData && selectedConversion.extractedData.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                        <tr>
                          {selectedConversion.headers?.map((h, i) => (
                            <th key={i} className="px-2 py-1.5 text-left font-mono font-medium uppercase tracking-wide text-slate-500 whitespace-nowrap">{h.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedConversion.extractedData.slice(0, 50).map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            {selectedConversion.headers?.map((h, j) => (
                              <td key={j} className="px-2 py-1.5 text-slate-700 whitespace-nowrap">{row[h.name] ?? "-"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">No data</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
