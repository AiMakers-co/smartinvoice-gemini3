"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  DollarSign, 
  Users, 
  CreditCard,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  MoreVertical,
  FileText,
  Zap,
  Crown,
  Building2,
  Gift,
  Edit,
  X,
  Plus,
  Minus,
  Download,
  ExternalLink,
  AlertTriangle,
  History,
  Mail,
  Settings,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  TrendingUp,
  PieChart,
  BarChart3,
  Target,
  Wallet,
} from "lucide-react";
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, Timestamp, where, getDocs, addDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useBrand } from "@/hooks/use-brand";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

// ============================================
// TYPES
// ============================================

interface Subscription {
  status: string;
  plan?: string;
  planId?: string;
  pagesUsedThisMonth: number;
  pagesLimit: number;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: Date;
  overagePages?: number;
  estimatedOverageCharge?: number;
  overagePerPage?: number;
  notes?: string;
}

interface UserWithSubscription {
  id: string;
  email: string;
  name?: string;
  stripeCustomerId?: string;
  subscription?: Subscription;
  subscriptionStatus?: string;
  createdAt?: Date;
}

interface Payment {
  id: string;
  userId: string;
  userEmail?: string;
  amount: number;
  currency: string;
  status: string;
  planId?: string;
  billingReason?: string;
  createdAt: Date;
}

interface AdminAction {
  id: string;
  type: string;
  userId: string;
  userEmail?: string;
  adminId: string;
  adminEmail: string;
  details: Record<string, any>;
  createdAt: Date;
}

// ============================================
// COST & PLAN CONFIG (Gemini 3 Flash @ $0.01/page)
// ============================================

const AI_COST_PER_PAGE = 0.01; // Gemini 3 Flash

const PLAN_OPTIONS = [
  { id: "free", name: "Free", icon: Gift, color: "text-slate-500", pages: 100, price: 0, overage: 0 },
  { id: "starter", name: "Starter (PAYG)", icon: Zap, color: "text-blue-500", pages: 0, price: 0, overage: 0.05 },
  { id: "pro", name: "Pro", icon: Crown, color: "text-amber-500", pages: 2000, price: 49, overage: 0.04 },
  { id: "team", name: "Team", icon: Users, color: "text-teal-500", pages: 4000, price: 99, overage: 0.035 },
  { id: "business", name: "Business", icon: Building2, color: "text-purple-500", pages: 7000, price: 179, overage: 0.03 },
  { id: "enterprise", name: "Enterprise", icon: Building2, color: "text-rose-500", pages: 16000, price: 399, overage: 0.025 },
];

const planConfig: Record<string, { icon: any; color: string; label: string; pages: number; price: number; overage: number }> = {
  free: { icon: Gift, color: "text-slate-500", label: "Free", pages: 100, price: 0, overage: 0 },
  starter: { icon: Zap, color: "text-blue-500", label: "Starter", pages: 0, price: 0, overage: 0.05 },
  pro: { icon: Crown, color: "text-amber-500", label: "Pro", pages: 2000, price: 49, overage: 0.04 },
  "pro-yearly": { icon: Crown, color: "text-amber-500", label: "Pro (Annual)", pages: 2000, price: 39, overage: 0.04 },
  team: { icon: Users, color: "text-teal-500", label: "Team", pages: 4000, price: 99, overage: 0.035 },
  "team-yearly": { icon: Users, color: "text-teal-500", label: "Team (Annual)", pages: 4000, price: 79, overage: 0.035 },
  business: { icon: Building2, color: "text-purple-500", label: "Business", pages: 7000, price: 179, overage: 0.03 },
  "business-yearly": { icon: Building2, color: "text-purple-500", label: "Business (Annual)", pages: 7000, price: 149, overage: 0.03 },
  enterprise: { icon: Building2, color: "text-rose-500", label: "Enterprise", pages: 16000, price: 399, overage: 0.025 },
  "enterprise-yearly": { icon: Building2, color: "text-rose-500", label: "Enterprise (Annual)", pages: 16000, price: 329, overage: 0.025 },
};

// ============================================
// ADMIN BILLING PAGE
// ============================================

