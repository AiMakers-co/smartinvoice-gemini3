"use client";

import { useBrand } from "@/hooks/use-brand";
import { Cookie, Settings, BarChart3, Shield, ToggleLeft, Mail } from "lucide-react";

export default function CookiePolicyPage() {
  const brand = useBrand();
  const lastUpdated = "December 27, 2024";

  const cookieTypes = [
    {
      name: "Essential Cookies",
      required: true,
      icon: Shield,
      description: "Required for the website to function. Cannot be disabled.",
      examples: [
        { name: "session_id", purpose: "Maintains your login session", duration: "Session" },
        { name: "csrf_token", purpose: "Security protection against cross-site attacks", duration: "Session" },
        { name: "cookie_consent", purpose: "Remembers your cookie preferences", duration: "1 year" },
      ],
    },
    {
      name: "Functional Cookies",
      required: false,
      icon: Settings,
      description: "Enable personalized features and remember your preferences.",
      examples: [
        { name: "theme", purpose: "Remembers your light/dark mode preference", duration: "1 year" },
        { name: "language", purpose: "Stores your language preference", duration: "1 year" },
        { name: "recent_accounts", purpose: "Remembers recently viewed accounts", duration: "30 days" },
      ],
    },
    {
      name: "Analytics Cookies",
      required: false,
      icon: BarChart3,
      description: "Help us understand how visitors interact with our website.",
      examples: [
        { name: "_ga", purpose: "Google Analytics - distinguishes users", duration: "2 years" },
        { name: "_gid", purpose: "Google Analytics - distinguishes users", duration: "24 hours" },
        { name: "mp_*", purpose: "Mixpanel - tracks feature usage", duration: "1 year" },
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
              <Cookie className="h-8 w-8" style={{ color: brand.colors.primary }} />
            </div>
            <span className="text-slate-400 text-sm font-medium">Legal</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">Cookie Policy</h1>
          <p className="text-xl text-slate-300">
            Learn how we use cookies and similar technologies to improve your experience.
          </p>
          <p className="text-sm text-slate-400 mt-4">Last updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Introduction */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">What Are Cookies?</h2>
            <p className="text-slate-600 mb-4">
              Cookies are small text files that are stored on your device when you visit a website. 
              They help websites remember your preferences, understand how you use the site, and 
              provide a more personalized experience.
            </p>
            <p className="text-slate-600">
              {brand.content.name} uses cookies and similar technologies (like local storage and pixels) to 
              provide, protect, and improve our services. This policy explains what cookies we use, 
              why we use them, and how you can control them.
            </p>
          </div>

          {/* Cookie Types */}
          <div className="space-y-6 mb-12">
            {cookieTypes.map((type, index) => {
              const Icon = type.icon;
              return (
                <div key={index} className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div 
                        className="p-3 rounded-xl"
                        style={{ backgroundColor: `${brand.colors.primary}10` }}
                      >
                        <Icon className="h-6 w-6" style={{ color: brand.colors.primary }} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">{type.name}</h3>
                        <p className="text-slate-500 text-sm">{type.description}</p>
                      </div>
                    </div>
                    <span 
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        type.required 
                          ? "bg-slate-900 text-white" 
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {type.required ? "Required" : "Optional"}
                    </span>
                  </div>
                  
                  {/* Cookie Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Cookie Name</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Purpose</th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {type.examples.map((cookie, cookieIndex) => (
                          <tr key={cookieIndex} className="border-b border-slate-100 last:border-0">
                            <td className="py-3 px-4 font-mono text-xs text-slate-800">{cookie.name}</td>
                            <td className="py-3 px-4 text-slate-600">{cookie.purpose}</td>
                            <td className="py-3 px-4 text-slate-500">{cookie.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Managing Cookies */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <ToggleLeft className="h-6 w-6" style={{ color: brand.colors.primary }} />
              <h2 className="text-2xl font-bold text-slate-900">Managing Your Cookie Preferences</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">Through Our Cookie Banner</h3>
                <p className="text-slate-600">
                  When you first visit {brand.content.name}, you'll see a cookie consent banner. You can 
                  accept all cookies, reject optional cookies, or customize your preferences. You 
                  can change these settings at any time by clicking the "Cookie Settings" link in 
                  our footer.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">Through Your Browser</h3>
                <p className="text-slate-600 mb-3">
                  Most browsers allow you to control cookies through their settings. Here's how:
                </p>
                <ul className="space-y-2 text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ backgroundColor: brand.colors.primary }} />
                    <span><strong>Chrome:</strong> Settings → Privacy and Security → Cookies</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ backgroundColor: brand.colors.primary }} />
                    <span><strong>Firefox:</strong> Options → Privacy & Security → Cookies</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ backgroundColor: brand.colors.primary }} />
                    <span><strong>Safari:</strong> Preferences → Privacy → Cookies</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ backgroundColor: brand.colors.primary }} />
                    <span><strong>Edge:</strong> Settings → Cookies and Site Permissions</span>
                  </li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800 text-sm">
                  <strong>Note:</strong> Disabling essential cookies may prevent {brand.content.name} from 
                  functioning properly. You may not be able to log in or use certain features.
                </p>
              </div>
            </div>
          </div>

          {/* Third Party Cookies */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Third-Party Cookies</h2>
            <p className="text-slate-600 mb-4">
              Some cookies on our site are set by third-party services we use:
            </p>
            <ul className="space-y-3 text-slate-600">
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ backgroundColor: brand.colors.primary }} />
                <span><strong>Stripe</strong> - Payment processing and fraud prevention</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ backgroundColor: brand.colors.primary }} />
                <span><strong>Google Analytics</strong> - Website usage analytics</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ backgroundColor: brand.colors.primary }} />
                <span><strong>Mixpanel</strong> - Product analytics and feature tracking</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ backgroundColor: brand.colors.primary }} />
                <span><strong>Intercom</strong> - Customer support chat (if enabled)</span>
              </li>
            </ul>
            <p className="text-slate-600 mt-4">
              These third parties have their own privacy policies governing their use of cookies.
            </p>
          </div>

          {/* Updates */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Updates to This Policy</h2>
            <p className="text-slate-600">
              We may update this Cookie Policy from time to time to reflect changes in our practices 
              or for legal, operational, or regulatory reasons. We will post any changes on this page 
              and update the "Last updated" date. We encourage you to review this policy periodically.
            </p>
          </div>

          {/* Contact Section */}
          <div className="bg-slate-900 rounded-2xl p-8 text-white">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="h-6 w-6" style={{ color: brand.colors.primary }} />
              <h2 className="text-xl font-bold">Questions About Cookies?</h2>
            </div>
            <p className="text-slate-300 mb-4">
              If you have any questions about how we use cookies, please contact us:
            </p>
            <div className="space-y-2 text-slate-300">
              <p>Email: <a href={`mailto:privacy@${brand.domain}`} className="underline" style={{ color: brand.colors.primary }}>privacy@{brand.domain}</a></p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

