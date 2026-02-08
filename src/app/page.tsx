"use client";

import { AuthProvider } from "@/hooks/use-auth";
import { BrandProvider } from "@/hooks/use-brand";

// Import the full marketing landing page
import LandingPage from "./(marketing)/page";
import MarketingLayout from "./(marketing)/layout";

// Landing page is always visible — logged-in users see a
// "Go to Dashboard" button in the header instead of being
// force-redirected away from the marketing site.
export default function HomePage() {
  return (
    <BrandProvider>
      <AuthProvider>
        <MarketingLayout>
          <LandingPage />
        </MarketingLayout>
      </AuthProvider>
    </BrandProvider>
  );
}
