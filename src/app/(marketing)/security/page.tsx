"use client";

import { useBrand } from "@/hooks/use-brand";
import { 
  Shield, 
  Lock, 
  Server, 
  Key, 
  Eye, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  FileCheck,
  Users,
  Mail,
  Globe
} from "lucide-react";

export default function SecurityPage() {
  const brand = useBrand();

  const securityFeatures = [
    {
      icon: Lock,
      title: "Encryption at Rest & Transit",
      description: "All data is encrypted using AES-256 encryption at rest and TLS 1.3 in transit. Your documents are protected from the moment they leave your device.",
    },
    {
      icon: Server,
      title: "SOC 2 Type II Infrastructure",
      description: "We use Google Cloud Platform, which maintains SOC 2 Type II, ISO 27001, and PCI DSS compliance. Your data is stored in enterprise-grade data centers.",
    },
    {
      icon: Key,
      title: "Secure Authentication",
      description: "Firebase Authentication with support for email/password, Google SSO, and multi-factor authentication. Session tokens expire automatically.",
    },
    {
      icon: Eye,
      title: "Access Controls",
      description: "Role-based access control (RBAC) ensures users only see data they're authorized to access. All access is logged and auditable.",
    },
    {
      icon: FileCheck,
      title: "Document Lifecycle",
      description: "Uploaded documents are processed in isolated environments and automatically deleted after 30 days. You can delete data at any time.",
    },
    {
      icon: Users,
      title: "Employee Security",
      description: "All employees undergo background checks and security training. Access to production systems requires approval and is logged.",
    },
  ];

  const certifications = [
    { name: "GDPR Compliant", description: "Full compliance with EU data protection regulations" },
    { name: "SOC 2 Type II", description: "Via Google Cloud Platform infrastructure" },
    { name: "ISO 27001", description: "Information security management certification" },
    { name: "PCI DSS", description: "Payment Card Industry Data Security Standard (via Stripe)" },
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
            <span className="text-slate-400 text-sm font-medium">Trust & Security</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Security at {brand.content.name}</h1>
          <p className="text-xl text-slate-300">
            Your financial data deserves enterprise-grade security. Here's how we protect it.
          </p>
        </div>
      </section>

      {/* Trust Banner */}
      <section className="py-12 border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {certifications.map((cert, index) => (
              <div key={index} className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="font-semibold text-slate-900">{cert.name}</span>
                </div>
                <p className="text-sm text-slate-500">{cert.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-16 lg:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">How We Protect Your Data</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Security isn't just a feature—it's built into every layer of our platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {securityFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={index} 
                  className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${brand.colors.primary}10` }}
                  >
                    <Icon className="h-6 w-6" style={{ color: brand.colors.primary }} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-600 text-sm">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Data Processing */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            How Your Documents Are Processed
          </h2>
          
          <div className="space-y-6">
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: brand.colors.primary }}>
                1
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Secure Upload</h3>
                <p className="text-slate-600">
                  Your document is encrypted using TLS 1.3 before it leaves your device. 
                  It travels through secure channels to our servers.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: brand.colors.primary }}>
                2
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Isolated Processing</h3>
                <p className="text-slate-600">
                  Each document is processed in an isolated container. Your data never 
                  mixes with other users' data. AI processing happens in secure Google Cloud environments.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: brand.colors.primary }}>
                3
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Encrypted Storage</h3>
                <p className="text-slate-600">
                  Extracted data is encrypted with AES-256 and stored in Firestore. 
                  Original documents are kept temporarily and automatically deleted after 30 days.
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: brand.colors.primary }}>
                4
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Your Control</h3>
                <p className="text-slate-600">
                  You can export or delete your data at any time. When you delete your account, 
                  all associated data is permanently removed within 30 days.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vulnerability Disclosure */}
      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-900 rounded-2xl p-8 lg:p-12 text-white">
            <div className="flex items-center gap-4 mb-6">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
              <h2 className="text-2xl font-bold">Responsible Disclosure</h2>
            </div>
            <p className="text-slate-300 mb-6">
              We take security seriously and appreciate the help of security researchers in 
              keeping {brand.content.name} safe. If you discover a vulnerability, please report it 
              responsibly:
            </p>
            <ul className="space-y-3 text-slate-300 mb-8">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Email security@{brand.domain} with details of the vulnerability</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Allow us reasonable time to investigate and fix before public disclosure</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>Do not access or modify other users' data</span>
              </li>
            </ul>
            <div className="flex flex-wrap gap-4">
              <a 
                href={`mailto:security@${brand.domain}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors"
                style={{ backgroundColor: brand.colors.primary, color: brand.colors.primaryForeground }}
              >
                <Mail className="h-5 w-5" />
                Report a Vulnerability
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            Security FAQ
          </h2>
          
          <div className="space-y-6">
            {[
              {
                q: "Who can see my uploaded documents?",
                a: "Only you can see your documents. Our support team may access data only with your explicit permission to help troubleshoot issues, and all access is logged."
              },
              {
                q: "Are my bank statements stored permanently?",
                a: "No. Original documents are automatically deleted after 30 days. Extracted data (transactions, balances) is retained until you delete your account."
              },
              {
                q: "Is the AI trained on my data?",
                a: "No. We do not train our AI models on your specific documents. Your data is used solely for processing your requests and is not shared with third parties."
              },
              {
                q: "What happens if there's a data breach?",
                a: "In the unlikely event of a breach, we will notify affected users within 72 hours as required by GDPR. We maintain cyber insurance and incident response procedures."
              },
              {
                q: "Can I get an audit log of who accessed my data?",
                a: "Yes. Business and Enterprise plans include audit logs showing all access to your account. Contact support if you need this information."
              },
            ].map((item, index) => (
              <div key={index} className="bg-slate-50 rounded-xl p-6">
                <h3 className="font-semibold text-slate-900 mb-2">{item.q}</h3>
                <p className="text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Globe className="h-12 w-12 mx-auto mb-4" style={{ color: brand.colors.primary }} />
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Have Security Questions?</h2>
          <p className="text-slate-600 mb-6">
            Our security team is happy to answer any questions about how we protect your data.
          </p>
          <a 
            href={`mailto:security@${brand.domain}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-colors"
            style={{ backgroundColor: brand.colors.primary }}
          >
            <Mail className="h-5 w-5" />
            Contact Security Team
          </a>
          <p className="text-sm text-slate-500 mt-8">
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

