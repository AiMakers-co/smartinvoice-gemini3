"use client";

/**
 * Financial Chat Panel — "Ask SmartInvoice"
 * Full-height right drawer with terminal-style AI thinking display.
 * Powered by Gemini 3 with dynamic queryFirestore tool — the AI
 * builds its own database queries autonomously.
 *
 * Features:
 *   - Terminal-style live progress (mirrors upload drawer / reconciliation)
 *   - Real-time Firestore streaming via onSnapshot
 *   - Full markdown rendering for responses
 *   - Voice input/output
 */

import { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  MessageCircle, X, Send, Sparkles, Mic, MicOff, Volume2, VolumeX, Square,
  TrendingUp, DollarSign, AlertCircle, Brain,
  BarChart3, Receipt, Building2, Zap, ChevronRight, Database, GitCompare, FileText,
} from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { onSnapshot, doc } from "firebase/firestore";
import { functions, db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ============================================
// TYPES
// ============================================

interface ToolCall {
  tool: string;
  args: any;
  summary: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: Date;
  isVoice?: boolean;
  toolCalls?: ToolCall[];
}

interface ProgressEvent {
  ts: number;
  type: "step" | "analyze" | "search" | "match" | "confirm" | "info" | "warning";
  text: string;
  toolName?: string;
  collection?: string;
}

// ============================================
// QUICK PROMPTS
// ============================================

const quickPrompts = [
  { id: "overview", label: "Financial overview", icon: <TrendingUp className="h-3.5 w-3.5" />, message: "Give me a complete financial overview — balances, cash flow trends, outstanding receivables and payables, and any concerns." },
  { id: "receivables", label: "Who owes me?", icon: <Receipt className="h-3.5 w-3.5" />, message: "Which clients have outstanding invoices? List them with amounts and due dates. Any overdue?" },
  { id: "payables", label: "What do I owe?", icon: <Building2 className="h-3.5 w-3.5" />, message: "What bills do I need to pay? List with amounts and due dates. What's overdue?" },
  { id: "spending", label: "Top expenses", icon: <DollarSign className="h-3.5 w-3.5" />, message: "What are my top 5 expenses this month? Break down by vendor and category." },
  { id: "cashflow", label: "Cash flow trend", icon: <BarChart3 className="h-3.5 w-3.5" />, message: "Analyze my cash flow trend over the last 6 months. Is it improving or declining? Any seasonal patterns?" },
  { id: "reconciliation", label: "Match status", icon: <GitCompare className="h-3.5 w-3.5" />, message: "Show me my reconciliation status — how many transactions are matched vs unmatched? What's the AI match rate? Show recent matches." },
  { id: "statements", label: "My statements", icon: <FileText className="h-3.5 w-3.5" />, message: "List all my uploaded bank statements — which banks, what periods, how many transactions in each?" },
  { id: "anomalies", label: "Find anomalies", icon: <AlertCircle className="h-3.5 w-3.5" />, message: "Are there any unusual transactions, duplicate payments, or anomalies in my recent financial data?" },
];

// ============================================
// TERMINAL-STYLE PROGRESS COMPONENT
// ============================================

/** Icon glyph for each event type — matches the upload drawer / reconciliation pattern */
function getEventGlyph(type: ProgressEvent["type"]): { glyph: string; className: string } {
  switch (type) {
    case "step":    return { glyph: "\u25b8", className: "text-slate-200 font-bold mt-2.5" };
    case "analyze": return { glyph: "\u2192", className: "text-cyan-400 font-medium" };
    case "search":  return { glyph: "  \u21b3", className: "text-purple-400" };
    case "match":   return { glyph: "  \u21b3", className: "text-emerald-400" };
    case "confirm": return { glyph: "  \u2713", className: "text-emerald-400 font-semibold" };
    case "info":    return { glyph: "\u2500", className: "text-slate-500 text-[10px]" };
    case "warning": return { glyph: "  \u26a0", className: "text-amber-400" };
    default:        return { glyph: "\u2192", className: "text-slate-400" };
  }
}

const AIThinkingTerminal = memo(({ events, isComplete }: { events: ProgressEvent[]; isComplete: boolean }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  // Elapsed timer
  useEffect(() => {
    if (isComplete) return;
    const interval = setInterval(() => setElapsed(Date.now() - startRef.current), 100);
    return () => clearInterval(interval);
  }, [isComplete]);

  return (
    <div className="w-full max-w-[95%] rounded-xl overflow-hidden border border-slate-700/50 bg-slate-900 shadow-lg">
      {/* Terminal header — Mac-style traffic lights */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 border-b border-slate-700/50">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          <span className="ml-2 text-[10px] text-slate-400 font-mono">
            $ smartinvoice chat --engine=gemini-3-flash
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isComplete && (
            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-emerald-900/50 border border-emerald-700/30">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider">Live</span>
            </div>
          )}
          <span className="text-[10px] font-mono text-slate-500">
            {(elapsed / 1000).toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className="px-3 py-2 max-h-[200px] overflow-y-auto font-mono text-[11px] leading-[1.6]"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#475569 transparent" }}
      >
        {events.map((evt, i) => {
          const { glyph, className } = getEventGlyph(evt.type);
          return (
            <div
              key={i}
              className={cn(
                "animate-in fade-in slide-in-from-bottom-1 duration-200",
                evt.type === "step" && i > 0 ? "border-t border-slate-700/40 pt-1.5" : ""
              )}
            >
              <span className={cn("select-none", className)}>{glyph} </span>
              <span className={cn(
                evt.type === "step" ? "text-slate-200 font-bold uppercase text-[10px] tracking-wider" :
                evt.type === "info" ? "text-slate-500 text-[10px]" :
                evt.type === "warning" ? "text-amber-400" :
                evt.type === "confirm" ? "text-emerald-400 font-semibold" :
                evt.type === "match" ? "text-emerald-300" :
                evt.type === "search" ? "text-purple-300" :
                "text-slate-300"
              )}>
                {evt.text}
              </span>
            </div>
          );
        })}

        {/* Blinking cursor when not complete */}
        {!isComplete && (
          <span className="inline-block w-1.5 h-3.5 bg-emerald-400 animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  );
});
AIThinkingTerminal.displayName = "AIThinkingTerminal";

// ============================================
// MARKDOWN MESSAGE COMPONENT
// ============================================

const MarkdownMessage = memo(({ content }: { content: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      h1: ({ children }) => <h1 className="text-base font-bold text-slate-900 mt-3 mb-1.5 first:mt-0">{children}</h1>,
      h2: ({ children }) => <h2 className="text-sm font-bold text-slate-900 mt-3 mb-1 first:mt-0">{children}</h2>,
      h3: ({ children }) => <h3 className="text-[13px] font-semibold text-slate-800 mt-2 mb-1 first:mt-0">{children}</h3>,
      h4: ({ children }) => <h4 className="text-xs font-semibold text-slate-700 mt-2 mb-0.5 first:mt-0">{children}</h4>,
      p: ({ children }) => <p className="text-[13px] leading-relaxed text-slate-700 my-1.5 first:mt-0 last:mb-0">{children}</p>,
      ul: ({ children }) => <ul className="my-1.5 space-y-0.5 list-none">{children}</ul>,
      ol: ({ children }) => <ol className="my-1.5 space-y-0.5 list-none counter-reset-item">{children}</ol>,
      li: ({ children, ...props }) => {
        const ordered = (props as any).ordered;
        const index = (props as any).index;
        return (
          <li className="flex gap-2 text-[13px] leading-relaxed text-slate-700">
            <span className="text-purple-500 shrink-0 font-medium mt-0.5">
              {ordered ? `${(index ?? 0) + 1}.` : "\u2022"}
            </span>
            <span className="flex-1">{children}</span>
          </li>
        );
      },
      strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
      em: ({ children }) => <em className="italic text-slate-600">{children}</em>,
      code: ({ children, className }) => {
        if (className) {
          return (
            <code className="block bg-slate-800 text-slate-100 rounded-lg px-3 py-2 my-2 text-xs font-mono overflow-x-auto">
              {children}
            </code>
          );
        }
        return <code className="px-1.5 py-0.5 rounded bg-slate-200/80 text-[12px] font-mono text-purple-700">{children}</code>;
      },
      pre: ({ children }) => <div className="my-2">{children}</div>,
      table: ({ children }) => (
        <div className="my-2 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-slate-50 border-b border-slate-200">{children}</thead>,
      tbody: ({ children }) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
      tr: ({ children }) => <tr className="hover:bg-slate-50/50">{children}</tr>,
      th: ({ children }) => <th className="px-3 py-1.5 text-left font-semibold text-slate-700 text-[11px] uppercase tracking-wider">{children}</th>,
      td: ({ children }) => <td className="px-3 py-1.5 text-slate-600">{children}</td>,
      blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-purple-300 pl-3 my-2 text-slate-600 italic text-[13px]">
          {children}
        </blockquote>
      ),
      hr: () => <hr className="my-3 border-slate-200" />,
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-700 underline decoration-purple-300">
          {children}
        </a>
      ),
    }}
  >
    {content}
  </ReactMarkdown>
));
MarkdownMessage.displayName = "MarkdownMessage";

// ============================================
// MAIN COMPONENT
// ============================================

export function FinancialChatPanel() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [progressEvents, setProgressEvents] = useState<ProgressEvent[]>([]);
  const [progressComplete, setProgressComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const unsubProgressRef = useRef<(() => void) | null>(null);

  // Keep ref in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, progressEvents]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // ============================================
  // SEND MESSAGE — with live progress streaming
  // ============================================

  const sendMessage = useCallback(async (content: string, isVoice = false) => {
    if (!content.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
      isVoice,
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);
    setProgressEvents([]);
    setProgressComplete(false);

    // Generate unique progress ID for streaming
    const progressId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Start listening to progress events BEFORE calling the function
    const progressDocRef = doc(db, "chat_progress", progressId);
    unsubProgressRef.current = onSnapshot(progressDocRef, (snapshot) => {
      const data = snapshot.data();
      if (!data) return;
      if (data.events) {
        setProgressEvents(data.events as ProgressEvent[]);
      }
      if (data.status === "complete" || data.status === "error") {
        setProgressComplete(true);
      }
    });

    try {
      const chatFn = httpsCallable(functions, "financialChat");
      const currentMessages = messagesRef.current;
      const history = currentMessages
        .filter(m => m.role === "user" || m.role === "assistant")
        .slice(-20)
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

      const result = await chatFn({
        message: content.trim(),
        history,
        effectiveUserId: user?.id,
        progressId,
      });

      const response = result.data as {
        content: string;
        toolCalls?: ToolCall[];
      };

      // Show tool calls as a terminal summary (collapsed)
      if (response.toolCalls && response.toolCalls.length > 0) {
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_tools`,
          role: "tool",
          content: "",
          timestamp: new Date(),
          toolCalls: response.toolCalls,
        }]);
      }

      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_resp`,
        role: "assistant",
        content: response.content,
        timestamp: new Date(),
      }]);

      if (isVoice) {
        speakText(response.content);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_err`,
        role: "assistant",
        content: errMsg.includes("unauthenticated")
          ? "Please sign in to use the AI assistant."
          : "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      setProgressComplete(true);
      // Cleanup listener
      if (unsubProgressRef.current) {
        unsubProgressRef.current();
        unsubProgressRef.current = null;
      }
    }
  }, [isLoading, user?.id]);

  // ============================================
  // VOICE
  // ============================================

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_voice_err`,
        role: "assistant",
        content: "Voice input is not supported in this browser. Please use Chrome.",
        timestamp: new Date(),
      }]);
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) sendMessage(transcript, true);
    };
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }, [sendMessage]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speakText = useCallback(async (text: string) => {
    if (!voiceEnabled) return;

    try {
      setIsSpeaking(true);

      const ttsFn = httpsCallable(functions, "textToSpeech");
      const result = await ttsFn({ text });
      const { audioData } = result.data as { audioData: string };

      if (!audioData) {
        setIsSpeaking(false);
        return;
      }

      const binaryStr = atob(audioData);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch { /* ignore */ }
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsSpeaking(false);
      source.start();
      audioSourceRef.current = source;

    } catch (error) {
      console.error("TTS error:", error);
      setIsSpeaking(false);
    }
  }, [voiceEnabled]);

  const stopSpeaking = useCallback(() => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch { /* ignore */ }
      audioSourceRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch { /* ignore */ }
      }
      recognitionRef.current?.stop();
      if (unsubProgressRef.current) {
        unsubProgressRef.current();
      }
    };
  }, []);

  // ============================================
  // SUGGESTED FOLLOW-UP ACTIONS
  // ============================================

  const getSuggestedActions = useCallback((): Array<{ label: string; message: string }> => {
    if (messages.length === 0) return [];
    const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
    if (!lastAssistant) return [];

    const text = lastAssistant.content.toLowerCase();

    if (text.includes("reconcil") || text.includes("match")) {
      return [
        { label: "Unmatched transactions", message: "Show all unmatched transactions that need review." },
        { label: "AI match confidence", message: "Show me the reconciliation matches sorted by confidence — any low-confidence ones I should check?" },
        { label: "Vendor patterns learned", message: "What vendor patterns has the AI learned so far? Show aliases and match counts." },
      ];
    }
    if (text.includes("statement") || text.includes("uploaded")) {
      return [
        { label: "Statement details", message: "Show the transaction counts and date ranges for each statement." },
        { label: "Check account balances", message: "What are my current account balances across all banks?" },
        { label: "Reconciliation status", message: "How many of my transactions are reconciled vs unmatched?" },
      ];
    }
    if (text.includes("vendor pattern") || text.includes("aliases") || text.includes("pattern")) {
      return [
        { label: "Top vendors by spend", message: "Show my top 10 vendors by total transaction amount." },
        { label: "Reconciliation matches", message: "Show recent AI reconciliation matches with their confidence scores." },
        { label: "Find specific vendor", message: "Search for all transactions and bills from my largest vendor." },
      ];
    }
    if (text.includes("invoice") || text.includes("receivable")) {
      return [
        { label: "Show overdue invoices", message: "Which invoices are overdue? List them with amounts." },
        { label: "Check reconciliation", message: "Which of my invoices have been matched to bank transactions?" },
        { label: "Cash flow trend", message: "Show me the cash flow trend for the last 6 months." },
      ];
    }
    if (text.includes("bill") || text.includes("payable")) {
      return [
        { label: "Show overdue bills", message: "Which bills are overdue? List with vendors and amounts." },
        { label: "Top expenses this month", message: "What are my top expenses this month by vendor?" },
        { label: "Financial overview", message: "Give me a full financial overview." },
      ];
    }
    if (text.includes("cash flow") || text.includes("trend") || text.includes("monthly")) {
      return [
        { label: "Who owes me money?", message: "List all unpaid invoices with amounts and due dates." },
        { label: "What do I owe?", message: "List all unpaid bills with amounts and due dates." },
        { label: "Find anomalies", message: "Are there any unusual transactions or duplicate payments?" },
      ];
    }
    if (text.includes("balance") || text.includes("account")) {
      return [
        { label: "Cash flow trend", message: "Analyze my cash flow over the last 6 months." },
        { label: "Outstanding invoices", message: "Show all unpaid invoices with totals." },
        { label: "Upcoming bills", message: "What bills are due in the next 30 days?" },
      ];
    }
    if (text.includes("anomal") || text.includes("duplicate") || text.includes("unusual")) {
      return [
        { label: "Financial overview", message: "Give me a complete financial overview." },
        { label: "Check balances", message: "What are my current account balances?" },
        { label: "Recent transactions", message: "Show my 10 most recent bank transactions." },
      ];
    }
    if (text.includes("no data") || text.includes("no transactions") || text.includes("0 results")) {
      return [
        { label: "Check my accounts", message: "Show all my bank accounts and their balances." },
        { label: "Financial overview", message: "Give me a high-level financial overview." },
        { label: "List all invoices", message: "List all my invoices regardless of status." },
      ];
    }

    return [
      { label: "Financial overview", message: "Give me a complete financial overview." },
      { label: "Who owes me?", message: "Which clients have outstanding invoices?" },
      { label: "Cash flow trend", message: "Analyze my cash flow over the last 6 months." },
    ];
  }, [messages]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-600 text-white pl-4 pr-5 py-3 shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/35 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200"
        >
          <div className="relative flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-white group-hover:scale-110 transition-transform duration-200" />
            <div className="absolute inset-0 h-5 w-5 bg-white/20 rounded-full blur-sm group-hover:blur-md transition-all" />
          </div>
          <span className="text-sm font-semibold whitespace-nowrap">Chat with your data</span>
        </button>
      )}

      {/* Backdrop — below top bar */}
      {isOpen && (
        <div
          className="fixed inset-0 top-11 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Right drawer — sits under the top bar */}
      <div
        className={cn(
          "fixed top-11 right-0 bottom-0 z-50 w-full sm:w-[480px] lg:w-[540px]",
          "bg-white shadow-2xl border-l border-slate-200/80",
          "flex flex-col",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200/80 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white tracking-tight">Ask SmartInvoice</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-purple-200 flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5" />
                    Gemini 3 Agent
                  </p>
                  <span className="text-purple-300/50">&bull;</span>
                  <p className="text-[11px] text-purple-200 flex items-center gap-1">
                    <Database className="h-2.5 w-2.5" />
                    Full database access
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  className="h-8 px-2.5 rounded-lg bg-red-500/80 hover:bg-red-500 flex items-center justify-center gap-1.5 transition-colors"
                  title="Stop speaking"
                >
                  <Square className="h-3 w-3 text-white fill-white" />
                  <span className="text-[11px] text-white font-medium">Stop</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (isSpeaking) stopSpeaking();
                  setVoiceEnabled(v => !v);
                }}
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                  voiceEnabled
                    ? "bg-white/20 hover:bg-white/30"
                    : "bg-white/10 hover:bg-white/15"
                )}
                title={voiceEnabled ? "Mute voice responses" : "Enable voice responses"}
              >
                {voiceEnabled
                  ? <Volume2 className="h-4 w-4 text-white" />
                  : <VolumeX className="h-4 w-4 text-white/50" />
                }
              </button>
              {messages.length > 0 && (
                <button
                  onClick={() => { stopSpeaking(); setMessages([]); }}
                  className="h-8 px-2.5 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-[11px] text-white/70 hover:text-white font-medium"
                >
                  New chat
                </button>
              )}
              <button onClick={() => { stopSpeaking(); setIsOpen(false); }} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <X className="h-4 w-4 text-white/70" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0" style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
          {/* Welcome + quick prompts when empty */}
          {messages.length === 0 && (
            <div className="space-y-5 pt-2">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium mb-4">
                  <Sparkles className="h-3 w-3" />
                  Autonomous AI Agent
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1.5">How can I help?</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
                  I have direct access to your database and can build any query I need. Ask me anything about your finances.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {quickPrompts.map(prompt => (
                  <button
                    key={prompt.id}
                    onClick={() => sendMessage(prompt.message)}
                    disabled={isLoading}
                    className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-200 text-left transition-all text-[13px] text-slate-700 disabled:opacity-50"
                  >
                    <span className="text-purple-500 shrink-0">{prompt.icon}</span>
                    <span className="line-clamp-1 font-medium">{prompt.label}</span>
                  </button>
                ))}
              </div>

              <div className="text-center pt-2">
                <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                  <Mic className="h-3 w-3" />
                  Tap the mic to ask with your voice
                </p>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => {
            // Tool call summary (after response)
            if (msg.role === "tool" && msg.toolCalls && msg.toolCalls.length > 0) {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="w-full max-w-[95%] rounded-xl px-4 py-2.5 bg-purple-50/70 border border-purple-100/80">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Brain className="h-3 w-3 text-purple-500" />
                      <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">Agent Queries</span>
                    </div>
                    <div className="space-y-1">
                      {msg.toolCalls.map((tc, i) => (
                        <div key={i} className="flex items-start gap-2 text-[12px] text-purple-700/90">
                          <span className="text-emerald-500 mt-0.5 shrink-0">&#10003;</span>
                          <span>{tc.summary}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            // User message
            if (msg.role === "user") {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 bg-purple-600 text-white">
                    <p className="text-[13px] leading-relaxed">
                      {msg.isVoice && <Mic className="inline h-3 w-3 mr-1 opacity-60" />}
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            }

            // Assistant message
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[95%] rounded-2xl rounded-bl-md px-4 py-3 bg-slate-50/80 border border-slate-100">
                  <MarkdownMessage content={msg.content} />
                </div>
              </div>
            );
          })}

          {/* Terminal-style thinking indicator */}
          {isLoading && (
            <div className="flex justify-start">
              {progressEvents.length > 0 ? (
                <AIThinkingTerminal events={progressEvents} isComplete={progressComplete} />
              ) : (
                <div className="bg-slate-50/80 border border-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-[12px] text-slate-400 ml-1">Connecting to Gemini 3...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested follow-up actions */}
        {!isLoading && messages.length > 0 && getSuggestedActions().length > 0 && (
          <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex flex-col gap-1.5">
              {getSuggestedActions().map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(action.message)}
                  className="w-full text-left px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-200 transition-all text-[12px] text-slate-600 hover:text-purple-700 flex items-center gap-2"
                >
                  <ChevronRight className="h-3 w-3 text-purple-400 shrink-0" />
                  <span className="font-medium">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="px-5 py-3.5 border-t border-slate-200/80 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading}
              className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center transition-all shrink-0",
                isListening
                  ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-200"
                  : "bg-slate-100 text-slate-500 hover:bg-purple-100 hover:text-purple-600"
              )}
              title={isListening ? "Stop listening" : "Voice input"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <div className="flex-1 relative">
              <input
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(inputValue);
                  }
                }}
                placeholder={isListening ? "Listening..." : "Ask anything about your finances..."}
                disabled={isLoading || isListening}
                className="w-full h-10 pl-4 pr-12 rounded-xl bg-slate-50 border border-slate-200 text-[13px] focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:bg-white disabled:opacity-50 placeholder:text-slate-400 transition-all"
              />
              <button
                onClick={() => sendMessage(inputValue)}
                disabled={!inputValue.trim() || isLoading}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center disabled:opacity-30 disabled:bg-slate-300 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400 mt-2">
            AI builds its own database queries autonomously via Gemini 3
          </p>
        </div>
      </div>
    </>
  );
}
