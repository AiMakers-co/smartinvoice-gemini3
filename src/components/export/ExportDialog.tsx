"use client";

import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Upload, 
  FileSpreadsheet, 
  Sparkles, 
  GripVertical, 
  Check,
  Download,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { ExportColumn, AVAILABLE_FIELDS } from "@/types/export";
import { useBrand } from "@/hooks/use-brand";
import * as XLSX from "xlsx";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  transactions: any[];
  onExport: (data: string, filename: string) => void;
}

interface AIAnalysis {
  mappings: {
    uploadedHeader: string;
    ourField: string;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  }[];
  summary: string;
}

type Step = 'choose' | 'upload' | 'analyzing' | 'confirm' | 'configure';

export function ExportDialog({ open, onClose, transactions, onExport }: ExportDialogProps) {
  const brand = useBrand();
  const [step, setStep] = useState<Step>('choose');
  const [columns, setColumns] = useState<ExportColumn[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [uploadedHeaders, setUploadedHeaders] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Reset state when dialog closes
  const handleClose = () => {
    setStep('choose');
    setColumns([]);
    setAiAnalysis(null);
    setUploadedHeaders([]);
    setError(null);
    onClose();
  };

  // Handle template file upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setStep('analyzing');
    setAnalyzing(true);
    setError(null);
    
    try {
      // Read the file to get headers
      const headers = await extractHeaders(file);
      setUploadedHeaders(headers);
      
      if (headers.length > 0) {
        // Call AI to analyze and map headers
        const analysis = await analyzeWithAI(headers);
        setAiAnalysis(analysis);
        
        // Convert AI analysis to columns
        const mappedColumns: ExportColumn[] = analysis.mappings.map(m => ({
          sourceField: m.ourField,
          exportHeader: m.uploadedHeader,
          included: m.ourField !== '',
        }));
        setColumns(mappedColumns);
        
        setStep('confirm');
      }
    } catch (err) {
      console.error('Error processing template:', err);
      setError('Failed to analyze template. Please try again.');
      setStep('upload');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  // Extract headers from uploaded file
  async function extractHeaders(file: File): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          // First row is headers
          const headers = (jsonData[0] as string[]) || [];
          resolve(headers.filter(h => h && typeof h === 'string'));
        } catch (err) {
          reject(err);
        }
      };
      
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  }

  // Call Gemini AI to analyze headers
  async function analyzeWithAI(headers: string[]): Promise<AIAnalysis> {
    const availableFields = AVAILABLE_FIELDS.map(f => `${f.field}: ${f.description}`).join('\n');
    
    const prompt = `You are analyzing a CSV/Excel export template for bank transaction data.

The user uploaded a template with these column headers:
${headers.map((h, i) => `${i + 1}. "${h}"`).join('\n')}

Our system has these available data fields:
${availableFields}

For each uploaded header, determine which of our fields it should map to.
If a header doesn't match any field, leave ourField empty.

Respond in this exact JSON format:
{
  "mappings": [
    {
      "uploadedHeader": "the header from their template",
      "ourField": "our field name or empty string",
      "confidence": "high" or "medium" or "low",
      "reasoning": "brief explanation"
    }
  ],
  "summary": "One sentence summary of what you found"
}`;

    try {
      const response = await fetch('/api/ai/analyze-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, headers }),
      });

      if (!response.ok) {
        throw new Error('AI analysis failed');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      // Fallback to simple mapping if API fails
      console.warn('AI API failed, using fallback mapping:', err);
      return fallbackAnalysis(headers);
    }
  }

  // Fallback mapping if AI fails
  function fallbackAnalysis(headers: string[]): AIAnalysis {
    const mappings: Record<string, string> = {
      'date': 'date', 'transaction date': 'date', 'trans date': 'date', 'posting date': 'date', 'value date': 'date',
      'description': 'description', 'memo': 'description', 'details': 'description', 'particulars': 'description', 'narrative': 'description',
      'amount': 'amount', 'value': 'amount', 'transaction amount': 'amount',
      'balance': 'balance', 'running balance': 'balance', 'closing balance': 'balance',
      'category': 'category', 'type': 'type',
      'reference': 'reference', 'ref': 'reference', 'reference number': 'reference',
    };

    return {
      mappings: headers.map(header => {
        const normalized = header.toLowerCase().trim();
        const ourField = mappings[normalized] || '';
        return {
          uploadedHeader: header,
          ourField,
          confidence: ourField ? 'medium' as const : 'low' as const,
          reasoning: ourField ? `Matched "${header}" to ${ourField}` : `No match found for "${header}"`,
        };
      }),
      summary: `Found ${headers.length} columns. Mapped using keyword matching.`,
    };
  }

  // Toggle column inclusion
  const toggleColumn = (index: number) => {
    setColumns(prev => prev.map((col, i) => 
      i === index ? { ...col, included: !col.included } : col
    ));
  };

  // Update source field
  const updateSourceField = (index: number, newField: string) => {
    setColumns(prev => prev.map((col, i) => 
      i === index ? { ...col, sourceField: newField, included: !!newField } : col
    ));
  };

  // Drag and drop reordering
  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newColumns = [...columns];
    const draggedItem = newColumns[draggedIndex];
    newColumns.splice(draggedIndex, 1);
    newColumns.splice(index, 0, draggedItem);
    setColumns(newColumns);
    setDraggedIndex(index);
  };
  const handleDragEnd = () => setDraggedIndex(null);

  // Generate export
  const generateExport = () => {
    const includedColumns = columns.filter(c => c.included && c.sourceField);
    
    const headers = includedColumns.map(c => c.exportHeader);
    const rows = transactions.map(tx => 
      includedColumns.map(col => {
        const value = tx[col.sourceField];
        if (value instanceof Date) return value.toLocaleDateString();
        return value ?? '';
      })
    );

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    onExport(csvContent, `export_${new Date().toISOString().split('T')[0]}.csv`);
    handleClose();
  };

  // Get sample data for preview
  const getSampleData = () => {
    const includedColumns = columns.filter(c => c.included && c.sourceField);
    return transactions.slice(0, 3).map(tx => 
      includedColumns.reduce((acc, col) => {
        acc[col.exportHeader] = tx[col.sourceField] ?? '';
        return acc;
      }, {} as Record<string, any>)
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: brand.colors.primary }} />
            Smart Export
          </DialogTitle>
        </DialogHeader>

        {/* Step: Choose method */}
        {step === 'choose' && (
          <div className="space-y-4">
            <p className="text-slate-600">How would you like to set up your export?</p>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setStep('upload')}
                className="p-6 border-2 border-dashed rounded-xl hover:border-slate-400 transition-colors text-left"
              >
                <Upload className="w-8 h-8 mb-3 text-slate-400" />
                <h3 className="font-semibold text-slate-900">Upload Template</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Upload a CSV/Excel with your headers. AI will map them.
                </p>
              </button>
              
              <button
                onClick={() => {
                  setColumns(AVAILABLE_FIELDS.map(f => ({
                    sourceField: f.field,
                    exportHeader: f.label,
                    included: ['date', 'description', 'amount'].includes(f.field),
                  })));
                  setStep('configure');
                }}
                className="p-6 border-2 border-dashed rounded-xl hover:border-slate-400 transition-colors text-left"
              >
                <FileSpreadsheet className="w-8 h-8 mb-3 text-slate-400" />
                <h3 className="font-semibold text-slate-900">Manual Setup</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Choose columns and rename headers yourself.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Step: Upload template */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}
              `}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600">
                {isDragActive ? 'Drop your template here...' : 'Drag & drop your template CSV or Excel'}
              </p>
              <p className="text-sm text-slate-400 mt-2">
                AI will analyze your headers and map them to your data
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            
            <Button variant="outline" onClick={() => setStep('choose')} className="w-full">
              Back
            </Button>
          </div>
        )}

        {/* Step: Analyzing with AI */}
        {step === 'analyzing' && (
          <div className="py-12 text-center">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-slate-200 rounded-full" />
              <div 
                className="absolute inset-0 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: `${brand.colors.primary} transparent transparent transparent` }}
              />
              <Sparkles className="absolute inset-0 m-auto w-6 h-6" style={{ color: brand.colors.primary }} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">AI is analyzing your template...</h3>
            <p className="text-slate-500">Mapping your headers to available data fields</p>
          </div>
        )}

        {/* Step: AI Confirmation */}
        {step === 'confirm' && aiAnalysis && (
          <div className="space-y-6">
            {/* AI Summary */}
            <div className="p-4 rounded-lg" style={{ backgroundColor: `${brand.colors.primary}10` }}>
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 mt-0.5" style={{ color: brand.colors.primary }} />
                <div>
                  <h3 className="font-semibold text-slate-900">AI Analysis Complete</h3>
                  <p className="text-sm text-slate-600 mt-1">{aiAnalysis.summary}</p>
                </div>
              </div>
            </div>

            {/* Mapping Results */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Column Mappings</h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {aiAnalysis.mappings.map((mapping, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium text-slate-900">{mapping.uploadedHeader}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                    <div className="flex-1 flex items-center gap-2">
                      {mapping.ourField ? (
                        <>
                          <CheckCircle2 className={`w-4 h-4 ${
                            mapping.confidence === 'high' ? 'text-green-500' :
                            mapping.confidence === 'medium' ? 'text-amber-500' : 'text-slate-400'
                          }`} />
                          <span className="text-slate-700">{mapping.ourField}</span>
                        </>
                      ) : (
                        <span className="text-slate-400 italic">Not mapped</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample Preview */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Sample Preview (first 3 rows)</h4>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        {columns.filter(c => c.included && c.sourceField).map((col, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium text-slate-700 whitespace-nowrap">
                            {col.exportHeader}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {getSampleData().map((row, i) => (
                        <tr key={i} className="border-t">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="px-3 py-2 text-slate-600 whitespace-nowrap">
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('configure')} className="flex-1">
                Adjust Mappings
              </Button>
              <Button 
                onClick={generateExport}
                className="flex-1 text-white"
                style={{ backgroundColor: brand.colors.primary }}
              >
                <Download className="w-4 h-4 mr-2" />
                Export {transactions.length} rows
              </Button>
            </div>
          </div>
        )}

        {/* Step: Manual Configure */}
        {step === 'configure' && (
          <div className="space-y-4">
            <p className="text-slate-600 text-sm">
              Drag to reorder. Check to include. Select which data field maps to each header.
            </p>
            
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {columns.map((col, index) => (
                <div
                  key={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`
                    flex items-center gap-3 p-3 bg-white border rounded-lg
                    ${draggedIndex === index ? 'opacity-50' : ''}
                    ${col.included ? 'border-slate-300' : 'border-slate-200 bg-slate-50'}
                  `}
                >
                  <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                  
                  <button
                    onClick={() => toggleColumn(index)}
                    className={`
                      w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                      ${col.included ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300'}
                    `}
                  >
                    {col.included && <Check className="w-3 h-3" />}
                  </button>
                  
                  <select
                    value={col.sourceField}
                    onChange={(e) => updateSourceField(index, e.target.value)}
                    className="flex-1 text-sm border rounded px-2 py-1.5 bg-slate-50"
                  >
                    <option value="">-- Select data field --</option>
                    {AVAILABLE_FIELDS.map(f => (
                      <option key={f.field} value={f.field}>{f.label}</option>
                    ))}
                  </select>
                  
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  
                  <Input
                    value={col.exportHeader}
                    onChange={(e) => {
                      setColumns(prev => prev.map((c, i) => 
                        i === index ? { ...c, exportHeader: e.target.value } : c
                      ));
                    }}
                    className="flex-1 h-8"
                    placeholder="Export header name"
                  />
                </div>
              ))}
            </div>

            {/* Add column button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setColumns(prev => [...prev, { sourceField: '', exportHeader: '', included: true }])}
              className="w-full"
            >
              + Add Column
            </Button>

            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setStep('choose')} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={generateExport}
                className="flex-1 text-white"
                style={{ backgroundColor: brand.colors.primary }}
                disabled={!columns.some(c => c.included && c.sourceField)}
              >
                <Download className="w-4 h-4 mr-2" />
                Export {transactions.length} rows
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
