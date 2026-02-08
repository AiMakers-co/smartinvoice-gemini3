"use client";

import { useEffect, Suspense } from "react";
import { usePathname } from "next/navigation";
import { setAnalyticsUserId, setAnalyticsUserProperties, trackPageView } from "@/lib/analytics";
import { useAuth } from "@/hooks/use-auth";

// ============================================
// ANALYTICS PROVIDER
// ============================================
// Uses Firebase Analytics (which IS Google Analytics 4)
// No external scripts needed - it's all built into Firebase SDK

function AnalyticsProviderInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, firebaseUser } = useAuth();

  // Track page views on route change
  useEffect(() => {
    if (pathname) {
      trackPageView(pathname, document.title);
    }
  }, [pathname]);

  // Set user ID when authenticated
  useEffect(() => {
    if (firebaseUser?.uid) {
      setAnalyticsUserId(firebaseUser.uid);
    }
    
    if (user) {
      setAnalyticsUserProperties({
        plan: user.subscription?.planId || "free",
        account_type: user.orgRole || "member",
      });
    }
  }, [firebaseUser, user]);

  return <>{children}</>;
}

// Wrap in Suspense for usePathname
export function Analytics({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AnalyticsProviderInner>{children}</AnalyticsProviderInner>
    </Suspense>
  );
}
