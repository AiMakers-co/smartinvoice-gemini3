"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Check, 
  X, 
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useBrand } from "@/hooks/use-brand";
import { cn } from "@/lib/utils";

// ============================================
// PRICING DATA
// ============================================

const PRICE_IDS = {
  starter: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER || "",
  pro_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || "",
  pro_yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY || "",
  team_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY || "",
  team_yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY || "",
  business_monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_MONTHLY || "",
  business_yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_YEARLY || "",
};

const plans = [
  {
    name: "Free Trial",
    description: "Try before you subscribe",
    monthlyPrice: 0,
    yearlyPrice: 0,
    pagesIncluded: 50,
    overage: null,
    popular: false,
    planId: "free",
    priceId: { monthly: null, yearly: null },
    features: [
      "2-week free trial",
      "5 documents included",
      "50 pages included",
      "Gemini 3 Flash AI extraction",
      "Excel & CSV export",
      "1 user",
    ],
    notIncluded: [
      "Team collaboration",
    ],
  },
  {
    name: "Pay-as-you-go",
    description: "Pay only for what you use",
    monthlyPrice: 0,
    yearlyPrice: 0,
    pagesIncluded: 0,
    overage: 0.05,
    popular: false,
    planId: "starter",
    priceId: { monthly: PRICE_IDS.starter, yearly: PRICE_IDS.starter },
    features: [
      "Unlimited pages at $0.05/page",
      "Gemini 3 Flash AI extraction",
      "All export formats + JSON",
      "1 user",
      "Email support",
    ],
    notIncluded: [
      "Priority support",
      "Team collaboration",
    ],
  },
  {
    name: "Pro",
    description: "For growing businesses",
    monthlyPrice: 49,
    yearlyPrice: 39,
    pagesIncluded: 2000,
    overage: 0.04,
    popular: true,
    planId: "pro",
    priceId: { monthly: PRICE_IDS.pro_monthly, yearly: PRICE_IDS.pro_yearly },
    features: [
      "2,000 pages/month included",
      "Then $0.04/page overage",
      "Gemini 3 Flash AI extraction",
      "Up to 5 team members",
      "Priority support",
      "Multi-currency support",
    ],
    notIncluded: [],
  },
  {
    name: "Team",
    description: "For collaborative teams",
    monthlyPrice: 99,
    yearlyPrice: 79,
    pagesIncluded: 4000,
    overage: 0.035,
    popular: false,
    planId: "team",
    priceId: { monthly: PRICE_IDS.team_monthly, yearly: PRICE_IDS.team_yearly },
    features: [
      "4,000 pages/month included",
      "Then $0.035/page overage",
      "Gemini 3 Flash AI extraction",
      "Up to 10 team members",
      "Priority support",
    ],
    notIncluded: [],
  },
  {
    name: "Business",
    description: "For larger organizations",
    monthlyPrice: 179,
    yearlyPrice: 149,
    pagesIncluded: 7000,
    overage: 0.03,
    popular: false,
    planId: "business",
    priceId: { monthly: PRICE_IDS.business_monthly, yearly: PRICE_IDS.business_yearly },
    features: [
      "7,000 pages/month included",
      "Then $0.03/page overage",
      "Gemini 3 Flash AI extraction",
      "Unlimited team members",
      "Dedicated support",
    ],
    notIncluded: [],
  },
];

const comparisonData = [
  { feature: "Pages included", free: "50 (trial)", payg: "Pay per use", pro: "2,000/mo", team: "4,000/mo", business: "7,000/mo" },
  { feature: "Cost per page", free: "Free", payg: "$0.05", pro: "~$0.02", team: "~$0.02", business: "~$0.02" },
  { feature: "Team members", free: "1", payg: "1", pro: "5", team: "10", business: "Unlimited" },
  { feature: "AI extraction", free: true, payg: true, pro: true, team: true, business: true },
  { feature: "All export formats", free: true, payg: true, pro: true, team: true, business: true },
  { feature: "Priority support", free: false, payg: false, pro: true, team: true, business: true },
  { feature: "Dedicated support", free: false, payg: false, pro: false, team: false, business: true },
];

