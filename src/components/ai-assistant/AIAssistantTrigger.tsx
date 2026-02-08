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
        "flex items-center gap-2.5 rounded-2xl",
        "bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600",
        "shadow-lg shadow-purple-500/25",
        "pl-4 pr-5 py-3",
        "hover:shadow-xl hover:shadow-purple-500/35 hover:scale-[1.03]",
        "active:scale-[0.97]",
        "transition-all duration-200",
        "group",
        state.isOpen && "scale-0 opacity-0 pointer-events-none",
        className
      )}
    >
      {/* Icon with glow */}
      <div className="relative flex items-center justify-center">
        <Sparkles className="h-5 w-5 text-white group-hover:scale-110 transition-transform duration-200" />
        <div className="absolute inset-0 h-5 w-5 bg-white/20 rounded-full blur-sm group-hover:blur-md transition-all" />
      </div>

      {/* Label */}
      <span className="text-sm font-semibold text-white whitespace-nowrap">
        Chat with your data
      </span>

      {/* Notification badge */}
      {unresolvedIssues > 0 && (
        <span className="ml-0.5 h-5 min-w-5 px-1.5 rounded-full bg-white/20 text-white text-[10px] font-bold flex items-center justify-center backdrop-blur-sm">
          {unresolvedIssues}
        </span>
      )}

      {/* Pulse ring when there are issues */}
      {unresolvedIssues > 0 && (
        <span className="absolute inset-0 rounded-2xl bg-violet-400 animate-ping opacity-15" />
      )}
    </button>
  );
}

