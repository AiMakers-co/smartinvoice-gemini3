"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  FileText,
  Shield,
  BarChart3,
  Brain,
  Target,
  Cpu,
  Eye,
  Code2,
  Wrench,
  Lightbulb,
  Search,
  GitMerge,
  DollarSign,
  Receipt,
  CreditCard,
  History,
  CheckCircle2,
  Zap,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  Database,
  Activity,
  Clock,
  Terminal,
} from "lucide-react";
import { useBrand } from "@/hooks/use-brand";

// ============================================
// FEATURES PAGE
// ============================================

export default function FeaturesPage() {
  const brand = useBrand();

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/headers/features-header.png"
            alt="Features"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-900/60" />
        </div>

        <div className="relative z-10 py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p
                className="text-sm font-semibold tracking-wide uppercase mb-4"
                style={{ color: brand.colors.primary }}
              >
                Technical Architecture
              </p>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]">
                Gemini 3 Flash with
                <br />
                agentic function calling
              </h1>

              <p className="mt-6 text-xl text-slate-300 leading-relaxed max-w-2xl">
                3-tier reconciliation with dynamic thinking levels, 8 investigation tools,
                streaming reasoning via Firestore, and pattern memory with Levenshtein fuzzy matching.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl bg-white text-slate-900 hover:bg-slate-100 transition-all"
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all backdrop-blur-sm"
                >
                  View Pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Diagram Section */}
      <ArchitectureDiagramSection />

      {/* Gemini Deep Dive Section */}
      <GeminiDeepDiveSection />

      {/* Reconciliation Deep Dive Section */}
      <ReconciliationDeepDiveSection />

      {/* Tech Specs Section */}
      <TechSpecsSection />

      {/* Anomaly & Forecast Deep Dive */}
      <AnomalyForecastDeepDive />

      {/* Financial Chat Deep Dive */}
      <FinancialChatDeepDive />

      {/* Export Formats Section */}
      <ExportFormatsSection />

      {/* Security Section */}
      <SecuritySection />

      {/* CTA Section */}
      <CTASection />
    </div>
  );
}

// ============================================
// ARCHITECTURE DIAGRAM SECTION
// ============================================

