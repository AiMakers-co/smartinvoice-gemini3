"use client";

import { useAuth } from "./use-auth";

// Plan configuration
const PLAN_CONFIG = {
  free: {
    name: "Free Trial",
    pagesLimit: 50,
    teamLimit: 1,
    monthlyPrice: 0,
    features: ["upload", "export_csv"],
  },
  starter: {
    name: "Pay-as-you-go",
    pagesLimit: 0, // Unlimited with overage at $0.05/page
    teamLimit: 1,
    monthlyPrice: 0,
    overageRate: 0.05,
    features: ["upload", "export_csv", "export_xlsx", "export_json"],
  },
  pro: {
    name: "Pro",
    pagesLimit: 2000,
    teamLimit: 5,
    monthlyPrice: 39,
    overageRate: 0.04,
    features: ["upload", "export_csv", "export_xlsx", "export_json", "api", "priority_support"],
  },
  "pro-yearly": {
    name: "Pro (Annual)",
    pagesLimit: 2000,
    teamLimit: 5,
    monthlyPrice: 31,
    overageRate: 0.04,
    features: ["upload", "export_csv", "export_xlsx", "export_json", "api", "priority_support"],
  },
  team: {
    name: "Team",
    pagesLimit: 4000,
    teamLimit: 10,
    monthlyPrice: 79,
    overageRate: 0.035,
    features: ["upload", "export_csv", "export_xlsx", "export_json", "api", "priority_support", "team", "audit_logs"],
  },
  "team-yearly": {
    name: "Team (Annual)",
    pagesLimit: 4000,
    teamLimit: 10,
    monthlyPrice: 63,
    overageRate: 0.035,
    features: ["upload", "export_csv", "export_xlsx", "export_json", "api", "priority_support", "team", "audit_logs"],
  },
  business: {
    name: "Business",
    pagesLimit: 7000,
    teamLimit: 999, // Unlimited
    monthlyPrice: 149,
    overageRate: 0.03,
    features: ["upload", "export_csv", "export_xlsx", "export_json", "api", "priority_support", "team", "audit_logs", "fraud_detection", "custom_workflows"],
  },
  "business-yearly": {
    name: "Business (Annual)",
    pagesLimit: 7000,
    teamLimit: 999,
    monthlyPrice: 119,
    overageRate: 0.03,
    features: ["upload", "export_csv", "export_xlsx", "export_json", "api", "priority_support", "team", "audit_logs", "fraud_detection", "custom_workflows"],
  },
  enterprise: {
    name: "Enterprise",
    pagesLimit: 16000,
    teamLimit: 999,
    monthlyPrice: 0, // Custom
    features: ["upload", "export_csv", "export_xlsx", "export_json", "api", "priority_support", "team", "audit_logs", "fraud_detection", "custom_workflows", "sso", "dedicated_support"],
  },
};

type PlanId = keyof typeof PLAN_CONFIG;
type Feature = typeof PLAN_CONFIG[PlanId]["features"][number];

export interface SubscriptionInfo {
  // Plan info
  planId: PlanId;
  planName: string;
  status: string;
  isActive: boolean;
  isFree: boolean;
  isTrialing: boolean;
  isPaidPlan: boolean;
  
  // Usage
  pagesUsed: number;
  pagesLimit: number;
  pagesRemaining: number;
  usagePercent: number;
  isOverLimit: boolean;
  isNearLimit: boolean;
  
  // Team
  teamLimit: number;
  hasTeamFeatures: boolean;
  
  // Period
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  daysUntilRenewal: number;
  
  // Feature checks
  canUseFeature: (feature: Feature) => boolean;
  features: readonly Feature[];
}

export function useSubscription(): SubscriptionInfo {
  const { user } = useAuth();
  
  // Get subscription data from user
  const subscription = user?.subscription;
  const planId = (subscription?.planId || "free") as PlanId;
  const planConfig = PLAN_CONFIG[planId] || PLAN_CONFIG.free;
  
  // Status
  const status = subscription?.status || "free";
  const isActive = status === "active" || status === "trialing" || status === "free";
  const isFree = status === "free" || planId === "free";
  const isTrialing = status === "trialing";
  const isPaidPlan = !isFree && planId !== "starter";
  
  // Usage
  const pagesUsed = subscription?.pagesUsedThisMonth || 0;
  const pagesLimit = subscription?.pagesLimit || planConfig.pagesLimit || 50;
  const pagesRemaining = Math.max(0, pagesLimit - pagesUsed);
  const usagePercent = pagesLimit > 0 ? Math.min(100, (pagesUsed / pagesLimit) * 100) : 0;
  const isOverLimit = pagesLimit > 0 && pagesUsed >= pagesLimit;
  const isNearLimit = pagesLimit > 0 && usagePercent >= 80;
  
  // Team
  const teamLimit = planConfig.teamLimit;
  const hasTeamFeatures = teamLimit > 1;
  
  // Period
  const currentPeriodEnd = subscription?.currentPeriodEnd?.toDate?.() 
    || (subscription?.currentPeriodEnd?.seconds 
      ? new Date(subscription.currentPeriodEnd.seconds * 1000) 
      : null);
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd || false;
  const daysUntilRenewal = currentPeriodEnd 
    ? Math.max(0, Math.ceil((currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 30;
  
  // Feature check
  const features = planConfig.features as readonly Feature[];
  const canUseFeature = (feature: Feature): boolean => {
    return features.includes(feature);
  };
  
  return {
    planId,
    planName: planConfig.name,
    status,
    isActive,
    isFree,
    isTrialing,
    isPaidPlan,
    
    pagesUsed,
    pagesLimit,
    pagesRemaining,
    usagePercent,
    isOverLimit,
    isNearLimit,
    
    teamLimit,
    hasTeamFeatures,
    
    currentPeriodEnd,
    cancelAtPeriodEnd,
    daysUntilRenewal,
    
    canUseFeature,
    features,
  };
}
