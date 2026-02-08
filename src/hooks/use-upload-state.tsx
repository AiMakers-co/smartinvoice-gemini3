"use client";

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";

// Types
export type DocumentType = "statement" | "invoice" | "bill";

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
  // Bank/payment details
  bankName?: string;
  bankNameRaw?: string;
  bankIdentifier?: string;
  bankCountry?: string;
  needsBankIdentification?: boolean;  // True if user needs to specify bank
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

export interface FileUploadState {
  file: File;
  fileUrl?: string;
  status: "pending" | "uploading" | "identifying" | "type_confirmed" | "extracting" | "extracted" | "error" | "scanning" | "scanned" | "wrong_type" | "needs_rules_confirmation" | "rejected";
  error?: string;
  
  // Phase 1: Type identification
  identifyResult?: {
    detectedType: string;
    confidence: number;
    detectedBank?: string;
    detectedVendor?: string;
    detectedCustomer?: string;
    invoiceFrom?: string;   // Company that issued the document
    invoiceTo?: string;     // Company that received / must pay
    currency?: string;
    reasoning: string;
  };
  confirmedType?: DocumentType;  // User-confirmed type
  
  // Phase 2: Full extraction
  extractedData?: ExtractedData;
  suggestedType?: DocumentType;
}

type DrawerStep = "upload" | "identifying" | "confirm_type" | "extracting" | "saving" | "preview" | "complete";

interface UploadState {
  fileStates: FileUploadState[];
  step: DrawerStep;
  selectedType: DocumentType;
  savedCount: number;
  skippedCount: number;
}

interface UploadStateContextType {
  state: UploadState;
  setFileStates: (files: FileUploadState[] | ((prev: FileUploadState[]) => FileUploadState[])) => void;
  setStep: (step: DrawerStep) => void;
  setSelectedType: (type: DocumentType) => void;
  setSavedCount: (count: number) => void;
  setSkippedCount: (count: number) => void;
  resetState: () => void;
  hasUnsavedData: boolean;
  // Drawer open/close control (persists across page navigation)
  isDrawerOpen: boolean;
  openDrawer: (type?: DocumentType) => void;
  closeDrawer: () => void;
  // Completion callback registration
  onCompleteRef: React.MutableRefObject<(() => void) | null>;
}

const initialState: UploadState = {
  fileStates: [],
  step: "upload",
  selectedType: "statement",
  savedCount: 0,
  skippedCount: 0,
};

const UploadStateContext = createContext<UploadStateContextType | undefined>(undefined);

export function UploadStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UploadState>(initialState);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const onCompleteRef = useRef<(() => void) | null>(null);

  const setFileStates = useCallback((files: FileUploadState[] | ((prev: FileUploadState[]) => FileUploadState[])) => {
    setState(prev => {
      const newFileStates = typeof files === "function" ? files(prev.fileStates) : files;
      return {
        ...prev,
        fileStates: newFileStates,
      };
    });
  }, []);

  const setStep = useCallback((step: DrawerStep) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  const setSelectedType = useCallback((selectedType: DocumentType) => {
    setState(prev => ({ ...prev, selectedType }));
  }, []);

  const setSavedCount = useCallback((savedCount: number) => {
    setState(prev => ({ ...prev, savedCount }));
  }, []);

  const setSkippedCount = useCallback((skippedCount: number) => {
    setState(prev => ({ ...prev, skippedCount }));
  }, []);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  const openDrawer = useCallback((type?: DocumentType) => {
    if (type) {
      setState(prev => ({ ...prev, selectedType: type }));
    }
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const hasUnsavedData = state.fileStates.some(f => f.status === "scanned" && f.extractedData);

  return (
    <UploadStateContext.Provider
      value={{
        state,
        setFileStates,
        setStep,
        setSelectedType,
        setSavedCount,
        setSkippedCount,
        resetState,
        hasUnsavedData,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        onCompleteRef,
      }}
    >
      {children}
    </UploadStateContext.Provider>
  );
}

export function useUploadState() {
  const context = useContext(UploadStateContext);
  if (!context) {
    throw new Error("useUploadState must be used within an UploadStateProvider");
  }
  return context;
}
