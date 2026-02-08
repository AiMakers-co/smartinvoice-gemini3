"use client";

import Link from "next/link";
import Image from "next/image";
import { 
  ArrowRight,
  FileText,
  Zap,
  Shield,
  BarChart3,
  Building2,
  Receipt,
  Globe,
  Users,
  Lock,
  RefreshCw,
  CheckCircle2,
  Brain,
  Layers,
  Target,
  TrendingUp,
} from "lucide-react";
import { useBrand } from "@/hooks/use-brand";

// ============================================
// FEATURES DATA
// ============================================

const mainFeatures = [
  {
    icon: Brain,
    title: "Gemini 3 Flash AI Engine",
    description: "Powered by Google's latest multimodal AI. Gemini 3 Flash understands documents like a human, extracting transactions with 99.2% accuracy in under 2 seconds per page.",
    highlights: [
      "Google's most advanced document AI",
      "3x faster than GPT-4 Vision",
      "Native PDF & image understanding",
      "Continuous learning from corrections",
    ],
    screenshot: "/screenshots/15-statements-list.png",
  },
  {
    icon: Layers,
    title: "Smart Categorization",
    description: "Automatically categorize transactions based on vendor names, amounts, and patterns. Customize rules to match your chart of accounts.",
    highlights: [
      "95%+ accuracy out of the box",
      "Custom category mapping",
      "Rule-based overrides",
      "Learns your preferences",
    ],
    screenshot: "/screenshots/13-transactions-list.png",
  },
  {
    icon: RefreshCw,
    title: "Auto-Reconciliation",
    description: "Match bank transactions with invoices and receipts automatically. Spot discrepancies instantly and close books faster.",
    highlights: [
      "Smart matching algorithms",
      "Duplicate detection",
      "Exception flagging",
      "Audit trail included",
    ],
    screenshot: "/screenshots/11-accounts-list.png",
  },
];

const allFeatures = [
  {
    icon: FileText,
    title: "Document Processing",
    description: "Upload bank statements in any format. Our AI handles PDFs, images, CSVs, and Excel files.",
  },
  {
    icon: Building2,
    title: "Multi-Bank Support",
    description: "Connect unlimited bank accounts from 10,000+ financial institutions worldwide.",
  },
  {
    icon: Globe,
    title: "Multi-Currency",
    description: "Process statements in any currency with automatic conversion and reporting.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Invite team members with role-based permissions. Everyone sees what they need.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Dashboards",
    description: "Live insights into cash flow, spending patterns, and financial health.",
  },
  {
    icon: Shield,
    title: "Bank-Grade Security",
    description: "256-bit encryption, SOC 2 compliance, and full audit trails for every action.",
  },
  {
    icon: Target,
    title: "Custom Rules",
    description: "Create rules to automatically categorize, flag, or route transactions.",
  },
  {
    icon: TrendingUp,
    title: "Trend Analysis",
    description: "Spot patterns in your data with AI-powered anomaly detection and forecasting.",
  },
  {
    icon: Lock,
    title: "Access Controls",
    description: "Fine-grained permissions ensure the right people see the right data.",
  },
  {
    icon: Receipt,
    title: "Invoice Matching",
    description: "Automatically match bank transactions with invoices and purchase orders.",
  },
];

// ============================================
// FEATURES PAGE
// ============================================