export default function AdminBillingPage() {
  const { user, isAdmin, isOwner } = useAuth();
  const brand = useBrand();
  
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [adminActions, setAdminActions] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlan, setFilterPlan] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  
  // Modal states
  const [selectedUser, setSelectedUser] = useState<UserWithSubscription | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Edit form state
  const [editPlan, setEditPlan] = useState("");
  const [editPagesLimit, setEditPagesLimit] = useState(0);
  const [editTrialDays, setEditTrialDays] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  
  // Credits form state
  const [creditAmount, setCreditAmount] = useState(100);
  const [creditReason, setCreditReason] = useState("");

  // Load users with subscriptions
  useEffect(() => {
    if (!user || (!isAdmin && !isOwner)) return;

    const usersQuery = query(
      collection(db, "users"),
      orderBy("createdAt", "desc"),
      limit(500)
    );

    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        subscription: doc.data().subscription ? {
          ...doc.data().subscription,
          currentPeriodEnd: doc.data().subscription.currentPeriodEnd?.toDate?.(),
          trialEnd: doc.data().subscription.trialEnd?.toDate?.(),
        } : undefined,
      })) as UserWithSubscription[];
      
      setUsers(usersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isAdmin, isOwner]);

  // Load recent payments
  useEffect(() => {
    if (!user || (!isAdmin && !isOwner)) return;

    const paymentsQuery = query(
      collection(db, "payments"),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
      const paymentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      })) as Payment[];
      
      setPayments(paymentsData);
    });

    return () => unsubscribe();
  }, [user, isAdmin, isOwner]);

  // Load admin actions log
  useEffect(() => {
    if (!user || (!isAdmin && !isOwner)) return;

    const actionsQuery = query(
      collection(db, "adminActions"),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(actionsQuery, (snapshot) => {
      const actionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      })) as AdminAction[];
      
      setAdminActions(actionsData);
    });

    return () => unsubscribe();
  }, [user, isAdmin, isOwner]);

  // Log admin action
  const logAdminAction = async (type: string, targetUserId: string, targetUserEmail: string, details: Record<string, any>) => {
    await addDoc(collection(db, "adminActions"), {
      type,
      userId: targetUserId,
      userEmail: targetUserEmail,
      adminId: user?.id,
      adminEmail: user?.email,
      details,
      createdAt: new Date(),
    });
  };

  // Calculate stats
  const stats = {
    totalUsers: users.length,
    paidUsers: users.filter(u => {
      const plan = u.subscription?.planId || u.subscription?.plan;
      return plan && plan !== "free" && plan !== "starter";
    }).length,
    freeUsers: users.filter(u => {
      const plan = u.subscription?.planId || u.subscription?.plan;
      return !plan || plan === "free";
    }).length,
    trialUsers: users.filter(u => u.subscription?.trialEnd && new Date(u.subscription.trialEnd) > new Date()).length,
    pastDueUsers: users.filter(u => u.subscription?.status === "past_due").length,
    mrr: users.reduce((sum, u) => {
      const plan = u.subscription?.planId || u.subscription?.plan;
      const config = planConfig[plan || "free"];
      return sum + (config?.price || 0);
    }, 0),
    totalRevenue: payments.reduce((sum, p) => sum + (p.amount || 0), 0) / 100,
    totalPages: users.reduce((sum, u) => sum + (u.subscription?.pagesUsedThisMonth || 0), 0),
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchQuery || 
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase());
    const plan = u.subscription?.planId || u.subscription?.plan || "free";
    const matchesPlan = !filterPlan || plan === filterPlan;
    const matchesStatus = !filterStatus || 
      (filterStatus === "trial" && u.subscription?.trialEnd && new Date(u.subscription.trialEnd) > new Date()) ||
      (filterStatus === "past_due" && u.subscription?.status === "past_due") ||
      (filterStatus === "active" && u.subscription?.status === "active") ||
      (filterStatus === "canceled" && u.subscription?.status === "canceled");
    return matchesSearch && matchesPlan && matchesStatus;
  });

  // Open edit modal
  const openEditModal = (targetUser: UserWithSubscription) => {
    setSelectedUser(targetUser);
    const plan = targetUser.subscription?.planId || targetUser.subscription?.plan || "free";
    setEditPlan(plan);
    setEditPagesLimit(targetUser.subscription?.pagesLimit || planConfig[plan]?.pages || 50);
    setEditTrialDays(0);
    setEditNotes(targetUser.subscription?.notes || "");
    setShowEditModal(true);
  };

  // Save user subscription changes
  const saveUserChanges = async () => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    try {
      const planInfo = planConfig[editPlan] || planConfig.free;
      const now = new Date();
      let trialEnd = selectedUser.subscription?.trialEnd;
      
      // Add trial days if specified
      if (editTrialDays > 0) {
        trialEnd = new Date(now.getTime() + editTrialDays * 24 * 60 * 60 * 1000);
      }
      
      const updateData: Record<string, any> = {
        subscriptionStatus: editTrialDays > 0 ? "trialing" : (editPlan === "free" ? "free" : "active"),
        "subscription.planId": editPlan,
        "subscription.plan": editPlan,
        "subscription.status": editTrialDays > 0 ? "trialing" : (editPlan === "free" ? "free" : "active"),
        "subscription.pagesLimit": editPagesLimit,
        "subscription.overagePerPage": planInfo.pages > 0 ? (
          editPlan === "pro" ? 0.10 : editPlan === "business" ? 0.08 : 0.05
        ) : 0,
        "subscription.notes": editNotes,
        "subscription.updatedAt": now,
        "subscription.updatedBy": user?.id,
        updatedAt: now,
      };
      
      if (trialEnd) {
        updateData["subscription.trialEnd"] = trialEnd;
      }
      
      await updateDoc(doc(db, "users", selectedUser.id), updateData);
      
      // Log the action
      await logAdminAction("subscription_modified", selectedUser.id, selectedUser.email, {
        previousPlan: selectedUser.subscription?.planId || selectedUser.subscription?.plan || "free",
        newPlan: editPlan,
        pagesLimit: editPagesLimit,
        trialDaysAdded: editTrialDays,
        notes: editNotes,
      });
      
      toast.success("User subscription updated!");
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    } finally {
      setActionLoading(false);
    }
  };

  // Open credits modal
  const openCreditsModal = (targetUser: UserWithSubscription) => {
    setSelectedUser(targetUser);
    setCreditAmount(100);
    setCreditReason("");
    setShowCreditsModal(true);
  };

  // Add page credits
  const addPageCredits = async () => {
    if (!selectedUser) return;
    
    setActionLoading(true);
    try {
      const currentLimit = selectedUser.subscription?.pagesLimit || 50;
      const newLimit = currentLimit + creditAmount;
      
      await updateDoc(doc(db, "users", selectedUser.id), {
        "subscription.pagesLimit": newLimit,
        "subscription.bonusPages": (selectedUser.subscription as any)?.bonusPages || 0 + creditAmount,
        "subscription.updatedAt": new Date(),
        updatedAt: new Date(),
      });
      
      // Log the action
      await logAdminAction("credits_added", selectedUser.id, selectedUser.email, {
        amount: creditAmount,
        reason: creditReason,
        previousLimit: currentLimit,
        newLimit: newLimit,
      });
      
      toast.success(`Added ${creditAmount} page credits!`);
      setShowCreditsModal(false);
    } catch (error) {
      console.error("Error adding credits:", error);
      toast.error("Failed to add credits");
    } finally {
      setActionLoading(false);
    }
  };

  // Reset monthly usage
  const resetUsage = async (targetUser: UserWithSubscription) => {
    if (!confirm(`Reset usage for ${targetUser.email}? This will set pages used this month to 0.`)) return;
    
    try {
      await updateDoc(doc(db, "users", targetUser.id), {
        "subscription.pagesUsedThisMonth": 0,
        "subscription.overagePages": 0,
        "subscription.estimatedOverageCharge": 0,
        "subscription.usageResetAt": new Date(),
        updatedAt: new Date(),
      });
      
      await logAdminAction("usage_reset", targetUser.id, targetUser.email, {});
      
      toast.success("Usage reset!");
    } catch (error) {
      console.error("Error resetting usage:", error);
      toast.error("Failed to reset usage");
    }
  };

  // Cancel subscription
  const cancelSubscription = async (targetUser: UserWithSubscription) => {
    if (!confirm(`Cancel subscription for ${targetUser.email}? They will be moved to the free tier.`)) return;
    
    try {
      await updateDoc(doc(db, "users", targetUser.id), {
        subscriptionStatus: "canceled",
        "subscription.status": "canceled",
        "subscription.planId": "free",
        "subscription.plan": "free",
        "subscription.pagesLimit": 50,
        "subscription.canceledAt": new Date(),
        "subscription.canceledBy": user?.id,
        updatedAt: new Date(),
      });
      
      await logAdminAction("subscription_canceled", targetUser.id, targetUser.email, {
        previousPlan: targetUser.subscription?.planId || targetUser.subscription?.plan,
      });
      
      toast.success("Subscription canceled");
    } catch (error) {
      console.error("Error canceling subscription:", error);
      toast.error("Failed to cancel subscription");
    }
  };

  // Export users to CSV
  const exportUsers = () => {
    const headers = ["Email", "Name", "Plan", "Status", "Pages Used", "Pages Limit", "Period End", "Created"];
    const rows = filteredUsers.map(u => [
      u.email,
      u.name || "",
      u.subscription?.planId || u.subscription?.plan || "free",
      u.subscription?.status || "free",
      u.subscription?.pagesUsedThisMonth || 0,
      u.subscription?.pagesLimit || 50,
      u.subscription?.currentPeriodEnd?.toLocaleDateString() || "",
      u.createdAt?.toLocaleDateString() || "",
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    
    toast.success("Exported to CSV");
  };

  // View user history
  const viewUserHistory = async (targetUser: UserWithSubscription) => {
    setSelectedUser(targetUser);
    setShowHistoryModal(true);
  };

  // Check access
  if (!isAdmin && !isOwner) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Billing Admin" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500">You don&apos;t have access to this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Billing & Subscription Management" />
      
      <div className="flex-1 p-6 overflow-auto">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="analytics">📊 Revenue Analytics</TabsTrigger>
            <TabsTrigger value="users">Users & Subscriptions</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="actions">Admin Actions Log</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* ANALYTICS TAB */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Revenue Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-100">
                      <DollarSign className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Monthly Revenue</p>
                      <p className="text-2xl font-bold text-slate-900">${stats.mrr.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-red-100">
                      <Wallet className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Monthly AI Cost</p>
                      <p className="text-2xl font-bold text-slate-900">
                        ${(stats.totalPages * AI_COST_PER_PAGE).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-100">
                      <TrendingUp className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Gross Profit</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        ${(stats.mrr - (stats.totalPages * AI_COST_PER_PAGE)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-amber-100">
                      <Target className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Gross Margin</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {stats.mrr > 0 
                          ? ((1 - (stats.totalPages * AI_COST_PER_PAGE) / stats.mrr) * 100).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue by Plan */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Revenue by Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {PLAN_OPTIONS.filter(p => p.price > 0).map((plan) => {
                      const planUsers = users.filter(u => {
                        const userPlan = u.subscription?.planId || u.subscription?.plan;
                        return userPlan === plan.id || userPlan === `${plan.id}-yearly`;
                      });
                      const planRevenue = planUsers.length * plan.price;
                      const planPages = planUsers.reduce((sum, u) => sum + (u.subscription?.pagesUsedThisMonth || 0), 0);
                      const planCost = planPages * AI_COST_PER_PAGE;
                      const planProfit = planRevenue - planCost;
                      const planMargin = planRevenue > 0 ? ((planProfit / planRevenue) * 100) : 0;
                      const PlanIcon = plan.icon;
                      
                      return (
                        <div key={plan.id} className="p-4 bg-slate-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <PlanIcon className={cn("h-5 w-5", plan.color)} />
                              <span className="font-medium">{plan.name}</span>
                              <Badge variant="outline">{planUsers.length} users</Badge>
                            </div>
                            <span className="font-bold">${planRevenue.toLocaleString()}/mo</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-sm">
                            <div>
                              <p className="text-slate-500">Pages</p>
                              <p className="font-medium">{planPages.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">AI Cost</p>
                              <p className="font-medium text-red-600">${planCost.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Profit</p>
                              <p className={cn("font-medium", planProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                                ${planProfit.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Margin</p>
                              <p className={cn("font-medium", planMargin >= 50 ? "text-emerald-600" : "text-amber-600")}>
                                {planMargin.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Cost Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Cost Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* AI Model Cost */}
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <h4 className="font-medium mb-3">AI Processing (Gemini 3 Flash)</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Cost per page</p>
                          <p className="text-xl font-bold">${AI_COST_PER_PAGE.toFixed(3)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Pages this month</p>
                          <p className="text-xl font-bold">{stats.totalPages.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Total AI cost</p>
                          <p className="text-xl font-bold text-red-600">
                            ${(stats.totalPages * AI_COST_PER_PAGE).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Avg pages/user</p>
                          <p className="text-xl font-bold">
                            {users.length > 0 ? Math.round(stats.totalPages / users.length) : 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Margin Targets */}
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <h4 className="font-medium mb-3">Margin Health</h4>
                      <div className="space-y-3">
                        {(() => {
                          const actualMargin = stats.mrr > 0 
                            ? ((stats.mrr - (stats.totalPages * AI_COST_PER_PAGE)) / stats.mrr) * 100
                            : 0;
                          const targetMargin = 60; // 150% markup = 60% margin
                          const isHealthy = actualMargin >= targetMargin;
                          
                          return (
                            <>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500">Target margin (150% markup)</span>
                                <span className="font-medium">{targetMargin}%</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500">Actual margin</span>
                                <span className={cn("font-bold text-lg", isHealthy ? "text-emerald-600" : "text-red-600")}>
                                  {actualMargin.toFixed(1)}%
                                </span>
                              </div>
                              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className={cn("h-full rounded-full", isHealthy ? "bg-emerald-500" : "bg-red-500")}
                                  style={{ width: `${Math.min(100, actualMargin)}%` }}
                                />
                              </div>
                              <p className={cn("text-sm", isHealthy ? "text-emerald-600" : "text-red-600")}>
                                {isHealthy 
                                  ? "✅ Healthy margins - on track!" 
                                  : "⚠️ Margins below target - review pricing or costs"}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Projections */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Revenue Projections
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: "Current Month", multiplier: 1 },
                    { label: "3 Months", multiplier: 3 },
                    { label: "6 Months", multiplier: 6 },
                    { label: "12 Months (ARR)", multiplier: 12 },
                  ].map((period) => {
                    const projectedRevenue = stats.mrr * period.multiplier;
                    const projectedCost = stats.totalPages * AI_COST_PER_PAGE * period.multiplier;
                    const projectedProfit = projectedRevenue - projectedCost;
                    
                    return (
                      <div key={period.label} className="p-4 bg-slate-50 rounded-lg text-center">
                        <p className="text-sm text-slate-500 mb-2">{period.label}</p>
                        <p className="text-2xl font-bold text-slate-900">
                          ${projectedRevenue.toLocaleString()}
                        </p>
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <p className="text-xs text-slate-500">Projected Profit</p>
                          <p className="text-lg font-semibold text-emerald-600">
                            ${projectedProfit.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Growth scenarios */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-3">Growth Scenarios (keeping 60% margin)</h4>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    {[100, 500, 1000, 5000].map((userCount) => {
                      // Assume average revenue per paid user is current MRR / paid users
                      const avgRevPerUser = stats.paidUsers > 0 ? stats.mrr / stats.paidUsers : 49;
                      const projectedMRR = userCount * avgRevPerUser;
                      const projectedProfit = projectedMRR * 0.6; // 60% margin
                      
                      return (
                        <div key={userCount} className="text-center">
                          <p className="text-blue-700 font-medium">{userCount} paid users</p>
                          <p className="text-xl font-bold text-blue-900">
                            ${projectedMRR.toLocaleString()}/mo
                          </p>
                          <p className="text-emerald-600 text-sm">
                            ${projectedProfit.toLocaleString()} profit
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* USERS TAB */}
          <TabsContent value="users" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div 
                      className="p-3 rounded-xl"
                      style={{ backgroundColor: `${brand.colors.primary}15` }}
                    >
                      <DollarSign className="h-6 w-6" style={{ color: brand.colors.primary }} />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">MRR</p>
                      <p className="text-2xl font-bold text-slate-900">${stats.mrr.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-100">
                      <Users className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Paid Users</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {stats.paidUsers}
                        <span className="text-sm font-normal text-slate-400 ml-1">
                          / {stats.totalUsers}
                        </span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-amber-100">
                      <Clock className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">In Trial</p>
                      <p className="text-2xl font-bold text-slate-900">{stats.trialUsers}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-red-100">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Past Due</p>
                      <p className="text-2xl font-bold text-slate-900">{stats.pastDueUsers}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-100">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Pages This Month</p>
                      <p className="text-2xl font-bold text-slate-900">{stats.totalPages.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Users Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>All Users</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <select
                      value={filterPlan || ""}
                      onChange={(e) => setFilterPlan(e.target.value || null)}
                      className="h-9 px-3 rounded-lg border border-slate-200 text-sm"
                    >
                      <option value="">All Plans</option>
                      <option value="free">Free</option>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="business">Business</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                    <select
                      value={filterStatus || ""}
                      onChange={(e) => setFilterStatus(e.target.value || null)}
                      className="h-9 px-3 rounded-lg border border-slate-200 text-sm"
                    >
                      <option value="">All Status</option>
                      <option value="active">Active</option>
                      <option value="trial">Trialing</option>
                      <option value="past_due">Past Due</option>
                      <option value="canceled">Canceled</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={exportUsers}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="py-12 text-center text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    No users found
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-medium text-slate-500">User</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Plan</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Usage</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Period Ends</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Joined</th>
                          <th className="text-right py-3 px-4 font-medium text-slate-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map((u) => {
                          const plan = u.subscription?.planId || u.subscription?.plan || "free";
                          const config = planConfig[plan] || planConfig.free;
                          const PlanIcon = config.icon;
                          const usage = u.subscription?.pagesUsedThisMonth || 0;
                          const planLimit = u.subscription?.pagesLimit || config.pages || 50;
                          const usagePercent = planLimit > 0 ? Math.min(100, (usage / planLimit) * 100) : 0;
                          const isTrialing = u.subscription?.trialEnd && new Date(u.subscription.trialEnd) > new Date();
                          const isPastDue = u.subscription?.status === "past_due";
                          
                          return (
                            <tr key={u.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4">
                                <div>
                                  <p className="font-medium text-slate-900">{u.name || "—"}</p>
                                  <p className="text-slate-500 text-xs">{u.email}</p>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <PlanIcon className={cn("h-4 w-4", config.color)} />
                                  <span className="font-medium">{config.label}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                {isTrialing ? (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                    Trial
                                  </Badge>
                                ) : isPastDue ? (
                                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                    Past Due
                                  </Badge>
                                ) : u.subscription?.status === "active" ? (
                                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                    Active
                                  </Badge>
                                ) : u.subscription?.status === "canceled" ? (
                                  <Badge variant="outline" className="bg-slate-100 text-slate-600">
                                    Canceled
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-slate-50 text-slate-600">
                                    {u.subscription?.status || "Free"}
                                  </Badge>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="w-32">
                                  <div className="flex items-center justify-between text-xs mb-1">
                                    <span>{usage.toLocaleString()}</span>
                                    <span className="text-slate-400">/ {planLimit.toLocaleString()}</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        usagePercent > 90 ? "bg-red-500" :
                                        usagePercent > 70 ? "bg-amber-500" : "bg-emerald-500"
                                      )}
                                      style={{ width: `${usagePercent}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-500 text-sm">
                                {u.subscription?.currentPeriodEnd 
                                  ? new Date(u.subscription.currentPeriodEnd).toLocaleDateString()
                                  : "—"}
                                {u.subscription?.cancelAtPeriodEnd && (
                                  <span className="text-red-500 text-xs block">(canceling)</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-500 text-sm">
                                {u.createdAt?.toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuItem onClick={() => openEditModal(u)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit Subscription
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => openCreditsModal(u)}>
                                      <Plus className="h-4 w-4 mr-2" />
                                      Add Page Credits
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => resetUsage(u)}>
                                      <RotateCcw className="h-4 w-4 mr-2" />
                                      Reset Monthly Usage
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => viewUserHistory(u)}>
                                      <History className="h-4 w-4 mr-2" />
                                      View History
                                    </DropdownMenuItem>
                                    {u.stripeCustomerId && (
                                      <DropdownMenuItem asChild>
                                        <a 
                                          href={`https://dashboard.stripe.com/customers/${u.stripeCustomerId}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          <ExternalLink className="h-4 w-4 mr-2" />
                                          View in Stripe
                                        </a>
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => cancelSubscription(u)}
                                      className="text-red-600"
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Cancel Subscription
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PAYMENTS TAB */}
          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Payments</CardTitle>
                  <p className="text-sm text-slate-500">
                    Total: ${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    No payments yet
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-medium text-slate-500">User</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Amount</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Plan</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Reason</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-500">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {payments.map((payment) => {
                          const paymentUser = users.find(u => u.id === payment.userId);
                          return (
                            <tr key={payment.id} className="hover:bg-slate-50">
                              <td className="py-3 px-4">
                                <p className="font-medium text-slate-900">
                                  {paymentUser?.name || paymentUser?.email || payment.userId}
                                </p>
                              </td>
                              <td className="py-3 px-4">
                                <p className="font-medium text-emerald-600">
                                  ${(payment.amount / 100).toFixed(2)} {payment.currency?.toUpperCase()}
                                </p>
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {planConfig[payment.planId || ""]?.label || "—"}
                              </td>
                              <td className="py-3 px-4 text-slate-500 text-sm">
                                {payment.billingReason?.replace(/_/g, " ") || "—"}
                              </td>
                              <td className="py-3 px-4">
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    payment.status === "succeeded" 
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-red-50 text-red-700 border-red-200"
                                  )}
                                >
                                  {payment.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-slate-500 text-sm">
                                {payment.createdAt.toLocaleDateString()} {payment.createdAt.toLocaleTimeString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ADMIN ACTIONS LOG TAB */}
          <TabsContent value="actions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Admin Actions Log</CardTitle>
              </CardHeader>
              <CardContent>
                {adminActions.length === 0 ? (
                  <div className="py-12 text-center text-slate-500">
                    No admin actions logged yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adminActions.map((action) => (
                      <div 
                        key={action.id}
                        className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg"
                      >
                        <div className={cn(
                          "p-2 rounded-lg",
                          action.type === "credits_added" ? "bg-emerald-100" :
                          action.type === "subscription_canceled" ? "bg-red-100" :
                          action.type === "usage_reset" ? "bg-blue-100" :
                          "bg-amber-100"
                        )}>
                          {action.type === "credits_added" ? (
                            <Plus className="h-4 w-4 text-emerald-600" />
                          ) : action.type === "subscription_canceled" ? (
                            <X className="h-4 w-4 text-red-600" />
                          ) : action.type === "usage_reset" ? (
                            <RotateCcw className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Edit className="h-4 w-4 text-amber-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">
                            {action.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          <p className="text-sm text-slate-500">
                            User: {action.userEmail}
                          </p>
                          {action.details && (
                            <p className="text-xs text-slate-400 mt-1">
                              {JSON.stringify(action.details)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-500">
                            {action.createdAt.toLocaleDateString()}
                          </p>
                          <p className="text-xs text-slate-400">
                            by {action.adminEmail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Billing Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium text-slate-900 mb-2">Stripe Dashboard</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Manage products, prices, coupons, and refunds directly in Stripe.
                  </p>
                  <div className="flex gap-3">
                    <Button variant="outline" asChild>
                      <a href="https://dashboard.stripe.com/products" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Products & Prices
                      </a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href="https://dashboard.stripe.com/coupons" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Coupons
                      </a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href="https://dashboard.stripe.com/payments" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Payments & Refunds
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-medium text-slate-900 mb-2">Plan Configuration</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Current pricing tiers and page limits.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {PLAN_OPTIONS.slice(2).map((plan) => {
                      const Icon = plan.icon;
                      return (
                        <div key={plan.id} className="p-4 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={cn("h-5 w-5", plan.color)} />
                            <span className="font-medium">{plan.name}</span>
                          </div>
                          <p className="text-2xl font-bold">${plan.price}<span className="text-sm font-normal">/mo</span></p>
                          <p className="text-sm text-slate-500">{plan.pages.toLocaleString()} pages/month</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-medium text-slate-900 mb-2">Webhook Status</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Stripe webhook endpoint for subscription events.
                  </p>
                  <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <code className="text-sm">https://us-central1-ormandy-app.cloudfunctions.net/stripeWebhook</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* EDIT SUBSCRIPTION MODAL */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>
              {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={editPlan} onValueChange={(val) => {
                setEditPlan(val);
                const planInfo = planConfig[val];
                if (planInfo) {
                  setEditPagesLimit(planInfo.pages);
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - ${plan.price}/mo ({plan.pages.toLocaleString()} pages)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Pages Limit (can override plan default)</Label>
              <Input
                type="number"
                value={editPagesLimit}
                onChange={(e) => setEditPagesLimit(parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Add Trial Days</Label>
              <Input
                type="number"
                value={editTrialDays}
                onChange={(e) => setEditTrialDays(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
              <p className="text-xs text-slate-500">
                Current trial ends: {selectedUser?.subscription?.trialEnd 
                  ? new Date(selectedUser.subscription.trialEnd).toLocaleDateString()
                  : "No trial"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Admin Notes</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Internal notes about this subscription..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveUserChanges} disabled={actionLoading}>
              {actionLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD CREDITS MODAL */}
      <Dialog open={showCreditsModal} onOpenChange={setShowCreditsModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Page Credits</DialogTitle>
            <DialogDescription>
              {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">Current limit</p>
              <p className="text-2xl font-bold">
                {selectedUser?.subscription?.pagesLimit?.toLocaleString() || 50} pages
              </p>
            </div>

            <div className="space-y-2">
              <Label>Credits to Add</Label>
              <div className="flex gap-2">
                {[50, 100, 250, 500, 1000].map((amount) => (
                  <Button
                    key={amount}
                    variant={creditAmount === amount ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCreditAmount(amount)}
                  >
                    +{amount}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                className="mt-2"
              />
            </div>

            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="e.g., Customer support compensation"
              />
            </div>

            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-600">New limit will be</p>
              <p className="text-2xl font-bold text-emerald-700">
                {((selectedUser?.subscription?.pagesLimit || 50) + creditAmount).toLocaleString()} pages
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreditsModal(false)}>
              Cancel
            </Button>
            <Button onClick={addPageCredits} disabled={actionLoading}>
              {actionLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Credits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* USER HISTORY MODAL */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>User History</DialogTitle>
            <DialogDescription>
              {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            {/* User payments */}
            <div>
              <h4 className="font-medium mb-2">Payment History</h4>
              {payments.filter(p => p.userId === selectedUser?.id).length === 0 ? (
                <p className="text-sm text-slate-500">No payments</p>
              ) : (
                <div className="space-y-2">
                  {payments.filter(p => p.userId === selectedUser?.id).map((p) => (
                    <div key={p.id} className="flex justify-between p-2 bg-slate-50 rounded">
                      <span>${(p.amount / 100).toFixed(2)}</span>
                      <span className="text-slate-500">{p.createdAt.toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Admin actions for this user */}
            <div>
              <h4 className="font-medium mb-2">Admin Actions</h4>
              {adminActions.filter(a => a.userId === selectedUser?.id).length === 0 ? (
                <p className="text-sm text-slate-500">No admin actions</p>
              ) : (
                <div className="space-y-2">
                  {adminActions.filter(a => a.userId === selectedUser?.id).map((a) => (
                    <div key={a.id} className="p-2 bg-slate-50 rounded">
                      <div className="flex justify-between">
                        <span className="font-medium">{a.type.replace(/_/g, " ")}</span>
                        <span className="text-slate-500 text-sm">{a.createdAt.toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-slate-400">by {a.adminEmail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
