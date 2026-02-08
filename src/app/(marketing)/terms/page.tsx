"use client";

import { useBrand } from "@/hooks/use-brand";
import { FileText, AlertTriangle, CreditCard, Ban, Scale, RefreshCw, Mail } from "lucide-react";

export default function TermsOfServicePage() {
  const brand = useBrand();
  const lastUpdated = "December 27, 2024";
  const effectiveDate = "December 27, 2024";

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
              <FileText className="h-8 w-8" style={{ color: brand.colors.primary }} />
            </div>
            <span className="text-slate-400 text-sm font-medium">Legal</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Terms of Service</h1>
          <p className="text-xl text-slate-300">
            Please read these terms carefully before using our services.
          </p>
          <p className="text-sm text-slate-400 mt-4">
            Last updated: {lastUpdated} | Effective: {effectiveDate}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Important Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-12">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 mb-1">Important Notice</h3>
                <p className="text-amber-700 text-sm">
                  By accessing or using {brand.content.name}, you agree to be bound by these Terms of Service. 
                  If you disagree with any part of these terms, you may not access our service.
                </p>
              </div>
            </div>
          </div>

          {/* Terms Content */}
          <div className="prose prose-slate max-w-none">
            {/* Section 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <span className="text-3xl font-light text-slate-300">01</span>
                Acceptance of Terms
              </h2>
              <p className="text-slate-600 mb-4">
                These Terms of Service ("Terms") govern your access to and use of {brand.content.name}'s website, 
                products, and services ("Services"). By creating an account or using our Services, you agree 
                to these Terms, our Privacy Policy, and our Cookie Policy.
              </p>
              <p className="text-slate-600">
                We may modify these Terms at any time. We will notify you of material changes via email or 
                through our Services. Your continued use after such modifications constitutes acceptance of 
                the updated Terms.
              </p>
            </div>

            {/* Section 2 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <span className="text-3xl font-light text-slate-300">02</span>
                Description of Services
              </h2>
              <p className="text-slate-600 mb-4">
                {brand.content.name} provides AI-powered financial document processing services, including:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
                <li>Automated extraction of data from bank statements, invoices, and receipts</li>
                <li>Transaction categorization and analysis</li>
                <li>Export to various formats (CSV, Excel, JSON)</li>
              </ul>
              <p className="text-slate-600">
                We reserve the right to modify, suspend, or discontinue any aspect of our Services at any time.
              </p>
            </div>

            {/* Section 3 */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <span className="text-3xl font-light text-slate-300">03</span>
                User Accounts
              </h2>
              <p className="text-slate-600 mb-4">
                To use our Services, you must:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
                <li>Be at least 18 years old or the age of majority in your jurisdiction</li>
                <li>Provide accurate, complete, and current account information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Accept responsibility for all activities under your account</li>
              </ul>
              <p className="text-slate-600">
                We may suspend or terminate accounts that violate these Terms or engage in fraudulent activity.
              </p>
            </div>

            {/* Section 4 - Payment */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <CreditCard className="h-7 w-7" style={{ color: brand.colors.primary }} />
                Payment Terms
              </h2>
              <p className="text-slate-600 mb-4">
                <strong>Subscription Plans:</strong> Paid plans are billed monthly or annually in advance. 
                Prices are listed on our pricing page and may change with 30 days' notice.
              </p>
              <p className="text-slate-600 mb-4">
                <strong>Free Tier:</strong> Our free tier includes limited pages per month. Usage beyond 
                free limits requires a paid plan or pay-as-you-go credits.
              </p>
              <p className="text-slate-600 mb-4">
                <strong>Overage Charges:</strong> If you exceed your plan's included pages, you will be 
                charged the overage rate specified in your plan.
              </p>
              <p className="text-slate-600 mb-4">
                <strong>Refunds:</strong> We offer a 14-day money-back guarantee for new subscribers. 
                After 14 days, subscription fees are non-refundable. Unused pages do not roll over.
              </p>
              <p className="text-slate-600">
                <strong>Cancellation:</strong> You may cancel your subscription at any time. Access 
                continues until the end of your billing period.
              </p>
            </div>

            {/* Section 5 - Acceptable Use */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <Ban className="h-7 w-7 text-red-500" />
                Acceptable Use Policy
              </h2>
              <p className="text-slate-600 mb-4">
                You agree NOT to use our Services to:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
                <li>Process documents you don't have authorization to access</li>
                <li>Upload malicious files, viruses, or harmful code</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Reverse engineer, decompile, or disassemble our software</li>
                <li>Use automated tools to scrape or extract our data</li>
                <li>Resell or redistribute our Services without authorization</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Process documents related to illegal activities</li>
                <li>Interfere with or disrupt our Services or servers</li>
              </ul>
              <p className="text-slate-600">
                Violation of this policy may result in immediate account termination without refund.
              </p>
            </div>

            {/* Section 6 - Intellectual Property */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <span className="text-3xl font-light text-slate-300">06</span>
                Intellectual Property
              </h2>
              <p className="text-slate-600 mb-4">
                <strong>Our Property:</strong> {brand.content.name}, including all software, designs, logos, and 
                content, is owned by {brand.content.companyName} and protected by intellectual property laws.
              </p>
              <p className="text-slate-600 mb-4">
                <strong>Your Data:</strong> You retain all rights to the documents you upload and the data 
                extracted from them. You grant us a limited license to process your documents solely for 
                providing our Services.
              </p>
              <p className="text-slate-600">
                <strong>Feedback:</strong> Any suggestions or feedback you provide may be used by us 
                without obligation to you.
              </p>
            </div>

            {/* Section 7 - Limitation of Liability */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <Scale className="h-7 w-7" style={{ color: brand.colors.primary }} />
                Limitation of Liability
              </h2>
              <p className="text-slate-600 mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
                <li>Our Services are provided "as is" without warranties of any kind</li>
                <li>We do not guarantee 100% accuracy of AI extraction results</li>
                <li>We are not liable for decisions made based on extracted data</li>
                <li>Our total liability is limited to fees paid in the 12 months preceding the claim</li>
                <li>We are not liable for indirect, incidental, or consequential damages</li>
              </ul>
              <p className="text-slate-600">
                You acknowledge that AI processing may contain errors and should be reviewed before use 
                in financial or legal matters.
              </p>
            </div>

            {/* Section 8 - Termination */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <RefreshCw className="h-7 w-7" style={{ color: brand.colors.primary }} />
                Termination
              </h2>
              <p className="text-slate-600 mb-4">
                <strong>By You:</strong> You may terminate your account at any time through your account 
                settings or by contacting support.
              </p>
              <p className="text-slate-600 mb-4">
                <strong>By Us:</strong> We may terminate or suspend your account immediately, without 
                notice, for:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
                <li>Violation of these Terms</li>
                <li>Non-payment of fees</li>
                <li>Fraudulent or illegal activity</li>
                <li>Extended inactivity (12+ months)</li>
              </ul>
              <p className="text-slate-600">
                Upon termination, your right to use the Services ceases immediately. We will retain 
                your data for 30 days, after which it will be permanently deleted.
              </p>
            </div>

            {/* Section 9 - Governing Law */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-3">
                <span className="text-3xl font-light text-slate-300">09</span>
                Governing Law & Disputes
              </h2>
              <p className="text-slate-600 mb-4">
                These Terms are governed by the laws of England and Wales, without regard to conflict of 
                law principles.
              </p>
              <p className="text-slate-600 mb-4">
                Any disputes arising from these Terms or our Services shall be resolved through:
              </p>
              <ol className="list-decimal pl-6 text-slate-600 space-y-2">
                <li>Good faith negotiation between the parties</li>
                <li>Mediation through a mutually agreed mediator</li>
                <li>Binding arbitration or court proceedings in England</li>
              </ol>
            </div>
          </div>

          {/* Contact Section */}
          <div className="mt-12 bg-slate-900 rounded-2xl p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="h-6 w-6" style={{ color: brand.colors.primary }} />
              <h2 className="text-xl font-bold">Questions About These Terms?</h2>
            </div>
            <p className="text-slate-300 mb-4">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="space-y-2 text-slate-300">
              <p>Email: <a href={`mailto:legal@${brand.domain}`} className="underline" style={{ color: brand.colors.primary }}>legal@{brand.domain}</a></p>
              <p>Address: {brand.content.companyName}, 10-12 Snipweg, Willemstad, Curaçao</p>
              <p className="mt-4 text-sm text-slate-400">
                Platform developed by{" "}
                <a 
                  href="https://www.aimakers.co" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-teal-400"
                >
                  AI Makers
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

