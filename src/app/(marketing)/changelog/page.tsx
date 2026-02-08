"use client";

import { useBrand } from "@/hooks/use-brand";
import { 
  Sparkles, 
  Bug, 
  Zap, 
  Shield, 
  Wrench,
  Star,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

export default function ChangelogPage() {
  const brand = useBrand();

  const releases = [
    {
      version: "1.1.0",
      date: "January 3, 2026",
      title: "AI Engine Upgrade",
      isLatest: true,
      changes: [
        { type: "feature", text: "Upgraded to Gemini 3 Flash for 3x faster processing" },
        { type: "feature", text: "New AI-powered export formatting - match any template" },
        { type: "improvement", text: "Improved extraction accuracy to 99.2%" },
        { type: "improvement", text: "Reduced processing time to under 2 seconds per page" },
        { type: "security", text: "Enhanced encryption for document storage" },
      ],
    },
    {
      version: "1.0.0",
      date: "December 2025",
      title: "General Availability",
      changes: [
        { type: "feature", text: "Multi-bank statement batch upload" },
        { type: "feature", text: "Automatic transaction categorization" },
        { type: "feature", text: "Export to CSV, Excel, and JSON" },
        { type: "feature", text: "Custom export templates" },
        { type: "feature", text: "Team collaboration features" },
        { type: "security", text: "SOC 2 Type II compliant infrastructure" },
        { type: "security", text: "End-to-end encryption for all documents" },
      ],
    },
    {
      version: "0.9.0",
      date: "November 2025",
      title: "Public Beta",
      changes: [
        { type: "feature", text: "Public beta launch" },
        { type: "feature", text: "Support for 50+ bank statement formats" },
        { type: "feature", text: "Real-time processing status updates" },
        { type: "improvement", text: "Improved extraction accuracy to 98%" },
        { type: "fix", text: "Fixed date parsing for international formats" },
      ],
    },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "feature": return Sparkles;
      case "improvement": return Zap;
      case "fix": return Bug;
      case "security": return Shield;
      default: return Wrench;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "feature": return "text-emerald-600 bg-emerald-50";
      case "improvement": return "text-blue-600 bg-blue-50";
      case "fix": return "text-amber-600 bg-amber-50";
      case "security": return "text-purple-600 bg-purple-50";
      default: return "text-slate-600 bg-slate-50";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "feature": return "New";
      case "improvement": return "Improved";
      case "fix": return "Fixed";
      case "security": return "Security";
      default: return "Changed";
    }
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
              <Sparkles className="h-8 w-8" style={{ color: brand.colors.primary }} />
            </div>
            <span className="text-slate-400 text-sm font-medium">Product Updates</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Changelog</h1>
          <p className="text-xl text-slate-300">
            Stay up to date with new features, improvements, and fixes.
          </p>
        </div>
      </section>

      {/* Subscribe Banner */}
      <section className="py-6 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-slate-600">
              Get notified when we ship new features
            </p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Enter your email"
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ "--tw-ring-color": brand.colors.primary } as React.CSSProperties}
              />
              <button 
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: brand.colors.primary }}
              >
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {releases.map((release, index) => (
              <div key={index} className="relative">
                {/* Timeline line */}
                {index !== releases.length - 1 && (
                  <div className="absolute left-[19px] top-16 w-0.5 h-full bg-slate-200" />
                )}
                
                {/* Version header */}
                <div className="flex items-center gap-4 mb-6">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm z-10"
                    style={{ backgroundColor: release.isLatest ? brand.colors.primary : "#94a3b8" }}
                  >
                    {release.isLatest ? <Star className="h-5 w-5" /> : index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-slate-900">
                        v{release.version}
                      </h2>
                      {release.isLatest && (
                        <span 
                          className="px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: brand.colors.primary }}
                        >
                          Latest
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500">{release.date} — {release.title}</p>
                  </div>
                </div>

                {/* Changes */}
                <div className="ml-14 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <ul className="space-y-3">
                    {release.changes.map((change, changeIndex) => {
                      const Icon = getTypeIcon(change.type);
                      return (
                        <li key={changeIndex} className="flex items-start gap-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(change.type)}`}>
                            <Icon className="h-3 w-3" />
                            {getTypeLabel(change.type)}
                          </span>
                          <span className="text-slate-700">{change.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Coming Soon */}
          <div className="mt-16 text-center">
            <p className="text-slate-500 mb-4">Want to see what's coming next?</p>
            <Link 
              href="/roadmap"
              className="inline-flex items-center gap-2 font-medium hover:underline"
              style={{ color: brand.colors.primary }}
            >
              View our roadmap
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