const faqs = [
  {
    question: "How does pricing compare to competitors?",
    answer: "Our Pro tier works out to approximately $0.025 per page, compared to $0.16-$0.45 per page from alternatives like Veryfi, Nanonets, or Rossum. We achieve this through efficient use of Gemini 3 Flash AI rather than legacy OCR technology.",
  },
  {
    question: "What counts as a 'page'?",
    answer: "One page equals one side of a document. A 3-page PDF bank statement counts as 3 pages. Multi-page statements are common, so our Pro tier's 2,000 pages typically covers 300-500 statements per month.",
  },
  {
    question: "What happens if I exceed my page limit?",
    answer: "You'll be charged the overage rate for additional pages automatically. For example, Pro tier charges $0.04/page for overage. You can also upgrade to a higher tier at any time.",
  },
  {
    question: "Is there a free trial?",
    answer: "Yes! Our 2-week free trial includes 5 documents and 50 pages to process—no credit card required. This gives you enough to fully test our AI extraction on your real bank statements before committing.",
  },
  {
    question: "What's your accuracy rate?",
    answer: "We achieve 99.2% accuracy on standard bank statements. If accuracy falls below 99% for your documents, contact support—we stand behind our quality.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes. No contracts, no cancellation fees. You can cancel or downgrade your plan at any time from your account settings.",
  },
];

// ============================================
// PRICING CONTENT COMPONENT
// ============================================

