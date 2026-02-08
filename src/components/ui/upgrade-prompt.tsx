"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  Zap, 
  TrendingUp, 
  CheckCircle2, 
  ArrowRight,
  Crown,
  Rocket,
  Star,
  X,
  FileText,
  Bot,
  Users,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan?: string;
  pagesUsed?: number;
  pagesLimit?: number;
  trigger?: "limit_reached" | "feature_locked" | "general";
  featureName?: string;
}

// ============================================
// PLAN DATA
// ============================================

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    tagline: "Pay as you go",
    price: "$0.05",
    priceUnit: "/page",
    monthlyPrice: null,
    highlight: false,
    color: "slate",
    features: [
      "Unlimited pages",
      "Pay only for what you use",
      "All document types",
      "CSV & Excel exports",
      "Email support",
    ],
  },
  {
    id: "pro_monthly",
    name: "Pro",
    tagline: "Most popular",
    price: "$49",
    priceUnit: "/month",
    monthlyPrice: 49,
    highlight: true,
    color: "cyan",
    features: [
      "2,000 pages/month",
      "$0.025/page after limit",
      "Priority AI processing",
      "Custom export templates",
      "API access",
      "Priority support",
    ],
  },
  {
    id: "team_monthly",
    name: "Team",
    tagline: "For growing teams",
    price: "$99",
    priceUnit: "/month",
    monthlyPrice: 99,
    highlight: false,
    color: "violet",
    features: [
      "4,000 pages/month",
      "$0.02/page after limit",
      "Up to 5 team members",
      "Team analytics",
      "Shared templates",
      "Dedicated support",
    ],
  },
];

const BENEFITS = [
  {
    icon: Bot,
    title: "Gemini 3 Flash AI",
    description: "99.2% accuracy on complex documents",
  },
  {
    icon: Clock,
    title: "15+ Hours Saved",
    description: "Per month on manual data entry",
  },
  {
    icon: FileText,
    title: "Any Document",
    description: "Statements, invoices, bills, receipts",
  },
  {
    icon: Users,
    title: "Trusted by 1,000+",
    description: "Accountants and finance teams",
  },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function UpgradePrompt({
  open,
  onOpenChange,
  currentPlan = "free",
  pagesUsed = 0,
  pagesLimit = 50,
  trigger = "limit_reached",
  featureName,
}: UpgradePromptProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState("pro_monthly");

  const handleUpgrade = (planId: string) => {
    router.push(`/settings?tab=billing&upgrade=${planId}`);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div 
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>

          {/* Header */}
          <div className="relative px-8 pt-8 pb-6 bg-gradient-to-br from-cyan-500 via-blue-600 to-violet-600 text-white overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
            </div>

            <div className="relative">
              {trigger === "limit_reached" ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Zap className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-white/90">
                      You&apos;ve reached your limit
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">
                    Unlock Unlimited Processing Power
                  </h2>
                  <p className="text-white/80 max-w-xl">
                    You&apos;ve used all <strong>{pagesLimit}</strong> pages this month. 
                    Upgrade now to continue processing documents instantly.
                  </p>
                </>
              ) : trigger === "feature_locked" ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Crown className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-white/90">
                      Premium Feature
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">
                    Unlock {featureName || "This Feature"}
                  </h2>
                  <p className="text-white/80 max-w-xl">
                    Upgrade to access {featureName?.toLowerCase() || "this feature"} and 
                    supercharge your document processing workflow.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                      <Rocket className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-medium text-white/90">
                      Upgrade Your Plan
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">
                    Process More, Spend Less Time
                  </h2>
                  <p className="text-white/80 max-w-xl">
                    Join thousands of accountants saving 15+ hours every month 
                    with AI-powered document processing.
                  </p>
                </>
              )}

              {/* Usage bar */}
              {trigger === "limit_reached" && (
                <div className="mt-4 p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-white/70">Pages used this month</span>
                    <span className="font-semibold">{pagesUsed} / {pagesLimit}</span>
                  </div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-white rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 1, delay: 0.3 }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Benefits */}
          <div className="px-8 py-4 bg-slate-50 border-b">
            <div className="grid grid-cols-4 gap-4">
              {BENEFITS.map((benefit, idx) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + idx * 0.1 }}
                  className="flex items-start gap-2"
                >
                  <div className="p-1.5 bg-cyan-100 rounded-lg shrink-0">
                    <benefit.icon className="h-3.5 w-3.5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{benefit.title}</p>
                    <p className="text-[10px] text-slate-500">{benefit.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Plans */}
          <div className="px-8 py-6">
            <div className="grid grid-cols-3 gap-4">
              {PLANS.map((plan, idx) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={cn(
                    "relative p-5 rounded-xl border-2 cursor-pointer transition-all",
                    selectedPlan === plan.id 
                      ? "border-cyan-500 bg-cyan-50/50 shadow-lg shadow-cyan-500/10" 
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                    plan.highlight && "ring-2 ring-cyan-500/20"
                  )}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        MOST POPULAR
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500">{plan.tagline}</p>
                  </div>

                  <div className="mb-4">
                    <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                    <span className="text-sm text-slate-500">{plan.priceUnit}</span>
                  </div>

                  <ul className="space-y-2 mb-5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpgrade(plan.id);
                    }}
                    className={cn(
                      "w-full",
                      plan.highlight || selectedPlan === plan.id
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
                        : "bg-slate-900 hover:bg-slate-800"
                    )}
                  >
                    {plan.highlight ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Get Started
                      </>
                    ) : (
                      <>
                        Choose {plan.name}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-slate-50 border-t flex items-center justify-between">
            <p className="text-xs text-slate-500">
              🔒 Secure payment via Stripe • Cancel anytime • 30-day money-back guarantee
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/pricing")}
              className="text-xs"
            >
              Compare all plans
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================
// COMPACT INLINE VERSION
// ============================================

export function UpgradeInline({ 
  pagesUsed = 0, 
  pagesLimit = 50,
  className,
}: { 
  pagesUsed?: number; 
  pagesLimit?: number;
  className?: string;
}) {
  const router = useRouter();
  const usagePercent = Math.min(100, (pagesUsed / pagesLimit) * 100);
  const isAtLimit = pagesUsed >= pagesLimit;

  if (!isAtLimit) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 rounded-lg">
          <Zap className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-900 mb-1">
            Page limit reached
          </h4>
          <p className="text-xs text-amber-700 mb-3">
            You&apos;ve used all {pagesLimit} pages this month. Upgrade to continue processing.
          </p>
          <Button
            size="sm"
            onClick={() => router.push("/settings?tab=billing")}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
            Upgrade Now
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
