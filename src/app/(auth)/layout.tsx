"use client";

import { BrandProvider } from "@/hooks/use-brand";
import { AuthProvider } from "@/hooks/use-auth";
import { BrandStyles } from "@/components/brand";
import { Analytics } from "@/components/analytics/AnalyticsProvider";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { MarketingFooter } from "@/components/layout/marketing-footer";

// ============================================
// AUTH LAYOUT
// ============================================

function AuthLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <BrandStyles />
      <MarketingHeader />
      <main className="flex-1 pt-16 lg:pt-20">{children}</main>
      <MarketingFooter />
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <BrandProvider>
        <Analytics>
          <AuthLayoutContent>{children}</AuthLayoutContent>
        </Analytics>
      </BrandProvider>
    </AuthProvider>
  );
}
