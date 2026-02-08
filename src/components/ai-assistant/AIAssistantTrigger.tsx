"use client";

/**
 * AI Assistant Trigger Button
 * Floating button to open the AI assistant sidebar
 */

import { Sparkles } from "lucide-react";
import { useAIAssistant } from "./AIAssistantContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AIAssistantTriggerProps {
  className?: string;
  variant?: "floating" | "inline" | "header";
}

export function AIAssistantTrigger({ className, variant = "floating" }: AIAssistantTriggerProps) {
  const { state, toggleSidebar } = useAIAssistant();
  
  const unresolvedIssues = state.issues.filter(i => !i.resolved).length;
  const hasUnreadMessages = state.messages.some(m => m.role === "assistant" && !m.isStreaming);

  if (variant === "header") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleSidebar}
        className={cn(
          "relative h-8 gap-1.5 text-xs",
          state.isOpen && "bg-violet-50 text-violet-700",
          className
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">AI Assistant</span>
        {unresolvedIssues > 0 && (
          <Badge 
            variant="destructive" 
            className="h-4 min-w-4 px-1 text-[10px] ml-1"
          >
            {unresolvedIssues}
          </Badge>
        )}
      </Button>
    );
  }

  if (variant === "inline") {
    return (
      <Button
        onClick={toggleSidebar}
        className={cn(
          "gap-2",
          state.isOpen 
            ? "bg-violet-100 text-violet-700 hover:bg-violet-200" 
            : "bg-violet-600 hover:bg-violet-700",
          className
        )}
      >
        <Sparkles className="h-4 w-4" />
        {state.isOpen ? "Close Assistant" : "AI Assistant"}
        {unresolvedIssues > 0 && !state.isOpen && (
          <Badge variant="secondary" className="h-5 px-1.5 bg-white/20 text-white">
            {unresolvedIssues} issues
          </Badge>
        )}
      </Button>
    );
  }

  // Floating button (default)
  return (
    <button
      onClick={toggleSidebar}
      className={cn(
        "fixed bottom-6 right-6 z-30",
        "h-14 w-14 rounded-full",
        "bg-gradient-to-br from-violet-500 to-purple-600",
        "shadow-lg shadow-violet-500/30",
        "flex items-center justify-center",
        "hover:shadow-xl hover:shadow-violet-500/40 hover:scale-105",
        "transition-all duration-200",
        "group",
        state.isOpen && "scale-0 opacity-0",
        className
      )}
    >
      <Sparkles className="h-6 w-6 text-white group-hover:scale-110 transition-transform" />
      
      {/* Notification badge */}
      {unresolvedIssues > 0 && (
        <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
          {unresolvedIssues}
        </span>
      )}

      {/* Pulse animation when there are issues */}
      {unresolvedIssues > 0 && (
        <span className="absolute inset-0 rounded-full bg-violet-500 animate-ping opacity-20" />
      )}

      {/* Tooltip */}
      <span className="absolute right-full mr-3 px-2 py-1 rounded bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        AI Assistant
        {unresolvedIssues > 0 && ` (${unresolvedIssues} issues)`}
      </span>
    </button>
  );
}

