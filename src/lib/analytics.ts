"use client";

import { getAnalytics, logEvent, setUserId, setUserProperties, isSupported } from "firebase/analytics";
import app from "./firebase";

// ============================================
// FIREBASE ANALYTICS (= Google Analytics 4)
// ============================================
// Firebase Analytics IS GA4 - same data, same dashboard
// No need for separate gtag scripts

let analytics: ReturnType<typeof getAnalytics> | null = null;

// Initialize analytics (only in browser)
async function getAnalyticsInstance() {
  if (typeof window === "undefined") return null;
  
  if (!analytics) {
    const supported = await isSupported();
    if (supported) {
      analytics = getAnalytics(app);
    }
  }
  return analytics;
}

// ============================================
// PAGE & EVENT TRACKING
// ============================================

/**
 * Track a custom event
 */
export async function trackEvent(eventName: string, params?: Record<string, string | number | boolean>) {
  const instance = await getAnalyticsInstance();
  if (instance) {
    logEvent(instance, eventName, params);
  }
}

/**
 * Track page view (automatic with Firebase, but can be called manually)
 */
export async function trackPageView(pagePath: string, pageTitle?: string) {
  const instance = await getAnalyticsInstance();
  if (instance) {
    logEvent(instance, "page_view", {
      page_path: pagePath,
      page_title: pageTitle,
    });
  }
}

// ============================================
// CONVERSION EVENTS
// ============================================

/**
 * Track signup conversion
 */
export async function trackSignUp(method: "email" | "google" = "email") {
  const instance = await getAnalyticsInstance();
  if (instance) {
    logEvent(instance, "sign_up", { method });
  }
}

/**
 * Track trial start
 */
export async function trackTrialStart(planId: string) {
  const instance = await getAnalyticsInstance();
  if (instance) {
    logEvent(instance, "start_trial", { plan_id: planId });
  }
}

/**
 * Track purchase/subscription
 */
export async function trackPurchase(params: {
  planId: string;
  value: number;
  currency?: string;
  transactionId?: string;
}) {
  const instance = await getAnalyticsInstance();
  if (instance) {
    logEvent(instance, "purchase", {
      transaction_id: params.transactionId,
      value: params.value,
      currency: params.currency || "USD",
      items: [{ item_id: params.planId, item_name: params.planId }],
    });
  }
}

/**
 * Track plan upgrade
 */
export async function trackUpgrade(fromPlan: string, toPlan: string, value: number) {
  const instance = await getAnalyticsInstance();
  if (instance) {
    logEvent(instance, "upgrade", {
      from_plan: fromPlan,
      to_plan: toPlan,
      value,
      currency: "USD",
    });
  }
}

// ============================================
// USAGE EVENTS
// ============================================

/**
 * Track document upload
 */
export async function trackDocumentUpload(fileType: string, pageCount: number) {
  const instance = await getAnalyticsInstance();
  if (instance) {
    logEvent(instance, "document_upload", {
      file_type: fileType,
      page_count: pageCount,
    });
  }
}

/**
 * Track page processing
 */
export async function trackPageProcessed(pageCount: number, documentType: string) {
  const instance = await getAnalyticsInstance();
  if (instance) {
    logEvent(instance, "page_processed", {
      page_count: pageCount,
      document_type: documentType,
    });
  }
}

/**
 * Track export
 */
export async function trackExport(format: string, transactionCount: number) {
  const instance = await getAnalyticsInstance();
  if (instance) {
    logEvent(instance, "export", {
      format,
      transaction_count: transactionCount,
    });
  }
}

// ============================================
// ENGAGEMENT EVENTS
// ============================================

/**
 * Track CTA click
 */
export async function trackCTAClick(ctaName: string, location: string) {
  const instance = await getAnalyticsInstance();
  if (instance) {
    logEvent(instance, "cta_click", {
      cta_name: ctaName,
      location,
    });
  }
}

/**
 * Track pricing page view
 */
export async function trackPricingView(source?: string) {
  const instance = await getAnalyticsInstance();
  if (instance) {
    logEvent(instance, "view_pricing", { source });
  }
}

// ============================================
// USER IDENTIFICATION
// ============================================

/**
 * Set user ID for cross-device tracking
 */
export async function setAnalyticsUserId(userId: string) {
  const instance = await getAnalyticsInstance();
  if (instance) {
    setUserId(instance, userId);
  }
}

/**
 * Set user properties
 */
export async function setAnalyticsUserProperties(properties: Record<string, string>) {
  const instance = await getAnalyticsInstance();
  if (instance) {
    setUserProperties(instance, properties);
  }
}