export default function FeaturesPage() {
  const brand = useBrand();

  return (
    <div className="bg-white">
      {/* Hero Section with Header Image */}
      <section className="relative pt-20 overflow-hidden">
        {/* Header Image */}
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
                Platform Capabilities
              </p>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]">
                Enterprise-grade document processing
              </h1>
              
              <p className="mt-6 text-xl text-slate-300 leading-relaxed max-w-2xl">
                Automate bank statement extraction with AI that understands financial documents. 
                Process any format, export to any system.
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

      {/* Main Features - Detailed */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Core capabilities
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Three powerful features that transform how you handle financial documents
            </p>
          </div>

          <div className="space-y-24">
            {mainFeatures.map((feature, index) => (
              <div 
                key={feature.title}
                className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
                  index % 2 === 1 ? "lg:flex-row-reverse" : ""
                }`}
              >
                {/* Content */}
                <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                    style={{ backgroundColor: `${brand.colors.primary}15` }}
                  >
                    <feature.icon className="w-8 h-8" style={{ color: brand.colors.primary }} />
                  </div>
                  
                  <h3 className="text-3xl font-bold text-slate-900 mb-4">
                    {feature.title}
                  </h3>
                  
                  <p className="text-lg text-slate-600 leading-relaxed mb-8">
                    {feature.description}
                  </p>

                  <ul className="space-y-3">
                    {feature.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        <span className="text-slate-700">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual */}
                <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                  <div 
                    className="rounded-2xl p-4 lg:p-8"
                    style={{ backgroundColor: `${brand.colors.primary}08` }}
                  >
                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                      <div className="h-8 bg-slate-100 border-b flex items-center gap-2 px-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      </div>
                      <Image
                        src={feature.screenshot}
                        alt={feature.title}
                        width={1920}
                        height={1080}
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All Features Grid */}
      <section className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Everything you need
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              A comprehensive suite of tools to manage your financial workflows
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {allFeatures.map((feature) => (
              <div 
                key={feature.title}
                className="p-6 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all group"
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: `${brand.colors.primary}10` }}
                >
                  <feature.icon className="w-6 h-6" style={{ color: brand.colors.primary }} />
                </div>
                
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                
                <p className="text-slate-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Export Formats Section */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Export to any accounting system
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Once your data is extracted, export it in the exact format your software needs. 
              No manual reformatting required.
            </p>
          </div>

          {/* Export Format Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {/* Standard Formats */}
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
                style={{ backgroundColor: `${brand.colors.primary}15` }}
              >
                <FileText className="w-7 h-7" style={{ color: brand.colors.primary }} />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Standard Formats
              </h3>
              <p className="text-slate-600 mb-6">
                Ready-to-use templates for common accounting software and spreadsheets.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Excel (.xlsx)", "CSV", "JSON", "PDF Report"].map((format) => (
                  <span 
                    key={format}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700"
                  >
                    {format}
                  </span>
                ))}
              </div>
            </div>

            {/* Accounting Software */}
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
                style={{ backgroundColor: "#10B98115" }}
              >
                <BarChart3 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Accounting Software
              </h3>
              <p className="text-slate-600 mb-6">
                Pre-configured formats that import directly into your accounting platform.
              </p>
              <div className="flex flex-wrap gap-2">
                {["QuickBooks", "Xero", "Sage", "FreshBooks"].map((format) => (
                  <span 
                    key={format}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700"
                  >
                    {format}
                  </span>
                ))}
              </div>
            </div>

            {/* Custom Templates */}
            <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
                style={{ backgroundColor: "#8B5CF615" }}
              >
                <Target className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Custom Templates
              </h3>
              <p className="text-slate-600 mb-6">
                Create your own export format with custom columns, date formats, and field mapping.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Custom CSV", "API/JSON", "Bank Format"].map((format) => (
                  <span 
                    key={format}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700"
                  >
                    {format}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* How It Works - Simple Flow */}
          <div className="bg-slate-900 rounded-2xl p-8 lg:p-12">
            <h3 className="text-xl font-semibold text-white mb-8 text-center">
              How export works
            </h3>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: "Process your statement",
                  description: "Upload bank statement PDF. AI extracts all transactions automatically.",
                },
                {
                  step: "2", 
                  title: "Choose your format",
                  description: "Select from preset templates or create a custom export format.",
                },
                {
                  step: "3",
                  title: "Download & import",
                  description: "Get your file instantly. Import directly into your accounting software.",
                },
              ].map((item, index) => (
                <div key={item.step} className="relative">
                  <div className="flex items-center gap-4 mb-4">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{ backgroundColor: brand.colors.primary, color: "white" }}
                    >
                      {item.step}
                    </div>
                    {index < 2 && (
                      <div className="hidden md:block flex-1 h-px bg-slate-700" />
                    )}
                  </div>
                  <h4 className="text-white font-semibold mb-2">{item.title}</h4>
                  <p className="text-slate-400 text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section 
        className="py-20 lg:py-28"
        style={{ backgroundColor: brand.colors.sidebar }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-sm font-medium text-white mb-6">
                <Shield className="w-4 h-4" />
                Enterprise Security
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                Your data, protected
              </h2>
              
              <p className="text-lg text-white/70 leading-relaxed mb-8">
                We take security seriously. {brand.content.name} is built with enterprise-grade 
                security features to keep your financial data safe.
              </p>

              <div className="grid sm:grid-cols-2 gap-6">
                {[
                  { title: "SOC 2 Type II", desc: "Certified compliant" },
                  { title: "256-bit Encryption", desc: "At rest and in transit" },
                  { title: "99.9% Uptime", desc: "SLA guaranteed" },
                  { title: "GDPR Compliant", desc: "Full data control" },
                ].map((item) => (
                  <div key={item.title} className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                    <p className="text-white/60 text-sm">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="w-64 h-64 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <Shield className="w-32 h-32 text-white/20" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Ready to transform your workflows?
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
    </div>
  );
}

