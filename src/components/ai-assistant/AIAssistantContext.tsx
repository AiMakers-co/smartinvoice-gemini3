"use client";

/**
 * AI Assistant Context Provider
 * Manages the global state for the AI assistant sidebar
 */

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import {
  AIAssistantContext,
  AIAssistantAction,
  DocumentType,
  DocumentFile,
  AIIssue,
  AIMessage,
  AIAction,
  UserCorrection,
  TemplateMatch,
  ExtractionStats,
  createMessage,
  createIssue,
  createAction,
} from "./types";

// ============================================
// INITIAL STATE
// ============================================

const initialState: AIAssistantContext = {
  sessionId: "",
  documentType: "invoice",
  isOpen: false,
  isProcessing: false,
  file: null,
  extractedData: null,
  issues: [],
  corrections: [],
  templateMatch: null,
  messages: [],
  stats: null,
};

// ============================================
// REDUCER
// ============================================

function aiAssistantReducer(
  state: AIAssistantContext,
  action: AIAssistantAction
): AIAssistantContext {
  switch (action.type) {
    case "OPEN_SIDEBAR":
      return { ...state, isOpen: true };
    
    case "CLOSE_SIDEBAR":
      return { ...state, isOpen: false };
    
    case "TOGGLE_SIDEBAR":
      return { ...state, isOpen: !state.isOpen };
    
    case "SET_PROCESSING":
      return { ...state, isProcessing: action.payload };
    
    case "START_SESSION":
      return {
        ...initialState,
        sessionId: action.payload.sessionId,
        documentType: action.payload.documentType,
        isOpen: false, // Don't auto-open - user opens manually
        messages: [], // No auto messages - action-driven interface
      };
    
    case "END_SESSION":
      return { ...initialState };
    
    case "SET_FILE":
      return { ...state, file: action.payload };
    
    case "SET_EXTRACTED_DATA":
      return { ...state, extractedData: action.payload };
    
    case "SET_STATS":
      return { ...state, stats: action.payload };
    
    case "ADD_ISSUE":
      return { ...state, issues: [...state.issues, action.payload] };
    
    case "RESOLVE_ISSUE":
      return {
        ...state,
        issues: state.issues.map(issue =>
          issue.id === action.payload ? { ...issue, resolved: true } : issue
        ),
      };
    
    case "CLEAR_ISSUES":
      return { ...state, issues: [] };
    
    case "ADD_CORRECTION":
      return { ...state, corrections: [...state.corrections, action.payload] };
    
    case "SET_TEMPLATE_MATCH":
      return { ...state, templateMatch: action.payload };
    
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.payload] };
    
    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id ? { ...msg, ...action.payload.updates } : msg
        ),
      };
    
    case "CLEAR_MESSAGES":
      return { ...state, messages: [] };
    
    case "RESET":
      return initialState;
    
    default:
      return state;
  }
}

function getWelcomeMessage(documentType: DocumentType): string {
  if (documentType === "invoice") {
    return "Hi! I'm here to help you process this invoice. Upload a PDF and I'll extract all the vendor details, line items, and amounts. I'll flag anything that needs your attention.";
  }
  return "Hi! I'm here to help you process this bank statement. Upload your document and I'll identify the bank, extract all transactions, and help you organize everything.";
}

// ============================================
// CONTEXT
// ============================================

interface AIAssistantContextValue {
  state: AIAssistantContext;
  dispatch: React.Dispatch<AIAssistantAction>;
  
  // Convenience methods
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  
  startSession: (documentType: DocumentType) => string;
  endSession: () => void;
  
  setFile: (file: DocumentFile) => void;
  setExtractedData: (data: any, stats?: ExtractionStats) => void;
  
  addIssue: (issue: AIIssue) => void;
  resolveIssue: (issueId: string) => void;
  clearIssues: () => void;
  
  addCorrection: (correction: Omit<UserCorrection, "id" | "timestamp">) => void;
  
  setTemplateMatch: (match: TemplateMatch | null) => void;
  
  sendMessage: (content: string) => Promise<void>;
  addAssistantMessage: (content: string, options?: Partial<AIMessage>) => void;
  
  executeAction: (action: AIAction) => Promise<void>;
  
  // Analysis helpers
  analyzeExtraction: (data: any, documentType: DocumentType) => void;
}

const AIAssistantContextInstance = createContext<AIAssistantContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

interface AIAssistantProviderProps {
  children: ReactNode;
}

