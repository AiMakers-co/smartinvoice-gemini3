"use client";

import Link from "next/link";
import Image from "next/image";
import { 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  Shield, 
  Clock, 
  BarChart3,
  FileText,
  Building2,
  Sparkles,
  Users,
  Star,
  ChevronRight,
  Frown,
  Search,
  Receipt,
} from "lucide-react";
import { useBrand } from "@/hooks/use-brand";

// ============================================
// HERO SECTION
// ============================================

function HeroSection() {
  const brand = useBrand();

  return (
    <section className="relative bg-slate-900 overflow-hidden">
      {/* Subtle gradient overlay */}
      <div 
        className="absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${brand.colors.primary}30, transparent)`
        }}
        />

      {/* Content */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 lg:pt-40 lg:pb-32">
        {/* Centered text content */}
        <div className="text-center max-w-4xl mx-auto">
            {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.15] tracking-tight">
            Extract bank statement data
              <br />
            <span className="text-slate-400">in seconds, not hours</span>
            </h1>

            {/* Subheadline */}
          <p className="mt-6 text-lg sm:text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Upload any PDF, CSV, or scanned statement. AI extracts every transaction 
            with 99.2% accuracy. Export to Excel, QuickBooks, Xero, or any format.
            </p>

            {/* CTAs */}
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

          {/* Trust line */}
          <p className="mt-8 text-sm text-slate-500">
            14-day free trial · No credit card required · Cancel anytime
          </p>
          </div>

        {/* Product screenshot */}
        <div className="mt-16 lg:mt-20">
          <div className="relative max-w-5xl mx-auto">
            {/* Screenshot with subtle shadow */}
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

            {/* Gradient fade at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// STATS BAR SECTION (replaces fake logos)
// ============================================

function StatsBarSection() {
  const brand = useBrand();
  
  return (
    <section className="py-12 bg-slate-50 border-y border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-3xl sm:text-4xl font-bold" style={{ color: brand.colors.primary }}>50M+</p>
            <p className="text-sm text-slate-500 mt-1">Pages processed</p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-bold" style={{ color: brand.colors.primary }}>1,000+</p>
            <p className="text-sm text-slate-500 mt-1">Happy accountants</p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-bold" style={{ color: brand.colors.primary }}>10,000+</p>
            <p className="text-sm text-slate-500 mt-1">Bank formats supported</p>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-bold" style={{ color: brand.colors.primary }}>99.2%</p>
            <p className="text-sm text-slate-500 mt-1">Extraction accuracy</p>
            </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// FEATURES SECTION
// ============================================

function FeaturesSection() {
  const brand = useBrand();

  const features = [
    {
      icon: Sparkles,
      title: "Gemini 3 Flash AI",
      description: "Google's latest multimodal AI extracts data from any document format with 99.2% accuracy. Faster and smarter than GPT-4.",
      color: brand.colors.primary,
    },
    {
      icon: FileText,
      title: "Any Format, Any Bank",
      description: "PDF, scanned images, CSV, Excel - our AI handles it all. Support for 10,000+ bank statement formats worldwide.",
      color: "#10B981",
    },
    {
      icon: Receipt,
      title: "Smart Categorization",
      description: "AI-powered transaction categorization learns your business rules. 95%+ accuracy out of the box, improving over time.",
      color: "#8B5CF6",
    },
    {
      icon: BarChart3,
      title: "Instant Insights",
      description: "Cash flow analysis, spending trends, and anomaly detection - all generated automatically from your statements.",
      color: "#F59E0B",
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "SOC 2 Type II compliant. AES-256 encryption. GDPR ready. Your financial data is protected by bank-grade security.",
      color: "#EF4444",
    },
    {
      icon: Clock,
      title: "2 Seconds Per Page",
      description: "Process a 50-page statement in under 2 minutes. What took hours of manual entry now takes seconds.",
      color: "#06B6D4",
    },
  ];

  return (
    <section className="py-24 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16 lg:mb-20">
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
            style={{ backgroundColor: `${brand.colors.primary}10`, color: brand.colors.primary }}
          >
            <Zap className="w-4 h-4" />
            Powerful Features
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            Everything you need to
            <br />
            <span style={{ color: brand.colors.primary }}>automate finance</span>
          </h2>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed">
            From document upload to reconciliation, {brand.content.name} handles the entire workflow 
            so your team can focus on strategic decisions.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={feature.title}
              className="group relative p-8 rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 hover:shadow-xl transition-all duration-300"
            >
              {/* Icon */}
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${feature.color}15` }}
              >
                <feature.icon className="w-7 h-7" style={{ color: feature.color }} />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {feature.description}
              </p>

              {/* Learn more link */}
              <div className="mt-6 flex items-center gap-2 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: feature.color }}>
                Learn more
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


// ============================================
// HOW IT WORKS SECTION
// ============================================

function HowItWorksSection() {
  const brand = useBrand();

  const steps = [
    {
      number: "1",
      title: "Upload any document",
      description: "Drag and drop bank statements or invoices. PDF, Excel, CSV, scanned images—even photos of paper documents.",
      icon: FileText,
      color: brand.colors.primary,
    },
    {
      number: "2",
      title: "AI extracts the data",
      description: "Gemini 3 Flash identifies every transaction, line item, date, and amount with 99.2% accuracy in under 2 seconds per page.",
      icon: Sparkles,
      color: "#8B5CF6",
    },
    {
      number: "3",
      title: "Export and use",
      description: "Download clean data in Excel, CSV, or custom formats. Ready for Xero, QuickBooks, Sage, or any accounting software.",
      icon: BarChart3,
      color: "#10B981",
    },
  ];

  return (
    <section className="py-24 lg:py-32 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            How it works
          </h2>
          <p className="mt-4 text-xl text-slate-600 max-w-2xl mx-auto">
            From document to data in three simple steps
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-[60%] w-[80%] h-0.5 bg-slate-200" />
              )}
              
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative">
                {/* Step number */}
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold text-white mb-6"
                  style={{ backgroundColor: step.color }}
                >
                  {step.number}
            </div>
            
                {/* Icon */}
                <div 
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${step.color}15` }}
                >
                  <step.icon className="w-7 h-7" style={{ color: step.color }} />
            </div>
            
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{step.title}</h3>
                <p className="text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Supported formats */}
        <div className="mt-16 text-center">
          <p className="text-slate-500 mb-4">Works with any document type</p>
          <div className="flex flex-wrap justify-center gap-3">
            {["Bank Statements", "Invoices", "Bills", "Receipts", "Credit Card Statements"].map((type) => (
              <span 
                key={type}
                className="px-4 py-2 bg-white rounded-full text-sm font-medium text-slate-700 border border-slate-200"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// PROBLEM SECTION - Pain Points
// ============================================

function ProblemSection() {
  const brand = useBrand();

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
            "I used to spend 15+ hours every month just entering bank data. Now it takes 15 minutes."
          </p>
          <p className="text-sm text-slate-400 mt-2">— Sarah M., Bookkeeper</p>
        </div>
      </div>
    </section>
  );
}

// ============================================
// TRUST BADGES SECTION
// ============================================

function TrustSection() {
  const brand = useBrand();

  const badges = [
    { label: "SOC 2 Type II", desc: "Certified" },
    { label: "GDPR", desc: "Compliant" },
    { label: "256-bit", desc: "Encryption" },
    { label: "99.9%", desc: "Uptime SLA" },
  ];

  return (
    <section className="py-12 bg-slate-50 border-y border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-16">
          {badges.map((badge, i) => (
            <div key={i} className="flex items-center gap-3">
              <Shield className="w-8 h-8" style={{ color: brand.colors.primary }} />
              <div>
                <p className="font-bold text-slate-900">{badge.label}</p>
                <p className="text-sm text-slate-500">{badge.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================
// USE CASES SECTION - Who Is This For
// ============================================

function UseCasesSection() {
  const brand = useBrand();

  const useCases = [
    {
      title: "Accountants & Bookkeepers",
      description: "Process client bank statements in bulk. Spend less time on data entry, more time on advisory services.",
      benefit: "Save 15+ hours per client, per month",
      icon: Users,
    },
    {
      title: "Small Business Owners",
      description: "Finally understand your cash flow without hiring a bookkeeper. Upload statements, get instant categorized reports.",
      benefit: "DIY bookkeeping in minutes, not hours",
      icon: Building2,
    },
    {
      title: "Finance Teams & CFOs",
      description: "Consolidate multi-entity, multi-bank data into one dashboard. Real-time visibility across all accounts.",
      benefit: "Close books 4x faster each month",
      icon: BarChart3,
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Built for people who hate data entry
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            (That's pretty much everyone, right?)
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {useCases.map((useCase, i) => (
            <div key={i} className="bg-slate-50 rounded-2xl p-8">
              <useCase.icon className="w-10 h-10 mb-4" style={{ color: brand.colors.primary }} />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">{useCase.title}</h3>
              <p className="text-slate-600 mb-4">{useCase.description}</p>
              <p 
                className="text-sm font-semibold"
                style={{ color: brand.colors.primary }}
              >
                ✓ {useCase.benefit}
              </p>
            </div>
          ))}
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
    <section className="py-24 lg:py-32 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
            Loved by finance teams
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            See what our customers have to say about {brand.content.name}
          </p>
        </div>

        {/* Testimonials grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <div 
              key={testimonial.author}
              className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 relative"
            >
              {/* Metric badge */}
              <div 
                className="absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: brand.colors.primary }}
              >
                {testimonial.metric}
              </div>

              {/* Stars */}
              <div className="flex gap-1 mb-4 mt-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-slate-700 leading-relaxed mb-6 text-sm">
                "{testimonial.quote}"
              </p>

              {/* Author */}
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
      {/* Background */}
      <div 
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${brand.colors.primary} 0%, ${brand.colors.primaryDark} 100%)`
        }}
      />
      
      {/* Pattern overlay */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: "32px 32px"
        }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
          Stop wasting time on
          <br />
          manual data entry
        </h2>
        <p className="mt-6 text-lg text-white/80 max-w-2xl mx-auto">
          Join 1,000+ accountants who've reclaimed 15+ hours every month. Start your 14-day free trial—no credit card required.
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
      <FeaturesSection />
      <TrustSection />
      <HowItWorksSection />
      <UseCasesSection />
      <TestimonialsSection />
      <CTASection />
    </>
  );
}

