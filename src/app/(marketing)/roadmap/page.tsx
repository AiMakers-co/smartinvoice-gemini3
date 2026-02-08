"use client";

import { useBrand } from "@/hooks/use-brand";
import { 
  Map, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  Rocket,
  Target,
  Calendar,
  ArrowRight,
  ThumbsUp
} from "lucide-react";
import Link from "next/link";

export default function RoadmapPage() {
  const brand = useBrand();

  const roadmapItems = {
    completed: [
      { title: "Gemini 3 Flash AI Engine", description: "Faster, more accurate AI extraction" },
      { title: "Multi-bank Statement Upload", description: "Process multiple statements at once" },
      { title: "Team Collaboration", description: "Invite team members and share accounts" },
      { title: "CSV & Excel Export", description: "Download your data in any format" },
    ],
    inProgress: [
      { title: "Mobile App (iOS & Android)", description: "Scan statements with your phone camera", eta: "Q1 2025" },
      { title: "Custom Categorization Rules", description: "Create your own transaction categories", eta: "Q1 2025" },
      { title: "Advanced Export Templates", description: "Create custom export formats for any system", eta: "Q1 2025" },
    ],
    planned: [
      { title: "Multi-currency Dashboard", description: "View all accounts in your preferred currency" },
      { title: "Receipt & Invoice Scanning", description: "Expand beyond bank statements" },
      { title: "Fraud Detection Alerts", description: "AI-powered anomaly detection" },
      { title: "Bank Account Linking", description: "Connect directly via Open Banking" },
      { title: "Custom Reports Builder", description: "Create custom financial reports" },
      { title: "White-label Solution", description: "Rebrand for your business" },
    ],
    considering: [
      { title: "Browser Extension", description: "Extract data from web banking portals" },
      { title: "AI Financial Assistant", description: "Ask questions about your data" },
    ],
  };

  const statusConfig = {
    completed: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Completed" },
    inProgress: { icon: Clock, color: "text-blue-600", bg: "bg-blue-50", label: "In Progress" },
    planned: { icon: Target, color: "text-purple-600", bg: "bg-purple-50", label: "Planned" },
    considering: { icon: Sparkles, color: "text-amber-600", bg: "bg-amber-50", label: "Under Consideration" },
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: `${brand.colors.primary}20` }}
            >
              <Map className="h-8 w-8" style={{ color: brand.colors.primary }} />
            </div>
            <span className="text-slate-400 text-sm font-medium">Product Direction</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Product Roadmap</h1>
          <p className="text-xl text-slate-300">
            See what we're building and what's coming next. Your feedback shapes our priorities.
          </p>
        </div>
      </section>

      {/* Feature Request Banner */}
      <section className="py-6 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Rocket className="h-5 w-5" style={{ color: brand.colors.primary }} />
              <p className="text-slate-600">
                Have a feature request? We'd love to hear from you!
              </p>
            </div>
            <Link 
              href="/contact"
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: brand.colors.primary }}
            >
              Submit Feature Request
            </Link>
          </div>
        </div>
      </section>

      {/* Roadmap Grid */}
      <section className="py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Completed */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-lg ${statusConfig.completed.bg}`}>
                  <CheckCircle2 className={`h-5 w-5 ${statusConfig.completed.color}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Completed</h2>
                  <p className="text-sm text-slate-500">Recently shipped</p>
                </div>
              </div>
              <ul className="space-y-4">
                {roadmapItems.completed.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-500">{item.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* In Progress */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-lg ${statusConfig.inProgress.bg}`}>
                  <Clock className={`h-5 w-5 ${statusConfig.inProgress.color}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">In Progress</h2>
                  <p className="text-sm text-slate-500">Currently being built</p>
                </div>
              </div>
              <ul className="space-y-4">
                {roadmapItems.inProgress.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{item.title}</p>
                        {item.eta && (
                          <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            <Calendar className="h-3 w-3" />
                            {item.eta}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{item.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Planned */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-lg ${statusConfig.planned.bg}`}>
                  <Target className={`h-5 w-5 ${statusConfig.planned.color}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Planned</h2>
                  <p className="text-sm text-slate-500">On our radar</p>
                </div>
              </div>
              <ul className="space-y-4">
                {roadmapItems.planned.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-purple-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-500">{item.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Under Consideration */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-lg ${statusConfig.considering.bg}`}>
                  <Sparkles className={`h-5 w-5 ${statusConfig.considering.color}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Under Consideration</h2>
                  <p className="text-sm text-slate-500">Exploring feasibility</p>
                </div>
              </div>
              <ul className="space-y-4">
                {roadmapItems.considering.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-dashed border-amber-300 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-900">{item.title}</p>
                        <button className="text-slate-400 hover:text-slate-600">
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-sm text-slate-500">{item.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-400 mt-4">
                👆 Vote for features you want to see!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Want to shape our roadmap?
          </h2>
          <p className="text-slate-600 mb-6 max-w-xl mx-auto">
            Your feedback directly influences what we build. Join our community to vote on features, 
            report bugs, and help us build the best financial document processing tool.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link 
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white"
              style={{ backgroundColor: brand.colors.primary }}
            >
              Share Feedback
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link 
              href="/changelog"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200"
            >
              View Changelog
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

