"use client";

import { useState, useEffect } from "react";
import { Brain, Save, Crown, Sparkles, Zap, Check, Calendar, DollarSign, Building2, Shield, Settings, BarChart3, AlertCircle, ToggleLeft, ToggleRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AI_MODELS, getModelsByProvider, type AIModel, type OrganizationSettings } from "@/types";

const tierIcons = { flagship: Crown, pro: Sparkles, fast: Zap };
const tierLabels = { flagship: "Flagship", pro: "Pro", fast: "Fast" };
const tierColors = {
  flagship: "bg-amber-100 text-amber-700 border-amber-200",
  pro: "bg-purple-100 text-purple-700 border-purple-200",
  fast: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function AdminPage() {
  const { organization, updateOrgSettings, isAdmin, isOwner, user, loading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [settings, setSettings] = useState<Partial<OrganizationSettings>>({
    aiProvider: "google",
    aiModel: "gemini-3-flash",
    allowUserModelOverride: false,
    maxStatementsPerMonth: 1000,
    maxPagesPerStatement: 50,
    confidenceThreshold: 0.85,
    autoApproveThreshold: 0.95,
    enableTemplateSharing: true,
    enableExport: true,
    enableApi: true,
  });

  useEffect(() => {
    if (organization?.settings) {
      setSettings(organization.settings);
    }
  }, [organization?.settings]);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Admin Settings" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-600 rounded-full" />
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Admin Settings" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h2 className="text-sm font-semibold text-slate-900">Access Denied</h2>
            <p className="text-xs text-slate-500 mt-1">Admin privileges required</p>
          </div>
        </div>
      </div>
    );
  }

  const availableModels = getModelsByProvider(settings.aiProvider || "google");
  const selectedModel = AI_MODELS.find(m => m.id === settings.aiModel);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      await updateOrgSettings(settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = (provider: "google" | "anthropic") => {
    setSettings(prev => ({ ...prev, aiProvider: provider, aiModel: "gemini-3-flash" }));
  };

  const ModelCard = ({ model, isSelected, onSelect }: { model: AIModel; isSelected: boolean; onSelect: () => void }) => {
    const TierIcon = tierIcons[model.tier];
    return (
      <button onClick={onSelect} className={`w-full text-left p-3 rounded-lg border transition-all ${isSelected ? "border-ormandy-red bg-red-50/50 ring-1 ring-ormandy-red" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-900">{model.name}</span>
              {model.recommended && <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-ormandy-red/10 text-ormandy-red border-0">Recommended</Badge>}
              <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${tierColors[model.tier]}`}><TierIcon className="h-2.5 w-2.5 mr-0.5" />{tierLabels[model.tier]}</Badge>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{model.description}</p>
            <div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-400">
              <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{model.releaseDate}</span>
              <span>{(model.contextWindow / 1000).toLocaleString()}K context</span>
              <span className="flex items-center gap-0.5"><DollarSign className="h-2.5 w-2.5" />${model.pricing.input}/${model.pricing.output} per 1M</span>
            </div>
          </div>
          {isSelected && <div className="h-5 w-5 rounded-full bg-ormandy-red flex items-center justify-center flex-shrink-0"><Check className="h-3 w-3 text-white" /></div>}
        </div>
      </button>
    );
  };

  const ToggleSwitch = ({ enabled, onToggle, label, description }: { enabled: boolean; onToggle: () => void; label: string; description: string }) => (
    <div className="flex items-center justify-between py-2">
      <div><p className="text-xs font-medium text-slate-900">{label}</p><p className="text-[10px] text-slate-500">{description}</p></div>
      <button onClick={onToggle} className="text-slate-600 hover:text-slate-900">{enabled ? <ToggleRight className="h-6 w-6 text-ormandy-red" /> : <ToggleLeft className="h-6 w-6" />}</button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Admin Settings" />
      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2"><Shield className="h-4 w-4 text-ormandy-red" />Organization Settings</h2>
              <p className="text-xs text-slate-500">Configure AI models and settings for {organization?.name || "your organization"}</p>
            </div>
            <Badge variant="outline" className="text-xs">{isOwner ? "Owner" : "Admin"}</Badge>
          </div>

          <Tabs defaultValue="ai" className="space-y-4">
            <TabsList className="h-8">
              <TabsTrigger value="ai" className="text-xs h-6"><Brain className="h-3 w-3 mr-1" />AI Models</TabsTrigger>
              <TabsTrigger value="limits" className="text-xs h-6"><BarChart3 className="h-3 w-3 mr-1" />Limits</TabsTrigger>
              <TabsTrigger value="features" className="text-xs h-6"><Settings className="h-3 w-3 mr-1" />Features</TabsTrigger>
              <TabsTrigger value="org" className="text-xs h-6"><Building2 className="h-3 w-3 mr-1" />Organization</TabsTrigger>
            </TabsList>

            <TabsContent value="ai">
              <div className="space-y-4">
                <Card className="shadow-sm">
                  <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-semibold">Default AI Provider</CardTitle><CardDescription className="text-xs">All users will use this provider by default</CardDescription></CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="grid grid-cols-1 gap-3">
                      <button onClick={() => handleProviderChange("google")} className="p-3 rounded-lg border text-left transition-all border-cyan-500 bg-cyan-50/50 ring-1 ring-cyan-500">
                        <div className="flex items-center gap-2 mb-1"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="#4285F4"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#4285F4" strokeWidth="2"/></svg><span className="text-xs font-semibold text-slate-900">Google Gemini 3</span></div>
                        <p className="text-[10px] text-slate-500">Gemini 3 Flash • Multimodal + Function Calling + Thinking</p>
                      </button>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-semibold">Default Model</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-4 pt-0"><div className="space-y-2">{availableModels.map(model => <ModelCard key={model.id} model={model} isSelected={settings.aiModel === model.id} onSelect={() => setSettings(prev => ({ ...prev, aiModel: model.id }))} />)}</div></CardContent>
                </Card>
                <Card className="shadow-sm"><CardContent className="p-4"><ToggleSwitch enabled={settings.allowUserModelOverride || false} onToggle={() => setSettings(prev => ({ ...prev, allowUserModelOverride: !prev.allowUserModelOverride }))} label="Allow User Model Override" description="Let users choose their own AI model" /></CardContent></Card>
                {selectedModel && <div className="p-3 rounded-lg bg-slate-900 text-white"><div className="flex items-center gap-2"><Brain className="h-4 w-4 text-ormandy-red" /><div className="flex-1"><p className="text-xs font-medium">Organization Default: {selectedModel.name}</p><p className="text-[10px] text-slate-400">Est. ${selectedModel.pricing.input + selectedModel.pricing.output}/1M tokens</p></div></div></div>}
              </div>
            </TabsContent>

            <TabsContent value="limits">
              <Card className="shadow-sm">
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-semibold">Usage Limits</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 pt-0 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5"><Label className="text-xs">Max Statements / Month</Label><Input type="number" value={settings.maxStatementsPerMonth || 1000} onChange={(e) => setSettings(prev => ({ ...prev, maxStatementsPerMonth: parseInt(e.target.value) || 1000 }))} className="h-8 text-xs" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Max Pages / Statement</Label><Input type="number" value={settings.maxPagesPerStatement || 50} onChange={(e) => setSettings(prev => ({ ...prev, maxPagesPerStatement: parseInt(e.target.value) || 50 }))} className="h-8 text-xs" /></div>
                  </div>
                  <Separator />
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5"><Label className="text-xs">Confidence Threshold</Label><Input type="number" step="0.01" min="0" max="1" value={settings.confidenceThreshold || 0.85} onChange={(e) => setSettings(prev => ({ ...prev, confidenceThreshold: parseFloat(e.target.value) || 0.85 }))} className="h-8 text-xs" /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Auto-Approve Threshold</Label><Input type="number" step="0.01" min="0" max="1" value={settings.autoApproveThreshold || 0.95} onChange={(e) => setSettings(prev => ({ ...prev, autoApproveThreshold: parseFloat(e.target.value) || 0.95 }))} className="h-8 text-xs" /></div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="features">
              <Card className="shadow-sm">
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-semibold">Feature Toggles</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 pt-0 divide-y">
                  <ToggleSwitch enabled={settings.enableTemplateSharing || false} onToggle={() => setSettings(prev => ({ ...prev, enableTemplateSharing: !prev.enableTemplateSharing }))} label="Template Sharing" description="Share bank statement templates across teams" />
                  <ToggleSwitch enabled={settings.enableExport || false} onToggle={() => setSettings(prev => ({ ...prev, enableExport: !prev.enableExport }))} label="Data Export" description="Export transactions to CSV/Excel" />
                  <ToggleSwitch enabled={settings.enableApi || false} onToggle={() => setSettings(prev => ({ ...prev, enableApi: !prev.enableApi }))} label="API Access" description="Create API keys for programmatic access" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="org">
              <Card className="shadow-sm">
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-semibold">Organization Details</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 pt-0 space-y-3">
                  <div className="space-y-1.5"><Label className="text-xs">Organization Name</Label><Input value={organization?.name || ""} disabled className="h-8 text-xs bg-slate-50" /></div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5"><Label className="text-xs">Plan</Label><div className="h-8 px-3 flex items-center bg-slate-50 rounded-md border text-xs"><Badge variant="secondary" className="text-[10px] capitalize">{organization?.billing?.plan || "free"}</Badge></div></div>
                    <div className="space-y-1.5"><Label className="text-xs">Billing Email</Label><Input value={organization?.billing?.billingEmail || ""} disabled className="h-8 text-xs bg-slate-50" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm mt-4">
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-semibold">Current Month Usage</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-2 rounded bg-slate-50"><p className="text-[10px] text-slate-500">Statements</p><p className="text-sm font-semibold">{organization?.usage?.currentMonth?.statements || 0}<span className="text-[10px] font-normal text-slate-400">/{settings.maxStatementsPerMonth}</span></p></div>
                    <div className="p-2 rounded bg-slate-50"><p className="text-[10px] text-slate-500">Pages</p><p className="text-sm font-semibold">{organization?.usage?.currentMonth?.pages || 0}</p></div>
                    <div className="p-2 rounded bg-slate-50"><p className="text-[10px] text-slate-500">Transactions</p><p className="text-sm font-semibold">{organization?.usage?.currentMonth?.transactions || 0}</p></div>
                    <div className="p-2 rounded bg-slate-50"><p className="text-[10px] text-slate-500">Est. Cost</p><p className="text-sm font-semibold">${(organization?.usage?.currentMonth?.cost || 0).toFixed(2)}</p></div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between pt-2">
            {success && <p className="text-xs text-emerald-600">Settings saved!</p>}
            {!success && <div />}
            <Button onClick={handleSave} disabled={saving} size="sm" className="h-7 text-xs"><Save className="h-3.5 w-3.5 mr-1" />{saving ? "Saving..." : "Save Changes"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

