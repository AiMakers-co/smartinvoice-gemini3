"use client";

/**
 * AI Assistant Sidebar
 * Context-aware actions based on current page
 */

import { useRef, useState, KeyboardEvent, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  X,
  Send,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  Loader2,
  Zap,
  Search,
  TrendingUp,
  Filter,
  Calendar,
  DollarSign,
  Building2,
  FileText,
  ArrowRight,
  CornerDownRight,
} from "lucide-react";
import { useAIAssistant } from "./AIAssistantContext";
import { AIIssue, AIAction, IssueSeverity } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ============================================
// PAGE-SPECIFIC PROMPTS
// ============================================

interface QuickPrompt {
  id: string;
  label: string;
  icon: React.ReactNode;
  message: string;
}

const pagePrompts: Record<string, QuickPrompt[]> = {
  "/dashboard": [
    { id: "overview", label: "What's my financial overview?", icon: <TrendingUp className="h-4 w-4" />, message: "Give me a summary of my financial overview - total balance, recent activity, and any important trends" },
    { id: "recent", label: "Show recent activity", icon: <Calendar className="h-4 w-4" />, message: "What's my recent financial activity? Any notable transactions?" },
    { id: "alerts", label: "Any issues to review?", icon: <AlertCircle className="h-4 w-4" />, message: "Are there any issues or anomalies I should review?" },
  ],
  "/transactions": [
    { id: "search", label: "Help me find a transaction", icon: <Search className="h-4 w-4" />, message: "I'm looking for a specific transaction. Can you help me find it?" },
    { id: "filter", label: "Filter by category", icon: <Filter className="h-4 w-4" />, message: "Show me how to filter transactions by category" },
    { id: "largest", label: "Show largest transactions", icon: <DollarSign className="h-4 w-4" />, message: "What are my largest transactions this month?" },
    { id: "recurring", label: "Find recurring payments", icon: <Calendar className="h-4 w-4" />, message: "Identify my recurring payments and subscriptions" },
  ],
  "/accounts": [
    { id: "balances", label: "Show account balances", icon: <DollarSign className="h-4 w-4" />, message: "What are my current account balances?" },
    { id: "compare", label: "Compare accounts", icon: <TrendingUp className="h-4 w-4" />, message: "Compare activity across my accounts" },
    { id: "verify", label: "Verify extraction", icon: <CheckCircle2 className="h-4 w-4" />, message: "Verify the extracted data is correct" },
    { id: "issues", label: "Any extraction issues?", icon: <AlertCircle className="h-4 w-4" />, message: "Are there any issues with the extraction I should review?" },
  ],
  "/invoices": [
    { id: "verify", label: "Verify invoice details", icon: <CheckCircle2 className="h-4 w-4" />, message: "Verify the invoice details are correct" },
    { id: "total", label: "Check total calculation", icon: <DollarSign className="h-4 w-4" />, message: "Verify the invoice total matches the line items" },
    { id: "vendor", label: "Check vendor info", icon: <Building2 className="h-4 w-4" />, message: "Is the vendor information correct?" },
  ],
  default: [
    { id: "help", label: "What can you help with?", icon: <Info className="h-4 w-4" />, message: "What can you help me with on this page?" },
    { id: "find", label: "Help me find something", icon: <Search className="h-4 w-4" />, message: "I'm looking for something specific, can you help?" },
  ],
};

function getPageTitle(pathname: string): string {
  if (pathname.includes("/dashboard")) return "Dashboard";
  if (pathname.includes("/transactions")) return "Transactions";
  if (pathname.includes("/accounts")) return "Accounts";
  if (pathname.includes("/invoices")) return "Invoices";
  if (pathname.includes("/settings")) return "Settings";
  if (pathname.includes("/team")) return "Team";
  if (pathname.includes("/admin")) return "Admin";
  return "Ormandy";
}

function getPromptsForPage(pathname: string): QuickPrompt[] {
  if (pathname.includes("/dashboard")) return pagePrompts["/dashboard"];
  if (pathname.includes("/transactions")) return pagePrompts["/transactions"];
  if (pathname.includes("/accounts")) return pagePrompts["/accounts"];
  if (pathname.includes("/invoices")) return pagePrompts["/invoices"];
  return pagePrompts["default"];
}

// ============================================
// MAIN SIDEBAR COMPONENT
// ============================================

