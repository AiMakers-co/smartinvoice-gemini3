"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { 
  User, 
  Bell, 
  Save, 
  Check, 
  Mail,
  Building2,
  AlertCircle,
  Moon,
  Sun,
  Monitor,
  Trash2,
  Database,
  Loader2,
  AlertTriangle,
  CreditCard,
  Zap,
  Shield,
  KeyRound,
  Link2,
  Clock,
  Users,
  Crown,
  FileText,
  ExternalLink,
  CheckCircle2,
  TrendingUp,
  X,
  Sparkles,
  UserPlus,
  Info,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { collection, query, where, getDocs, writeBatch, doc, onSnapshot, orderBy, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useBrand } from "@/hooks/use-brand";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Timestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";
import type { AuthProvider, AuthProviderInfo } from "@/types";

// ============================================
// GOOGLE ICON SVG COMPONENT
// ============================================

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ============================================
// PRICING CONFIGURATION
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
    id: "starter",
    name: "Pay-as-you-go",
    description: "Pay only for what you use",
    monthlyPrice: 0,
    yearlyPrice: 0,
    priceDisplay: "$0.05",
    priceUnit: "/page",
    pagesIncluded: 0,
    overage: 0.05,
    teamMembers: 1,
    popular: false,
    priceId: { monthly: PRICE_IDS.starter, yearly: PRICE_IDS.starter },
    features: [
      { text: "Unlimited pages at $0.05/page", included: true },
      { text: "Gemini 3 Flash AI extraction", included: true },
      { text: "All export formats + JSON", included: true },
      { text: "1 user", included: true },
      { text: "Email support", included: true },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For growing businesses",
    monthlyPrice: 49,
    yearlyPrice: 39,
    priceDisplay: null,
    priceUnit: "/mo",
    pagesIncluded: 2000,
    overage: 0.04,
    teamMembers: 5,
    popular: true,
    priceId: { monthly: PRICE_IDS.pro_monthly, yearly: PRICE_IDS.pro_yearly },
    features: [
      { text: "2,000 pages/month included", included: true },
      { text: "Then $0.04/page overage", included: true },
      { text: "Up to 5 team members", included: true },
      { text: "Priority support", included: true },
    ],
  },
  {
    id: "team",
    name: "Team",
    description: "For collaborative teams",
    monthlyPrice: 99,
    yearlyPrice: 79,
    priceDisplay: null,
    priceUnit: "/mo",
    pagesIncluded: 4000,
    overage: 0.035,
    teamMembers: 10,
    popular: false,
    priceId: { monthly: PRICE_IDS.team_monthly, yearly: PRICE_IDS.team_yearly },
    features: [
      { text: "4,000 pages/month included", included: true },
      { text: "Then $0.035/page overage", included: true },
      { text: "Up to 10 team members", included: true },
      { text: "Priority support", included: true },
    ],
  },
  {
    id: "business",
    name: "Business",
    description: "For larger organizations",
    monthlyPrice: 179,
    yearlyPrice: 149,
    priceDisplay: null,
    priceUnit: "/mo",
    pagesIncluded: 7000,
    overage: 0.03,
    teamMembers: 999,
    popular: false,
    priceId: { monthly: PRICE_IDS.business_monthly, yearly: PRICE_IDS.business_yearly },
    features: [
      { text: "7,000 pages/month included", included: true },
      { text: "Then $0.03/page overage", included: true },
      { text: "Unlimited team members", included: true },
      { text: "Dedicated support", included: true },
    ],
  },
];

const PLAN_NAMES: Record<string, string> = {
  free: "Free Trial",
  starter: "Pay-as-you-go",
  pro: "Pro",
  "pro-yearly": "Pro (Annual)",
  team: "Team",
  "team-yearly": "Team (Annual)",
  business: "Business",
  "business-yearly": "Business (Annual)",
  enterprise: "Enterprise",
};

const TEAM_LIMITS: Record<string, number> = {
  free: 1,
  starter: 1,
  pro: 5,
  "pro-yearly": 5,
  team: 10,
  "team-yearly": 10,
  business: 999,
  "business-yearly": 999,
  enterprise: 999,
};

