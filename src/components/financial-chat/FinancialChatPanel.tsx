"use client";

/**
 * Financial Chat Panel — "Ask SmartInvoice"
 * Full-height right drawer with proper markdown rendering.
 * Powered by Gemini 3 with agentic function calling.
 */

import { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  MessageCircle, X, Send, Sparkles, Loader2, Mic, MicOff, Volume2,
  TrendingUp, DollarSign, AlertCircle, Brain,
  BarChart3, Receipt, Building2, Zap, ChevronRight, Database,
} from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
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

// ============================================
// QUICK PROMPTS
// ============================================

const quickPrompts = [
  { id: "overview", label: "Financial overview", icon: <TrendingUp className="h-3.5 w-3.5" />, message: "Give me a complete financial overview — balances, cash flow trends, outstanding receivables and payables, and any concerns." },
  { id: "receivables", label: "Who owes me?", icon: <Receipt className="h-3.5 w-3.5" />, message: "Which clients have outstanding invoices? List them with amounts and due dates. Any overdue?" },
  { id: "payables", label: "What do I owe?", icon: <Building2 className="h-3.5 w-3.5" />, message: "What bills do I need to pay? List with amounts and due dates. What's overdue?" },
  { id: "spending", label: "Top expenses", icon: <DollarSign className="h-3.5 w-3.5" />, message: "What are my top 5 expenses this month? Break down by vendor and category." },
  { id: "cashflow", label: "Cash flow trend", icon: <BarChart3 className="h-3.5 w-3.5" />, message: "Analyze my cash flow trend over the last 6 months. Is it improving or declining? Any seasonal patterns?" },
  { id: "anomalies", label: "Find anomalies", icon: <AlertCircle className="h-3.5 w-3.5" />, message: "Are there any unusual transactions, duplicate payments, or anomalies in my recent financial data?" },
];

// ============================================
// MARKDOWN MESSAGE COMPONENT
// ============================================

const MarkdownMessage = memo(({ content }: { content: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      // Headings
      h1: ({ children }) => <h1 className="text-base font-bold text-slate-900 mt-3 mb-1.5 first:mt-0">{children}</h1>,
      h2: ({ children }) => <h2 className="text-sm font-bold text-slate-900 mt-3 mb-1 first:mt-0">{children}</h2>,
      h3: ({ children }) => <h3 className="text-[13px] font-semibold text-slate-800 mt-2 mb-1 first:mt-0">{children}</h3>,
      h4: ({ children }) => <h4 className="text-xs font-semibold text-slate-700 mt-2 mb-0.5 first:mt-0">{children}</h4>,
      // Paragraphs
      p: ({ children }) => <p className="text-[13px] leading-relaxed text-slate-700 my-1.5 first:mt-0 last:mb-0">{children}</p>,
      // Lists
      ul: ({ children }) => <ul className="my-1.5 space-y-0.5 list-none">{children}</ul>,
      ol: ({ children }) => <ol className="my-1.5 space-y-0.5 list-none counter-reset-item">{children}</ol>,
      li: ({ children, ...props }) => {
        const ordered = (props as any).ordered;
        const index = (props as any).index;
        return (
          <li className="flex gap-2 text-[13px] leading-relaxed text-slate-700">
            <span className="text-purple-500 shrink-0 font-medium mt-0.5">
              {ordered ? `${(index ?? 0) + 1}.` : "•"}
            </span>
            <span className="flex-1">{children}</span>
          </li>
        );
      },
      // Inline
      strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
      em: ({ children }) => <em className="italic text-slate-600">{children}</em>,
      code: ({ children, className }) => {
        // Block code
        if (className) {
          return (
            <code className="block bg-slate-800 text-slate-100 rounded-lg px-3 py-2 my-2 text-xs font-mono overflow-x-auto">
              {children}
            </code>
          );
        }
        // Inline code
        return <code className="px-1.5 py-0.5 rounded bg-slate-200/80 text-[12px] font-mono text-purple-700">{children}</code>;
      },
      pre: ({ children }) => <div className="my-2">{children}</div>,
      // Table
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
      // Block quote
      blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-purple-300 pl-3 my-2 text-slate-600 italic text-[13px]">
          {children}
        </blockquote>
      ),
      // Horizontal rule
      hr: () => <hr className="my-3 border-slate-200" />,
      // Links
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
  const [activeToolCall, setActiveToolCall] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  // Keep ref in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // ============================================
  // SEND MESSAGE
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
    setActiveToolCall("Connecting to Gemini 3...");

    try {
      const chatFn = httpsCallable(functions, "financialChat");
      const currentMessages = messagesRef.current;
      const history = currentMessages
        .filter(m => m.role === "user" || m.role === "assistant")
        .slice(-8)
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

      setActiveToolCall("Querying your financial data...");

      const result = await chatFn({ message: content.trim(), history });

      const response = result.data as {
        content: string;
        toolCalls?: ToolCall[];
      };

      setActiveToolCall(null);

      // Show tool calls
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

      if (isVoice && typeof window !== "undefined" && "speechSynthesis" in window) {
        speakText(response.content);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setActiveToolCall(null);
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
      setActiveToolCall(null);
    }
  }, [isLoading]);

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

  const speakText = (text: string) => {
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/[#_`~\[\]()]/g, "")
      .replace(/\|/g, ", ")
      .replace(/\n+/g, ". ")
      .replace(/\s+/g, " ")
      .trim();
    const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 600));
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white"
          title="Ask SmartInvoice AI"
        >
          <div className="relative">
            <MessageCircle className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-purple-600 animate-pulse" />
          </div>
        </button>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Full-height right drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full sm:w-[480px] lg:w-[540px]",
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
                  <span className="text-purple-300/50">•</span>
                  <p className="text-[11px] text-purple-200 flex items-center gap-1">
                    <Database className="h-2.5 w-2.5" />
                    6 tools
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isSpeaking && (
                <button onClick={stopSpeaking} className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors">
                  <Volume2 className="h-4 w-4 text-white animate-pulse" />
                </button>
              )}
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="h-8 px-2.5 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-[11px] text-white/70 hover:text-white font-medium"
                >
                  New chat
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
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
                  AI Financial Agent
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1.5">How can I help?</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
                  I can search your invoices, bills, and transactions in real-time using AI function calling. Ask me anything.
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
            // Tool call indicator
            if (msg.role === "tool" && msg.toolCalls && msg.toolCalls.length > 0) {
              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="w-full max-w-[95%] rounded-xl px-4 py-2.5 bg-purple-50/70 border border-purple-100/80">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Brain className="h-3 w-3 text-purple-500" />
                      <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">Agent Actions</span>
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

            // Assistant message with full markdown
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[95%] rounded-2xl rounded-bl-md px-4 py-3 bg-slate-50/80 border border-slate-100">
                  <MarkdownMessage content={msg.content} />
                </div>
              </div>
            );
          })}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-50/80 border border-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-[12px] text-slate-400 ml-1">
                    {activeToolCall || "Thinking..."}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="px-5 py-3.5 border-t border-slate-200/80 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Mic button */}
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

            {/* Text input */}
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
                placeholder={isListening ? "Listening..." : "Ask about your finances..."}
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

          {/* Footer */}
          <p className="text-center text-[10px] text-slate-400 mt-2">
            SmartInvoice AI queries your live data via Gemini 3 function calling
          </p>
        </div>
      </div>
    </>
  );
}
