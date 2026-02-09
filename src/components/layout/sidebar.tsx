"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Receipt,
  Settings,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  BarChart3,
  Key,
  FileText,
  Landmark,
  CreditCard,
  Link2,
  Upload,
  Table,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileSpreadsheet,
  FileCheck,
  ChevronUp,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useBrand } from "@/hooks/use-brand";
import { useSubscription } from "@/hooks/use-subscription";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { useUploadState } from "@/hooks/use-upload-state";
import { BrandLogo } from "@/components/brand";
import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, writeBatch } from "firebase/firestore";

// Max number of sections open at once
const MAX_OPEN = 3;

// Main navigation
const mainNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
];

// Banking section - your bank accounts
const bankingNavigation = [
  { name: "Bank Accounts", href: "/accounts", icon: Building2 },
  { name: "Statements", href: "/statements", icon: FileText },
  { name: "Transactions", href: "/transactions", icon: Receipt },
  { name: "Reconciliation", href: "/reconciliation", icon: Link2 },
];

// Receivables - Money coming IN to you
const receivablesNavigation = [
  { name: "Summary", href: "/receivables", icon: ArrowDownToLine },
  { name: "Invoices", href: "/receivables/invoices", icon: FileCheck },
];

// Payables - Money going OUT from you
const payablesNavigation = [
  { name: "Summary", href: "/payables", icon: ArrowUpFromLine },
  { name: "Bills", href: "/payables/bills", icon: FileSpreadsheet },
];

// AI Tools section - AI-powered utilities
const toolsNavigation = [
  { name: "Smart Extract", href: "/pdf2sheet", icon: Table },
  { name: "AI Insights", href: "/insights", icon: Sparkles },
];

// Admin section - only for admins/owners/developers
const adminNavigation = [
  { name: "Admin Settings", href: "/admin", icon: Shield, adminOnly: true },
  { name: "Billing & Revenue", href: "/admin/billing", icon: CreditCard, adminOnly: true },
  { name: "Usage Analytics", href: "/admin/usage", icon: BarChart3, adminOnly: true },
];

// Section definitions for collapsible groups
type SectionId = "banking" | "receivables" | "payables" | "tools";

const sectionConfig: Record<SectionId, { label: string; icon: any; items: typeof bankingNavigation; prefixes: string[] }> = {
  banking: { label: "Banking", icon: Landmark, items: bankingNavigation, prefixes: ["/accounts", "/statements", "/transactions", "/reconciliation"] },
  receivables: { label: "Receivables", icon: ArrowDownToLine, items: receivablesNavigation, prefixes: ["/receivables"] },
  payables: { label: "Payables", icon: ArrowUpFromLine, items: payablesNavigation, prefixes: ["/payables"] },
  tools: { label: "AI Tools", icon: Sparkles, items: toolsNavigation, prefixes: ["/pdf2sheet", "/insights"] },
};