// Feature comparison matrix
const FEATURE_MATRIX = [
  { 
    category: "Processing",
    features: [
      { name: "Pages per month", free: "50", starter: "Unlimited", pro: "2,000", team: "4,000", business: "7,000" },
      { name: "Overage rate", free: "—", starter: "$0.05/pg", pro: "$0.04/pg", team: "$0.035/pg", business: "$0.03/pg" },
      { name: "Gemini AI extraction", free: true, starter: true, pro: true, team: true, business: true },
      { name: "Bank statement processing", free: true, starter: true, pro: true, team: true, business: true },
      { name: "Invoice/Bill processing", free: true, starter: true, pro: true, team: true, business: true },
    ]
  },
  {
    category: "Export & Integration",
    features: [
      { name: "CSV export", free: true, starter: true, pro: true, team: true, business: true },
      { name: "Excel export", free: true, starter: true, pro: true, team: true, business: true },
      { name: "JSON export", free: true, starter: true, pro: true, team: true, business: true },
      { name: "API access", free: false, starter: false, pro: true, team: true, business: true },
      { name: "Webhooks", free: false, starter: false, pro: false, team: true, business: true },
    ]
  },
  {
    category: "Team & Collaboration",
    features: [
      { name: "Team members", free: "1", starter: "1", pro: "5", team: "10", business: "Unlimited" },
      { name: "Role-based access", free: false, starter: false, pro: true, team: true, business: true },
      { name: "Shared workspace", free: false, starter: false, pro: true, team: true, business: true },
      { name: "Audit logs", free: false, starter: false, pro: false, team: true, business: true },
    ]
  },
  {
    category: "Support",
    features: [
      { name: "Email support", free: true, starter: true, pro: true, team: true, business: true },
      { name: "Priority support", free: false, starter: false, pro: true, team: true, business: true },
      { name: "Dedicated support", free: false, starter: false, pro: false, team: false, business: true },
      { name: "SLA guarantee", free: false, starter: false, pro: false, team: false, business: true },
    ]
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatRelativeTime(timestamp: Timestamp | undefined): string {
  if (!timestamp) return "Never";
  
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getProviderDisplayName(provider: AuthProvider): string {
  switch (provider) {
    case "google": return "Google";
    case "email": return "Email & Password";
    default: return provider;
  }
}

// ============================================
// SECURITY TAB COMPONENT
// ============================================

function SecurityTab({ 
  authProviders, 
  lastAuthProvider,
  userEmail,
  onLinkGoogle,
  googleLinking,
}: { 
  authProviders: AuthProviderInfo[];
  lastAuthProvider?: AuthProvider;
  userEmail?: string;
  onLinkGoogle: () => Promise<void>;
  googleLinking: boolean;
}) {
  const hasEmail = authProviders.some(p => p.provider === "email");
  const hasGoogle = authProviders.some(p => p.provider === "google");
  
  const emailProvider = authProviders.find(p => p.provider === "email");
  const googleProvider = authProviders.find(p => p.provider === "google");

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-slate-500" />
            <CardTitle className="text-sm font-semibold">Sign-in Methods</CardTitle>
          </div>
          <CardDescription className="text-xs">Manage how you sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 space-y-3">
          {/* Email & Password */}
          <div className={`relative p-4 rounded-xl border-2 transition-all ${hasEmail ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/50'}`}>
            <div className="flex items-start gap-4">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${hasEmail ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                <Mail className={`h-5 w-5 ${hasEmail ? 'text-emerald-600' : 'text-slate-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900">Email & Password</p>
                  {hasEmail && lastAuthProvider === "email" && (
                    <Badge className="h-5 px-2 text-[10px] font-medium bg-emerald-100 text-emerald-700 border-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last used
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {hasEmail ? userEmail : "Not connected"}
                </p>
                {hasEmail && emailProvider?.lastUsedAt && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Last sign-in: {formatRelativeTime(emailProvider.lastUsedAt)}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0">
                {hasEmail ? (
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <Check className="h-4 w-4" />
                    <span className="text-xs font-medium">Connected</span>
                  </div>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Not linked</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Google */}
          <div className={`relative p-4 rounded-xl border-2 transition-all ${hasGoogle ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-white cursor-pointer'}`}>
            <div className="flex items-start gap-4">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${hasGoogle ? 'bg-white shadow-sm border border-slate-100' : 'bg-slate-200'}`}>
                <GoogleIcon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900">Google</p>
                  {hasGoogle && lastAuthProvider === "google" && (
                    <Badge className="h-5 px-2 text-[10px] font-medium bg-blue-100 text-blue-700 border-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last used
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {hasGoogle ? "Sign in with one click" : "Fast & secure sign-in"}
                </p>
                {hasGoogle && googleProvider?.lastUsedAt && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Last sign-in: {formatRelativeTime(googleProvider.lastUsedAt)}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0">
                {hasGoogle ? (
                  <div className="flex items-center gap-1.5 text-blue-600">
                    <Check className="h-4 w-4" />
                    <span className="text-xs font-medium">Connected</span>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs h-8 gap-1.5"
                    onClick={onLinkGoogle}
                    disabled={googleLinking}
                  >
                    {googleLinking ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Linking...
                      </>
                    ) : (
                      <>
                        <Link2 className="h-3.5 w-3.5" />
                        Connect
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm bg-amber-50/50 border-amber-100">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Shield className="h-4.5 w-4.5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Security Tip</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {!hasGoogle && !hasEmail ? (
                  "Connect at least one sign-in method to secure your account."
                ) : !hasGoogle ? (
                  "Link your Google account for faster, more secure sign-in with two-factor authentication."
                ) : !hasEmail ? (
                  "Consider adding a password as a backup sign-in method."
                ) : (
                  "Great job! You have multiple sign-in methods connected for account recovery."
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// DATA MANAGEMENT TAB COMPONENT
// ============================================

function DataManagementTab({ userId }: { userId?: string }) {
  const [dataCounts, setDataCounts] = useState({
    accounts: 0,
    statements: 0,
    transactions: 0,
    invoices: 0,
    lineItems: 0,
    templates: 0,
    bills: 0,
  });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  useEffect(() => {
    if (!userId) return;
    
    const loadCounts = async () => {
      setLoading(true);
      try {
        const collections = [
          { name: "accounts", key: "accounts" },
          { name: "statements", key: "statements" },
          { name: "transactions", key: "transactions" },
          { name: "invoices", key: "invoices" },
          { name: "invoice_line_items", key: "lineItems" },
          { name: "invoice_templates", key: "templates" },
          { name: "bills", key: "bills" },
        ];

        const counts: Record<string, number> = {};
        
        for (const col of collections) {
          const q = query(collection(db, col.name), where("userId", "==", userId));
          const snapshot = await getDocs(q);
          counts[col.key] = snapshot.size;
        }

        setDataCounts(counts as typeof dataCounts);
      } catch (error) {
        console.error("Error loading counts:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCounts();
  }, [userId]);

  const handleClearDatabase = async () => {
    if (!userId || confirmText !== "DELETE") return;

    setDeleting(true);
    try {
      const collections = [
        "transactions",
        "invoice_line_items",
        "statements",
        "invoices",
        "invoice_templates",
        "accounts",
        "bills",
      ];

      for (const colName of collections) {
        const q = query(collection(db, colName), where("userId", "==", userId));
        const snapshot = await getDocs(q);
        
        const batchSize = 500;
        let batch = writeBatch(db);
        let count = 0;

        for (const docSnap of snapshot.docs) {
          batch.delete(doc(db, colName, docSnap.id));
          count++;

          if (count >= batchSize) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }

        if (count > 0) {
          await batch.commit();
        }
      }

      setDeleteSuccess(true);
      setConfirmText("");
      setDataCounts({
        accounts: 0,
        statements: 0,
        transactions: 0,
        invoices: 0,
        lineItems: 0,
        templates: 0,
        bills: 0,
      });

      setTimeout(() => setDeleteSuccess(false), 5000);
    } catch (error) {
      console.error("Error clearing database:", error);
      alert("Failed to clear database. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const totalItems = Object.values(dataCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold">Data Overview</CardTitle>
          <CardDescription className="text-xs">Your stored data across all collections</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Bank Accounts</p>
                <p className="text-lg font-semibold text-slate-900">{dataCounts.accounts}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Statements</p>
                <p className="text-lg font-semibold text-slate-900">{dataCounts.statements}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Transactions</p>
                <p className="text-lg font-semibold text-slate-900">{dataCounts.transactions}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Invoices</p>
                <p className="text-lg font-semibold text-slate-900">{dataCounts.invoices}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Line Items</p>
                <p className="text-lg font-semibold text-slate-900">{dataCounts.lineItems}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Templates</p>
                <p className="text-lg font-semibold text-slate-900">{dataCounts.templates}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500">Bills</p>
                <p className="text-lg font-semibold text-slate-900">{dataCounts.bills}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-red-200">
        <CardHeader className="py-3 px-4 bg-red-50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <CardTitle className="text-sm font-semibold text-red-900">Danger Zone</CardTitle>
          </div>
          <CardDescription className="text-xs text-red-700">
            Irreversible actions. Proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-4 space-y-4">
          {deleteSuccess ? (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200 text-center">
              <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-900">Database Cleared Successfully</p>
              <p className="text-xs text-green-700 mt-1">All your data has been deleted.</p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <div className="flex items-start gap-3">
                  <Trash2 className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900">Clear All Data</p>
                    <p className="text-xs text-red-700 mt-1">
                      This will permanently delete all your data including:
                    </p>
                    <ul className="text-xs text-red-600 mt-2 space-y-0.5">
                      <li>• {dataCounts.accounts} bank accounts</li>
                      <li>• {dataCounts.statements} statements</li>
                      <li>• {dataCounts.transactions} transactions</li>
                      <li>• {dataCounts.invoices} invoices</li>
                      <li>• {dataCounts.lineItems} line items</li>
                      <li>• {dataCounts.templates} templates</li>
                      <li>• {dataCounts.bills} bills</li>
                    </ul>
                    <p className="text-xs text-red-800 font-medium mt-3">
                      Total: {totalItems} items will be deleted
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-700">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm
                </Label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="h-9 text-sm font-mono"
                  disabled={deleting || totalItems === 0}
                />
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearDatabase}
                disabled={confirmText !== "DELETE" || deleting || totalItems === 0}
                className="w-full"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Data
                  </>
                )}
              </Button>

              {totalItems === 0 && (
                <p className="text-xs text-slate-500 text-center">No data to delete</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// TEAM TAB COMPONENT
// ============================================

interface Invoice {
  id: string;
  amount: number;
  status: string;
  created: Date;
  invoicePdf?: string;
}

interface SubscriptionStatus {
  status: string;
  plan: string;
  planId: string;
  pagesUsed: number;
  pagesLimit: number;
  pagesRemaining: number;
  overagePages: number;
  estimatedOverageCharge: number;
  currentPeriodEnd?: { _seconds: number };
  cancelAtPeriodEnd?: boolean;
  trialEnd?: { _seconds: number };
}

function TeamTab({ user, brand }: { user: any; brand: any }) {
  const planId = user?.subscription?.planId || "free";
  const teamLimit = TEAM_LIMITS[planId] || 1;
  const hasTeamFeatures = teamLimit > 1;
  
  const getInitials = (name: string) => 
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  if (!hasTeamFeatures) {
    return (
      <div className="space-y-4">
        <Card className="shadow-sm">
          <CardHeader className="text-center pb-2">
            <div 
              className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: `${brand.colors.primary}15` }}
            >
              <Users className="w-8 h-8" style={{ color: brand.colors.primary }} />
            </div>
            <CardTitle className="text-lg">Team Collaboration</CardTitle>
            <CardDescription className="text-sm">
              Invite team members to collaborate on document processing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-slate-900 text-sm">Team features include:</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-500" />
                  Invite up to 10 team members
                </li>
                <li className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-500" />
                  Shared workspace & documents
                </li>
                <li className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-500" />
                  Role-based access control
                </li>
              </ul>
            </div>
            
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-3">
                Available on Pro plan and above
              </p>
              <Link href="/pricing">
                <Button 
                  className="w-full"
                  style={{ backgroundColor: brand.colors.primary }}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Upgrade to Pro
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Team Management</h3>
          <p className="text-xs text-slate-500">
            {teamLimit >= 999 ? "Unlimited" : `Up to ${teamLimit}`} team members on your plan
          </p>
        </div>
        <Badge 
          className="text-xs"
          style={{ backgroundColor: `${brand.colors.primary}15`, color: brand.colors.primary }}
        >
          {planId.replace("-yearly", "")} Plan
        </Badge>
      </div>

      {/* Current User (Owner) */}
      <Card className="shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback 
                className="text-white text-[10px]"
                style={{ backgroundColor: brand.colors.primary }}
              >
                {getInitials(user?.name || "U")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-900">{user?.name}</p>
              <p className="text-[10px] text-slate-500">{user?.email}</p>
            </div>
            <Badge className="h-5 text-[10px]">
              <Crown className="h-2.5 w-2.5 mr-1" />
              Owner
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Team Features Coming Soon */}
      <Card className="shadow-sm border-dashed">
        <CardHeader className="py-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400" />
            Team Members
          </CardTitle>
          <CardDescription className="text-xs">
            Team invitation features coming soon
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600 mb-1">
              Team invitations coming soon
            </p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              You&apos;ll be able to invite team members and manage roles here. 
              For now, contact support if you need to add team members.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Plan Info */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Your Team Capacity</p>
              <p className="text-xs text-slate-500 mt-0.5">
                1 of {teamLimit >= 999 ? "unlimited" : teamLimit} seats used
              </p>
            </div>
            <Link href="/pricing">
              <Button variant="outline" size="sm" className="text-xs h-7">
                {teamLimit < 10 ? "Need more seats?" : "View Plans"}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// TRIAL COUNTDOWN COMPONENT
// ============================================

function TrialCountdown({ 
  trialEnd, 
  brand 
}: { 
  trialEnd: Date; 
  brand: any;
}) {
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60)) % 24);
  
  if (daysRemaining > 7) return null; // Only show when 7 days or less
  
  const urgency = daysRemaining <= 1 ? "critical" : daysRemaining <= 3 ? "warning" : "info";
  
  return (
    <div className={cn(
      "rounded-xl p-4 border",
      urgency === "critical" ? "bg-red-50 border-red-200" :
      urgency === "warning" ? "bg-amber-50 border-amber-200" :
      "bg-blue-50 border-blue-200"
    )}>
      <div className="flex items-center gap-4">
        <div className={cn(
          "flex flex-col items-center justify-center h-14 w-14 rounded-xl",
          urgency === "critical" ? "bg-red-100" :
          urgency === "warning" ? "bg-amber-100" :
          "bg-blue-100"
        )}>
          <span className={cn(
            "text-2xl font-bold leading-none",
            urgency === "critical" ? "text-red-600" :
            urgency === "warning" ? "text-amber-600" :
            "text-blue-600"
          )}>
            {daysRemaining}
          </span>
          <span className={cn(
            "text-[10px] uppercase font-medium",
            urgency === "critical" ? "text-red-500" :
            urgency === "warning" ? "text-amber-500" :
            "text-blue-500"
          )}>
            {daysRemaining === 1 ? "day" : "days"}
          </span>
        </div>
        
        <div className="flex-1">
          <h4 className={cn(
            "font-semibold text-sm",
            urgency === "critical" ? "text-red-900" :
            urgency === "warning" ? "text-amber-900" :
            "text-blue-900"
          )}>
            {daysRemaining === 0 
              ? "Your trial ends today!"
              : daysRemaining === 1 
                ? "Your trial ends tomorrow!"
                : `Your trial ends in ${daysRemaining} days`
            }
          </h4>
          <p className={cn(
            "text-xs mt-0.5",
            urgency === "critical" ? "text-red-700" :
            urgency === "warning" ? "text-amber-700" :
            "text-blue-700"
          )}>
            {daysRemaining === 0 
              ? `Only ${hoursRemaining} hours left. Subscribe now to keep your access.`
              : "Subscribe now to continue processing documents without interruption."
            }
          </p>
        </div>
        
        <Link href="/settings?tab=billing">
          <Button 
            size="sm"
            className={cn(
              "text-white",
              urgency === "critical" ? "bg-red-600 hover:bg-red-700" :
              urgency === "warning" ? "bg-amber-600 hover:bg-amber-700" :
              ""
            )}
            style={urgency === "info" ? { backgroundColor: brand.colors.primary } : undefined}
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            Subscribe
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ============================================
// FEATURE COMPARISON TABLE COMPONENT
// ============================================

function FeatureComparisonTable({ currentPlanId, brand }: { currentPlanId: string; brand: any }) {
  const planColumns = ["free", "starter", "pro", "team", "business"];
  const planNames = ["Free", "Pay-as-you-go", "Pro", "Team", "Business"];
  
  const renderValue = (value: boolean | string) => {
    if (typeof value === "boolean") {
      return value ? (
        <Check className="w-4 h-4 text-emerald-500 mx-auto" />
      ) : (
        <X className="w-4 h-4 text-slate-300 mx-auto" />
      );
    }
    return <span className="text-xs text-slate-700">{value}</span>;
  };
  
  const isCurrentPlan = (planId: string) => {
    return currentPlanId === planId || 
      currentPlanId === `${planId}-yearly` || 
      currentPlanId === `${planId}-monthly` ||
      (planId === "free" && currentPlanId === "free");
  };
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4 font-medium text-slate-500 w-48">Feature</th>
            {planColumns.map((plan, i) => (
              <th 
                key={plan}
                className={cn(
                  "py-3 px-3 text-center font-semibold text-xs",
                  isCurrentPlan(plan) && "bg-slate-50"
                )}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-slate-900">{planNames[i]}</span>
                  {isCurrentPlan(plan) && (
                    <span 
                      className="text-[9px] px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: brand.colors.primary }}
                    >
                      Current
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FEATURE_MATRIX.map((category) => (
            <>
              <tr key={category.category} className="bg-slate-50/50">
                <td colSpan={6} className="py-2 px-4 font-semibold text-xs text-slate-600 uppercase tracking-wide">
                  {category.category}
                </td>
              </tr>
              {category.features.map((feature) => (
                <tr key={feature.name} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 text-slate-700">{feature.name}</td>
                  {planColumns.map((plan) => (
                    <td 
                      key={plan}
                      className={cn(
                        "py-2.5 px-3 text-center",
                        isCurrentPlan(plan) && "bg-slate-50/80"
                      )}
                    >
                      {renderValue(feature[plan as keyof typeof feature] as boolean | string)}
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// DOWNGRADE CONFIRMATION DIALOG
// ============================================

interface DowngradeDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentPlan: string;
  targetPlan: string;
  loading?: boolean;
  brand: any;
}

function DowngradeConfirmationDialog({ 
  open, 
  onClose, 
  onConfirm, 
  currentPlan, 
  targetPlan,
  loading,
  brand 
}: DowngradeDialogProps) {
  if (!open) return null;
  
  // Features lost when downgrading
  const featureLosses: Record<string, string[]> = {
    "pro_to_starter": [
      "2,000 included pages/month",
      "Discounted overage rate ($0.04 vs $0.05)",
      "Team members (5 → 1)",
      "API access",
      "Priority support",
    ],
    "team_to_pro": [
      "2,000 additional pages/month",
      "Discounted overage rate ($0.035 vs $0.04)",
      "Team members (10 → 5)",
      "Webhooks",
      "Audit logs",
    ],
    "business_to_team": [
      "3,000 additional pages/month",
      "Discounted overage rate ($0.03 vs $0.035)",
      "Unlimited team members (→ 10)",
      "Dedicated support",
      "SLA guarantee",
    ],
  };
  
  const lostFeatures = featureLosses[`${currentPlan}_to_${targetPlan}`] || [
    "Some included pages",
    "Team member capacity",
    "Support level may change",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-amber-50 px-6 py-4 border-b border-amber-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Confirm Downgrade</h3>
              <p className="text-xs text-slate-500">
                {PLAN_NAMES[currentPlan] || currentPlan} → {PLAN_NAMES[targetPlan] || targetPlan}
              </p>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-sm text-slate-600 mb-4">
            Your plan will change immediately. Proration is handled by Stripe.
          </p>
          
          <ul className="space-y-2 mb-4">
            {lostFeatures.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <X className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-slate-700">{feature}</span>
              </li>
            ))}
          </ul>
          
          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
            <strong>Note:</strong> You can upgrade again at any time from Billing.
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Keep Current Plan
          </Button>
          <Button 
            size="sm" 
            onClick={onConfirm}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Processing...</>
            ) : (
              "Confirm Downgrade"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PLAN RECOMMENDATION COMPONENT
// ============================================

interface PlanRecommendationProps {
  pagesUsed: number;
  currentPlanId: string;
  billingCycle: "monthly" | "yearly";
  brand: any;
  onSelectPlan: (planId: string) => void;
}

function PlanRecommendation({ 
  pagesUsed, 
  currentPlanId, 
  billingCycle,
  brand,
  onSelectPlan,
}: PlanRecommendationProps) {
  // Calculate monthly usage estimate (use 6-month average if available, else current)
  const estimatedMonthlyUsage = pagesUsed;
  
  // Calculate cost for each plan
  const calculateMonthlyCost = (plan: typeof plans[0], usage: number) => {
    const basePrice = billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
    
    if (plan.id === "starter") {
      return usage * plan.overage;
    }
    
    const overagePages = Math.max(0, usage - plan.pagesIncluded);
    return basePrice + (overagePages * plan.overage);
  };
  
  // Find the best value plan
  const planCosts = plans.map(plan => ({
    ...plan,
    monthlyCost: calculateMonthlyCost(plan, estimatedMonthlyUsage),
    isCurrentPlan: currentPlanId === plan.id || 
      currentPlanId === `${plan.id}-yearly` || 
      currentPlanId === `${plan.id}-monthly`,
  }));
  
  const bestValuePlan = planCosts
    .filter(p => !p.isCurrentPlan && p.id !== "free")
    .sort((a, b) => a.monthlyCost - b.monthlyCost)[0];
  
  const currentPlanCost = planCosts.find(p => p.isCurrentPlan);
  
  if (!bestValuePlan || !currentPlanCost) return null;
  
  // Only show if there's meaningful savings
  const potentialSavings = currentPlanCost.monthlyCost - bestValuePlan.monthlyCost;
  if (potentialSavings < 5) return null;
  
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-emerald-100 rounded-lg">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-emerald-900 text-sm">Save money with a better plan</h4>
          <p className="text-xs text-emerald-700 mt-1">
            Based on your usage ({estimatedMonthlyUsage.toLocaleString()} pages/month), 
            switching to <strong>{bestValuePlan.name}</strong> would cost 
            <strong> ${bestValuePlan.monthlyCost.toFixed(2)}/month</strong> vs 
            your current <strong>${currentPlanCost.monthlyCost.toFixed(2)}/month</strong>.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <Button 
              size="sm" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              onClick={() => onSelectPlan(bestValuePlan.id)}
            >
              Switch to {bestValuePlan.name}
              <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded text-[10px]">
                Save ${potentialSavings.toFixed(0)}/mo
              </span>
            </Button>
            <span className="text-xs text-emerald-600">
              {billingCycle === "yearly" ? "Billed annually" : "Billed monthly"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// USAGE HISTORY COMPONENT
// ============================================

interface UsageHistoryProps {
  userId: string;
}

function UsageHistory({ userId }: UsageHistoryProps) {
  const [history, setHistory] = useState<Array<{ month: string; pages: number; limit: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    
    const loadHistory = async () => {
      try {
        // Query usage records for the last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const usageQuery = query(
          collection(db, "usage_records"),
          where("userId", "==", userId),
          where("createdAt", ">=", sixMonthsAgo),
          orderBy("createdAt", "desc"),
          limit(180) // ~6 months of daily records
        );
        
        const snapshot = await getDocs(usageQuery);
        
        // Aggregate by month
        const monthlyMap = new Map<string, { pages: number; limit: number }>();
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const date = data.createdAt?.toDate?.() || new Date();
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          
          const existing = monthlyMap.get(monthKey) || { pages: 0, limit: data.pagesLimit || 50 };
          existing.pages += data.pagesProcessed || 0;
          monthlyMap.set(monthKey, existing);
        });
        
        // Convert to array and format
        const historyData = Array.from(monthlyMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-6)
          .map(([key, data]) => {
            const [year, month] = key.split("-");
            const date = new Date(parseInt(year), parseInt(month) - 1);
            return {
              month: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
              pages: data.pages,
              limit: data.limit,
            };
          });
        
        setHistory(historyData);
      } catch (error) {
        console.error("Error loading usage history:", error);
        // Generate sample data if no history exists
        const now = new Date();
        const sampleHistory = Array.from({ length: 6 }, (_, i) => {
          const date = new Date(now);
          date.setMonth(date.getMonth() - (5 - i));
          return {
            month: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
            pages: 0,
            limit: 50,
          };
        });
        setHistory(sampleHistory);
      } finally {
        setLoading(false);
      }
    };
    
    loadHistory();
  }, [userId]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }
  
  const maxPages = Math.max(...history.map(h => Math.max(h.pages, h.limit)), 50);
  
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-900">Usage History</h4>
        <span className="text-xs text-slate-500">Last 6 months</span>
      </div>
      
      <div className="flex items-end gap-2 h-32">
        {history.map((item, i) => {
          const heightPercent = (item.pages / maxPages) * 100;
          const limitPercent = (item.limit / maxPages) * 100;
          const isOverLimit = item.pages > item.limit;
          
          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="relative w-full h-24 flex items-end">
                {/* Limit line */}
                <div 
                  className="absolute w-full border-t border-dashed border-slate-300"
                  style={{ bottom: `${limitPercent}%` }}
                />
                {/* Usage bar */}
                <div 
                  className={cn(
                    "w-full rounded-t transition-all",
                    isOverLimit ? "bg-red-400" : "bg-blue-400"
                  )}
                  style={{ height: `${Math.min(heightPercent, 100)}%` }}
                />
              </div>
              <div className="mt-2 text-center">
                <p className="text-[10px] text-slate-500">{item.month}</p>
                <p className="text-xs font-medium text-slate-700">{item.pages}</p>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-400" />
          <span>Pages used</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 border-t border-dashed border-slate-400" />
          <span>Plan limit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-400" />
          <span>Over limit</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// BILLING TAB COMPONENT
// ============================================

// Payment method type
interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface BillingAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface BillingDetails {
  paymentMethod: PaymentMethod | null;
  billingAddress: BillingAddress | null;
  emailReceipts: boolean;
  email?: string;
  name?: string;
}

function BillingTab({ user, firebaseUser, brand, checkoutSuccess, checkoutCancelled }: { user: any; firebaseUser: any; brand: any; checkoutSuccess?: boolean; checkoutCancelled?: boolean }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [showPlans, setShowPlans] = useState(false);
  const [showFeatureMatrix, setShowFeatureMatrix] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(checkoutSuccess);
  const [showCancelledBanner, setShowCancelledBanner] = useState(checkoutCancelled);
  const [showUsageHistory, setShowUsageHistory] = useState(false);
  const [downgradeDialog, setDowngradeDialog] = useState<{ open: boolean; targetPlan: string }>({ open: false, targetPlan: "" });
  
  // Billing details state
  const [billingDetails, setBillingDetails] = useState<BillingDetails | null>(null);
  const [billingDetailsLoading, setBillingDetailsLoading] = useState(false);
  const [emailReceiptsUpdating, setEmailReceiptsUpdating] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState<BillingAddress>({
    line1: "", line2: "", city: "", state: "", postalCode: "", country: "US"
  });
  const [addressSaving, setAddressSaving] = useState(false);

  // Auto-hide banners after 10 seconds
  useEffect(() => {
    if (showSuccessBanner) {
      const timer = setTimeout(() => setShowSuccessBanner(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessBanner]);

  useEffect(() => {
    if (showCancelledBanner) {
      const timer = setTimeout(() => setShowCancelledBanner(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [showCancelledBanner]);

  const loadSubscription = useCallback(async () => {
    if (!firebaseUser) return;
    
    try {
      const getSubscriptionStatus = httpsCallable<object, SubscriptionStatus>(
        functions,
        "getSubscriptionStatus"
      );
      const result = await getSubscriptionStatus({});
      setSubscriptionData(result.data);
    } catch (error) {
      console.error("Error loading subscription:", error);
      if (user?.subscription) {
        setSubscriptionData({
          status: user.subscription.status || "free",
          plan: user.subscription.planId || "free",
          planId: user.subscription.planId || "free",
          pagesUsed: user.subscription.pagesUsedThisMonth || 0,
          pagesLimit: user.subscription.pagesLimit || 50,
          pagesRemaining: Math.max(0, (user.subscription.pagesLimit || 50) - (user.subscription.pagesUsedThisMonth || 0)),
          overagePages: 0,
          estimatedOverageCharge: 0,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, user]);

  useEffect(() => {
    if (!firebaseUser) return;
    loadSubscription();
  }, [firebaseUser, loadSubscription]);

  useEffect(() => {
    if (!firebaseUser?.uid) return;

    const invoicesQuery = query(
      collection(db, "users", firebaseUser.uid, "invoices"),
      orderBy("created", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(invoicesQuery, (snapshot) => {
      setInvoices(
        snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            amount: (data.amount || data.amount_paid || 0) / 100,
            status: data.status || "paid",
            created: data.created?.toDate?.() || new Date(data.created?._seconds * 1000) || new Date(),
            invoicePdf: data.invoicePdf || data.invoice_pdf,
          };
        })
      );
    }, (error) => {
      console.error("Error loading invoices:", error);
    });

    return () => unsubscribe();
  }, [firebaseUser?.uid]);

  // Load billing details (payment method, address, preferences)
  const loadBillingDetails = useCallback(async () => {
    if (!firebaseUser) return;
    
    setBillingDetailsLoading(true);
    try {
      const getBillingDetails = httpsCallable<object, BillingDetails>(
        functions,
        "getBillingDetails"
      );
      const result = await getBillingDetails({});
      setBillingDetails(result.data);
      
      // Pre-fill address form if we have an address
      if (result.data.billingAddress) {
        setAddressForm(result.data.billingAddress);
      }
    } catch (error) {
      console.error("Error loading billing details:", error);
    } finally {
      setBillingDetailsLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (firebaseUser) {
      loadBillingDetails();
    }
  }, [firebaseUser, loadBillingDetails]);

  // Toggle email receipts
  const handleToggleEmailReceipts = async () => {
    if (!billingDetails) return;
    
    setEmailReceiptsUpdating(true);
    try {
      const updateBillingPreferences = httpsCallable<{ emailReceipts: boolean }, { success: boolean }>(
        functions,
        "updateBillingPreferences"
      );
      await updateBillingPreferences({ emailReceipts: !billingDetails.emailReceipts });
      setBillingDetails({ ...billingDetails, emailReceipts: !billingDetails.emailReceipts });
    } catch (error) {
      console.error("Error updating email preferences:", error);
      alert("Failed to update preferences. Please try again.");
    } finally {
      setEmailReceiptsUpdating(false);
    }
  };

  // Save billing address
  const handleSaveAddress = async () => {
    setAddressSaving(true);
    try {
      const updateBillingAddress = httpsCallable<{ address: BillingAddress }, { success: boolean }>(
        functions,
        "updateBillingAddress"
      );
      await updateBillingAddress({ address: addressForm });
      setBillingDetails(prev => prev ? { ...prev, billingAddress: addressForm } : null);
      setShowAddressForm(false);
    } catch (error) {
      console.error("Error updating address:", error);
      alert("Failed to update address. Please try again.");
    } finally {
      setAddressSaving(false);
    }
  };

  const openPortal = useCallback(async () => {
    if (!firebaseUser) return;
    
    setPortalLoading(true);
    try {
      const createPortalSession = httpsCallable<object, { url: string }>(
        functions,
        "createPortalSession"
      );
      const result = await createPortalSession({});
      if (result.data.url) {
        window.location.href = result.data.url;
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      alert("Failed to open billing portal. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }, [firebaseUser]);

  // Plan tier order for determining upgrades vs downgrades
  const planTierOrder = ["free", "starter", "pro", "team", "business"];
  
  const isDowngrade = (fromPlan: string, toPlan: string): boolean => {
    const fromTier = planTierOrder.indexOf(fromPlan.replace("-yearly", "").replace("-monthly", ""));
    const toTier = planTierOrder.indexOf(toPlan.replace("-yearly", "").replace("-monthly", ""));
    return toTier < fromTier && toTier >= 0;
  };

  const handleSelectPlan = async (plan: typeof plans[0]) => {
    const priceId = billingCycle === "monthly" ? plan.priceId.monthly : plan.priceId.yearly;
    
    if (!priceId) {
      console.error("No price ID configured for", plan.id);
      return;
    }

    // Check if this is a downgrade
    if (isDowngrade(currentPlanId, plan.id)) {
      setDowngradeDialog({ open: true, targetPlan: plan.id });
      return;
    }

    if (isFree) {
      await processCheckout(priceId, plan.id);
      return;
    }
    
    setLoadingPlan(plan.id);
    try {
      const updatePlan = httpsCallable<{ priceId: string; planId: string; isDowngrade?: boolean }, { subscriptionId: string }>(
        functions,
        "updateSubscriptionPlan"
      );
      await updatePlan({ priceId, planId: plan.id, isDowngrade: false });
      await loadSubscription();
    } catch (error) {
      console.error("Plan update error:", error);
      alert("Failed to change plan. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };
  
  const processCheckout = async (priceId: string, planId: string) => {
    setLoadingPlan(planId);
    try {
      const createCheckoutSession = httpsCallable<{ priceId: string; planId: string; successUrl: string; cancelUrl: string }, { url: string }>(
        functions, 
        "createCheckoutSession"
      );
      const origin = window.location.origin;
      const result = await createCheckoutSession({ 
        priceId,
        planId,
        successUrl: `${origin}/settings?tab=billing&success=true`,
        cancelUrl: `${origin}/settings?tab=billing&cancelled=true`,
      });
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
  
  const handleConfirmDowngrade = async () => {
    const targetPlan = plans.find(p => p.id === downgradeDialog.targetPlan);
    if (!targetPlan) return;
    
    const priceId = billingCycle === "monthly" ? targetPlan.priceId.monthly : targetPlan.priceId.yearly;
    setDowngradeDialog({ open: false, targetPlan: "" });
    
    setLoadingPlan(targetPlan.id);
    try {
      const updatePlan = httpsCallable<{ priceId: string; planId: string; isDowngrade?: boolean }, { subscriptionId: string }>(
        functions,
        "updateSubscriptionPlan"
      );
      await updatePlan({ priceId, planId: targetPlan.id, isDowngrade: true });
      await loadSubscription();
    } catch (error) {
      console.error("Plan downgrade error:", error);
      alert("Failed to change plan. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const currentPlanId = subscriptionData?.planId || user?.subscription?.planId || "free";
  const status = subscriptionData?.status || user?.subscription?.status || "free";
  const planName = PLAN_NAMES[currentPlanId] || "Free Trial";
  
  const pagesUsed = subscriptionData?.pagesUsed || user?.subscription?.pagesUsedThisMonth || 0;
  const pagesLimit = subscriptionData?.pagesLimit || user?.subscription?.pagesLimit || 50;
  const usagePercent = pagesLimit > 0 ? Math.min(100, (pagesUsed / pagesLimit) * 100) : 0;
  
  const periodEnd = subscriptionData?.currentPeriodEnd?._seconds 
    ? new Date(subscriptionData.currentPeriodEnd._seconds * 1000)
    : user?.subscription?.currentPeriodEnd?.toDate?.() 
    || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
  const cancelAtPeriodEnd = subscriptionData?.cancelAtPeriodEnd || false;
  const isTrialing = status === "trialing";
  const isActive = status === "active" || status === "trialing";
  const isPastDue = status === "past_due";
  const isFree = status === "free" || currentPlanId === "free";
  
  // Trial end date
  const trialEnd = subscriptionData?.trialEnd?._seconds 
    ? new Date(subscriptionData.trialEnd._seconds * 1000)
    : user?.subscription?.trialEnd?.toDate?.() 
    || null;

  // Find current plan details
  const currentPlanDetails = plans.find(p => 
    currentPlanId === p.id || 
    currentPlanId === `${p.id}-yearly` || 
    currentPlanId === `${p.id}-monthly`
  );

  return (
    <div className="space-y-4">
      {/* Checkout Success Banner */}
      {showSuccessBanner && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 relative">
          <button 
            onClick={() => setShowSuccessBanner(false)}
            className="absolute top-3 right-3 text-emerald-600 hover:text-emerald-800"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-900">Welcome to your new plan! 🎉</h3>
              <p className="text-sm text-emerald-700 mt-1">
                Your subscription is now active. You can start processing documents immediately.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Cancelled Banner */}
      {showCancelledBanner && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 relative">
          <button 
            onClick={() => setShowCancelledBanner(false)}
            className="absolute top-3 right-3 text-amber-600 hover:text-amber-800"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Info className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900">No worries, take your time!</h3>
              <p className="text-sm text-amber-700 mt-1">
                Your checkout was cancelled. You can continue using the free tier or upgrade anytime.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trial Countdown - Shows when trialing and within 7 days */}
      {isTrialing && trialEnd && (
        <TrialCountdown trialEnd={trialEnd} brand={brand} />
      )}

      {/* Current Plan Hero - More Prominent */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div 
                className="p-4 rounded-2xl"
                style={{ backgroundColor: `${brand.colors.primary}10` }}
              >
                {!isFree ? (
                  <Crown className="w-8 h-8" style={{ color: brand.colors.primary }} />
                ) : (
                  <Sparkles className="w-8 h-8" style={{ color: brand.colors.primary }} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-bold text-slate-900">{planName}</h2>
                  {isActive && !isFree && !isTrialing && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active
                    </span>
                  )}
                  {isTrialing && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      <Clock className="w-3.5 h-3.5" />
                      Trial
                    </span>
                  )}
                  {isPastDue && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Past Due
                    </span>
                  )}
                  {isFree && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      Free Tier
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">
                  {isFree 
                    ? "50 free pages to try SmartInvoice" 
                    : currentPlanId === "starter"
                      ? "Pay only for what you use • $0.05 per page"
                      : currentPlanDetails 
                        ? `${currentPlanDetails.pagesIncluded.toLocaleString()} pages/month • $${currentPlanDetails.overage}/page overage`
                        : "Unlimited processing"
                  }
                </p>
                {cancelAtPeriodEnd && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Cancels on {periodEnd.toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {isFree ? (
                <Button 
                  onClick={() => setShowPlans(!showPlans)}
                  style={{ backgroundColor: brand.colors.primary }}
                  className="text-white"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Upgrade Now
                </Button>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowPlans(!showPlans)}
                  >
                    {showPlans ? "Hide Plans" : "Change Plan"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openPortal}
                    disabled={portalLoading}
                  >
                    {portalLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Manage Billing
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Usage Stats Bar */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          {currentPlanId === "starter" ? (
            // Pay-as-you-go specific stats
            <div className="grid grid-cols-4 gap-6">
              <div>
                <p className="text-2xl font-bold text-slate-900">{pagesUsed.toLocaleString()}</p>
                <p className="text-xs text-slate-500">Pages processed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">${(pagesUsed * 0.05).toFixed(2)}</p>
                <p className="text-xs text-slate-500">Estimated bill</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">$0.05</p>
                <p className="text-xs text-slate-500">Per page rate</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {periodEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
                <p className="text-xs text-slate-500">Next billing date</p>
              </div>
            </div>
          ) : (
            // Standard plan stats
            <div className="grid grid-cols-4 gap-6">
              <div>
                <p className="text-2xl font-bold text-slate-900">{pagesUsed.toLocaleString()}</p>
                <p className="text-xs text-slate-500">Pages used</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {pagesLimit > 0 ? Math.max(0, pagesLimit - pagesUsed).toLocaleString() : "∞"}
                </p>
                <p className="text-xs text-slate-500">Pages remaining</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{pagesLimit > 0 ? pagesLimit.toLocaleString() : "∞"}</p>
                <p className="text-xs text-slate-500">Monthly limit</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
                </p>
                <p className="text-xs text-slate-500">Days until reset</p>
              </div>
            </div>
          )}
          
          {/* Progress Bar - only show for plans with limits */}
          {pagesLimit > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-500">Usage this period</span>
                <span className="font-medium text-slate-700">{Math.round(usagePercent)}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${usagePercent}%`,
                    backgroundColor: usagePercent > 90 ? "#ef4444" : usagePercent > 75 ? "#f59e0b" : brand.colors.primary
                  }}
                />
              </div>
            </div>
          )}

          {/* Overage warning for standard plans */}
          {pagesLimit > 0 && pagesUsed > pagesLimit && currentPlanDetails && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                You&apos;ve used {(pagesUsed - pagesLimit).toLocaleString()} overage pages • 
                Estimated charge: <strong>${((pagesUsed - pagesLimit) * currentPlanDetails.overage).toFixed(2)}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Payment & Billing Details Card */}
      {!isFree && (
        <Card className="shadow-sm">
          <CardHeader className="py-4 px-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Payment & Billing</CardTitle>
                <CardDescription className="text-sm">Manage your payment method and billing details</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={openPortal}
                disabled={portalLoading}
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Stripe Portal
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {billingDetailsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                {/* Payment Method */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <CreditCard className="w-4 h-4" />
                    Payment Method
                  </div>
                  {billingDetails?.paymentMethod ? (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="p-2 bg-white rounded shadow-sm">
                        {billingDetails.paymentMethod.brand === "visa" && (
                          <svg className="w-8 h-5" viewBox="0 0 48 32" fill="none">
                            <rect width="48" height="32" rx="4" fill="#1434CB"/>
                            <path d="M18.5 21.5h-3l2-11h3l-2 11zm8.5-10.7c-.6-.2-1.5-.5-2.7-.5-3 0-5.1 1.5-5.1 3.7 0 1.6 1.5 2.5 2.6 3 1.2.6 1.6 1 1.6 1.5 0 .8-1 1.2-1.9 1.2-1.3 0-2-.2-3-.6l-.4-.2-.5 2.6c.8.3 2.2.6 3.6.6 3.2 0 5.2-1.5 5.3-3.8 0-1.3-.8-2.3-2.5-3.1-1-.5-1.7-.9-1.7-1.4 0-.5.5-1 1.7-1 1 0 1.7.2 2.2.4l.3.1.4-2.5zm7.9-.3h-2.3c-.7 0-1.3.2-1.6.9l-4.5 10.1h3.2l.6-1.7h3.9l.4 1.7h2.8l-2.5-11zm-3.7 7.1l1.2-3.1.3-.9.2.9.7 3.1h-2.4zm-14.7-7.1l-3 7.5-.3-1.5c-.5-1.8-2.2-3.8-4.1-4.7l2.7 9.7h3.2l4.8-11h-3.3z" fill="white"/>
                          </svg>
                        )}
                        {billingDetails.paymentMethod.brand === "mastercard" && (
                          <svg className="w-8 h-5" viewBox="0 0 48 32" fill="none">
                            <rect width="48" height="32" rx="4" fill="#F9F9F9"/>
                            <circle cx="19" cy="16" r="10" fill="#EB001B"/>
                            <circle cx="29" cy="16" r="10" fill="#F79E1B"/>
                            <path d="M24 8.5a10 10 0 000 15 10 10 0 000-15z" fill="#FF5F00"/>
                          </svg>
                        )}
                        {billingDetails.paymentMethod.brand === "amex" && (
                          <svg className="w-8 h-5" viewBox="0 0 48 32" fill="none">
                            <rect width="48" height="32" rx="4" fill="#006FCF"/>
                            <path d="M7 16h34v2H7v-2z" fill="white"/>
                          </svg>
                        )}
                        {!["visa", "mastercard", "amex"].includes(billingDetails.paymentMethod.brand) && (
                          <CreditCard className="w-8 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 capitalize">
                          {billingDetails.paymentMethod.brand} •••• {billingDetails.paymentMethod.last4}
                        </p>
                        <p className="text-xs text-slate-500">
                          Expires {billingDetails.paymentMethod.expMonth}/{billingDetails.paymentMethod.expYear}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={openPortal}
                      className="w-full p-3 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-slate-300 hover:text-slate-600 transition-colors"
                    >
                      + Add payment method
                    </button>
                  )}
                </div>

                {/* Billing Address */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Building2 className="w-4 h-4" />
                      Billing Address
                    </div>
                    {billingDetails?.billingAddress && !showAddressForm && (
                      <button 
                        onClick={() => setShowAddressForm(true)}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {showAddressForm ? (
                    <div className="space-y-2">
                      <Input
                        placeholder="Address line 1"
                        value={addressForm.line1}
                        onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                        className="text-sm"
                      />
                      <Input
                        placeholder="Address line 2 (optional)"
                        value={addressForm.line2}
                        onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
                        className="text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="City"
                          value={addressForm.city}
                          onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                          className="text-sm"
                        />
                        <Input
                          placeholder="State"
                          value={addressForm.state}
                          onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Postal code"
                          value={addressForm.postalCode}
                          onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                          className="text-sm"
                        />
                        <Select 
                          value={addressForm.country} 
                          onValueChange={(value) => setAddressForm({ ...addressForm, country: value })}
                        >
                          <SelectTrigger className="text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="US">United States</SelectItem>
                            <SelectItem value="GB">United Kingdom</SelectItem>
                            <SelectItem value="CA">Canada</SelectItem>
                            <SelectItem value="AU">Australia</SelectItem>
                            <SelectItem value="DE">Germany</SelectItem>
                            <SelectItem value="FR">France</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={handleSaveAddress}
                          disabled={addressSaving}
                          style={{ backgroundColor: brand.colors.primary }}
                          className="text-white"
                        >
                          {addressSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowAddressForm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : billingDetails?.billingAddress?.line1 ? (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                      <p className="text-slate-900">{billingDetails.billingAddress.line1}</p>
                      {billingDetails.billingAddress.line2 && (
                        <p className="text-slate-900">{billingDetails.billingAddress.line2}</p>
                      )}
                      <p className="text-slate-600">
                        {billingDetails.billingAddress.city}, {billingDetails.billingAddress.state} {billingDetails.billingAddress.postalCode}
                      </p>
                      <p className="text-slate-500">{billingDetails.billingAddress.country}</p>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowAddressForm(true)}
                      className="w-full p-3 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-slate-300 hover:text-slate-600 transition-colors"
                    >
                      + Add billing address
                    </button>
                  )}
                </div>

                {/* Email Receipts */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Mail className="w-4 h-4" />
                    Email Receipts
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {billingDetails?.emailReceipts ? "Enabled" : "Disabled"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {billingDetails?.emailReceipts 
                            ? "Receive invoices by email" 
                            : "No email receipts"}
                        </p>
                      </div>
                      <button
                        onClick={handleToggleEmailReceipts}
                        disabled={emailReceiptsUpdating}
                        className={cn(
                          "relative w-11 h-6 rounded-full transition-colors",
                          billingDetails?.emailReceipts ? "bg-emerald-500" : "bg-slate-300"
                        )}
                      >
                        {emailReceiptsUpdating ? (
                          <Loader2 className="w-4 h-4 animate-spin absolute top-1 left-1 text-white" />
                        ) : (
                          <span
                            className={cn(
                              "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                              billingDetails?.emailReceipts ? "translate-x-5" : "translate-x-0.5"
                            )}
                          />
                        )}
                      </button>
                    </div>
                    {billingDetails?.email && (
                      <p className="text-xs text-slate-400 mt-2">
                        Sent to: {billingDetails.email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan Recommendation - Shows savings suggestions for paid users */}
      {!isFree && pagesUsed > 0 && (
        <PlanRecommendation 
          pagesUsed={pagesUsed}
          currentPlanId={currentPlanId}
          billingCycle={billingCycle}
          brand={brand}
          onSelectPlan={(planId) => {
            const plan = plans.find(p => p.id === planId);
            if (plan) handleSelectPlan(plan);
          }}
        />
      )}

      {/* Usage History Toggle & Chart */}
      {firebaseUser?.uid && (
        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4 border-b cursor-pointer hover:bg-slate-50" onClick={() => setShowUsageHistory(!showUsageHistory)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-500" />
                <CardTitle className="text-sm font-semibold">Usage History</CardTitle>
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 text-slate-400 transition-transform",
                showUsageHistory && "rotate-90"
              )} />
            </div>
          </CardHeader>
          {showUsageHistory && (
            <CardContent className="p-4">
              <UsageHistory userId={firebaseUser.uid} />
            </CardContent>
          )}
        </Card>
      )}

      {/* Upgrade Prompt for Free Users */}
      {isFree && !showPlans && (
        <div 
          className="rounded-xl p-6 text-white"
          style={{ background: `linear-gradient(135deg, ${brand.colors.primary} 0%, ${brand.colors.primary}dd 100%)` }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">Unlock Full Potential</h3>
              <p className="text-white/80 text-sm">
                Get more pages, team collaboration, and priority support with a paid plan.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-sm">
                  <Check className="w-4 h-4" />
                  <span>2,000+ pages/month</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Check className="w-4 h-4" />
                  <span>Team members</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Check className="w-4 h-4" />
                  <span>Priority support</span>
                </div>
              </div>
            </div>
            <Button 
              variant="secondary" 
              className="bg-white text-slate-900 hover:bg-slate-100"
              onClick={() => setShowPlans(true)}
            >
              View Plans
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Plans Section - Collapsible for paid users */}
      {(showPlans || isFree) && (
        <Card className="shadow-sm">
          <CardHeader className="py-4 px-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  {isFree ? "Choose Your Plan" : "Available Plans"}
                </CardTitle>
                <CardDescription className="text-sm">
                  All plans include Gemini 3 Flash AI extraction and all export formats
                </CardDescription>
              </div>
              
              <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-all",
                    billingCycle === "monthly"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                    billingCycle === "yearly"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Annual
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => {
                const isCurrentPlan = currentPlanId === plan.id || 
                  currentPlanId === `${plan.id}-yearly` || 
                  currentPlanId === `${plan.id}-monthly`;
                const price = billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
                const isPayAsYouGo = plan.id === "starter";
              
                return (
                  <div 
                    key={plan.id}
                    className={cn(
                      "relative rounded-xl border-2 transition-all p-4 flex flex-col",
                      plan.popular
                        ? "shadow-lg border-2"
                        : "border-slate-200 hover:border-slate-300",
                      isCurrentPlan && "ring-2 ring-offset-2 bg-slate-50",
                    )}
                    style={{
                      borderColor: plan.popular ? brand.colors.primary : isCurrentPlan ? brand.colors.primary : undefined,
                      ...(isCurrentPlan ? { ringColor: brand.colors.primary } : {})
                    }}
                  >
                    {plan.popular && (
                      <div 
                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white shadow-sm"
                        style={{ backgroundColor: brand.colors.primary }}
                      >
                        Most Popular
                      </div>
                    )}
                    
                    {isCurrentPlan && (
                      <div className="absolute -top-3 right-4 px-3 py-1 rounded-full text-xs font-semibold bg-slate-900 text-white shadow-sm">
                        Current Plan
                      </div>
                    )}

                    <div className="pt-2">
                      <h4 className="text-sm font-bold text-slate-900">{plan.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
                    </div>

                    <div className="mt-4 mb-4">
                      {isPayAsYouGo ? (
                        <div className="flex items-baseline">
                          <span className="text-3xl font-bold text-slate-900">$0.05</span>
                          <span className="text-slate-500 text-sm ml-1">/page</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-baseline">
                            <span className="text-3xl font-bold text-slate-900">${price}</span>
                            <span className="text-slate-500 text-sm ml-1">/mo</span>
                          </div>
                          {billingCycle === "yearly" && (
                            <p className="text-xs text-emerald-600 mt-1">
                              Billed ${price * 12}/year
                            </p>
                          )}
                        </>
                      )}
                      {plan.pagesIncluded > 0 && (
                        <p className="text-xs text-slate-600 mt-2 font-medium">
                          {plan.pagesIncluded.toLocaleString()} pages included
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={loadingPlan === plan.id || isCurrentPlan}
                      variant={isCurrentPlan ? "outline" : plan.popular ? "default" : "outline"}
                      className={cn(
                        "w-full",
                        plan.popular && !isCurrentPlan && "text-white",
                        isCurrentPlan && "cursor-not-allowed opacity-60"
                      )}
                      style={plan.popular && !isCurrentPlan ? { backgroundColor: brand.colors.primary } : undefined}
                    >
                      {loadingPlan === plan.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isCurrentPlan ? (
                        <><CheckCircle2 className="w-4 h-4 mr-2" /> Current Plan</>
                      ) : isPayAsYouGo ? (
                        "Get Started"
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Start 14-Day Trial
                        </>
                      )}
                    </Button>

                    <ul className="mt-4 space-y-2 flex-1">
                      {plan.features.map((feature) => (
                        <li key={feature.text} className="flex items-start gap-2 text-xs">
                          {feature.included ? (
                            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <X className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                          )}
                          <span className={feature.included ? "text-slate-700" : "text-slate-400"}>
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            
            {/* Compare Features Button */}
            <div className="mt-6 pt-6 border-t text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFeatureMatrix(!showFeatureMatrix)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                {showFeatureMatrix ? (
                  <>Hide feature comparison</>
                ) : (
                  <>Compare all features</>
                )}
                <ChevronRight className={cn(
                  "w-3 h-3 ml-1 transition-transform",
                  showFeatureMatrix && "rotate-90"
                )} />
              </Button>
            </div>
            
            {/* Feature Comparison Table */}
            {showFeatureMatrix && (
              <div className="mt-4 pt-4 border-t">
                <FeatureComparisonTable currentPlanId={currentPlanId} brand={brand} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Invoices */}
      <Card className="shadow-sm">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-semibold">Recent Invoices</CardTitle>
        </CardHeader>
        
        {invoices.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <FileText className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      ${invoice.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {invoice.created.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium",
                    invoice.status === "paid" 
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  )}>
                    {invoice.status}
                  </span>
                  {invoice.invoicePdf && (
                    <a 
                      href={invoice.invoicePdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <CardContent className="p-8 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No invoices yet</p>
            {isFree && (
              <p className="text-xs text-slate-400 mt-1">
                Invoices will appear here after you upgrade
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Downgrade Confirmation Dialog */}
      <DowngradeConfirmationDialog
        open={downgradeDialog.open}
        onClose={() => setDowngradeDialog({ open: false, targetPlan: "" })}
        onConfirm={handleConfirmDowngrade}
        currentPlan={currentPlanId}
        targetPlan={downgradeDialog.targetPlan}
        loading={!!loadingPlan}
        brand={brand}
      />
    </div>
  );
}

// ============================================
// MAIN SETTINGS PAGE
// ============================================

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const { user, organization, firebaseUser, updateUserSettings, updateUserProfile, signInWithGoogle, loading: authLoading } = useAuth();
  const brand = useBrand();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [googleLinking, setGoogleLinking] = useState(false);
  
  // Get initial tab from URL or default to "account"
  const initialTab = searchParams.get("tab") || "account";
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Handle checkout return URLs
  const checkoutSuccess = searchParams.get("success") === "true";
  const checkoutCancelled = searchParams.get("cancelled") === "true";
  
  // If coming from checkout, switch to billing tab
  useEffect(() => {
    if (checkoutSuccess || checkoutCancelled) {
      setActiveTab("billing");
    }
  }, [checkoutSuccess, checkoutCancelled]);

  const [settings, setSettings] = useState({
    name: user?.name || "",
    defaultExportFormat: user?.settings?.defaultExportFormat || "csv",
    theme: user?.settings?.theme || "system",
    emailNotifications: user?.settings?.emailNotifications ?? true,
    processingAlerts: user?.settings?.processingAlerts ?? true,
  });

  useEffect(() => {
    if (user) {
      setSettings({
        name: user.name || "",
        defaultExportFormat: user.settings?.defaultExportFormat || "csv",
        theme: user.settings?.theme || "system",
        emailNotifications: user.settings?.emailNotifications ?? true,
        processingAlerts: user.settings?.processingAlerts ?? true,
      });
    }
  }, [user]);

  const authProviders: AuthProviderInfo[] = user?.authProviders || [
    { provider: "email", linkedAt: user?.createdAt as Timestamp, lastUsedAt: user?.lastLoginAt }
  ];
  
  const handleLinkGoogle = async () => {
    setGoogleLinking(true);
    try {
      await signInWithGoogle();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to link Google:", error);
    } finally {
      setGoogleLinking(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      await updateUserSettings({
        defaultExportFormat: settings.defaultExportFormat as "csv" | "xlsx",
        theme: settings.theme as "light" | "dark" | "system",
        emailNotifications: settings.emailNotifications,
        processingAlerts: settings.processingAlerts,
      });
      
      if (settings.name !== user?.name) {
        await updateUserProfile({ name: settings.name });
      }
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Settings" />
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Settings" />

      <div className="flex-1 p-4 space-y-4 overflow-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Settings</h2>
            <p className="text-xs text-slate-500">Manage your account, team, and subscription</p>
          </div>
          {(activeTab === "account" || activeTab === "notifications") && (
            <Button onClick={handleSave} disabled={saving} size="sm" className="h-7 text-xs">
              <Save className="h-3.5 w-3.5 mr-1" />
              {saving ? "Saving..." : success ? "Saved!" : "Save Changes"}
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="h-8">
            <TabsTrigger value="account" className="text-xs h-6">
              <User className="h-3 w-3 mr-1" />
              Account
            </TabsTrigger>
            <TabsTrigger value="billing" className="text-xs h-6">
              <CreditCard className="h-3 w-3 mr-1" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs h-6">
              <Users className="h-3 w-3 mr-1" />
              Team
            </TabsTrigger>
            <TabsTrigger value="security" className="text-xs h-6">
              <Shield className="h-3 w-3 mr-1" />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs h-6">
              <Bell className="h-3 w-3 mr-1" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="data" className="text-xs h-6">
              <Database className="h-3 w-3 mr-1" />
              Data
            </TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">Profile Information</CardTitle>
                <CardDescription className="text-xs">Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Full Name</Label>
                    <Input 
                      value={settings.name} 
                      onChange={(e) => setSettings({ ...settings, name: e.target.value })} 
                      className="h-8 text-xs" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email Address</Label>
                    <Input 
                      value={user?.email || ""} 
                      disabled 
                      className="h-8 text-xs bg-slate-50" 
                    />
                    <p className="text-[10px] text-slate-400">Contact support to change your email</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {organization && (
              <Card className="shadow-sm">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-semibold">Organization</CardTitle>
                  <CardDescription className="text-xs">Your team and organization details</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="h-10 w-10 rounded-lg bg-slate-200 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{organization.name}</p>
                      <p className="text-xs text-slate-500">
                        Role: <Badge variant="secondary" className="text-[10px] h-4 ml-1">{user?.orgRole}</Badge>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">Preferences</CardTitle>
                <CardDescription className="text-xs">Customize your experience</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Default Export Format</Label>
                    <Select 
                      value={settings.defaultExportFormat} 
                      onValueChange={(value) => setSettings({ ...settings, defaultExportFormat: value as "csv" | "xlsx" })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv" className="text-xs">CSV (.csv)</SelectItem>
                        <SelectItem value="xlsx" className="text-xs">Excel (.xlsx)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Theme</Label>
                    <Select 
                      value={settings.theme} 
                      onValueChange={(value) => setSettings({ ...settings, theme: value as "system" | "light" | "dark" })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light" className="text-xs">
                          <div className="flex items-center gap-2">
                            <Sun className="h-3 w-3" />
                            Light
                          </div>
                        </SelectItem>
                        <SelectItem value="dark" className="text-xs">
                          <div className="flex items-center gap-2">
                            <Moon className="h-3 w-3" />
                            Dark
                          </div>
                        </SelectItem>
                        <SelectItem value="system" className="text-xs">
                          <div className="flex items-center gap-2">
                            <Monitor className="h-3 w-3" />
                            System
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-4">
            <BillingTab 
              user={user} 
              firebaseUser={firebaseUser} 
              brand={brand} 
              checkoutSuccess={checkoutSuccess}
              checkoutCancelled={checkoutCancelled}
            />
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-4">
            <TeamTab user={user} brand={brand} />
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <SecurityTab 
              authProviders={authProviders}
              lastAuthProvider={user?.lastAuthProvider}
              userEmail={user?.email}
              onLinkGoogle={handleLinkGoogle}
              googleLinking={googleLinking}
            />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">Email Notifications</CardTitle>
                <CardDescription className="text-xs">Manage what emails you receive</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 space-y-3">
                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs font-medium text-slate-900">Email Notifications</p>
                      <p className="text-[10px] text-slate-500">Receive updates about your account</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-ormandy-red focus:ring-ormandy-red"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <Bell className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs font-medium text-slate-900">Processing Alerts</p>
                      <p className="text-[10px] text-slate-500">Get notified when statement processing completes</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.processingAlerts}
                    onChange={(e) => setSettings({ ...settings, processingAlerts: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-ormandy-red focus:ring-ormandy-red"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs font-medium text-slate-900">Usage Alerts</p>
                      <p className="text-[10px] text-slate-500">Notify when approaching usage limits</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    className="h-4 w-4 rounded border-slate-300 text-ormandy-red focus:ring-ormandy-red"
                  />
                </label>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data" className="space-y-4">
            <DataManagementTab userId={user?.id} />
          </TabsContent>
        </Tabs>

        {success && (
          <div className="fixed bottom-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs shadow-lg flex items-center gap-2">
            <Check className="h-4 w-4" />
            Settings saved successfully!
          </div>
        )}
      </div>
    </div>
  );
}