export default function PricingContent() {
  const brand = useBrand();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubscribe = async (plan: typeof plans[0]) => {
    const priceId = billingCycle === "monthly" ? plan.priceId.monthly : plan.priceId.yearly;
    
    // Free trial just goes to signup
    if (plan.planId === "free") {
      router.push("/login");
      return;
    }

    if (plan.planId === "enterprise") {
      router.push("/contact");
      return;
    }

    if (!priceId) {
      console.error("No price ID configured");
      return;
    }

    if (!user) {
      sessionStorage.setItem("checkoutIntent", JSON.stringify({ priceId, planId: plan.planId }));
      router.push("/login");
      return;
    }

    setLoadingPlan(plan.planId);
    try {
      const createCheckoutSession = httpsCallable<{ priceId: string; planId: string }, { url: string }>(
        functions, 
        "createCheckoutSession"
      );
      const result = await createCheckoutSession({ priceId, planId: plan.planId });
      if (result.data.url) {
        window.location.href = result.data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="bg-white">
      {/* Hero Section with Header Image */}
      <section className="relative pt-20 overflow-hidden">
        {/* Header Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/headers/pricing-header.png"
            alt="Pricing"
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
                Pricing
              </p>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.1]">
                Simple, transparent pricing
              </h1>
              
              <p className="mt-6 text-xl text-slate-300 leading-relaxed max-w-2xl">
                Start with a 2-week free trial. 5 documents, 50 pages—no credit card required.
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
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-all backdrop-blur-sm"
                >
                  Contact Sales
                </Link>
              </div>

              {/* Billing toggle */}
              <div className="mt-10 inline-flex items-center p-1 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={cn(
                    "px-5 py-2.5 text-sm font-medium rounded-md transition-all",
                    billingCycle === "monthly"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-white hover:text-white/80"
                  )}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={cn(
                    "px-5 py-2.5 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                    billingCycle === "yearly"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-white hover:text-white/80"
                  )}
                >
                  Annual
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-6">
            {plans.map((plan) => (
              <div 
                key={plan.name}
                className={cn(
                  "relative rounded-2xl border transition-all",
                  plan.popular
                    ? "border-2 shadow-xl lg:scale-105 z-10"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-lg"
                )}
                style={plan.popular ? { borderColor: brand.colors.primary } : undefined}
              >
                {plan.popular && (
                  <div 
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: brand.colors.primary }}
                  >
                    Most Popular
                  </div>
                )}

                <div className="p-6">
                  <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{plan.description}</p>

                  <div className="mt-4">
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold text-slate-900">
                        {plan.monthlyPrice === 0 && plan.overage 
                          ? `$${plan.overage}` 
                          : `$${billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}`}
                      </span>
                      <span className="text-slate-500 ml-1">
                        {plan.monthlyPrice === 0 && plan.overage ? "/page" : plan.monthlyPrice > 0 ? "/mo" : ""}
                      </span>
                    </div>
                    {plan.pagesIncluded > 0 && (
                      <p className="text-sm text-slate-600 mt-1">
                        {plan.pagesIncluded.toLocaleString()} pages included
                      </p>
                    )}
                    {plan.monthlyPrice === 0 && !plan.overage && (
                      <p className="text-sm text-slate-600 mt-1">14-day trial</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSubscribe(plan)}
                    disabled={loadingPlan === plan.planId || authLoading}
                    className={cn(
                      "mt-6 w-full py-2.5 px-4 text-sm font-semibold rounded-lg transition-all disabled:opacity-50 cursor-pointer",
                      plan.popular
                        ? "text-white hover:opacity-90"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    )}
                    style={plan.popular ? { backgroundColor: brand.colors.primary } : undefined}
                  >
                    {loadingPlan === plan.planId ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : plan.monthlyPrice === 0 
                      ? "Get Started" 
                      : "Start Free Trial"}
                  </button>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700">{feature}</span>
                      </li>
                    ))}
                    {plan.notIncluded.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <X className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-400">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Enterprise callout */}
          <div className="mt-12 p-8 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Enterprise</h3>
                <p className="mt-2 text-slate-600 max-w-2xl">
                  Need more than 7,000 pages per month? Custom pricing with volume discounts, 
                  SSO/SAML, dedicated support, custom ML fine-tuning, and SLA guarantees.
                </p>
              </div>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Contact Sales
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Cost Comparison */}
      <section className="py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">
              How we compare
            </h2>
            <p className="mt-4 text-slate-600">
              Typical per-page pricing across document processing providers
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-left font-semibold text-slate-900">Provider</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-900">Per Page</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-900">2,000 Pages/mo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-emerald-50">
                  <td className="px-6 py-4 font-semibold text-slate-900">{brand.content.name}</td>
                  <td className="px-6 py-4 text-right text-emerald-700 font-semibold">$0.02</td>
                  <td className="px-6 py-4 text-right text-emerald-700 font-semibold">$49/mo</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-slate-600">Veryfi</td>
                  <td className="px-6 py-4 text-right text-slate-600">$0.16</td>
                  <td className="px-6 py-4 text-right text-slate-600">$320/mo</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-slate-600">DocuClipper</td>
                  <td className="px-6 py-4 text-right text-slate-600">$0.19</td>
                  <td className="px-6 py-4 text-right text-slate-600">$380/mo</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-slate-600">Nanonets</td>
                  <td className="px-6 py-4 text-right text-slate-600">$0.30</td>
                  <td className="px-6 py-4 text-right text-slate-600">$600/mo</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-slate-600">Rossum</td>
                  <td className="px-6 py-4 text-right text-slate-600">$0.45+</td>
                  <td className="px-6 py-4 text-right text-slate-600">$900+/mo</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Prices based on publicly available information as of 2024. Actual pricing may vary.
          </p>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">Compare plans</h2>
            <p className="mt-4 text-slate-600">See what&apos;s included in each tier</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="px-4 py-4 text-left font-semibold text-slate-900">Feature</th>
                  <th className="px-4 py-4 text-center font-semibold text-slate-900">Free</th>
                  <th className="px-4 py-4 text-center font-semibold text-slate-900">Pay-as-you-go</th>
                  <th className="px-4 py-4 text-center font-semibold" style={{ color: brand.colors.primary }}>Pro</th>
                  <th className="px-4 py-4 text-center font-semibold text-slate-900">Team</th>
                  <th className="px-4 py-4 text-center font-semibold text-slate-900">Business</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparisonData.map((row) => (
                  <tr key={row.feature} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700 font-medium">{row.feature}</td>
                    {["free", "payg", "pro", "team", "business"].map((tier) => {
                      const value = row[tier as keyof typeof row];
                      return (
                        <td key={tier} className="px-4 py-3 text-center">
                          {typeof value === "boolean" ? (
                            value ? (
                              <Check className="w-5 h-5 text-emerald-600 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-slate-300 mx-auto" />
                            )
                          ) : (
                            <span className="text-slate-600">{value}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>


      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">Frequently asked questions</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div 
                key={faq.question} 
                className="border border-slate-200 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <span className="font-medium text-slate-900">{faq.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4">
                    <p className="text-slate-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">
            Ready to get started?
          </h2>
          <p className="mt-4 text-lg text-slate-400 max-w-xl mx-auto">
            Try free for 2 weeks. 5 documents, 50 pages—no credit card required.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 text-base font-semibold rounded-lg bg-white text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Start Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 text-base font-semibold rounded-lg border border-slate-600 text-white hover:bg-slate-800 transition-colors"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

