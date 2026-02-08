/**
 * AI Assistant Types
 * Comprehensive type definitions for the AI assistant system
 */

// ============================================
// CORE TYPES
// ============================================

export type DocumentType = "invoice" | "bank_statement";

export interface AIAssistantContext {
  // Session
  sessionId: string;
  documentType: DocumentType;
  isOpen: boolean;
  isProcessing: boolean;
  
  // Document
  file: DocumentFile | null;
  extractedData: any | null;
  
  // Issues & Suggestions
  issues: AIIssue[];
  
  // User corrections
  corrections: UserCorrection[];
  
  // Template matching
  templateMatch: TemplateMatch | null;
  
  // Chat
  messages: AIMessage[];
  
  // Stats
  stats: ExtractionStats | null;
}

export interface DocumentFile {
  name: string;
  size: number;
  type: string;
  url?: string;
  pageCount?: number;
  file?: File; // The actual File object for uploads
}

// ============================================
// ISSUES & ACTIONS
// ============================================

export type IssueType = 
  | "low_confidence"
  | "missing_field"
  | "format_mismatch"
  | "duplicate_detected"
  | "amount_mismatch"
  | "date_anomaly"
  | "new_vendor"
  | "template_suggestion"
  | "categorization_needed";

export type IssueSeverity = "error" | "warning" | "info" | "success";

export interface AIIssue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  field?: string;
  lineItemIndex?: number;
  title: string;
  message: string;
  suggestedAction?: AIAction;
  confidence: number;
  resolved: boolean;
}

export type ActionType = 
  | "correct_field"
  | "apply_template"
  | "accept_all"
  | "accept_field"
  | "reject_field"
  | "rescan"
  | "categorize"
  | "flag_duplicate"
  | "create_template"
  | "ask_question"
  | "navigate";

export interface AIAction {
  id: string;
  type: ActionType;
  label: string;
  description?: string;
  payload: Record<string, any>;
  isPrimary?: boolean;
  isDestructive?: boolean;
}

// ============================================
// CORRECTIONS
// ============================================

export interface UserCorrection {
  id: string;
  timestamp: Date;
  field: string;
  lineItemIndex?: number;
  originalValue: any;
  correctedValue: any;
  reason?: string;
}

// ============================================
// TEMPLATES
// ============================================

export interface TemplateMatch {
  templateId: string;
  templateName: string;
  confidence: number;
  successRate: number;
  usageCount: number;
  lastUsed?: Date;
}

// ============================================
// CHAT
// ============================================

export type MessageRole = "assistant" | "user" | "system";

export interface AIMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  
  // Optional attachments
  actions?: AIAction[];
  dataSnapshot?: Record<string, any>;
  issueRef?: string;
  
  // Processing state
  isStreaming?: boolean;
  error?: string;
}

// ============================================
// STATS
// ============================================

export interface ExtractionStats {
  totalFields: number;
  extractedFields: number;
  confidence: number;
  processingTime: number;
  tokensUsed: number;
  estimatedCost: number;
  
  // For invoices
  lineItemCount?: number;
  totalAmount?: number;
  
  // For bank statements
  transactionCount?: number;
  periodStart?: string;
  periodEnd?: string;
}

// ============================================
// CONTEXT ACTIONS (for reducer)
// ============================================

export type AIAssistantAction =
  | { type: "OPEN_SIDEBAR" }
  | { type: "CLOSE_SIDEBAR" }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "SET_PROCESSING"; payload: boolean }
  | { type: "START_SESSION"; payload: { sessionId: string; documentType: DocumentType } }
  | { type: "END_SESSION" }
  | { type: "SET_FILE"; payload: DocumentFile }
  | { type: "SET_EXTRACTED_DATA"; payload: any }
  | { type: "SET_STATS"; payload: ExtractionStats }
  | { type: "ADD_ISSUE"; payload: AIIssue }
  | { type: "RESOLVE_ISSUE"; payload: string }
  | { type: "CLEAR_ISSUES" }
  | { type: "ADD_CORRECTION"; payload: UserCorrection }
  | { type: "SET_TEMPLATE_MATCH"; payload: TemplateMatch | null }
  | { type: "ADD_MESSAGE"; payload: AIMessage }
  | { type: "UPDATE_MESSAGE"; payload: { id: string; updates: Partial<AIMessage> } }
  | { type: "CLEAR_MESSAGES" }
  | { type: "EXECUTE_ACTION"; payload: AIAction }
  | { type: "RESET" };

// ============================================
// HELPER FUNCTIONS
// ============================================

export function createIssue(
  type: IssueType,
  title: string,
  message: string,
  options?: Partial<AIIssue>
): AIIssue {
  return {
    id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    severity: options?.severity || getSeverityForType(type),
    title,
    message,
    confidence: options?.confidence || 0.8,
    resolved: false,
    ...options,
  };
}

export function createAction(
  type: ActionType,
  label: string,
  payload: Record<string, any> = {},
  options?: Partial<AIAction>
): AIAction {
  return {
    id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    label,
    payload,
    ...options,
  };
}

export function createMessage(
  role: MessageRole,
  content: string,
  options?: Partial<AIMessage>
): AIMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    role,
    content,
    timestamp: new Date(),
    ...options,
  };
}

function getSeverityForType(type: IssueType): IssueSeverity {
  switch (type) {
    case "missing_field":
    case "amount_mismatch":
      return "error";
    case "low_confidence":
    case "format_mismatch":
    case "date_anomaly":
      return "warning";
    case "duplicate_detected":
    case "new_vendor":
    case "categorization_needed":
      return "info";
    case "template_suggestion":
      return "success";
    default:
      return "info";
  }
}

