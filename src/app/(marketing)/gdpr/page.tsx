"use client";

import { useBrand } from "@/hooks/use-brand";
import { 
  Shield, 
  Globe, 
  FileText, 
  Download, 
  Trash2, 
  Edit3, 
  Ban, 
  Send,
  Clock,
  Mail,
  CheckCircle2,
  AlertCircle,
  Building2
} from "lucide-react";
import Link from "next/link";

export default function GDPRPage() {
  const brand = useBrand();

  const rights = [
    {
      icon: FileText,
      title: "Right to Access",
      article: "Article 15",
      description: "You can request a copy of all personal data we hold about you, including uploaded documents, extracted data, account information, and usage logs.",
      action: "Request Data Export",
    },
    {
      icon: Edit3,
      title: "Right to Rectification",
      article: "Article 16",
      description: "You can correct any inaccurate personal data we hold. Update your profile information directly in your account settings or contact us for assistance.",
      action: "Update Profile",
    },
    {
      icon: Trash2,
      title: "Right to Erasure",
      article: "Article 17",
      description: "You can request deletion of your personal data. This includes your account, all uploaded documents, extracted data, and associated records.",
      action: "Delete My Data",
    },
    {
      icon: Ban,
      title: "Right to Restrict Processing",
      article: "Article 18",
      description: "You can request that we limit how we process your data while we verify accuracy or assess our legitimate interests.",
      action: "Restrict Processing",
    },
    {
      icon: Download,
      title: "Right to Data Portability",
      article: "Article 20",
      description: "You can receive your data in a structured, commonly used format (JSON, CSV) to transfer to another service provider.",
      action: "Export Data",
    },
    {
      icon: Send,
      title: "Right to Object",
      article: "Article 21",
      description: "You can object to processing based on legitimate interests, direct marketing, or research/statistical purposes.",
      action: "Submit Objection",
    },
  ];

  const dataCategories = [
    {
      category: "Account Information",
      data: ["Email address", "Name", "Password (hashed)", "Profile settings"],
      purpose: "Account management and authentication",
      retention: "Until account deletion + 30 days",
    },
    {
      category: "Financial Documents",
      data: ["Uploaded bank statements", "Invoices", "Receipts"],
      purpose: "Document processing and data extraction",
      retention: "30 days after processing (configurable)",
    },
    {
      category: "Extracted Data",
      data: ["Transactions", "Account balances", "Vendor information"],
      purpose: "Providing core service functionality",
      retention: "Until account deletion",
    },
    {
      category: "Payment Information",
      data: ["Billing address", "Payment method (via Stripe)"],
      purpose: "Processing payments and subscriptions",
      retention: "7 years (legal requirement)",
    },
    {
      category: "Usage Data",
      data: ["Features used", "Pages viewed", "Processing history"],
      purpose: "Service improvement and analytics",
      retention: "90 days",
    },
  ];

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
              <Globe className="h-8 w-8" style={{ color: brand.colors.primary }} />
            </div>
            <span className="text-slate-400 text-sm font-medium">Data Protection</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">GDPR Compliance</h1>
          <p className="text-xl text-slate-300">
            We're committed to protecting your privacy rights under the General Data Protection Regulation.
          </p>
        </div>
      </section>

      {/* Commitment Banner */}
      <section className="py-8 bg-emerald-50 border-b border-emerald-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <p className="text-emerald-800 font-medium">
              {brand.content.name} is fully GDPR compliant and registered with the UK Information Commissioner's Office (ICO)
            </p>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Our Commitment to GDPR</h2>
            <p className="text-slate-600 mb-4">
              The General Data Protection Regulation (GDPR) is a comprehensive data protection law that 
              gives EU/EEA residents control over their personal data. Even though we're based in the UK, 
              we apply GDPR standards to all users globally.
            </p>
            <p className="text-slate-600 mb-4">
              As a data processor handling sensitive financial documents, we take our responsibilities 
              seriously. This page explains how we comply with GDPR and how you can exercise your rights.
            </p>
            <div className="flex flex-wrap gap-4 mt-6">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Building2 className="h-4 w-4" />
                <span>Data Controller: {brand.content.companyName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Mail className="h-4 w-4" />
                <span>DPO Contact: dpo@{brand.domain}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Your Rights */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Your Data Rights</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Under GDPR, you have specific rights regarding your personal data. Here's how to exercise them.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rights.map((right, index) => {
              const Icon = right.icon;
              return (
                <div 
                  key={index} 
                  className="bg-slate-50 rounded-2xl p-6 border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${brand.colors.primary}10` }}
                    >
                      <Icon className="h-6 w-6" style={{ color: brand.colors.primary }} />
                    </div>
                    <span className="text-xs font-mono text-slate-400 bg-slate-200 px-2 py-1 rounded">
                      {right.article}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{right.title}</h3>
                  <p className="text-slate-600 text-sm mb-4">{right.description}</p>
                  <a 
                    href={`mailto:dpo@${brand.domain}?subject=GDPR Request: ${right.title}`}
                    className="text-sm font-medium hover:underline"
                    style={{ color: brand.colors.primary }}
                  >
                    {right.action} →
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Data We Collect */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Data We Collect & Process</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Transparency about what data we collect, why, and how long we keep it.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-xl shadow-sm border border-slate-200">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Category</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Data Collected</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Purpose</th>
                  <th className="text-left py-4 px-6 font-semibold text-slate-700">Retention</th>
                </tr>
              </thead>
              <tbody>
                {dataCategories.map((cat, index) => (
                  <tr key={index} className="border-b border-slate-100 last:border-0">
                    <td className="py-4 px-6 font-medium text-slate-900">{cat.category}</td>
                    <td className="py-4 px-6 text-slate-600 text-sm">
                      {cat.data.join(", ")}
                    </td>
                    <td className="py-4 px-6 text-slate-600 text-sm">{cat.purpose}</td>
                    <td className="py-4 px-6 text-slate-500 text-sm">{cat.retention}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Legal Bases */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            Legal Bases for Processing
          </h2>
          
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Contract Performance (Article 6(1)(b))
              </h3>
              <p className="text-slate-600">
                Processing your documents and providing our services requires handling your data as 
                part of our contractual obligations to you.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Legitimate Interests (Article 6(1)(f))
              </h3>
              <p className="text-slate-600">
                We use anonymized analytics to improve our service, detect fraud, and ensure security. 
                We've conducted legitimate interest assessments for these activities.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Consent (Article 6(1)(a))
              </h3>
              <p className="text-slate-600">
                For optional features like marketing emails and analytics cookies, we obtain your 
                explicit consent. You can withdraw consent at any time.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                Legal Obligation (Article 6(1)(c))
              </h3>
              <p className="text-slate-600">
                We retain certain records (like payment history) to comply with tax, accounting, and 
                anti-money laundering regulations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Response Times */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 rounded-2xl p-8 lg:p-12 text-white">
            <div className="flex items-center gap-4 mb-6">
              <Clock className="h-8 w-8" style={{ color: brand.colors.primary }} />
              <h2 className="text-2xl font-bold">Response Times</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2">Data Subject Requests</h3>
                <p className="text-slate-300">
                  We respond to all GDPR requests within <strong>30 days</strong>. Complex requests 
                  may take up to 60 days, and we'll notify you of any extension.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Data Breach Notification</h3>
                <p className="text-slate-300">
                  In case of a data breach affecting your rights, we'll notify you and the relevant 
                  supervisory authority within <strong>72 hours</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Submit Request */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: brand.colors.primary }} />
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Submit a GDPR Request</h2>
          <p className="text-slate-600 mb-6 max-w-xl mx-auto">
            To exercise any of your rights, please contact our Data Protection Officer. 
            We may need to verify your identity before processing your request.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a 
              href={`mailto:dpo@${brand.domain}?subject=GDPR Data Subject Request`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-colors"
              style={{ backgroundColor: brand.colors.primary }}
            >
              <Mail className="h-5 w-5" />
              Email DPO
            </a>
            <Link 
              href="/privacy"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <FileText className="h-5 w-5" />
              Read Privacy Policy
            </Link>
          </div>
          <p className="text-sm text-slate-500 mt-6">
            You also have the right to lodge a complaint with a supervisory authority 
            (e.g., ICO in the UK, your local DPA in the EU).
          </p>
          <p className="text-sm text-slate-500 mt-4">
            Platform developed by{" "}
            <a 
              href="https://www.aimakers.co" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              AI Makers
            </a>
            {" "}• 10-12 Snipweg, Willemstad, Curaçao
          </p>
        </div>
      </section>
    </div>
  );
}