export function AIAssistantProvider({ children }: AIAssistantProviderProps) {
  const [state, dispatch] = useReducer(aiAssistantReducer, initialState);

  // ============================================
  // CONVENIENCE METHODS
  // ============================================

  const openSidebar = useCallback(() => {
    dispatch({ type: "OPEN_SIDEBAR" });
  }, []);

  const closeSidebar = useCallback(() => {
    dispatch({ type: "CLOSE_SIDEBAR" });
  }, []);

  const toggleSidebar = useCallback(() => {
    dispatch({ type: "TOGGLE_SIDEBAR" });
  }, []);

  const startSession = useCallback((documentType: DocumentType): string => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    dispatch({ type: "START_SESSION", payload: { sessionId, documentType } });
    return sessionId;
  }, []);

  const endSession = useCallback(() => {
    dispatch({ type: "END_SESSION" });
  }, []);

  const setFile = useCallback((file: DocumentFile) => {
    dispatch({ type: "SET_FILE", payload: file });
    // No auto-message - action-driven interface
  }, []);

  const setExtractedData = useCallback((data: any, stats?: ExtractionStats) => {
    dispatch({ type: "SET_EXTRACTED_DATA", payload: data });
    if (stats) {
      dispatch({ type: "SET_STATS", payload: stats });
    }
  }, []);

  const addIssue = useCallback((issue: AIIssue) => {
    dispatch({ type: "ADD_ISSUE", payload: issue });
  }, []);

  const resolveIssue = useCallback((issueId: string) => {
    dispatch({ type: "RESOLVE_ISSUE", payload: issueId });
  }, []);

  const clearIssues = useCallback(() => {
    dispatch({ type: "CLEAR_ISSUES" });
  }, []);

  const addCorrection = useCallback((correction: Omit<UserCorrection, "id" | "timestamp">) => {
    const fullCorrection: UserCorrection = {
      ...correction,
      id: `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    dispatch({ type: "ADD_CORRECTION", payload: fullCorrection });
  }, []);

  const setTemplateMatch = useCallback((match: TemplateMatch | null) => {
    dispatch({ type: "SET_TEMPLATE_MATCH", payload: match });
  }, []);

  const addAssistantMessage = useCallback((content: string, options?: Partial<AIMessage>) => {
    dispatch({
      type: "ADD_MESSAGE",
      payload: createMessage("assistant", content, options),
    });
  }, []);

  // ============================================
  // CHAT & ACTIONS
  // ============================================

  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    dispatch({
      type: "ADD_MESSAGE",
      payload: createMessage("user", content),
    });

    dispatch({ type: "SET_PROCESSING", payload: true });

    try {
      // Build chat history for context
      const history = state.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Build document context
      const context = {
        documentType: state.documentType,
        fileName: state.file?.name,
        extractedData: state.extractedData,
        issues: state.issues,
        corrections: state.corrections,
      };

      // Call Google AI via Cloud Function (Gemini 3 Flash)
      const aiAssistantChat = httpsCallable(functions, "aiAssistantChat");
      const result = await aiAssistantChat({
        message: content,
        history,
        context,
      });

      const response = result.data as {
        content: string;
        actions?: AIAction[];
        tokensUsed: { input: number; output: number };
      };

      dispatch({
        type: "ADD_MESSAGE",
        payload: createMessage("assistant", response.content, {
          actions: response.actions,
        }),
      });

    } catch (error) {
      console.error("AI Assistant error:", error);
      
      // Fallback to local response if Cloud Function fails
      const fallbackResponse = generateLocalResponse(content, state);
      
      dispatch({
        type: "ADD_MESSAGE",
        payload: createMessage("assistant", fallbackResponse.content, {
          actions: fallbackResponse.actions,
          error: error instanceof Error ? error.message : "Cloud function unavailable, using local response",
        }),
      });
    } finally {
      dispatch({ type: "SET_PROCESSING", payload: false });
    }
  }, [state]);

  const executeAction = useCallback(async (action: AIAction) => {
    dispatch({ type: "SET_PROCESSING", payload: true });
    
    try {
      // Handle different action types
      switch (action.type) {
        case "accept_all":
          addAssistantMessage("Great! I've accepted all the extracted data. You can now save or make any final adjustments.");
          dispatch({ type: "CLEAR_ISSUES" });
          break;
        
        case "correct_field":
          const { field, newValue } = action.payload;
          addCorrection({
            field,
            originalValue: action.payload.originalValue,
            correctedValue: newValue,
          });
          addAssistantMessage(`Updated ${field} to "${newValue}". I'll remember this for similar documents in the future.`);
          break;
        
        case "apply_template":
          addAssistantMessage(`Applied the "${action.payload.templateName}" template. The extraction should be more accurate now.`);
          break;
        
        case "create_template":
          addAssistantMessage(`I've saved this as a new template for "${action.payload.vendorName}". Future invoices from this vendor will be processed automatically.`);
          break;
        
        case "rescan":
          addAssistantMessage("Re-scanning the document with higher precision settings...");
          break;
        
        case "categorize":
          addAssistantMessage(`Categorized ${action.payload.count} line items. You can review them in the table below.`);
          break;
        
        default:
          addAssistantMessage(`Executed action: ${action.label}`);
      }

      // Resolve related issue if any
      if (action.payload.issueId) {
        resolveIssue(action.payload.issueId);
      }

    } catch (error) {
      addAssistantMessage(`Failed to execute action: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      dispatch({ type: "SET_PROCESSING", payload: false });
    }
  }, [addAssistantMessage, addCorrection, resolveIssue]);

  // ============================================
  // ANALYSIS
  // ============================================

  const analyzeExtraction = useCallback((data: any, documentType: DocumentType) => {
    dispatch({ type: "CLEAR_ISSUES" });
    
    const issues: AIIssue[] = [];
    const messages: string[] = [];

    if (documentType === "invoice") {
      // Analyze invoice data
      const { vendorName, invoiceNumber, total, lineItems, confidence } = data;

      // Check confidence
      if (confidence < 0.85) {
        issues.push(createIssue(
          "low_confidence",
          "Low Confidence Extraction",
          `Overall confidence is ${Math.round(confidence * 100)}%. Some fields may need manual review.`,
          {
            severity: "warning",
            confidence,
            suggestedAction: createAction("rescan", "Re-scan Document", { highPrecision: true }),
          }
        ));
      }

      // Check for missing fields
      if (!vendorName || vendorName === "Unknown Vendor") {
        issues.push(createIssue(
          "missing_field",
          "Vendor Name Missing",
          "I couldn't identify the vendor name. Please enter it manually.",
          { field: "vendorName", severity: "error" }
        ));
      }

      if (!invoiceNumber) {
        issues.push(createIssue(
          "missing_field",
          "Invoice Number Missing",
          "No invoice number found. This is usually important for record keeping.",
          { field: "invoiceNumber", severity: "warning" }
        ));
      }

      // Check line items
      if (lineItems && lineItems.length > 0) {
        const lowConfidenceItems = lineItems.filter((item: any) => (item.confidence || 1) < 0.8);
        if (lowConfidenceItems.length > 0) {
          issues.push(createIssue(
            "low_confidence",
            `${lowConfidenceItems.length} Line Items Need Review`,
            "Some line items have low confidence. Click to review them.",
            {
              severity: "warning",
              suggestedAction: createAction("navigate", "Review Items", { section: "lineItems" }),
            }
          ));
        }

        // Calculate and verify total
        const calculatedTotal = lineItems.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
        if (Math.abs(calculatedTotal - (total || 0)) > 0.01) {
          issues.push(createIssue(
            "amount_mismatch",
            "Total Amount Mismatch",
            `Line items sum to ${calculatedTotal.toFixed(2)} but total shows ${total?.toFixed(2)}. This might be due to tax or discounts.`,
            { severity: "warning" }
          ));
        }
      }

      // Generate summary message
      const itemCount = lineItems?.length || 0;
      const totalFormatted = total ? `$${total.toFixed(2)}` : "unknown amount";
      
      if (issues.length === 0) {
        messages.push(`✅ Extraction complete! Found ${itemCount} line items totaling ${totalFormatted} from ${vendorName}. Everything looks good!`);
      } else {
        messages.push(`Extracted ${itemCount} line items totaling ${totalFormatted} from ${vendorName}. I found ${issues.length} item${issues.length > 1 ? 's' : ''} that need${issues.length === 1 ? 's' : ''} your attention.`);
      }

    } else {
      // Analyze bank statement data
      const { bankName, accountNumber, transactions, confidence, periodStart, periodEnd } = data;

      if (confidence < 0.85) {
        issues.push(createIssue(
          "low_confidence",
          "Low Confidence Extraction",
          `Overall confidence is ${Math.round(confidence * 100)}%. Some transactions may need review.`,
          { severity: "warning" }
        ));
      }

      if (!bankName || bankName === "Unknown Bank") {
        issues.push(createIssue(
          "missing_field",
          "Bank Not Identified",
          "I couldn't identify the bank. Please select it manually for better accuracy.",
          { field: "bankName", severity: "warning" }
        ));
      }

      const txCount = transactions?.length || 0;
      messages.push(`Found ${txCount} transactions from ${bankName} (****${accountNumber}) for period ${periodStart || 'unknown'} to ${periodEnd || 'unknown'}.`);
    }

    // Add issues
    issues.forEach(issue => addIssue(issue));

    // Add summary message with actions
    const actions: AIAction[] = [];
    
    if (issues.length === 0) {
      actions.push(createAction("accept_all", "Accept All", {}, { isPrimary: true }));
    } else {
      actions.push(createAction("navigate", "Review Issues", { section: "issues" }, { isPrimary: true }));
    }

    addAssistantMessage(messages[0], { actions });

  }, [addIssue, addAssistantMessage]);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value: AIAssistantContextValue = {
    state,
    dispatch,
    openSidebar,
    closeSidebar,
    toggleSidebar,
    startSession,
    endSession,
    setFile,
    setExtractedData,
    addIssue,
    resolveIssue,
    clearIssues,
    addCorrection,
    setTemplateMatch,
    sendMessage,
    addAssistantMessage,
    executeAction,
    analyzeExtraction,
  };

  return (
    <AIAssistantContextInstance.Provider value={value}>
      {children}
    </AIAssistantContextInstance.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useAIAssistant() {
  const context = useContext(AIAssistantContextInstance);
  if (!context) {
    throw new Error("useAIAssistant must be used within an AIAssistantProvider");
  }
  return context;
}

// ============================================
// LOCAL RESPONSE GENERATOR (Temporary)
// ============================================

function generateLocalResponse(
  content: string,
  state: AIAssistantContext
): { content: string; actions?: AIAction[] } {
  const lowerContent = content.toLowerCase();

  // Questions about the extraction
  if (lowerContent.includes("confidence") || lowerContent.includes("accurate")) {
    const confidence = state.stats?.confidence || 0.85;
    return {
      content: `The overall extraction confidence is ${Math.round(confidence * 100)}%. ${
        confidence >= 0.9 
          ? "This is very high - the data should be accurate." 
          : confidence >= 0.8 
            ? "This is good, but you may want to review a few fields." 
            : "I'd recommend reviewing the extraction carefully."
      }`,
    };
  }

  if (lowerContent.includes("total") || lowerContent.includes("amount")) {
    const total = state.stats?.totalAmount || state.extractedData?.total;
    if (total) {
      return {
        content: `The total amount is $${total.toFixed(2)}. This includes ${state.stats?.lineItemCount || 0} line items.`,
      };
    }
  }

  if (lowerContent.includes("help") || lowerContent.includes("what can you do")) {
    return {
      content: "I can help you with:\n\n• **Review extracted data** - I'll flag anything that looks off\n• **Correct mistakes** - Just tell me what needs fixing\n• **Categorize items** - I can auto-categorize line items\n• **Save templates** - I'll remember vendor formats for next time\n• **Answer questions** - Ask me about the document!\n\nWhat would you like to do?",
      actions: [
        createAction("navigate", "Review Issues", { section: "issues" }),
        createAction("categorize", "Auto-Categorize", { count: state.stats?.lineItemCount || 0 }),
      ],
    };
  }

  if (lowerContent.includes("save") || lowerContent.includes("done") || lowerContent.includes("finish")) {
    return {
      content: "Ready to save? Make sure you've reviewed any flagged issues. Click 'Confirm & Save' when you're ready.",
      actions: [
        createAction("accept_all", "Confirm & Save", {}, { isPrimary: true }),
      ],
    };
  }

  if (lowerContent.includes("template") || lowerContent.includes("remember")) {
    return {
      content: "I can save this as a template for future documents from the same vendor. This will make future extractions faster and more accurate.",
      actions: [
        createAction("create_template", "Save Template", { vendorName: state.extractedData?.vendorName }),
      ],
    };
  }

  // Default response
  return {
    content: "I'm here to help! You can ask me about the extracted data, request corrections, or let me know if anything looks incorrect. What would you like to do?",
  };
}

