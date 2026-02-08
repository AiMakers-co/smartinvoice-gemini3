"use client";

import Link from "next/link";
import Image from "next/image";
import { 
  ArrowRight, 
  Code,
  Building2,
  ExternalLink,
  Check,
  Linkedin,
  Globe,
  Shield,
  Clock,
  Cpu,
  FileText,
  BarChart3,
  Lock,
} from "lucide-react";
import { useBrand } from "@/hooks/use-brand";

export default function AboutPage() {
  const brand = useBrand();

  return (
    <div className="bg-white">
      {/* Hero Section with Header Image */}
      <section className="relative pt-20 overflow-hidden">
        {/* Header Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/headers/about-header.png"
            alt="About"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/85 to-slate-900/70" />
            </div>
            
        <div className="relative z-10 py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p 
                className="text-sm font-semibold tracking-wide uppercase mb-4"
                style={{ color: brand.colors.primary }}
              >
                About {brand.content.name}
              </p>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]">
                Intelligent document processing for financial services
            </h1>
            
              <p className="mt-6 text-xl text-slate-300 leading-relaxed">
                {brand.content.name} automates bank statement data extraction using advanced AI, 
                enabling finance teams to process documents in seconds instead of hours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Metrics */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-200">
            {[
              { value: "99.7%", label: "Data Extraction Accuracy" },
              { value: "<5s", label: "Average Processing Time" },
              { value: "500+", label: "Bank Formats Supported" },
              { value: "99.9%", label: "Platform Uptime" },
            ].map((stat, i) => (
              <div key={i} className="py-8 lg:py-10 text-center">
                <div className="text-3xl lg:text-4xl font-bold text-slate-900">{stat.value}</div>
                <div className="mt-1 text-sm text-slate-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem & Solution */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-8">
                The Challenge
              </h2>
              <div className="space-y-5 text-lg text-slate-600 leading-relaxed">
                <p>
                  Financial institutions and accounting firms process thousands of bank 
                  statements monthly. Traditional methods require manual data entry—a 
                  process that is time-consuming, error-prone, and expensive.
                </p>
                <p className="text-xl text-slate-900 font-medium border-l-4 pl-6 py-2" style={{ borderColor: brand.colors.primary }}>
                  Industry research shows finance professionals spend an average of 
                  12 hours per week on manual document processing tasks.
                </p>
                <p>
                  Legacy OCR solutions require extensive configuration, struggle with 
                  varying document formats, and often achieve accuracy rates below 90%—
                  requiring significant manual verification.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-8">
                Our Solution
              </h2>
              <div className="space-y-5 text-lg text-slate-600 leading-relaxed">
                <p>
                  {brand.content.name} leverages Google's Gemini AI—the most advanced 
                  multimodal AI available—to understand document structure and context, 
                  not just recognize text.
                </p>
                <p>
                  The platform automatically identifies bank formats, extracts transaction 
                  data with field-level accuracy, and outputs structured data compatible 
                  with major accounting systems.
                </p>
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      "Universal bank format support",
                      "99.7% field-level accuracy", 
                      "Sub-5-second processing",
                      "Flexible export options",
                      "Enterprise security compliance",
                      "Volume-based pricing",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 flex-shrink-0" style={{ color: brand.colors.primary }} />
                        <span className="text-slate-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Screenshot */}
      <section className="pb-20 lg:pb-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-2xl shadow-slate-200/50">
            <div className="h-10 bg-slate-100 border-b border-slate-200 flex items-center gap-2 px-4">
              <div className="w-3 h-3 rounded-full bg-slate-300" />
              <div className="w-3 h-3 rounded-full bg-slate-300" />
              <div className="w-3 h-3 rounded-full bg-slate-300" />
              <div className="flex-1 mx-4">
                <div className="h-5 bg-slate-200 rounded-md max-w-xs mx-auto" />
              </div>
              </div>
              <Image
                src="/screenshots/10-dashboard.png"
              alt={`${brand.content.name} Platform`}
                width={1920}
                height={1080}
                className="w-full h-auto"
              priority
              />
          </div>
        </div>
      </section>

      {/* Key Capabilities */}
      <section className="py-20 lg:py-28 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Enterprise-Ready Capabilities
            </h2>
            <p className="text-lg text-slate-400">
              Built to meet the requirements of regulated financial services.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: FileText,
                title: "Intelligent Extraction",
                description: "Advanced AI understands document context to accurately extract transaction data, account details, and balances from any bank statement format.",
              },
              {
                icon: BarChart3,
                title: "Structured Output",
                description: "Export processed data in CSV, Excel, JSON, or integrate directly with accounting platforms via API. Custom templates available.",
              },
              {
                icon: Lock,
                title: "Security & Compliance",
                description: "SOC 2 Type II certified. All data encrypted in transit and at rest. GDPR compliant with configurable data retention policies.",
              },
            ].map((item, i) => (
              <div key={i} className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: `${brand.colors.primary}20` }}
                >
                  <item.icon className="w-6 h-6" style={{ color: brand.colors.primary }} />
              </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-slate-400 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">
                Technology Foundation
              </h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                {brand.content.name} is built on enterprise-grade infrastructure designed 
                for reliability, security, and scale.
              </p>

              <div className="space-y-4">
                {[
                  {
                    icon: Cpu,
                    title: "Google Gemini AI",
                    description: "State-of-the-art multimodal AI for document understanding",
                  },
                  {
                    icon: Shield,
                    title: "SOC 2 Type II Certified",
                    description: "Independently audited security controls and processes",
                  },
                  {
                    icon: Globe,
                    title: "Google Cloud Platform",
                    description: "Enterprise infrastructure with 99.99% uptime SLA",
                  },
                  {
                    icon: Clock,
                    title: "Real-Time Processing",
                    description: "Asynchronous architecture for high-volume workloads",
                  },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl hover:bg-slate-50 transition-colors">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${brand.colors.primary}10` }}
                    >
                      <item.icon className="w-5 h-5" style={{ color: brand.colors.primary }} />
            </div>
            <div>
                      <h3 className="font-semibold text-slate-900">{item.title}</h3>
                      <p className="text-sm text-slate-600">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 lg:p-12 border border-slate-200">
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-8">
                Infrastructure Partners
              </p>
              <div className="grid grid-cols-2 gap-8">
                {[
                  { name: "Google Cloud", sublabel: "Infrastructure" },
                  { name: "Gemini AI", sublabel: "Document Processing" },
                  { name: "Firebase", sublabel: "Database & Auth" },
                  { name: "Stripe", sublabel: "Payments" },
                ].map((tech, i) => (
                  <div key={i} className="text-center">
                    <div className="text-lg font-semibold text-slate-900">{tech.name}</div>
                    <div className="text-sm text-slate-500">{tech.sublabel}</div>
            </div>
                ))}
              </div>

              <div className="mt-10 pt-8 border-t border-slate-200">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">
                  Compliance & Security
                </p>
                <div className="flex flex-wrap gap-3">
                  {["SOC 2 Type II", "GDPR", "AES-256 Encryption", "ISO 27001"].map((badge, i) => (
                    <span 
                      key={i}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="py-20 lg:py-28 bg-slate-50 border-y border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: brand.colors.primary }}
            >
              <Code className="w-10 h-10 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Mark Austen
            </h2>
            <p className="text-slate-600 mb-8">
              Founder & Technical Lead
            </p>

            <div className="max-w-2xl mx-auto text-lg text-slate-600 leading-relaxed space-y-4">
              <p>
                Software engineer specializing in AI application development, with expertise 
                in Google Cloud AI, machine learning systems, and enterprise SaaS architecture.
              </p>
              <p>
                Founder of <a href="https://www.aimakers.co" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: brand.colors.primary }}>AI Makers</a>, 
                a consultancy delivering custom AI solutions and technical training for 
                enterprise clients.
            </p>
          </div>

            <div className="flex items-center justify-center gap-4 mt-8">
              <a 
                href="https://www.aimakers.co" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-slate-300 transition-colors"
                >
                <Globe className="w-4 h-4" />
                AI Makers
              </a>
              <a 
                href="https://linkedin.com/in/markausten" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-slate-300 transition-colors"
              >
                <Linkedin className="w-4 h-4" />
                LinkedIn
              </a>
              </div>
          </div>
        </div>
      </section>

      {/* Related Ventures */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Related Ventures
            </h2>
            <p className="text-lg text-slate-600">
              Part of a portfolio of AI-powered enterprise solutions
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                name: "AI Makers",
                url: "https://www.aimakers.co",
                description: "Enterprise AI consultancy providing custom solution development, system integration, and technical training programmes.",
                tags: ["Consulting", "Development", "Training"],
              },
              {
                name: "VeoStudio",
                url: "https://veostudio.ai",
                description: "Video generation platform leveraging Google VEO technology for automated content production workflows.",
                tags: ["Video AI", "Content Automation", "SaaS"],
              },
            ].map((project) => (
              <a
                key={project.name}
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-6 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all bg-white"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-semibold text-slate-900 group-hover:text-teal-600 transition-colors">
                    {project.name}
                  </h3>
                  <ExternalLink className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
                <p className="text-slate-600 mb-4 leading-relaxed">
                  {project.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span 
                      key={tag}
                      className="px-2.5 py-1 bg-slate-100 rounded text-xs font-medium text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Partnership */}
      <section className="py-16 border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-3 text-slate-600">
            <Building2 className="w-5 h-5" />
            <span>
              Strategic partnership with <strong className="text-slate-900">Curaco Growth Fund</strong>
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28" style={{ backgroundColor: brand.colors.primary }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to streamline your document processing?
          </h2>
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            Start with a free trial to evaluate {brand.content.name} for your organisation. 
            No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl bg-white text-slate-900 hover:bg-slate-100 transition-all"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