export function Sidebar() {
  const pathname = usePathname();
  const { signOut, user, organization, isAdmin, isOwner, isDeveloper } = useAuth();
  const brand = useBrand();
  const subscription = useSubscription();
  const { isDemoMode } = useDemoMode();
  const { openDrawer: openUploadDrawer } = useUploadState();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });

  // Collapsible sections — track which are open (no max limit)
  const [openSections, setOpenSections] = useState<SectionId[]>(() => {
    // Default: open the section containing the current route + banking
    const defaults: SectionId[] = ["banking"];
    for (const [id, cfg] of Object.entries(sectionConfig) as [SectionId, typeof sectionConfig[SectionId]][]) {
      if (cfg.prefixes.some(p => typeof window !== "undefined" && window.location.pathname.startsWith(p))) {
        if (!defaults.includes(id)) defaults.push(id);
      }
    }
    if (defaults.length < 2) defaults.push("tools");
    return defaults;
  });

  // Persist collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  // Auto-open section when navigating into it
  useEffect(() => {
    for (const [id, cfg] of Object.entries(sectionConfig) as [SectionId, typeof sectionConfig[SectionId]][]) {
      if (cfg.prefixes.some(p => pathname.startsWith(p)) && !openSections.includes(id)) {
        setOpenSections(prev => [...prev, id]);
        break;
      }
    }
  }, [pathname]);

  const toggleSection = useCallback((id: SectionId) => {
    setOpenSections(prev => {
      if (prev.includes(id)) {
        // Close it
        return prev.filter(s => s !== id);
      }
      // Open it
      return [...prev, id];
    });
  }, []);

  const roleLabel = isOwner ? "Owner" : isAdmin ? "Admin" : isDeveloper ? "Dev" : "Member";
  const [resetting, setResetting] = useState(false);

  const resetDemoData = useCallback(async () => {
    if (resetting || !user?.id) return;
    setResetting(true);
    try {
      const demoId = user.id;
      // Reset transactions to unmatched
      const txSnap = await getDocs(query(collection(db, "transactions"), where("userId", "==", demoId)));
      for (let i = 0; i < txSnap.docs.length; i += 500) {
        const batch = writeBatch(db);
        txSnap.docs.slice(i, i + 500).forEach(doc => {
          batch.update(doc.ref, { reconciliationStatus: "unmatched", matchedDocumentId: null, confidence: null });
        });
        await batch.commit();
      }

      // Reset invoices to unpaid/unmatched
      const invSnap = await getDocs(query(collection(db, "invoices"), where("userId", "==", demoId)));
      for (let i = 0; i < invSnap.docs.length; i += 500) {
        const batch = writeBatch(db);
        invSnap.docs.slice(i, i + 500).forEach(doc => {
          const data = doc.data();
          batch.update(doc.ref, {
            paymentStatus: "unpaid",
            amountRemaining: data.total || data.amountRemaining || 0,
            reconciliationStatus: "unmatched",
            status: "outstanding",
            paidDate: null,
          });
        });
        await batch.commit();
      }

      // Reset bills to unpaid/unmatched
      const billSnap = await getDocs(query(collection(db, "bills"), where("userId", "==", demoId)));
      for (let i = 0; i < billSnap.docs.length; i += 500) {
        const batch = writeBatch(db);
        billSnap.docs.slice(i, i + 500).forEach(doc => {
          const data = doc.data();
          batch.update(doc.ref, {
            paymentStatus: "unpaid",
            amountRemaining: data.total || data.amountRemaining || 0,
            reconciliationStatus: "unmatched",
            status: "outstanding",
            paidDate: null,
          });
        });
        await batch.commit();
      }

      // Delete reconciliation matches
      const matchSnap = await getDocs(query(collection(db, "reconciliation_matches"), where("userId", "==", demoId)));
      for (let i = 0; i < matchSnap.docs.length; i += 500) {
        const batch = writeBatch(db);
        matchSnap.docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      // Delete reconciliation runs
      const runSnap = await getDocs(query(collection(db, "reconciliation_runs"), where("userId", "==", demoId)));
      for (let i = 0; i < runSnap.docs.length; i += 500) {
        const batch = writeBatch(db);
        runSnap.docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      // Reload to refresh all data
      window.location.reload();
    } catch (err) {
      console.error("Failed to reset demo data:", err);
      setResetting(false);
    }
  }, [resetting, user?.id]);

  const NavLink = ({ item, isActive }: { item: { name: string; href: string; icon: any }; isActive: boolean }) => (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        isActive
          ? "brand-nav-active shadow-sm"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      )}
      style={isActive ? { backgroundColor: brand.colors.sidebarActive, color: brand.colors.primaryForeground } : undefined}
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span>{item.name}</span>}
    </Link>
  );

  const isPathActive = (href: string) => {
    if (href === "/receivables" || href === "/payables") {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  const isSectionActive = (id: SectionId) => {
    return sectionConfig[id].prefixes.some(p => pathname.startsWith(p));
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-slate-900 text-slate-100 transition-all duration-200 border-r border-slate-800",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <BrandLogo size="md" collapsed={collapsed} variant="white" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Organization Badge */}
      {!collapsed && organization && (
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/30">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Organization</p>
          <p className="text-sm font-medium text-slate-100 truncate">{organization.name}</p>
        </div>
      )}

      {/* Navigation - Scrollable top section */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {/* Dashboard — always visible */}
        {mainNavigation.map((item) => (
          <NavLink
            key={item.name}
            item={item}
            isActive={pathname === item.href}
          />
        ))}

        {/* Collapsible sections */}
        {(Object.entries(sectionConfig) as [SectionId, typeof sectionConfig[SectionId]][]).map(([id, section]) => {
          const isOpen = openSections.includes(id);
          const hasActive = isSectionActive(id);
          const SectionIcon = section.icon;

          return (
            <div key={id} className="pt-3">
              {!collapsed ? (
                <button
                  onClick={() => toggleSection(id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 rounded-md transition-colors group",
                    hasActive && !isOpen ? "bg-slate-800/50" : "hover:bg-slate-800/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <SectionIcon className={cn("h-3.5 w-3.5", hasActive ? "text-slate-200" : "text-slate-400")} />
                    <span className={cn(
                      "text-[10px] uppercase tracking-wider font-semibold",
                      hasActive ? "text-slate-200" : "text-slate-400"
                    )}>
                      {section.label}
                    </span>
                  </div>
                  <ChevronRight className={cn(
                    "h-3 w-3 text-slate-400 transition-transform duration-200",
                    isOpen && "rotate-90"
                  )} />
                </button>
              ) : (
                <div className="h-px bg-slate-800 my-2" />
              )}

              {/* Collapsible content */}
              <div className={cn(
                "overflow-hidden transition-all duration-200",
                isOpen || collapsed ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0"
              )}>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.name}
                      item={item}
                      isActive={isPathActive(item.href)}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}

      </nav>

      {/* Demo Mode Indicator + Reset */}
      {isDemoMode && (
        <div className="px-3 pb-2">
          {!collapsed ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <p className="text-[11px] font-medium text-amber-300">Demo Mode</p>
              </div>
              <button
                onClick={resetDemoData}
                disabled={resetting}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 transition-colors text-slate-300 hover:text-white disabled:opacity-50"
              >
                <RotateCcw className={cn("h-3.5 w-3.5", resetting && "animate-spin")} />
                <span className="text-[11px] font-medium">{resetting ? "Resetting..." : "Reset Demo Data"}</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <button
                onClick={resetDemoData}
                disabled={resetting}
                className="p-1.5 rounded-md hover:bg-slate-800 transition-colors text-slate-400 hover:text-white disabled:opacity-50"
                title="Reset Demo Data"
              >
                <RotateCcw className={cn("h-3.5 w-3.5", resetting && "animate-spin")} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload Documents */}
      <div className="px-3 pb-3">
        <button
          onClick={() => openUploadDrawer("statement")}
          className={cn(
            "group w-full flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-200",
            "bg-white/10 text-slate-100 border border-white/15 hover:bg-white/[0.17] hover:border-white/25 active:scale-[0.98]",
            collapsed && "justify-center px-0"
          )}
        >
          <Upload className="h-4 w-4 flex-shrink-0 text-slate-300 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:text-white" />
          {!collapsed && <span>Upload Documents</span>}
        </button>
      </div>

      {/* Account Menu - Clean Dropdown */}
      <div className="p-3 border-t border-slate-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors text-left",
                collapsed && "justify-center"
              )}
            >
              {/* Avatar */}
              <div 
                className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold"
                style={{ backgroundColor: brand.colors.primary, color: brand.colors.primaryForeground }}
              >
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{user?.name}</p>
                    {(user as any)?.companyName ? (
                      <p className="text-[10px] text-slate-400 truncate">{(user as any).companyName}</p>
                    ) : (
                      <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                    )}
                  </div>
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent 
            side="right" 
            align="end" 
            className="w-72 bg-white rounded-xl shadow-xl border-0 p-2"
            sideOffset={24}
          >
            {/* Account Header */}
            <div className="px-3 py-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Account</p>
            </div>
            
            {/* User Info */}
            <div className="px-3 pb-3 flex items-center gap-3">
              <div 
                className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold"
                style={{ backgroundColor: brand.colors.primary, color: brand.colors.primaryForeground }}
              >
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                {(user as any)?.companyName && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                    <p className="text-[10px] text-slate-400 truncate">{(user as any).companyName}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Plan Badge */}
            <div className="mx-3 mb-3 p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-900">{subscription.planName}</span>
                {(isOwner || isAdmin || isDeveloper) && (
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded",
                    isOwner ? "bg-amber-100 text-amber-700" : 
                    isAdmin ? "bg-purple-100 text-purple-700" : 
                    "bg-blue-100 text-blue-700"
                  )}>
                    {roleLabel}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {subscription.pagesUsed.toLocaleString()} / {subscription.pagesLimit.toLocaleString()} pages
                </p>
                <span className={cn(
                  "text-[10px] font-medium",
                  subscription.isNearLimit ? "text-amber-600" : 
                  subscription.isOverLimit ? "text-red-600" : 
                  "text-emerald-600"
                )}>
                  {Math.round(subscription.usagePercent)}%
                </span>
              </div>
              {/* Usage bar */}
              <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    subscription.isOverLimit ? "bg-red-500" :
                    subscription.isNearLimit ? "bg-amber-500" :
                    "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(100, subscription.usagePercent)}%` }}
                />
              </div>
            </div>

            <DropdownMenuSeparator />
            
            {/* Menu Items */}
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/settings" className="flex items-center gap-3 px-3 py-2.5">
                <Settings className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-700">Settings</span>
              </Link>
            </DropdownMenuItem>
            
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/settings?tab=billing" className="flex items-center gap-3 px-3 py-2.5">
                <CreditCard className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-700">Subscription</span>
              </Link>
            </DropdownMenuItem>
            
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/settings?tab=team" className="flex items-center gap-3 px-3 py-2.5">
                <Users className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-700">Team</span>
              </Link>
            </DropdownMenuItem>

            {/* Admin links — only for admins/owners/developers */}
            {(isAdmin || isOwner || isDeveloper) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold px-3 py-1.5">
                  Administration
                </DropdownMenuLabel>
                {adminNavigation.map((item) => (
                  <DropdownMenuItem key={item.name} asChild className="cursor-pointer">
                    <Link href={item.href} className="flex items-center gap-3 px-3 py-2.5">
                      <item.icon className="h-4 w-4 text-slate-400" />
                      <span className="text-sm text-slate-700">{item.name}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </>
            )}

            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              onClick={() => signOut()} 
              className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <LogOut className="h-4 w-4" />
                <span className="text-sm">Log out</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
