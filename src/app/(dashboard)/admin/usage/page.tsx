"use client";

import { useState, useEffect } from "react";
import { BarChart3, FileText, Coins, TrendingUp, Zap, Clock, AlertCircle, Brain, Download } from "lucide-react";
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import type { UsageRecord } from "@/types";
import { getModelById } from "@/types";

interface UsageStats {
  statements: number;
  pages: number;
  transactions: number;
  apiCalls: number;
  tokensUsed: number;
  cost: number;
  avgConfidence: number;
  avgProcessingTime: number;
}

interface UserUsageBreakdown {
  userId: string;
  userName: string;
  statements: number;
  transactions: number;
  cost: number;
}

interface ModelUsageBreakdown {
  modelId: string;
  modelName: string;
  calls: number;
  tokens: number;
  cost: number;
  percentage: number;
}

export default function UsagePage() {
  const { organization, isAdmin, user, loading } = useAuth();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [dataLoading, setDataLoading] = useState(true);
  
  const [stats, setStats] = useState<UsageStats>({ statements: 0, pages: 0, transactions: 0, apiCalls: 0, tokensUsed: 0, cost: 0, avgConfidence: 0, avgProcessingTime: 0 });
  const [recentRecords, setRecentRecords] = useState<UsageRecord[]>([]);
  const [userBreakdown, setUserBreakdown] = useState<UserUsageBreakdown[]>([]);
  const [modelBreakdown, setModelBreakdown] = useState<ModelUsageBreakdown[]>([]);

  useEffect(() => {
    if (!organization?.id) return;
    loadUsageData();
  }, [organization?.id, timeRange]);

  const loadUsageData = async () => {
    if (!organization?.id) return;
    setDataLoading(true);
    try {
      const now = new Date();
      const daysBack = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
      const recordsQuery = query(collection(db, "usage_records"), where("orgId", "==", organization.id), where("timestamp", ">=", startDate), orderBy("timestamp", "desc"), limit(500));
      const recordsSnapshot = await getDocs(recordsQuery);
      const records = recordsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as UsageRecord));
      setRecentRecords(records.slice(0, 20));

      const totalStats: UsageStats = { statements: 0, pages: 0, transactions: 0, apiCalls: records.length, tokensUsed: 0, cost: 0, avgConfidence: 0, avgProcessingTime: 0 };
      let confidenceSum = 0, processingTimeSum = 0, confidenceCount = 0;
      const userMap = new Map<string, UserUsageBreakdown>();
      const modelMap = new Map<string, ModelUsageBreakdown>();

      records.forEach(record => {
        totalStats.statements += record.type === "extraction" ? 1 : 0;
        totalStats.pages += record.pagesProcessed || 0;
        totalStats.transactions += record.transactionsExtracted || 0;
        totalStats.tokensUsed += (record.inputTokens || 0) + (record.outputTokens || 0);
        totalStats.cost += record.estimatedCost || 0;
        if (record.confidence) { confidenceSum += record.confidence; confidenceCount++; }
        processingTimeSum += record.processingTimeMs || 0;

        const userId = record.userId;
        if (!userMap.has(userId)) userMap.set(userId, { userId, userName: userId.substring(0, 8) + "...", statements: 0, transactions: 0, cost: 0 });
        const userStats = userMap.get(userId)!;
        userStats.statements += record.type === "extraction" ? 1 : 0;
        userStats.transactions += record.transactionsExtracted || 0;
        userStats.cost += record.estimatedCost || 0;

        const modelId = record.aiModel;
        if (!modelMap.has(modelId)) {
          const model = getModelById(modelId);
          modelMap.set(modelId, { modelId, modelName: model?.name || modelId, calls: 0, tokens: 0, cost: 0, percentage: 0 });
        }
        const modelStats = modelMap.get(modelId)!;
        modelStats.calls++;
        modelStats.tokens += (record.inputTokens || 0) + (record.outputTokens || 0);
        modelStats.cost += record.estimatedCost || 0;
      });

      totalStats.avgConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;
      totalStats.avgProcessingTime = records.length > 0 ? processingTimeSum / records.length : 0;
      setStats(totalStats);

      const modelList = Array.from(modelMap.values());
      const totalCalls = modelList.reduce((sum, m) => sum + m.calls, 0);
      modelList.forEach(m => { m.percentage = totalCalls > 0 ? (m.calls / totalCalls) * 100 : 0; });
      setModelBreakdown(modelList.sort((a, b) => b.calls - a.calls));
      setUserBreakdown(Array.from(userMap.values()).sort((a, b) => b.statements - a.statements).slice(0, 10));
    } catch (error) {
      console.error("Error loading usage data:", error);
    } finally {
      setDataLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Usage Analytics" />
        <div className="flex-1 flex items-center justify-center"><div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-600 rounded-full" /></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Usage Analytics" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center"><AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" /><h2 className="text-sm font-semibold text-slate-900">Access Denied</h2><p className="text-xs text-slate-500 mt-1">Admin privileges required</p></div>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, trend }: { title: string; value: string | number; icon: React.ElementType; trend?: "up" | "down" | "neutral" }) => (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div><p className="text-[10px] text-slate-500 uppercase tracking-wide">{title}</p><p className="text-xl font-semibold text-slate-900 mt-1">{value}</p></div>
          <div className={`p-2 rounded-lg ${trend === "up" ? "bg-emerald-50" : trend === "down" ? "bg-red-50" : "bg-slate-50"}`}><Icon className={`h-4 w-4 ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-slate-600"}`} /></div>
        </div>
      </CardContent>
    </Card>
  );

  const maxLimit = organization?.settings?.maxStatementsPerMonth || 1000;
  const usagePercentage = Math.min((stats.statements / maxLimit) * 100, 100);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Usage Analytics" />
      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div><h2 className="text-base font-semibold text-slate-900 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-ormandy-red" />Usage Analytics</h2><p className="text-xs text-slate-500">Track AI usage and costs for {organization?.name}</p></div>
            <div className="flex items-center gap-2">
              <Select value={timeRange} onValueChange={(v: "7d" | "30d" | "90d") => setTimeRange(v)}><SelectTrigger className="h-7 text-xs w-[100px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7d" className="text-xs">Last 7 days</SelectItem><SelectItem value="30d" className="text-xs">Last 30 days</SelectItem><SelectItem value="90d" className="text-xs">Last 90 days</SelectItem></SelectContent></Select>
              <Button variant="outline" size="sm" className="h-7 text-xs"><Download className="h-3 w-3 mr-1" />Export</Button>
            </div>
          </div>

          <Card className="shadow-sm"><CardContent className="p-4"><div className="flex items-center justify-between mb-2"><p className="text-xs font-medium text-slate-700">Monthly Statement Limit</p><p className="text-xs text-slate-500">{stats.statements.toLocaleString()} / {maxLimit.toLocaleString()}</p></div><Progress value={usagePercentage} className="h-2" /><p className="text-[10px] text-slate-400 mt-1">{(maxLimit - stats.statements).toLocaleString()} remaining this month</p></CardContent></Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="Statements" value={stats.statements.toLocaleString()} icon={FileText} />
            <StatCard title="Transactions" value={stats.transactions.toLocaleString()} icon={TrendingUp} />
            <StatCard title="Tokens Used" value={`${(stats.tokensUsed / 1000000).toFixed(2)}M`} icon={Zap} />
            <StatCard title="Est. Cost" value={`$${stats.cost.toFixed(2)}`} icon={Coins} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard title="Pages Processed" value={stats.pages.toLocaleString()} icon={FileText} />
            <StatCard title="Avg Confidence" value={`${(stats.avgConfidence * 100).toFixed(1)}%`} icon={Brain} trend={stats.avgConfidence > 0.9 ? "up" : stats.avgConfidence < 0.8 ? "down" : "neutral"} />
            <StatCard title="Avg Processing" value={`${(stats.avgProcessingTime / 1000).toFixed(1)}s`} icon={Clock} />
            <StatCard title="API Calls" value={stats.apiCalls.toLocaleString()} icon={Zap} />
          </div>

          <Tabs defaultValue="models" className="space-y-4">
            <TabsList className="h-8"><TabsTrigger value="models" className="text-xs h-6">By Model</TabsTrigger><TabsTrigger value="users" className="text-xs h-6">By User</TabsTrigger><TabsTrigger value="recent" className="text-xs h-6">Recent Activity</TabsTrigger></TabsList>

            <TabsContent value="models">
              <Card className="shadow-sm"><CardHeader className="py-3 px-4"><CardTitle className="text-sm font-semibold">Usage by Model</CardTitle></CardHeader><CardContent className="px-4 pb-4 pt-0">{modelBreakdown.length === 0 ? <p className="text-xs text-slate-500 text-center py-8">No usage data yet</p> : <div className="space-y-3">{modelBreakdown.map(model => <div key={model.modelId} className="space-y-1"><div className="flex items-center justify-between text-xs"><span className="font-medium text-slate-900">{model.modelName}</span><span className="text-slate-500">{model.calls} calls • ${model.cost.toFixed(2)}</span></div><div className="flex items-center gap-2"><Progress value={model.percentage} className="h-1.5 flex-1" /><span className="text-[10px] text-slate-400 w-10 text-right">{model.percentage.toFixed(0)}%</span></div></div>)}</div>}</CardContent></Card>
            </TabsContent>

            <TabsContent value="users">
              <Card className="shadow-sm"><CardHeader className="py-3 px-4"><CardTitle className="text-sm font-semibold">Top Users</CardTitle></CardHeader><CardContent className="px-4 pb-4 pt-0">{userBreakdown.length === 0 ? <p className="text-xs text-slate-500 text-center py-8">No usage data yet</p> : <Table><TableHeader><TableRow><TableHead className="text-xs">User</TableHead><TableHead className="text-xs text-right">Statements</TableHead><TableHead className="text-xs text-right">Transactions</TableHead><TableHead className="text-xs text-right">Cost</TableHead></TableRow></TableHeader><TableBody>{userBreakdown.map((u, i) => <TableRow key={u.userId}><TableCell className="text-xs font-medium"><div className="flex items-center gap-2"><div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-semibold">{i + 1}</div>{u.userName}</div></TableCell><TableCell className="text-xs text-right">{u.statements}</TableCell><TableCell className="text-xs text-right">{u.transactions}</TableCell><TableCell className="text-xs text-right">${u.cost.toFixed(2)}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
            </TabsContent>

            <TabsContent value="recent">
              <Card className="shadow-sm"><CardHeader className="py-3 px-4"><CardTitle className="text-sm font-semibold">Recent Extractions</CardTitle></CardHeader><CardContent className="px-4 pb-4 pt-0">{recentRecords.length === 0 ? <p className="text-xs text-slate-500 text-center py-8">No recent activity</p> : <Table><TableHeader><TableRow><TableHead className="text-xs">Time</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Model</TableHead><TableHead className="text-xs text-right">Transactions</TableHead><TableHead className="text-xs text-right">Confidence</TableHead><TableHead className="text-xs text-right">Status</TableHead></TableRow></TableHeader><TableBody>{recentRecords.slice(0, 10).map(record => { const model = getModelById(record.aiModel); return <TableRow key={record.id}><TableCell className="text-xs text-slate-500">{record.timestamp?.toDate?.()?.toLocaleString?.() || "N/A"}</TableCell><TableCell className="text-xs capitalize">{record.type}</TableCell><TableCell className="text-xs">{model?.name || record.aiModel}</TableCell><TableCell className="text-xs text-right">{record.transactionsExtracted}</TableCell><TableCell className="text-xs text-right">{((record.confidence || 0) * 100).toFixed(0)}%</TableCell><TableCell className="text-right"><Badge variant="secondary" className={`text-[9px] ${record.status === "success" ? "bg-emerald-50 text-emerald-700" : record.status === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{record.status}</Badge></TableCell></TableRow>; })}</TableBody></Table>}</CardContent></Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

