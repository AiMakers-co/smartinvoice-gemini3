"use client";

import { useBrand } from "@/hooks/use-brand";
import { Shield, Eye, Database, Lock, Mail, Globe, UserCheck, Clock } from "lucide-react";

export default function PrivacyPolicyPage() {
  const brand = useBrand();
  const lastUpdated = "December 27, 2024";

  const sections = [
    {
      icon: Eye,
      title: "1. Information We Collect",
      content: [
        {
          subtitle: "Information you provide to us:",
          items: [
            "Account information (name, email address, password)",
            "Payment information (processed securely via Stripe)",
            "Documents you upload for processing (bank statements, invoices, receipts)",
            "Communications with our support team",
            "Feedback and survey responses",
          ],
        },
        {
          subtitle: "Information collected automatically:",
          items: [
            "Device information (browser type, operating system, device identifiers)",
            "Usage data (pages visited, features used, time spent)",
            "IP address and approximate location",
            "Cookies and similar tracking technologies",
          ],
        },
      ],
    },
    {
      icon: Database,
      title: "2. How We Use Your Information",
      content: [
        {
          subtitle: "We use your information to:",
          items: [
            "Provide, maintain, and improve our services",
            "Process your documents using AI and extract financial data",
            "Process payments and manage your subscription",
            "Send transactional emails (receipts, account updates)",
            "Provide customer support",
            "Analyze usage patterns to improve our product",
            "Detect and prevent fraud or abuse",
            "Comply with legal obligations",
          ],
        },
      ],
    },
    {
      icon: Lock,
      title: "3. Data Security",
      content: [
        {
          subtitle: "We implement robust security measures:",
          items: [
            "All data is encrypted in transit using TLS 1.3",
            "Documents are encrypted at rest using AES-256 encryption",
            "We use Google Cloud Platform with SOC 2 Type II certification",
            "Regular security audits and penetration testing",
            "Access controls and authentication for all systems",
            "Employee security training and background checks",
            "Automatic deletion of processed documents after 30 days (configurable)",
          ],
        },
      ],
    },
    {
      icon: Globe,
      title: "4. Data Sharing & Third Parties",
      content: [
        {
          subtitle: "We share data with:",
          items: [
            "Google Cloud Platform (infrastructure and AI processing)",
            "Stripe (payment processing)",
            "Firebase (authentication and database)",
            "Analytics providers (anonymized usage data only)",
          ],
        },
        {
          subtitle: "We never:",
          items: [
            "Sell your personal data to third parties",
            "Share your documents with other users",
            "Use your financial data for advertising",
            "Train AI models on your specific documents without consent",
          ],
        },
      ],
    },
    {
      icon: UserCheck,
      title: "5. Your Rights (GDPR & CCPA)",
      content: [
        {
          subtitle: "You have the right to:",
          items: [
            "Access your personal data",
            "Correct inaccurate data",
            "Delete your data ('right to be forgotten')",
            "Export your data in a portable format",
            "Restrict processing of your data",
            "Object to certain processing activities",
            "Withdraw consent at any time",
            "Lodge a complaint with a supervisory authority",
          ],
        },
      ],
    },
    {
      icon: Clock,
      title: "6. Data Retention",
      content: [
        {
          subtitle: "We retain your data as follows:",
          items: [
            "Account data: Until you delete your account + 30 days",
            "Uploaded documents: 30 days after processing (configurable)",
            "Extracted data: Until you delete your account",
            "Payment records: 7 years (legal requirement)",
            "Usage logs: 90 days",
            "Support conversations: 2 years",
          ],
        },
      ],
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
              <Shield className="h-8 w-8" style={{ color: brand.colors.primary }} />
            </div>
            <span className="text-slate-400 text-sm font-medium">Legal</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-xl text-slate-300">
            Your privacy is important to us. This policy explains how we collect, use, and protect your data.
          </p>
          <p className="text-sm text-slate-400 mt-4">Last updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Introduction */}
          <div className="prose prose-slate max-w-none mb-12">
            <p className="text-lg text-slate-600 leading-relaxed">
              {brand.content.companyName} ("{brand.content.name}", "we", "us", or "our") operates the {brand.content.name} 
              platform for automated bank statement and financial document processing. This Privacy Policy 
              describes how we collect, use, store, and protect your personal information when you use our 
              services.
            </p>
            <p className="text-slate-600">
              By using {brand.content.name}, you agree to the collection and use of information in accordance with 
              this policy. We are committed to protecting your privacy and complying with applicable data 
              protection laws, including the General Data Protection Regulation (GDPR) and the California 
              Consumer Privacy Act (CCPA).
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-12">
            {sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <div key={index} className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                  <div className="flex items-start gap-4 mb-6">
                    <div 
                      className="p-3 rounded-xl shrink-0"
                      style={{ backgroundColor: `${brand.colors.primary}10` }}
                    >
                      <Icon className="h-6 w-6" style={{ color: brand.colors.primary }} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">{section.title}</h2>
                  </div>
                  <div className="space-y-6 ml-16">
                    {section.content.map((block, blockIndex) => (
                      <div key={blockIndex}>
                        <h3 className="font-semibold text-slate-800 mb-3">{block.subtitle}</h3>
                        <ul className="space-y-2">
                          {block.items.map((item, itemIndex) => (
                            <li key={itemIndex} className="flex items-start gap-3 text-slate-600">
                              <span 
                                className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                                style={{ backgroundColor: brand.colors.primary }}
                              />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Contact Section */}
          <div className="mt-12 bg-slate-900 rounded-2xl p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="h-6 w-6" style={{ color: brand.colors.primary }} />
              <h2 className="text-xl font-bold">Contact Us About Privacy</h2>
            </div>
            <p className="text-slate-300 mb-4">
              If you have any questions about this Privacy Policy, your personal data, or wish to exercise 
              your rights, please contact our Data Protection Officer:
            </p>
            <div className="space-y-2 text-slate-300">
              <p>Email: <a href={`mailto:privacy@${brand.domain}`} className="underline" style={{ color: brand.colors.primary }}>privacy@{brand.domain}</a></p>
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

