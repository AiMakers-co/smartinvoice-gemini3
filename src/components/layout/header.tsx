"use client";

import { Search, Command, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface HeaderProps {
  title?: string;
}

// Route-to-breadcrumb mapping
const routeLabels: Record<string, { label: string; parent?: string }> = {
  "/dashboard": { label: "Dashboard" },
  "/accounts": { label: "Bank Accounts", parent: "Banking" },
  "/statements": { label: "Statements", parent: "Banking" },
  "/transactions": { label: "Transactions", parent: "Banking" },
  "/reconciliation": { label: "Reconciliation", parent: "Banking" },
  "/receivables": { label: "Summary", parent: "Receivables" },
  "/receivables/invoices": { label: "Invoices", parent: "Receivables" },
  "/payables": { label: "Summary", parent: "Payables" },
  "/payables/bills": { label: "Bills", parent: "Payables" },
  "/pdf2sheet": { label: "Smart Extract", parent: "AI Tools" },
  "/insights": { label: "AI Insights", parent: "AI Tools" },
  "/settings": { label: "Settings" },
  "/admin": { label: "Admin Settings", parent: "Admin" },
  "/admin/billing": { label: "Billing & Revenue", parent: "Admin" },
  "/admin/usage": { label: "Usage Analytics", parent: "Admin" },
};

export function Header({ title }: HeaderProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+K keyboard shortcut for search (placeholder for future)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen(prev => !prev);
    }
    if (e.key === "Escape") {
      setSearchOpen(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Build breadcrumbs from current path
  const routeInfo = routeLabels[pathname] || null;
  const breadcrumbs: { label: string; href?: string }[] = [];
  if (routeInfo) {
    if (routeInfo.parent) {
      breadcrumbs.push({ label: routeInfo.parent });
    }
    breadcrumbs.push({ label: title || routeInfo.label });
  } else if (title) {
    breadcrumbs.push({ label: title });
  }

  // Greeting for dashboard
  const isDashboard = pathname === "/dashboard";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b bg-white/80 backdrop-blur-sm px-5">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-1.5 min-w-0">
        {isDashboard ? (
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-slate-900">
              {greeting}, {user?.name?.split(" ")[0] || "there"}
            </h1>
            {(user as any)?.companyName && (
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                — {(user as any).companyName}
              </span>
            )}
          </div>
        ) : breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1.5 text-sm">
            <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 transition-colors">
              Home
            </Link>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3 text-slate-300" />
                {i === breadcrumbs.length - 1 ? (
                  <span className="font-semibold text-slate-900">{crumb.label}</span>
                ) : (
                  <span className="text-slate-400">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : title ? (
          <h1 className="text-sm font-semibold text-slate-900">{title}</h1>
        ) : null}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {/* Search trigger (Cmd+K) */}
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="hidden md:flex items-center gap-2 h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="text-xs">Search...</span>
          <kbd className="hidden lg:inline-flex items-center gap-0.5 ml-2 text-[10px] text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

      </div>
    </header>
  );
}