function ArchitectureDiagramSection() {
  const brand = useBrand();

  return (
    <section className="py-20 lg:py-28 bg-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-purple-400 font-medium text-sm uppercase tracking-wide mb-3">Full stack</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">System Architecture</h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Next.js 14 frontend, Firebase Cloud Functions backend, Gemini 3 Flash AI,
            and Firestore for real-time streaming.
          </p>
        </div>

        {/* Architecture boxes */}
        <div className="space-y-3 font-mono text-sm">
          {/* Client layer */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5">
            <div className="text-indigo-400 font-semibold mb-2">Client</div>
            <div className="text-slate-300">
              Next.js 14 + React 19 + Firestore SDK + Tailwind CSS
            </div>
            <div className="text-slate-500 text-xs mt-1">
              Real-time onSnapshot listeners for streaming AI progress
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center">
              <div className="w-px h-4 bg-slate-600" />
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-600" />
            </div>
            <span className="text-xs text-slate-500 ml-3 self-center">Real-time listeners</span>
          </div>

          {/* Cloud Functions layer */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-5">
            <div className="text-purple-400 font-semibold mb-3">Firebase Cloud Functions (onCall)</div>
            <div className="grid md:grid-cols-3 gap-4">
              {/* Vision Pipeline */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-cyan-400 font-semibold text-xs mb-2">Vision Pipeline</div>
                <ul className="text-slate-400 text-xs space-y-1">
                  <li>PDF scan (inlineData)</li>
                  <li>CSV detection &amp; parsing</li>
                  <li>Template fingerprinting</li>
                  <li>responseMimeType: JSON</li>
                </ul>
              </div>
              {/* Reconciliation Engine */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-amber-400 font-semibold text-xs mb-2">Reconciliation Engine</div>
                <ul className="text-slate-400 text-xs space-y-1">
                  <li>Tier 1: Rule-based scan</li>
                  <li>Tier 2: thinking_level LOW</li>
                  <li>Tier 3: thinking_level HIGH</li>
                  <li>Pattern memory + learning</li>
                </ul>
              </div>
              {/* AI Assistant */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-emerald-400 font-semibold text-xs mb-2">AI Assistant</div>
                <ul className="text-slate-400 text-xs space-y-1">
                  <li>queryFirestore tool</li>
                  <li>getOverview / getCashFlow</li>
                  <li>90-day cash flow forecast</li>
                  <li>Natural language queries</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center">
              <div className="w-px h-4 bg-slate-600" />
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-600" />
            </div>
          </div>

          {/* Firestore layer */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
            <div className="text-emerald-400 font-semibold mb-2">Firestore</div>
            <div className="text-slate-300 text-xs">
              transactions, invoices, bills, vendor_patterns, match_history, fx_cache, reconciliation_runs
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center">
              <div className="w-px h-4 bg-slate-600" />
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-600" />
            </div>
          </div>

          {/* Streaming layer */}
          <div className="rounded-xl border border-pink-500/30 bg-pink-500/5 p-5">
            <div className="text-pink-400 font-semibold mb-2">ProgressStream</div>
            <div className="text-slate-300 text-xs">
              Firestore events → onSnapshot → Terminal UI with color-coded reasoning steps
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// GEMINI DEEP DIVE SECTION
// ============================================

function GeminiDeepDiveSection() {
  const features = [
    {
      icon: Eye,
      title: "Vision Processing",
      desc: "PDF pages sent as base64 to Gemini 3 Flash's multimodal input. Detects tables, headers, and transaction rows from any bank format.",
      code: `inlineData: {
  mimeType: "application/pdf",
  data: base64EncodedPDF
}`,
      color: "#6366F1",
    },
    {
      icon: Code2,
      title: "Structured Output",
      desc: "Guaranteed JSON responses — no regex parsing of AI text. Every extraction and reconciliation returns typed, validated data.",
      code: `config: {
  responseMimeType: "application/json",
  // Gemini returns valid JSON directly
}`,
      color: "#10B981",
    },
    {
      icon: Wrench,
      title: "Function Calling",
      desc: "8 tool declarations registered with Gemini. Manual calling loop processes tool calls until the AI is satisfied — up to 10 iterations.",
      code: `tools: [{
  functionDeclarations: [
    searchTransactions,
    findInvoiceCombination,
    getFXRate, // ... 8 tools total
  ]
}]`,
      color: "#F59E0B",
    },
    {
      icon: Brain,
      title: "Thinking Levels",
      desc: "Dynamic thinking budget per tier. LOW for batch matching (speed). HIGH for complex investigations (depth). No thinking for rule-based.",
      code: `thinkingConfig: {
  thinkingLevel: ThinkingLevel.HIGH
  // LOW for Tier 2, HIGH for Tier 3
}`,
      color: "#A855F7",
    },
  ];

  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-indigo-600 font-medium text-sm uppercase tracking-wide mb-3">Gemini 3 API</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            How We Use Gemini 3
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Four distinct Gemini 3 API features — Vision, Structured Output,
            Function Calling, and Thinking Levels — each serving a specific role.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${feature.color}15` }}
                  >
                    <feature.icon className="w-5 h-5" style={{ color: feature.color }} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{feature.title}</h3>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">{feature.desc}</p>
              </div>
              <div className="bg-slate-900 p-4">
                <pre className="text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto">
                  <code>{feature.code}</code>
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// RECONCILIATION DEEP DIVE SECTION
// ============================================

function ReconciliationDeepDiveSection() {
  const brand = useBrand();

  return (
    <section className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-purple-600 font-medium text-sm uppercase tracking-wide mb-3">Deep dive</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Reconciliation Engine
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Five scoring signals, fee detection, FX conversion, combined payments,
            and pattern memory — all in one engine.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Scoring formula */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              5-Signal Scoring Formula
            </h3>
            <div className="space-y-3 font-mono text-sm">
              {[
                { signal: "Reference Match", max: "/40", desc: "Invoice # found in description" },
                { signal: "Amount Match", max: "/35", desc: "Exact, FX-converted, or fee-adjusted" },
                { signal: "Identity Match", max: "/25", desc: "Vendor name fuzzy match (Levenshtein)" },
                { signal: "Time Proximity", max: "/20", desc: "Days between invoice and payment" },
                { signal: "Context", max: "/5", desc: "Unique amount, cross-currency bonus" },
              ].map((s) => (
                <div key={s.signal} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <span className="text-slate-900 font-semibold">{s.signal}</span>
                    <span className="text-slate-400 ml-1">{s.max}</span>
                  </div>
                  <span className="text-slate-500 text-xs">{s.desc}</span>
                </div>
              ))}
              <div className="pt-2 text-slate-700">
                Total: /125 → normalized to 0-100% confidence
              </div>
            </div>
          </div>

          {/* Fee patterns + FX */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-600" />
                Fee Pattern Detection
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: "Stripe", rate: "2.9% + $0.30" },
                  { name: "PayPal", rate: "2.9% + $0.30" },
                  { name: "Square", rate: "2.6% + $0.10" },
                  { name: "Wise", rate: "1%" },
                  { name: "Card", rate: "3%" },
                ].map((fee) => (
                  <div key={fee.name} className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-mono">
                    <span className="text-slate-900 font-semibold">{fee.name}</span>
                    <span className="text-slate-500 ml-2">{fee.rate}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                When a transaction amount doesn&apos;t match exactly, the engine checks if it matches after subtracting known processor fees.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Multi-Currency FX
              </h3>
              <ul className="text-sm text-slate-600 space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>40+ currency pairs with 3-tier fallback: Live API → Firestore cache → hardcoded rates</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Pegged currency detection — ANG, AWG, XCG treated as equivalent</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Cross-currency via USD pivot when direct rate unavailable</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>FX tolerance: 2% for rounding, 5% for rate variance, 10% for fluctuation</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Combined payments */}
        <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-8">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-indigo-600" />
                Combined Payment Detection
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                When one transaction pays multiple invoices, the engine runs subset-sum with
                early termination to find document combinations that match the payment amount.
              </p>
              <ul className="text-sm text-slate-600 space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <span>Max 5 documents per combination (configurable)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <span>Groups by counterparty first (most likely), then cross-vendor</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <span>Early termination after 3 matches found</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <span>2% tolerance for rounding differences</span>
                </li>
              </ul>
            </div>
            <div className="bg-slate-900 rounded-xl p-5">
              <pre className="text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto">
                <code>
                  <span className="text-slate-500">{"// Subset-sum with early termination\n"}</span>
                  <span className="text-purple-400">{"function "}</span>
                  <span className="text-cyan-400">{"findCombination"}</span>
                  <span className="text-slate-300">{"(\n"}</span>
                  <span className="text-slate-300">{"  docs, targetAmount, tolerance,\n"}</span>
                  <span className="text-slate-300">{"  onFound, "}</span>
                  <span className="text-cyan-400">{"maxDocs"}</span>
                  <span className="text-slate-300">{" = "}</span>
                  <span className="text-amber-400">{"5"}</span>
                  <span className="text-slate-300">{"\n) {\n"}</span>
                  <span className="text-slate-300">{"  "}</span>
                  <span className="text-purple-400">{"const "}</span>
                  <span className="text-cyan-400">{"recurse "}</span>
                  <span className="text-slate-300">{"= (startIdx, current, sum) => {\n"}</span>
                  <span className="text-slate-300">{"    "}</span>
                  <span className="text-purple-400">{"if "}</span>
                  <span className="text-slate-300">{"(found >= "}</span>
                  <span className="text-amber-400">{"3"}</span>
                  <span className="text-slate-300">{") "}</span>
                  <span className="text-purple-400">{"return"}</span>
                  <span className="text-slate-300">{"; "}</span>
                  <span className="text-slate-500">{"// early termination\n"}</span>
                  <span className="text-slate-300">{"    "}</span>
                  <span className="text-purple-400">{"if "}</span>
                  <span className="text-slate-300">{"(sum > target + tol) "}</span>
                  <span className="text-purple-400">{"return"}</span>
                  <span className="text-slate-300">{"; "}</span>
                  <span className="text-slate-500">{"// prune\n"}</span>
                  <span className="text-slate-300">{"    "}</span>
                  <span className="text-purple-400">{"if "}</span>
                  <span className="text-slate-300">{"(current.length >= 2 && diff <= tol)\n"}</span>
                  <span className="text-slate-300">{"      onFound(current, sum);\n"}</span>
                  <span className="text-slate-300">{"  };\n"}</span>
                  <span className="text-slate-300">{"}\n"}</span>
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
// TECH SPECS SECTION
// ============================================

function TechSpecsSection() {
  const specs = [
    { label: "AI Model", value: "Gemini 3 Flash" },
    { label: "Thinking Levels", value: "LOW (batch) / HIGH (investigation)" },
    { label: "Agent Tools", value: "8 function-calling tools" },
    { label: "Max Iterations", value: "10 per investigation" },
    { label: "Batch Size", value: "10 txns, 4 concurrent batches" },
    { label: "FX Currencies", value: "40+ pairs, 3-tier fallback" },
    { label: "Fee Patterns", value: "Stripe, PayPal, Square, Wise, Card" },
    { label: "Fuzzy Matching", value: "Levenshtein distance, 0.7 threshold" },
    { label: "Auto-Confirm", value: "93%+ confidence" },
    { label: "Streaming", value: "Real-time Firestore ProgressStream" },
    { label: "Time Budget", value: "4 min/batch with graceful degradation" },
    { label: "Combined Payments", value: "Subset-sum, max 5 docs, early termination" },
    { label: "Cash Flow Forecast", value: "90-day, 3 periods, 4096-token thinking budget" },
    { label: "Anomaly Detection", value: "2σ outliers, slow payers, FX exposure, match rate" },
    { label: "Chat Agent", value: "Dynamic queryFirestore + 11 collections + 10 rounds" },
    { label: "Chat Thinking", value: "2048-token budget, 90s timeout, 20-msg history" },
  ];

  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-slate-500 font-medium text-sm uppercase tracking-wide mb-3">Specifications</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Technical Specifications</h2>
        </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {specs.map((spec, i) => (
                <tr key={spec.label} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-6 py-4 font-semibold text-slate-900 w-1/3">{spec.label}</td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">{spec.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ============================================
// ANOMALY & FORECAST DEEP DIVE SECTION
// ============================================

function AnomalyForecastDeepDive() {
  return (
    <section className="py-20 lg:py-28 bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-red-400 font-medium text-sm uppercase tracking-wide mb-3">Intelligence layer</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Anomaly Detection & Cash Flow Forecast
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Beyond reconciliation — statistical analysis, risk scoring, and predictive forecasting
            powered by Gemini 3 extended thinking.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Anomaly Detection */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Anomaly Detection</h3>
            </div>

            <div className="space-y-4">
              {[
                {
                  title: "Statistical Outliers (2σ)",
                  desc: "Debit amounts exceeding mean + 2 standard deviations flagged automatically. Runs on every transaction set.",
                  color: "text-red-400",
                },
                {
                  title: "Slow Payer Identification",
                  desc: "Vendors with 30+ day delays detected from AI-learned vendor_patterns. Surfaces cash flow risks.",
                  color: "text-amber-400",
                },
                {
                  title: "Low Match Rate Alerts",
                  desc: ">20% unreconciled transactions triggers high-priority alert. Uses latest reconciliation_run data.",
                  color: "text-red-400",
                },
                {
                  title: "FX Exposure Detection",
                  desc: "Cross-currency matches flagged for rate variance review. Detects when txn.currency ≠ doc.currency.",
                  color: "text-indigo-400",
                },
                {
                  title: "Spending Trend Analysis",
                  desc: "Monthly debit comparison: >10% increase = trending up, >10% decrease = trending down.",
                  color: "text-slate-400",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${item.color.replace("text-", "bg-")}`} />
                  <div>
                    <p className={`text-sm font-semibold ${item.color}`}>{item.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 bg-slate-950 rounded-xl p-4">
              <pre className="text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto">
                <code>
                  <span className="text-slate-500">{"// insights/page.tsx — computed on real data\n"}</span>
                  <span className="text-purple-400">{"const "}</span>
                  <span className="text-cyan-400">{"anomalies"}</span>
                  <span className="text-slate-300">{": { type, severity, description }[] = [];\n"}</span>
                  <span className="text-slate-500">{"// Statistical outlier detection\n"}</span>
                  <span className="text-purple-400">{"if "}</span>
                  <span className="text-slate-300">{"(amount > mean + 2 * stdDev) "}</span>
                  <span className="text-cyan-400">{"anomalies"}</span>
                  <span className="text-slate-300">{".push(...);\n"}</span>
                  <span className="text-slate-500">{"// Slow payer from vendor_patterns\n"}</span>
                  <span className="text-purple-400">{"if "}</span>
                  <span className="text-slate-300">{"(p.typicalDelay.max > "}</span>
                  <span className="text-amber-400">{"30"}</span>
                  <span className="text-slate-300">{") "}</span>
                  <span className="text-cyan-400">{"anomalies"}</span>
                  <span className="text-slate-300">{".push(...);\n"}</span>
                </code>
              </pre>
            </div>
          </div>

          {/* Cash Flow Forecast */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white">90-Day Cash Flow Forecast</h3>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-emerald-400 mb-2">Data Collection (6 parallel queries)</p>
                <div className="grid grid-cols-2 gap-2">
                  {["accounts", "transactions (100)", "invoices", "bills", "vendor_patterns", "reconciliation_runs (3)"].map((col) => (
                    <div key={col} className="text-xs font-mono text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg">
                      {col}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-amber-400 mb-2">Gemini 3 Flash Configuration</p>
                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>Model</span>
                    <span className="font-mono text-slate-300">gemini-3-flash</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Temperature</span>
                    <span className="font-mono text-slate-300">0.3 (conservative)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Thinking Budget</span>
                    <span className="font-mono text-slate-300">4,096 tokens</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Response Format</span>
                    <span className="font-mono text-slate-300">application/json</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Output</span>
                    <span className="font-mono text-slate-300">4,096 tokens</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-purple-400 mb-2">Output Structure</p>
                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Activity className="w-3 h-3 text-emerald-400" />
                    <span><strong className="text-slate-300">3 forecast periods</strong> — 30/60/90 days with confidence scores</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    <span><strong className="text-slate-300">Risk factors</strong> — severity + estimated dollar impact</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-3 h-3 text-amber-400" />
                    <span><strong className="text-slate-300">AI recommendations</strong> — actionable next steps</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Brain className="w-3 h-3 text-purple-400" />
                    <span><strong className="text-slate-300">Reasoning</strong> — 2-3 paragraph methodology explanation</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-cyan-400 mb-2">Thinking Animation (7 steps)</p>
                <div className="bg-slate-950 rounded-lg p-3 font-mono text-[10px] space-y-0.5">
                  <p className="text-emerald-400">&#10003; Analyzing historical transaction patterns...</p>
                  <p className="text-emerald-400">&#10003; Scanning upcoming receivables and payables...</p>
                  <p className="text-emerald-400">&#10003; Detecting seasonal spending trends...</p>
                  <p className="text-emerald-400">&#10003; Computing projected inflows from unpaid invoices...</p>
                  <p className="text-emerald-400">&#10003; Estimating recurring expense patterns...</p>
                  <p className="text-emerald-400">&#10003; Assessing cash flow risk factors...</p>
                  <p className="text-purple-400">&#9679; Generating 90-day forecast with Gemini 3...</p>
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
// FINANCIAL CHAT DEEP DIVE SECTION
// ============================================

function FinancialChatDeepDive() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-indigo-600 font-medium text-sm uppercase tracking-wide mb-3">Agentic assistant</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Financial Chat — &ldquo;Ask Your Books&rdquo;
          </h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            An autonomous AI agent with direct Firestore access. Gemini 3 constructs its own queries
            from a full database schema — no hardcoded search functions.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Architecture */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              Dynamic Query Architecture
            </h3>

            <div className="space-y-4 mb-8">
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <p className="text-sm font-semibold text-indigo-600 mb-2">queryFirestore — The Primary Tool</p>
                <p className="text-xs text-slate-600 mb-3">
                  AI constructs arbitrary queries with filters, ordering, text search, and field selection.
                  userId filter auto-applied for security.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["collection", "filters[]", "orderBy", "orderDirection", "limit", "selectFields[]", "textSearch"].map((param) => (
                    <span key={param} className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                      {param}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <p className="text-sm font-semibold text-emerald-600 mb-2">Security Whitelist — 11 Collections</p>
                <div className="flex flex-wrap gap-1.5">
                  {["invoices", "bills", "transactions", "accounts", "statements", "reconciliation_matches", "vendor_patterns", "invoice_line_items", "reconciliation_runs", "match_history", "documents"].map((col) => (
                    <span key={col} className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <p className="text-sm font-semibold text-amber-600 mb-2">Agent Loop</p>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Max iterations</span>
                    <span className="font-mono text-slate-900">10 rounds</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Thinking budget</span>
                    <span className="font-mono text-slate-900">2,048 tokens</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Conversation history</span>
                    <span className="font-mono text-slate-900">Last 20 messages</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Timeout</span>
                    <span className="font-mono text-slate-900">90 seconds</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Real-time streaming */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-purple-600" />
              Real-Time Progress Streaming
            </h3>

            <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden mb-6">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                <span className="ml-2 text-xs text-slate-500 font-mono">chat_progress — live events</span>
              </div>
              <div className="p-4 font-mono text-xs leading-relaxed space-y-1">
                <p className="text-white font-semibold">{"> ANALYZING QUERY"}</p>
                <p className="text-slate-400">{"  Processing: \"Which vendors have unpaid invoices?\""}</p>
                <p className="text-white font-semibold">{"> QUERYING DATABASE"}</p>
                <p className="text-cyan-400">{"  Querying invoices: paymentStatus == unpaid"}</p>
                <p className="text-emerald-400">{"  Found 12 results in invoices collection"}</p>
                <p className="text-cyan-400">{"  Querying vendor_patterns: orderBy matchCount desc"}</p>
                <p className="text-emerald-400">{"  Loaded financial overview across all collections"}</p>
                <p className="text-slate-500">{"  AI analyzing results (round 2)..."}</p>
                <p className="text-white font-semibold">{"> GENERATING RESPONSE"}</p>
                <p className="text-emerald-400">{"  Complete — 3 queries, 2 rounds, 2.1s"}</p>
              </div>
            </div>

            {/* Code snippet */}
            <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                <span className="ml-2 text-xs text-slate-500 font-mono">financial-chat.ts — agentic loop</span>
              </div>
              <pre className="p-4 text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto">
                <code>
                  <span className="text-slate-500">{"// Manual function-calling loop\n"}</span>
                  <span className="text-purple-400">{"while "}</span>
                  <span className="text-slate-300">{"(response.functionCalls?.length > 0\n"}</span>
                  <span className="text-slate-300">{"  && iterations < "}</span>
                  <span className="text-amber-400">{"10"}</span>
                  <span className="text-slate-300">{") {\n"}</span>
                  <span className="text-slate-300">{"  "}</span>
                  <span className="text-purple-400">{"for "}</span>
                  <span className="text-slate-300">{"("}</span>
                  <span className="text-purple-400">{"const "}</span>
                  <span className="text-cyan-400">{"fc "}</span>
                  <span className="text-purple-400">{"of "}</span>
                  <span className="text-cyan-400">{"response"}</span>
                  <span className="text-slate-300">{".functionCalls) {\n"}</span>
                  <span className="text-slate-300">{"    "}</span>
                  <span className="text-purple-400">{"await "}</span>
                  <span className="text-cyan-400">{"writeProgressEvent"}</span>
                  <span className="text-slate-300">{"(...);\n"}</span>
                  <span className="text-slate-300">{"    result = "}</span>
                  <span className="text-purple-400">{"await "}</span>
                  <span className="text-cyan-400">{"executeTool"}</span>
                  <span className="text-slate-300">{"(fc.name, fc.args);\n"}</span>
                  <span className="text-slate-300">{"  }\n"}</span>
                  <span className="text-slate-300">{"  response = "}</span>
                  <span className="text-purple-400">{"await "}</span>
                  <span className="text-cyan-400">{"ai"}</span>
                  <span className="text-slate-300">{".models.generateContent(...);\n"}</span>
                  <span className="text-slate-300">{"}\n"}</span>
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
// EXPORT FORMATS SECTION (kept from original)
// ============================================

function ExportFormatsSection() {
  const brand = useBrand();

  return (
    <section className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Export to any accounting system
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Once your data is extracted, export it in the exact format your software needs.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl p-8 border border-slate-200">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
              style={{ backgroundColor: `${brand.colors.primary}15` }}
            >
              <FileText className="w-7 h-7" style={{ color: brand.colors.primary }} />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Standard Formats</h3>
            <p className="text-slate-600 mb-6">Ready-to-use templates for common accounting software.</p>
            <div className="flex flex-wrap gap-2">
              {["Excel (.xlsx)", "CSV", "JSON", "PDF Report"].map((format) => (
                <span key={format} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700">
                  {format}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 border border-slate-200">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-emerald-50">
              <BarChart3 className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Accounting Software</h3>
            <p className="text-slate-600 mb-6">Pre-configured formats that import directly.</p>
            <div className="flex flex-wrap gap-2">
              {["QuickBooks", "Xero", "Sage", "FreshBooks"].map((format) => (
                <span key={format} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700">
                  {format}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-8 border border-slate-200">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-purple-50">
              <Target className="w-7 h-7 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">Custom Templates</h3>
            <p className="text-slate-600 mb-6">Create your own export format with custom columns.</p>
            <div className="flex flex-wrap gap-2">
              {["Custom CSV", "API/JSON", "Bank Format"].map((format) => (
                <span key={format} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700">
                  {format}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// SECURITY SECTION (condensed)
// ============================================

function SecuritySection() {
  const brand = useBrand();

  return (
    <section className="py-16 bg-slate-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Enterprise Security</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "SOC 2 Type II", desc: "Certified compliant" },
            { title: "256-bit Encryption", desc: "At rest and in transit" },
            { title: "99.9% Uptime", desc: "SLA guaranteed" },
            { title: "GDPR Compliant", desc: "Full data control" },
          ].map((item) => (
            <div key={item.title} className="p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-white text-sm">{item.title}</h3>
              </div>
              <p className="text-white/60 text-xs">{item.desc}</p>
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
    <section className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
          Ready to see it work?
        </h2>
        <p className="mt-4 text-lg text-slate-600">
          Start your free 14-day trial today. No credit card required.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            style={{ backgroundColor: brand.colors.primary }}
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl bg-slate-100 text-slate-900 hover:bg-slate-200 transition-all"
          >
            Request Demo
          </Link>
        </div>
      </div>
    </section>
  );
}
