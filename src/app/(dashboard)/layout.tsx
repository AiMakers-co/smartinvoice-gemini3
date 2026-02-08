/**
 * Dashboard Layout
 * 
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                         LAYOUT CONVENTIONS                                  ║
 * ╠════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                            ║
 * ║  1. FULL WIDTH PAGES (default for all dashboard pages)                     ║
 * ║     - Pages should use the FULL available width                            ║
 * ║     - DO NOT use max-w-* constraints on page content wrappers              ║
 * ║     - The sidebar already constrains the available space                   ║
 * ║                                                                            ║
 * ║  2. PAGE STRUCTURE (standard pattern):                                     ║
 * ║     <div className="flex flex-col h-full bg-slate-50">                     ║
 * ║       <Header title="Page Title" />                                        ║
 * ║       <div className="flex-1 p-4 overflow-auto">                           ║
 * ║         <div className="space-y-4">                                        ║
 * ║           Page content - NO max-width here!                                ║
 * ║         </div>                                                             ║
 * ║       </div>                                                               ║
 * ║     </div>                                                                 ║
 * ║                                                                            ║
 * ║  3. WHEN TO USE max-w-* (rare exceptions only):                            ║
 * ║     - Single-column forms (e.g., /accounts/new uses max-w-md)              ║
 * ║     - Admin pages with narrow content (max-w-3xl or max-w-6xl)             ║
 * ║     - NEVER on data-heavy pages (tables, lists, dashboards)                ║
 * ║                                                                            ║
 * ║  4. CARDS & GRIDS:                                                         ║
 * ║     - Use responsive grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3      ║
 * ║     - Cards expand to fill available space                                 ║
 * ║     - Let content breathe - wide screens show more columns                 ║
 * ║                                                                            ║
 * ║  5. COLORS (Ormandy brand):                                                ║
 * ║     - Primary: ormandy-red (#E31B54)                                       ║
 * ║     - Background: bg-slate-50 (pages), bg-white (cards)                    ║
 * ║     - Text: text-slate-900 (primary), text-slate-500 (secondary)           ║
 * ║                                                                            ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Sidebar } from "@/components/layout/sidebar";
import { ProcessingBanner } from "@/components/layout/processing-banner";
import { useAuth, AuthProvider } from "@/hooks/use-auth";
import { BrandProvider, useBrand } from "@/hooks/use-brand";
import { BrandStyles } from "@/components/brand";
import { AIAssistantProvider, AIAssistantSidebar } from "@/components/ai-assistant";
import { FinancialChatPanel } from "@/components/financial-chat";
import { Analytics } from "@/components/analytics/AnalyticsProvider";
import { DemoModeProvider } from "@/hooks/use-demo-mode";
import { UploadStateProvider } from "@/hooks/use-upload-state";
import { UploadDrawer } from "@/components/upload/upload-drawer";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const brand = useBrand();
  const [checkingIntent, setCheckingIntent] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Handle checkout intent from pricing page
  useEffect(() => {
    if (!user || loading || checkingIntent) return;

    const checkoutIntent = sessionStorage.getItem("checkoutIntent");
    if (checkoutIntent) {
      setCheckingIntent(true);
      sessionStorage.removeItem("checkoutIntent");
      
      try {
        const { priceId } = JSON.parse(checkoutIntent);
        if (priceId) {
          // Create checkout session
          const createCheckoutSession = httpsCallable<
            { priceId: string },
            { url: string }
          >(functions, "createCheckoutSession");
          
          createCheckoutSession({ priceId })
            .then((result) => {
              if (result.data.url) {
                window.location.href = result.data.url;
              }
            })
            .catch((error) => {
              console.error("Error creating checkout session:", error);
              setCheckingIntent(false);
            });
        }
      } catch (error) {
        console.error("Error parsing checkout intent:", error);
        setCheckingIntent(false);
      }
    }
  }, [user, loading, checkingIntent]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div 
            className="h-12 w-12 rounded-full flex items-center justify-center animate-pulse"
            style={{ backgroundColor: brand.colors.primary }}
          >
            <div className="h-5 w-5 rounded-full" style={{ backgroundColor: brand.colors.primaryForeground }} />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AIAssistantProvider>
      {/* Inject brand CSS variables */}
      <BrandStyles />
      <div className="flex h-screen bg-background">
        <Sidebar />
        {/* Main area - FULL WIDTH. Do NOT add max-w-* to pages! */}
        <main className="flex-1 overflow-auto flex flex-col">
          {/* Page content */}
          <div className="flex-1 overflow-auto">{children}</div>
        </main>
        
        {/* Global processing indicator — fixed bottom bar */}
        <ProcessingBanner />
        
        {/* AI Assistant Sidebar */}
        <AIAssistantSidebar />
        
        {/* Financial Chat Panel — "Ask SmartInvoice" */}
        <FinancialChatPanel />
        
        {/* Global Upload Drawer — persists across page navigation */}
        <UploadDrawer />
      </div>
    </AIAssistantProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BrandProvider>
      <AuthProvider>
        <DemoModeProvider>
          <UploadStateProvider>
            <Analytics>
              <DashboardLayoutContent>{children}</DashboardLayoutContent>
            </Analytics>
          </UploadStateProvider>
        </DemoModeProvider>
      </AuthProvider>
    </BrandProvider>
  );
}
