"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const popularBanks = [
  "Chase", "Bank of America", "Wells Fargo", "Citi", "Capital One",
  "US Bank", "PNC Bank", "TD Bank", "Truist", "Other",
];

const accountTypes = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit Card" },
  { value: "other", label: "Other" },
];

const currencies = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "CAD", label: "CAD" },
];

export default function NewAccountPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    bankName: "",
    accountNickname: "",
    accountNumber: "",
    accountType: "checking",
    currency: "USD",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      await addDoc(collection(db, "accounts"), {
        userId: user.id,
        orgId: user.orgId || null,
        bankName: formData.bankName,
        accountNickname: formData.accountNickname,
        accountNumber: formData.accountNumber.slice(-4),
        accountType: formData.accountType,
        currency: formData.currency,
        isArchived: false,
        transactionCount: 0,
        createdAt: serverTimestamp(),
      });

      router.push("/accounts");
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Add Account" />

      <div className="flex-1 p-4 overflow-auto">
        <div className="max-w-md mx-auto">
          <Button variant="ghost" asChild className="mb-4 h-7 text-xs text-slate-600">
            <Link href="/accounts">
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back to Accounts
            </Link>
          </Button>

          <Card className="shadow-sm">
            <CardHeader className="pb-3 pt-4 px-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">New Bank Account</CardTitle>
                  <p className="text-[10px] text-slate-500">Connect to start uploading statements</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-2 rounded bg-red-50 border border-red-100 text-red-700 text-xs">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Bank Name</Label>
                  <Select
                    value={formData.bankName}
                    onValueChange={(value) => setFormData({ ...formData, bankName: value })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {popularBanks.map((bank) => (
                        <SelectItem key={bank} value={bank} className="text-xs">{bank}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Account Nickname</Label>
                  <Input
                    placeholder="e.g., Main Checking"
                    value={formData.accountNickname}
                    onChange={(e) => setFormData({ ...formData, accountNickname: e.target.value })}
                    className="h-8 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Last 4 Digits</Label>
                  <Input
                    placeholder="1234"
                    maxLength={4}
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value.replace(/\D/g, "") })}
                    className="h-8 text-xs"
                    required
                  />
                  <p className="text-[10px] text-slate-400">For identification only</p>
                </div>

                <div className="grid gap-3 grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={formData.accountType}
                      onValueChange={(value) => setFormData({ ...formData, accountType: value })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accountTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value} className="text-xs">
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((c) => (
                          <SelectItem key={c.value} value={c.value} className="text-xs">
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1 h-8 text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1 h-8 text-xs" disabled={loading}>
                    {loading ? "Creating..." : "Create Account"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
