"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Sparkles,
  Star,
  Upload,
  ScanLine,
  FileOutput,
  Tags,
  GitMerge,
  Brain,
  Search,
  FileText,
  Receipt,
  DollarSign,
  CreditCard,
  History,
  Lightbulb,
  Frown,
  Clock,
  ChevronDown,
  ChevronUp,
  Terminal,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Shield,
  MessageSquare,
  Database,
  Activity,
} from "lucide-react";
import { useBrand } from "@/hooks/use-brand";

// ============================================
// HERO SECTION
// ============================================

function HeroSection() {
  const brand = useBrand();

  return (
    <section className="relative bg-slate-900 overflow-hidden">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${brand.colors.primary}30, transparent)`
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 lg:pt-40 lg:pb-32">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.15] tracking-tight">
            AI-powered reconciliation
            <br />
            <span className="text-slate-400">with a 3-tier engine</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
            A 3-tier reconciliation engine powered by Gemini 3 Flash with agentic function calling,
            8 investigation tools, and real-time streaming reasoning. Upload any bank statement —
            PDF, CSV, or scanned — and watch the AI match, learn, and explain.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/demo"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/30 hover:from-purple-700 hover:to-indigo-700 transition-all"
            >
              <Sparkles className="w-5 h-5" />
              Try Live Demo
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-lg bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all"
            >
              Sign In
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          <p className="mt-8 text-sm text-slate-500">
            14-day free trial · No credit card required · Cancel anytime
          </p>
        </div>

        <div className="mt-16 lg:mt-20">
          <div className="relative max-w-5xl mx-auto">
            <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10">
              <Image
                src="/screenshots/10-dashboard.png"
                alt="Dashboard showing extracted bank statement data"
                width={1920}
                height={1080}
                className="w-full h-auto"
                priority
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// STATS BAR SECTION
// ============================================

function StatsBarSection() {
  const brand = useBrand();

  return (
    <section className="py-12 bg-slate-50 border-y border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-3xl sm:text-4xl font-bold" style={{ color: brand.colors.primary }}>8</p>
            <p className="text-sm text-slate-500 mt-1">Agent Tools</p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-bold" style={{ color: brand.colors.primary }}>3-Tier</p>
            <p className="text-sm text-slate-500 mt-1">AI Engine</p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-bold" style={{ color: brand.colors.primary }}>40+</p>
            <p className="text-sm text-slate-500 mt-1">Currency Pairs</p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-bold" style={{ color: brand.colors.primary }}>90-Day</p>
            <p className="text-sm text-slate-500 mt-1">Cash Flow Forecast</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// PROBLEM SECTION
// ============================================

function ProblemSection() {
  const problems = [
    {
      icon: Frown,
      title: "Hours of manual data entry",
      description: "Copying transactions from PDFs into spreadsheets. Typos. Missing entries. The same tedious work, month after month.",
    },
    {
      icon: Search,
      title: "Unreadable statement formats",
      description: "Every bank has a different layout. Scanned documents. Multi-page statements. Nothing matches your chart of accounts.",
    },
    {
      icon: Clock,
      title: "Month-end closing nightmares",
      description: "Reconciliation takes days. Discrepancies appear at the worst time. Your team works overtime every month.",
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-red-600 font-medium mb-2">Sound familiar?</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Bank statement processing is broken
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {problems.map((problem, i) => (
            <div key={i} className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
                <problem.icon className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{problem.title}</h3>
              <p className="text-slate-600 text-sm">{problem.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-slate-500 italic">
            &ldquo;I used to spend 15+ hours every month just entering bank data. Now it takes 15 minutes.&rdquo;
          </p>
          <p className="text-sm text-slate-400 mt-2">&mdash; Sarah M., Bookkeeper</p>
        </div>
      </div>
    </section>
  );
}

// ============================================
// PIPELINE SECTION — "6-Stage AI Pipeline"
// ============================================

const pipelineStages = [
  {
    icon: Upload,
    title: "Upload",
    subtitle: "PDF, CSV, or image",
    detail: "Drag-and-drop any bank statement. Multi-page PDFs and scanned images accepted.",
    color: "#6366F1",
  },
  {
    icon: ScanLine,
    title: "Vision Scan",
    subtitle: "Gemini 3 Vision",
    detail: "PDF pages sent as base64 inlineData to Gemini 3 Flash. Detects if CSV or tabular data — skips Vision if parseable directly.",
    color: "#8B5CF6",
  },
  {
    icon: FileOutput,
    title: "Extract",
    subtitle: "Structured JSON output",
    detail: "Only 15 sample CSV rows sent to AI to generate reusable parsing rules. Uses responseMimeType: 'application/json' for guaranteed structured output.",
    color: "#A855F7",
  },
  {
    icon: Tags,
    title: "Categorize",
    subtitle: "Smart classification",
    detail: "Transactions auto-categorized by vendor, amount patterns, and learned rules. Payment processors detected (Stripe, PayPal, etc.).",
    color: "#C084FC",
  },
  {
    icon: GitMerge,
    title: "Reconcile",
    subtitle: "3-tier matching",
    detail: "Tier 1: rule-based instant scan. Tier 2: Gemini 3 with thinking_level: LOW. Tier 3: deep investigation with thinking_level: HIGH.",
    color: "#D946EF",
  },
  {
    icon: Brain,
    title: "Learn",
    subtitle: "Pattern memory",
    detail: "Every confirmed match updates vendor patterns — keywords, payment delays, aliases, processor fees. Levenshtein fuzzy matching at 0.7 threshold.",
    color: "#EC4899",
  },
];

function PipelineSection() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <section className="py-24 lg:py-32 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-purple-600 font-medium text-sm uppercase tracking-wide mb-3">End-to-end processing</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            6-Stage AI Pipeline
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Every document flows through six stages — each powered by a different Gemini 3 capability.
          </p>
        </div>

        {/* Horizontal pipeline (desktop) */}
        <div className="hidden lg:flex items-start justify-between gap-2">
          {pipelineStages.map((stage, i) => (
            <div key={stage.title} className="flex items-start flex-1">
              <div className="flex flex-col items-center w-full">
                {/* Stage card */}
                <button
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  className="w-full group cursor-pointer"
                >
                  <div
                    className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${stage.color}15` }}
                  >
                    <stage.icon className="w-8 h-8" style={{ color: stage.color }} />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm">{stage.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{stage.subtitle}</p>
                  <div className="mt-2">
                    {expanded === i ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 mx-auto" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 mx-auto" />
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {expanded === i && (
                  <div className="mt-3 p-4 bg-white rounded-xl border border-slate-200 shadow-lg text-left w-full">
                    <p className="text-sm text-slate-700 leading-relaxed">{stage.detail}</p>
                  </div>
                )}
              </div>

              {/* Connector arrow */}
              {i < pipelineStages.length - 1 && (
                <div className="flex items-center pt-7 px-1 flex-shrink-0">
                  <div className="w-8 h-0.5 bg-slate-300 relative">
                    <div
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-slate-300"
                    />
                    {/* Pulse animation */}
                    <div
                      className="absolute inset-0 bg-purple-400 animate-pulse opacity-50"
                      style={{ animationDelay: `${i * 200}ms` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Vertical pipeline (mobile) */}
        <div className="lg:hidden space-y-4">
          {pipelineStages.map((stage, i) => (
            <div key={stage.title} className="relative">
              {/* Vertical connector */}
              {i < pipelineStages.length - 1 && (
                <div className="absolute left-8 top-full w-0.5 h-4 bg-slate-300 z-0" />
              )}
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-200 text-left relative z-10"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${stage.color}15` }}
                >
                  <stage.icon className="w-6 h-6" style={{ color: stage.color }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{stage.title}</h3>
                  <p className="text-sm text-slate-500">{stage.subtitle}</p>
                  {expanded === i && (
                    <p className="text-sm text-slate-700 mt-2 leading-relaxed">{stage.detail}</p>
                  )}
                </div>
                {expanded === i ? (
                  <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// THREE-TIER SECTION — "3-Tier Reconciliation Engine"
// ============================================

function ThreeTierSection() {
  const tiers = [
    {
      tier: "Tier 1",
      title: "Quick Scan",
      method: "Rule-based, instant",
      thinking: "No AI needed",
      batch: "All transactions",
      speed: "< 1ms per match",
      result: "93%+ auto-confirmed",
      color: "#10B981",
      borderColor: "border-emerald-500/30",
      glowColor: "shadow-emerald-500/10",
    },
    {
      tier: "Tier 2",
      title: "AI Matching",
      method: "Gemini 3 Flash",
      thinking: "thinking_level: LOW",
      batch: "Batch 10, 4 concurrent",
      speed: "~200ms per batch",
      result: "60-92% confidence",
      color: "#F59E0B",
      borderColor: "border-amber-500/30",
      glowColor: "shadow-amber-500/10",
    },
    {
      tier: "Tier 3",
      title: "Deep Investigation",
      method: "Gemini 3 Flash",
      thinking: "thinking_level: HIGH",
      batch: "1 transaction at a time",
      speed: "~2s deep analysis",
      result: "Complex cases resolved",
      color: "#A855F7",
      borderColor: "border-purple-500/30",
      glowColor: "shadow-purple-500/10",
    },
  ];

  return (
    <section className="py-24 lg:py-32 bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-purple-400 font-medium text-sm uppercase tracking-wide mb-3">Core architecture</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
            3-Tier Reconciliation Engine
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Each transaction escalates only if the previous tier can&apos;t resolve it.
            Most match in Tier 1 — AI is reserved for genuinely complex cases.
          </p>
        </div>

        {/* Tier cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.tier}
              className={`relative p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur ${tier.glowColor} shadow-lg`}
            >
              {/* Tier badge */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4"
                style={{ backgroundColor: `${tier.color}20`, color: tier.color }}
              >
                {tier.tier}
              </div>

              <h3 className="text-xl font-bold text-white mb-4">{tier.title}</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Method</span>
                  <span className="text-slate-300 font-medium">{tier.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Thinking</span>
                  <span className="text-slate-300 font-mono text-xs">{tier.thinking}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Batch</span>
                  <span className="text-slate-300">{tier.batch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Speed</span>
                  <span className="text-slate-300">{tier.speed}</span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex justify-between">
                  <span className="text-slate-500">Result</span>
                  <span className="font-semibold" style={{ color: tier.color }}>{tier.result}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Code snippet */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-slate-950 rounded-xl border border-white/10 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              <span className="ml-2 text-xs text-slate-500 font-mono">reconcile-engine.ts</span>
            </div>
            <pre className="p-4 text-sm font-mono leading-relaxed overflow-x-auto">
              <code>
                <span className="text-slate-500">{"// Tier 2: AI matching with dynamic thinking\n"}</span>
                <span className="text-purple-400">{"const "}</span>
                <span className="text-cyan-400">{"response "}</span>
                <span className="text-slate-300">{"= "}</span>
                <span className="text-purple-400">{"await "}</span>
                <span className="text-cyan-400">{"ai"}</span>
                <span className="text-slate-300">{"."}</span>
                <span className="text-cyan-400">{"models"}</span>
                <span className="text-slate-300">{"."}</span>
                <span className="text-cyan-400">{"generateContent"}</span>
                <span className="text-slate-300">{"({\n"}</span>
                <span className="text-cyan-400">{"  model"}</span>
                <span className="text-slate-300">{": "}</span>
                <span className="text-emerald-400">{'"gemini-3-flash"'}</span>
                <span className="text-slate-300">{",\n"}</span>
                <span className="text-cyan-400">{"  config"}</span>
                <span className="text-slate-300">{": {\n"}</span>
                <span className="text-cyan-400">{"    responseMimeType"}</span>
                <span className="text-slate-300">{": "}</span>
                <span className="text-emerald-400">{'"application/json"'}</span>
                <span className="text-slate-300">{",\n"}</span>
                <span className="text-cyan-400">{"    thinkingConfig"}</span>
                <span className="text-slate-300">{": {\n"}</span>
                <span className="text-cyan-400">{"      thinkingLevel"}</span>
                <span className="text-slate-300">{": ThinkingLevel."}</span>
                <span className="text-amber-400">{"LOW"}</span>
                <span className="text-slate-300">{",\n"}</span>
                <span className="text-slate-300">{"    },\n"}</span>
                <span className="text-slate-300">{"  },\n"}</span>
                <span className="text-slate-300">{"});\n"}</span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// AGENT TOOLS SECTION — "8-Tool Agentic System"
// ============================================

function AgentToolsSection() {
  const brand = useBrand();

  const tools = [
    { name: "searchTransactions", desc: "Fuzzy search by amount, date, keywords", icon: Search },
    { name: "searchInvoices", desc: "Vendor, amount, status filters", icon: FileText },
    { name: "findInvoiceCombination", desc: "Subset-sum: invoices that add to payment", icon: GitMerge },
    { name: "findPaymentCombination", desc: "Transactions that sum to invoice", icon: Receipt },
    { name: "getFXRate", desc: "Live + cached, 40+ currency pairs", icon: DollarSign },
    { name: "searchCreditNotes", desc: "Credit notes explaining differences", icon: CreditCard },
    { name: "getVendorHistory", desc: "Payment delay statistics", icon: History },
    { name: "getLearnedPatterns", desc: "AI-learned vendor patterns", icon: Lightbulb },
  ];

  return (
    <section className="py-24 lg:py-32 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-indigo-600 font-medium text-sm uppercase tracking-wide mb-3">Function calling</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            8-Tool Agentic System
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Gemini 3 Flash calls real database tools in a manual function-calling loop —
            up to 10 iterations per investigation.
          </p>
        </div>

        {/* Central badge + grid */}
        <div className="relative">
          {/* Gemini badge */}
          <div className="flex justify-center mb-8">
            <div
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white shadow-lg"
              style={{ backgroundColor: brand.colors.primary }}
            >
              <Brain className="w-5 h-5" />
              Gemini 3 Flash
            </div>
          </div>

          {/* Tool grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="group p-5 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all"
              >
                <div className="flex items-center gap-3 mb-2">
                  <tool.icon className="w-5 h-5 text-indigo-500" />
                  <code className="text-sm font-mono font-semibold text-slate-900">{tool.name}</code>
                </div>
                <p className="text-sm text-slate-600">{tool.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Agent loop snippet */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              <span className="ml-2 text-xs text-slate-500 font-mono">ai-agent.ts — function-calling loop</span>
            </div>
            <pre className="p-4 text-sm font-mono leading-relaxed overflow-x-auto">
              <code>
                <span className="text-slate-500">{"// Manual function-calling loop (up to 10 iterations)\n"}</span>
                <span className="text-purple-400">{"while "}</span>
                <span className="text-slate-300">{"(response.candidates?.[0]?.content\n"}</span>
                <span className="text-slate-300">{"  ?.parts?.some(p => p."}</span>
                <span className="text-cyan-400">{"functionCall"}</span>
                <span className="text-slate-300">{") && "}</span>
                <span className="text-cyan-400">{"iterations"}</span>
                <span className="text-slate-300">{" < "}</span>
                <span className="text-amber-400">{"10"}</span>
                <span className="text-slate-300">{") {\n"}</span>
                <span className="text-slate-300">{"  "}</span>
                <span className="text-purple-400">{"const "}</span>
                <span className="text-cyan-400">{"calls "}</span>
                <span className="text-slate-300">{"= parts.filter(p => p.functionCall);\n"}</span>
                <span className="text-slate-300">{"  "}</span>
                <span className="text-purple-400">{"for "}</span>
                <span className="text-slate-300">{"("}</span>
                <span className="text-purple-400">{"const "}</span>
                <span className="text-cyan-400">{"call "}</span>
                <span className="text-purple-400">{"of "}</span>
                <span className="text-cyan-400">{"calls"}</span>
                <span className="text-slate-300">{") {\n"}</span>
                <span className="text-slate-300">{"    "}</span>
                <span className="text-purple-400">{"await "}</span>
                <span className="text-cyan-400">{"agentTools"}</span>
                <span className="text-slate-300">{"[call.name](...args);\n"}</span>
                <span className="text-slate-300">{"  }\n"}</span>
                <span className="text-slate-300">{"  iterations++;\n"}</span>
                <span className="text-slate-300">{"}\n"}</span>
              </code>
            </pre>
          </div>
          <p className="text-center text-sm text-slate-500 mt-4">
            Up to 10 iterations per investigation. Real Firestore queries. Streaming progress to the UI.
          </p>
        </div>
      </div>
    </section>
  );
}

// ============================================
// STREAMING SECTION — "Real-Time AI Reasoning"
// ============================================

const streamLines = [
  { type: "step", text: "Step 1: Quick Analysis — rule-based scoring" },
  { type: "analyze", text: '  ↳ "STRIPE PAYMENT 15998" — ANG 4,399.82' },
  { type: "search", text: "  ↳ Found reference '15998' in description" },
  { type: "search", text: "  ↳ Searching bills... found INV-15998 from GlobalTech" },
  { type: "fx", text: "  ↳ ANG 4,399.82 ÷ 1.7900 = USD 2,458.00 — exact match" },
  { type: "confirm", text: "  ✓ MATCH: 96% confidence — auto-confirmed" },
  { type: "learn", text: "  ◆ Updated pattern for GlobalTech (24 matches, 94% confidence)" },
  { type: "step", text: "Step 2: AI Matching — 3 transactions, thinking_level: LOW" },
  { type: "info", text: "  ↳ Sending batch 1/1 to Gemini 3 Flash..." },
  { type: "escalate", text: '  ⚠ "MISC PAYMENT" — uncertain (45%), escalating' },
  { type: "step", text: "Step 3: Deep Investigation — thinking_level: HIGH" },
  { type: "analyze", text: "  ↳ Engaging Gemini 3 with extended reasoning..." },
  { type: "search", text: "  ↳ Calling getLearnedPatterns('GlobalTech')..." },
  { type: "search", text: "  ↳ Found 2-invoice combination: INV-201 + INV-203 = $1,847.50" },
  { type: "confirm", text: "  ✓ COMBINED MATCH: 91% confidence" },
];

const streamColors: Record<string, string> = {
  step: "text-white font-semibold",
  analyze: "text-slate-400",
  search: "text-cyan-400",
  fx: "text-cyan-300",
  confirm: "text-emerald-400",
  learn: "text-purple-400",
  info: "text-slate-500",
  escalate: "text-amber-400",
};

function StreamingSection() {
  const [visibleLines, setVisibleLines] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Start streaming animation
          let line = 0;
          intervalRef.current = setInterval(() => {
            line++;
            if (line > streamLines.length) {
              // Reset after showing all
              setTimeout(() => {
                setVisibleLines(0);
                line = 0;
              }, 3000);
            }
            setVisibleLines(line);
          }, 250);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      observer.disconnect();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <section ref={sectionRef} className="py-24 lg:py-32 bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-emerald-400 font-medium text-sm uppercase tracking-wide mb-3">Live progress</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
            Real-Time AI Reasoning
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Watch the engine think. Every step streams to your browser via Firestore real-time listeners —
            not a spinner, but actual reasoning.
          </p>
        </div>

        {/* Terminal mockup */}
        <div className="bg-slate-900 rounded-xl border border-white/10 overflow-hidden shadow-2xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-slate-800/50">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="ml-3 text-xs text-slate-500 font-mono">
              <Terminal className="w-3 h-3 inline mr-1" />
              reconciliation_runs/progress
            </span>
          </div>
          <div className="p-6 font-mono text-sm leading-relaxed min-h-[360px]">
            {streamLines.slice(0, visibleLines).map((line, i) => (
              <div
                key={i}
                className={`${streamColors[line.type] || "text-slate-400"} transition-opacity duration-200`}
              >
                {line.type === "step" ? `→ ${line.text}` : line.text}
              </div>
            ))}
            {visibleLines < streamLines.length && (
              <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-1" />
            )}
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          ProgressStream writes events to Firestore in real-time. Frontend renders via onSnapshot listener.
        </p>
      </div>
    </section>
  );
}

// ============================================
// SCORING SECTION — "5-Signal Match Scoring"
// ============================================

const scoringSignals = [
  { name: "Reference Match", max: 40, example: 38, desc: 'Found "INV-15998" in transaction', color: "#6366F1" },
  { name: "Amount Match", max: 35, example: 35, desc: "ANG→USD exact after FX conversion", color: "#8B5CF6" },
  { name: "Identity Match", max: 25, example: 22, desc: '"GlobalTech" fuzzy match 92%', color: "#A855F7" },
  { name: "Time Proximity", max: 20, example: 14, desc: "15 days after invoice — within normal range", color: "#D946EF" },
  { name: "Context", max: 5, example: 4, desc: "Unique amount, no duplicates", color: "#EC4899" },
];

function ScoringSection() {
  const [animated, setAnimated] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const totalMax = scoringSignals.reduce((sum, s) => sum + s.max, 0);
  const totalExample = scoringSignals.reduce((sum, s) => sum + s.example, 0);
  const confidence = Math.round((totalExample / totalMax) * 100);

  return (
    <section ref={sectionRef} className="py-24 lg:py-32 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-purple-600 font-medium text-sm uppercase tracking-wide mb-3">Scoring engine</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            5-Signal Match Scoring
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Every potential match is scored across five independent signals.
            Total score out of {totalMax} is converted to a confidence percentage.
          </p>
        </div>

        {/* Scoring bars */}
        <div className="space-y-6 max-w-3xl mx-auto">
          {scoringSignals.map((signal) => (
            <div key={signal.name}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold text-slate-900">{signal.name}</span>
                  <span className="text-sm text-slate-500 ml-2">/{signal.max}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900">{signal.example}</span>
                  <span className="text-sm text-slate-500 ml-2">{signal.desc}</span>
                </div>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: animated ? `${(signal.example / signal.max) * 100}%` : "0%",
                    backgroundColor: signal.color,
                  }}
                />
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">Total</span>
              <span className="text-lg font-bold text-slate-900">
                {totalExample}/{totalMax} → {confidence}% confidence
              </span>
            </div>
          </div>
        </div>

        {/* Fee pattern badges */}
        <div className="mt-12 text-center">
          <p className="text-sm text-slate-500 mb-4">Built-in fee pattern detection</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "Stripe 2.9% + $0.30",
              "PayPal 2.9% + $0.30",
              "Wise 1%",
              "Square 2.6% + $0.10",
              "Card 3%",
            ].map((fee) => (
              <span
                key={fee}
                className="px-4 py-2 bg-slate-50 rounded-full text-sm font-mono text-slate-700 border border-slate-200"
              >
                {fee}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// PATTERN MEMORY SECTION — "It Learns From Every Match"
// ============================================

function PatternMemorySection() {
  return (
    <section className="py-24 lg:py-32 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-purple-600 font-medium text-sm uppercase tracking-wide mb-3">Continuous learning</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            It Learns From Every Match
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Every confirmed match — manual or AI — updates vendor patterns in Firestore.
            The next time that vendor appears, matching is faster and more accurate.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Vendor card example */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Brain className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">GlobalTech Solutions</h3>
                <p className="text-sm text-slate-500">Vendor pattern — learned</p>
              </div>
            </div>

            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Aliases</span>
                <span className="text-slate-700">GlobalTech, GT Solutions, GLOBALTECH INC</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Confidence</span>
                <span className="text-emerald-600 font-semibold">94% (23 matches)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Avg Payment Delay</span>
                <span className="text-slate-700">18 days (range: 12-25)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Keywords</span>
                <span className="text-slate-700">stripe, globaltech, payment</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Processor</span>
                <span className="text-slate-700">Stripe (2.9% + $0.30)</span>
              </div>
            </div>
          </div>

          {/* Learning loop */}
          <div className="flex flex-col justify-center">
            <h3 className="text-xl font-bold text-slate-900 mb-6">How pattern memory works</h3>

            <div className="space-y-4">
              {[
                { step: "1", title: "Match Confirmed", desc: "Manual or AI-confirmed match triggers learning" },
                { step: "2", title: "Extract Keywords", desc: "Transaction description tokenized. Common words filtered. Top 15 kept." },
                { step: "3", title: "Update Averages", desc: "Running averages for payment delay, amount range, and confidence — weighted by match count." },
                { step: "4", title: "Better Next Match", desc: "Next time this vendor appears, patterns boost scoring. Levenshtein fuzzy matching (0.7 threshold) catches name variants." },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-purple-600">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">{item.title}</h4>
                    <p className="text-sm text-slate-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-slate-900 rounded-xl">
              <pre className="text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto">
                <code>
                  <span className="text-slate-500">{"// Levenshtein fuzzy matching\n"}</span>
                  <span className="text-purple-400">{"function "}</span>
                  <span className="text-cyan-400">{"stringSimilarity"}</span>
                  <span className="text-slate-300">{"(a, b): "}</span>
                  <span className="text-purple-400">{"number "}</span>
                  <span className="text-slate-300">{"{\n"}</span>
                  <span className="text-slate-300">{"  "}</span>
                  <span className="text-purple-400">{"const "}</span>
                  <span className="text-cyan-400">{"dist "}</span>
                  <span className="text-slate-300">{"= "}</span>
                  <span className="text-cyan-400">{"levenshteinDistance"}</span>
                  <span className="text-slate-300">{"(a, b);\n"}</span>
                  <span className="text-slate-300">{"  "}</span>
                  <span className="text-purple-400">{"return "}</span>
                  <span className="text-amber-400">{"1"}</span>
                  <span className="text-slate-300">{" - (dist / Math.max(a.length, b.length));\n"}</span>
                  <span className="text-slate-300">{"}\n"}</span>
                  <span className="text-slate-500">{"\n// Threshold: 0.7 — catches \"GlobalTech\" ≈ \"GLOBALTECH INC\"\n"}</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// ANOMALY DETECTION SECTION — "Agentic Fraud Detection"
// ============================================

function AnomalyDetectionSection() {
  const detectionTypes = [
    {
      icon: AlertTriangle,
      title: "Statistical Outliers",
      desc: "Flags payments exceeding 2 standard deviations from the mean — catches unusual spikes automatically.",
      code: "threshold = mean + 2 × stdDev",
      color: "#EF4444",
      severity: "high",
    },
    {
      icon: Clock,
      title: "Slow Payer Detection",
      desc: "Identifies vendors with 30+ day payment delays from AI-learned vendor_patterns. Alerts on cash flow risk.",
      code: "typicalDelay.max > 30 days",
      color: "#F59E0B",
      severity: "medium",
    },
    {
      icon: DollarSign,
      title: "FX Exposure Alerts",
      desc: "Detects cross-currency reconciliation matches where rate fluctuations could cause variance. Flags for review.",
      code: "txn.currency ≠ doc.currency",
      color: "#6366F1",
      severity: "low",
    },
    {
      icon: Shield,
      title: "Low Match Rate Warnings",
      desc: "When >20% of transactions remain unreconciled, the system raises a high-priority alert for investigation.",
      code: "unmatchedRate > 20%",
      color: "#DC2626",
      severity: "high",
    },
  ];

  return (
    <section className="py-24 lg:py-32 bg-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-red-400 font-medium text-sm uppercase tracking-wide mb-3">Anomaly reasoning</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
            AI Fraud Detection & Anomaly Alerts
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Statistical analysis runs on every transaction set. The AI doesn&apos;t just match —
            it watches for outliers, duplicate charges, slow payers, and FX exposure.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {detectionTypes.map((detection) => (
            <div
              key={detection.title}
              className="relative p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur hover:bg-white/[0.07] transition-colors"
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${detection.color}15` }}
                >
                  <detection.icon className="w-6 h-6" style={{ color: detection.color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-white">{detection.title}</h3>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                      style={{
                        backgroundColor: `${detection.color}20`,
                        color: detection.color,
                      }}
                    >
                      {detection.severity}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed mb-3">{detection.desc}</p>
                  <code className="text-xs font-mono text-slate-500 bg-white/5 px-3 py-1.5 rounded-lg inline-block">
                    {detection.code}
                  </code>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Code snippet */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-slate-950 rounded-xl border border-white/10 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              <span className="ml-2 text-xs text-slate-500 font-mono">insights/page.tsx — anomaly detection</span>
            </div>
            <pre className="p-4 text-sm font-mono leading-relaxed overflow-x-auto">
              <code>
                <span className="text-slate-500">{"// Statistical outlier detection (2σ)\n"}</span>
                <span className="text-purple-400">{"const "}</span>
                <span className="text-cyan-400">{"mean "}</span>
                <span className="text-slate-300">{"= debits.reduce((a, b) => a + b) / debits.length;\n"}</span>
                <span className="text-purple-400">{"const "}</span>
                <span className="text-cyan-400">{"stdDev "}</span>
                <span className="text-slate-300">{"= Math.sqrt(variance);\n"}</span>
                <span className="text-purple-400">{"const "}</span>
                <span className="text-cyan-400">{"threshold "}</span>
                <span className="text-slate-300">{"= mean + "}</span>
                <span className="text-amber-400">{"2"}</span>
                <span className="text-slate-300">{" * stdDev;\n"}</span>
                <span className="text-purple-400">{"const "}</span>
                <span className="text-cyan-400">{"outliers "}</span>
                <span className="text-slate-300">{"= txns.filter(t => t.amount > "}</span>
                <span className="text-cyan-400">{"threshold"}</span>
                <span className="text-slate-300">{");\n"}</span>
              </code>
            </pre>
          </div>
          <p className="text-center text-sm text-slate-500 mt-4">
            Anomalies computed client-side from real transaction data. No external fraud service — pure statistical AI.
          </p>
        </div>
      </div>
    </section>
  );
}

// ============================================
// CASH FLOW FORECAST SECTION — "90-Day AI Forecast"
// ============================================

function CashFlowForecastSection() {
  const brand = useBrand();

  return (
    <section className="py-24 lg:py-32 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-emerald-600 font-medium text-sm uppercase tracking-wide mb-3">Predictive intelligence</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            90-Day Cash Flow Forecast
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Gemini 3 Flash with extended thinking (4,096-token budget) analyzes your transaction history,
            upcoming receivables, and vendor patterns to project cash flow with risk scoring.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Forecast periods mock */}
          {[
            { period: "Next 30 days", inflow: "$24,500", outflow: "$18,200", net: "+$6,300", confidence: 82, color: "#10B981" },
            { period: "30-60 days", inflow: "$19,800", outflow: "$21,100", net: "-$1,300", confidence: 68, color: "#F59E0B" },
            { period: "60-90 days", inflow: "$22,000", outflow: "$17,500", net: "+$4,500", confidence: 55, color: "#A855F7" },
          ].map((p) => (
            <div key={p.period} className="border border-slate-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-4">{p.period}</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Projected Inflow</span>
                  <span className="font-semibold text-emerald-600">{p.inflow}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Projected Outflow</span>
                  <span className="font-semibold text-red-500">{p.outflow}</span>
                </div>
                <div className="h-px bg-slate-200" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Net</span>
                  <span className={`text-xl font-bold ${p.net.startsWith("+") ? "text-emerald-600" : "text-red-500"}`}>
                    {p.net}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${p.confidence}%`, backgroundColor: p.color }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 font-medium">{p.confidence}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Data pipeline */}
        <div className="mt-12 grid lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              What feeds the forecast
            </h3>
            <div className="space-y-3">
              {[
                { label: "6 parallel Firestore queries", detail: "Accounts, transactions, invoices, bills, vendor_patterns, reconciliation_runs" },
                { label: "Monthly cash flow aggregation", detail: "Last 6 months of credits vs debits, computed client-side" },
                { label: "Upcoming receivables", detail: "All unpaid invoices with due dates and amounts" },
                { label: "Upcoming payables", detail: "All unpaid bills with vendor and due date" },
                { label: "AI match rate", detail: "Reconciliation quality score from latest run" },
                { label: "Vendor pattern count", detail: "Number of AI-learned patterns improves forecast accuracy" },
              ].map((item) => (
                <div key={item.label} className="flex gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gemini config snippet */}
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              Gemini 3 Configuration
            </h3>
            <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                <span className="ml-2 text-xs text-slate-500 font-mono">financial-chat.ts — cashFlowForecast</span>
              </div>
              <pre className="p-4 text-sm font-mono leading-relaxed overflow-x-auto">
                <code>
                  <span className="text-purple-400">{"const "}</span>
                  <span className="text-cyan-400">{"response "}</span>
                  <span className="text-slate-300">{"= "}</span>
                  <span className="text-purple-400">{"await "}</span>
                  <span className="text-cyan-400">{"ai"}</span>
                  <span className="text-slate-300">{"."}</span>
                  <span className="text-cyan-400">{"models"}</span>
                  <span className="text-slate-300">{"."}</span>
                  <span className="text-cyan-400">{"generateContent"}</span>
                  <span className="text-slate-300">{"({\n"}</span>
                  <span className="text-cyan-400">{"  model"}</span>
                  <span className="text-slate-300">{": "}</span>
                  <span className="text-emerald-400">{'"gemini-3-flash"'}</span>
                  <span className="text-slate-300">{",\n"}</span>
                  <span className="text-cyan-400">{"  config"}</span>
                  <span className="text-slate-300">{": {\n"}</span>
                  <span className="text-cyan-400">{"    temperature"}</span>
                  <span className="text-slate-300">{": "}</span>
                  <span className="text-amber-400">{"0.3"}</span>
                  <span className="text-slate-300">{",\n"}</span>
                  <span className="text-cyan-400">{"    responseMimeType"}</span>
                  <span className="text-slate-300">{": "}</span>
                  <span className="text-emerald-400">{'"application/json"'}</span>
                  <span className="text-slate-300">{",\n"}</span>
                  <span className="text-cyan-400">{"    thinkingConfig"}</span>
                  <span className="text-slate-300">{": {\n"}</span>
                  <span className="text-cyan-400">{"      thinkingBudget"}</span>
                  <span className="text-slate-300">{": "}</span>
                  <span className="text-amber-400">{"4096"}</span>
                  <span className="text-slate-300">{",\n"}</span>
                  <span className="text-slate-300">{"    },\n"}</span>
                  <span className="text-slate-300">{"  },\n"}</span>
                  <span className="text-slate-300">{"});\n"}</span>
                </code>
              </pre>
            </div>

            {/* Risk + Recommendations */}
            <div className="mt-6 space-y-3">
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-red-700">Risk Identification</p>
                  <p className="text-xs text-red-600">AI assigns severity (high/medium/low) and dollar impact to each risk factor</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-xl border border-purple-200">
                <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-purple-700">AI Recommendations</p>
                  <p className="text-xs text-purple-600">Actionable steps based on the analysis — chase invoices, reduce spending, build reserves</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// FINANCIAL CHAT SECTION — "Ask Your Books"
// ============================================

function FinancialChatSection() {
  const brand = useBrand();

  const chatTools = [
    { name: "queryFirestore", desc: "AI constructs arbitrary Firestore queries with filters, ordering, text search — across 11 collections", icon: Database },
    { name: "getFinancialOverview", desc: "Cross-collection aggregation: invoices, bills, accounts, reconciliation stats, vendor patterns", icon: BarChart3 },
    { name: "getCashFlowTrend", desc: "Monthly cash flow analysis with configurable lookback (up to 24 months)", icon: TrendingUp },
  ];

  return (
    <section className="py-24 lg:py-32 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-indigo-600 font-medium text-sm uppercase tracking-wide mb-3">Natural language queries</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            Ask Your Books Anything
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            An agentic AI assistant with direct database access. Gemini 3 constructs its own Firestore queries —
            no hardcoded searches. Up to 10 rounds of tool calls per conversation.
          </p>
        </div>

        {/* Tool cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {chatTools.map((tool) => (
            <div
              key={tool.name}
              className="p-6 bg-white rounded-2xl border border-slate-200 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <tool.icon className="w-5 h-5 text-indigo-600" />
                </div>
                <code className="text-sm font-mono font-semibold text-slate-900">{tool.name}</code>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{tool.desc}</p>
            </div>
          ))}
        </div>

        {/* Chat mockup */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
            {/* Chat header */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Financial AI Assistant</p>
                <p className="text-[10px] text-slate-400">Powered by Gemini 3 Flash · 3 tools · 11 collections</p>
              </div>
            </div>

            {/* Messages */}
            <div className="p-5 space-y-4">
              {/* User message */}
              <div className="flex justify-end">
                <div className="bg-indigo-600 text-white px-4 py-2.5 rounded-2xl rounded-br-sm max-w-sm">
                  <p className="text-sm">Which vendors have unpaid invoices over $5,000?</p>
                </div>
              </div>

              {/* Tool calls */}
              <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-xs font-mono">
                <div className="text-cyan-600 flex items-center gap-2">
                  <Search className="w-3 h-3" />
                  Querying invoices: paymentStatus == unpaid, total &gt; 5000
                </div>
                <div className="text-emerald-600 flex items-center gap-2">
                  <Database className="w-3 h-3" />
                  Found 4 results in invoices collection
                </div>
                <div className="text-cyan-600 flex items-center gap-2">
                  <Search className="w-3 h-3" />
                  Querying vendor_patterns for payment delay data
                </div>
                <div className="text-purple-600 flex items-center gap-2">
                  <Brain className="w-3 h-3" />
                  Complete — 2 queries, 2 rounds, 1.8s
                </div>
              </div>

              {/* AI response */}
              <div className="flex justify-start">
                <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm max-w-md">
                  <p className="text-sm text-slate-800 leading-relaxed">
                    I found <strong>4 unpaid invoices</strong> over $5,000:
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    <p>1. <strong>GlobalTech</strong> — $8,450 (15 days overdue)</p>
                    <p>2. <strong>Acme Corp</strong> — $6,200 (due in 5 days)</p>
                    <p>3. <strong>CloudSync Ltd</strong> — $5,890 (30 days overdue)</p>
                    <p>4. <strong>DataFlow Inc</strong> — $5,100 (due in 12 days)</p>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    CloudSync has a history of 30+ day delays per your vendor patterns.
                  </p>
                </div>
              </div>
            </div>

            {/* Input bar */}
            <div className="px-4 py-3 border-t border-slate-100">
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-2.5">
                <span className="text-sm text-slate-400 flex-1">Ask about your financial data...</span>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: brand.colors.primary }}
                >
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            Security whitelist: 11 Firestore collections. userId filter auto-applied. No raw database access exposed.
          </p>
        </div>
      </div>
    </section>
  );
}

// ============================================
// TESTIMONIALS SECTION
// ============================================

function TestimonialsSection() {
  const brand = useBrand();

  const testimonials = [
    {
      quote: `I manage books for 23 clients. Before ${brand.content.name}, I spent 2-3 hours per client on bank reconciliation. Now? 10 minutes. I've literally 10x'd my capacity without hiring.`,
      author: "Sarah Mitchell",
      role: "Bookkeeper, 23 clients",
      metric: "Saved 50+ hours/month",
      avatar: "/avatars/sarah.png",
    },
    {
      quote: `The Gemini AI understood our weird foreign bank formats that no other tool could handle. We tried 4 competitors before finding ${brand.content.name}. Nothing else came close.`,
      author: "Marcus Chen",
      role: "CFO, Import/Export Co",
      metric: "12 bank formats, 1 tool",
      avatar: "/avatars/marcus.png",
    },
    {
      quote: "Our month-end close went from 5 painful days to literally 1 day. The accuracy is insane - I've found maybe 3 errors in 6 months of processing thousands of transactions.",
      author: "Linda Park",
      role: "Controller, SaaS Startup",
      metric: "99.8% accuracy achieved",
      avatar: "/avatars/linda.png",
    },
  ];

  return (
    <section className="py-24 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            Loved by finance teams
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            See what our customers have to say about {brand.content.name}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.author}
              className="bg-slate-50 rounded-2xl p-8 shadow-sm border border-slate-200 relative"
            >
              <div
                className="absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: brand.colors.primary }}
              >
                {testimonial.metric}
              </div>

              <div className="flex gap-1 mb-4 mt-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                ))}
              </div>

              <p className="text-slate-700 leading-relaxed mb-6 text-sm">
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100">
                  <Image
                    src={testimonial.avatar}
                    alt={testimonial.author}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{testimonial.author}</p>
                  <p className="text-sm text-slate-500">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


// ============================================
// CTA SECTION
// ============================================

function CTASection() {
  const brand = useBrand();

  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${brand.colors.primary} 0%, ${brand.colors.primaryDark} 100%)`
        }}
      />

      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: "32px 32px"
        }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
          See the AI in action
        </h2>
        <p className="mt-6 text-lg text-white/80 max-w-2xl mx-auto">
          Try the live demo — upload a bank statement and watch the 3-tier engine
          match, reason, and learn in real time. No signup required.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/demo"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl bg-white text-slate-900 hover:bg-slate-100 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            <Sparkles className="w-5 h-5" />
            Try Live Demo
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all"
          >
            Talk to Sales
          </Link>
        </div>

        <p className="mt-6 text-white/60 text-sm">
          No credit card required · 14-day free trial · Cancel anytime
        </p>
      </div>
    </section>
  );
}

// ============================================
// LANDING PAGE
// ============================================

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <StatsBarSection />
      <ProblemSection />
      <PipelineSection />
      <ThreeTierSection />
      <AgentToolsSection />
      <StreamingSection />
      <ScoringSection />
      <PatternMemorySection />
      <AnomalyDetectionSection />
      <CashFlowForecastSection />
      <FinancialChatSection />
      <TestimonialsSection />
      <CTASection />
    </>
  );
}