export function AIAssistantSidebar() {
  const pathname = usePathname();
  const {
    state,
    closeSidebar,
    sendMessage,
    executeAction,
    resolveIssue,
  } = useAIAssistant();

  const [inputValue, setInputValue] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [isPromptLoading, setIsPromptLoading] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const prompts = getPromptsForPage(pathname);
  const pageTitle = getPageTitle(pathname);
  const unresolvedIssues = state.issues.filter(i => !i.resolved);

  // Auto-add navigation message when page changes
  useEffect(() => {
    // Could add navigation awareness here if needed
  }, [pathname]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || state.isProcessing) return;
    const message = inputValue.trim();
    setInputValue("");
    setShowChat(true);
    await sendMessage(message);
  };

  const handlePromptClick = async (prompt: QuickPrompt) => {
    setIsPromptLoading(prompt.id);
    setShowChat(true);
    try {
      await sendMessage(prompt.message);
    } finally {
      setIsPromptLoading(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!state.isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-full max-w-[380px] bg-white border-l border-slate-200 shadow-2xl z-50",
        "transform transition-transform duration-300 ease-out",
        "flex flex-col"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#E31B54] flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">AI Assistant</h2>
              <p className="text-xs text-slate-500">{pageTitle}</p>
            </div>
          </div>
          <button 
            onClick={closeSidebar} 
            className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            
            {/* Issues Section */}
            {unresolvedIssues.length > 0 && (
              <IssuesSection
                issues={unresolvedIssues}
                onResolve={resolveIssue}
                onExecuteAction={executeAction}
              />
            )}

            {/* Quick Actions for this page */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-3">
                How can I help?
              </p>
              <div className="space-y-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    onClick={() => handlePromptClick(prompt)}
                    disabled={state.isProcessing}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-3 rounded-lg text-left transition-all",
                      "bg-slate-50 border border-slate-200 hover:border-[#E31B54]/40 hover:bg-red-50/30",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      isPromptLoading === prompt.id && "border-[#E31B54] bg-red-50/50"
                    )}
                  >
                    <span className={cn(
                      "flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center",
                      isPromptLoading === prompt.id 
                        ? "bg-[#E31B54] text-white" 
                        : "bg-white text-slate-600 border border-slate-200"
                    )}>
                      {isPromptLoading === prompt.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        prompt.icon
                      )}
                    </span>
                    <span className="flex-1 text-sm text-slate-700">{prompt.label}</span>
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation History (Collapsible) */}
            {state.messages.length > 0 && (
              <ConversationSection
                messages={state.messages}
                isOpen={showChat}
                onToggle={() => setShowChat(!showChat)}
                isProcessing={state.isProcessing}
                onExecuteAction={executeAction}
              />
            )}

          </div>
        </ScrollArea>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              className="flex-1 h-9 text-sm bg-white border-slate-300 focus:border-[#E31B54] focus:ring-[#E31B54]/20"
              disabled={state.isProcessing}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || state.isProcessing}
              className="h-9 w-9 bg-[#E31B54] hover:bg-[#C41848] text-white"
            >
              {state.isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================
// ISSUES SECTION
// ============================================

interface IssuesSectionProps {
  issues: AIIssue[];
  onResolve: (issueId: string) => void;
  onExecuteAction: (action: AIAction) => Promise<void>;
}

function IssuesSection({ issues, onResolve, onExecuteAction }: IssuesSectionProps) {
  const severityConfig: Record<IssueSeverity, { icon: React.ReactNode; bg: string; border: string; iconColor: string }> = {
    error: { icon: <AlertCircle className="h-4 w-4" />, bg: "bg-red-50", border: "border-red-200", iconColor: "text-red-500" },
    warning: { icon: <AlertTriangle className="h-4 w-4" />, bg: "bg-amber-50", border: "border-amber-200", iconColor: "text-amber-500" },
    info: { icon: <Info className="h-4 w-4" />, bg: "bg-blue-50", border: "border-blue-200", iconColor: "text-blue-500" },
    success: { icon: <CheckCircle2 className="h-4 w-4" />, bg: "bg-green-50", border: "border-green-200", iconColor: "text-green-500" },
  };

  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-2">
        Needs attention
      </p>
      <div className="space-y-2">
        {issues.map((issue) => {
          const config = severityConfig[issue.severity];
          return (
            <div
              key={issue.id}
              className={cn("rounded-lg border p-3", config.bg, config.border)}
            >
              <div className="flex items-start gap-2">
                <span className={cn("mt-0.5", config.iconColor)}>{config.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{issue.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{issue.message}</p>
                  
                  <div className="flex items-center gap-2 mt-2">
                    {issue.suggestedAction && (
                      <Button
                        size="sm"
                        onClick={() => {
                          onExecuteAction(issue.suggestedAction!);
                          onResolve(issue.id);
                        }}
                        className="h-7 text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                      >
                        <Zap className="h-3 w-3 mr-1 text-[#E31B54]" />
                        {issue.suggestedAction.label}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onResolve(issue.id)}
                      className="h-7 text-xs text-slate-500"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// CONVERSATION SECTION (Collapsible)
// ============================================

interface ConversationSectionProps {
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
    actions?: AIAction[];
  }>;
  isOpen: boolean;
  onToggle: () => void;
  isProcessing: boolean;
  onExecuteAction: (action: AIAction) => Promise<void>;
}

function ConversationSection({ messages, isOpen, onToggle, isProcessing, onExecuteAction }: ConversationSectionProps) {
  const recentMessages = messages.slice(-6);

  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left mb-2"
      >
        <p className="text-xs font-medium text-slate-500">
          Conversation ({messages.length})
        </p>
        <ChevronDown className={cn(
          "h-4 w-4 text-slate-400 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div className="space-y-2">
          {recentMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-lg p-3 text-sm",
                message.role === "user"
                  ? "bg-slate-100 ml-6"
                  : "bg-[#E31B54]/5 border border-[#E31B54]/10"
              )}
            >
              <div className="flex items-start gap-2">
                {message.role === "assistant" && (
                  <Sparkles className="h-3.5 w-3.5 text-[#E31B54] flex-shrink-0 mt-0.5" />
                )}
                {message.role === "user" && (
                  <CornerDownRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-xs">
                    {message.content}
                  </p>
                  
                  {message.actions && message.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {message.actions.map((action) => (
                        <Button
                          key={action.id}
                          variant={action.isPrimary ? "default" : "outline"}
                          size="sm"
                          onClick={() => onExecuteAction(action)}
                          className={cn(
                            "h-6 text-[10px]",
                            action.isPrimary && "bg-[#E31B54] hover:bg-[#C41848] text-white"
                          )}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex items-center gap-2 text-xs text-slate-500 p-3 bg-[#E31B54]/5 rounded-lg border border-[#E31B54]/10">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E31B54]" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
