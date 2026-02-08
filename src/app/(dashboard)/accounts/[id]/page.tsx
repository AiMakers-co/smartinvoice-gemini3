"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Calendar,
  TrendingUp,
  TrendingDown,
  FileText,
  DollarSign,
  Edit2,
  Archive,
  Trash2,
  Download,
  Eye,
  MoreVertical,
  AlertCircle,
} from "lucide-react";
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BankAccount, Statement, Transaction } from "@/types";

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatCurrency(amount: number | undefined | null, currency: string = "USD"): string {
  if (amount === undefined || amount === null || isNaN(amount)) return `${currency} 0.00`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(timestamp: Timestamp | undefined | null): string {
  if (!timestamp) return "—";
  return timestamp.toDate().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(timestamp: Timestamp | undefined | null): string {
  if (!timestamp) return "—";
  return timestamp.toDate().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function AccountDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const accountId = params.id as string;

  const [account, setAccount] = useState<BankAccount | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editNickname, setEditNickname] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editAccountNumber, setEditAccountNumber] = useState("");
  const [editAccountType, setEditAccountType] = useState("");
  const [editCurrency, setEditCurrency] = useState("");
  const [editBalance, setEditBalance] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Load account details
  useEffect(() => {
    if (!user || !accountId) return;

    const loadAccount = async () => {
      try {
        const accountDoc = await getDoc(doc(db, "accounts", accountId));
        if (accountDoc.exists()) {
          setAccount({ id: accountDoc.id, ...accountDoc.data() } as BankAccount);
        } else {
          console.error("Account not found");
          router.push("/accounts");
        }
      } catch (error) {
        console.error("Error loading account:", error);
        router.push("/accounts");
      } finally {
        setLoading(false);
      }
    };

    loadAccount();
  }, [user, accountId, router]);

  // Load statements
  useEffect(() => {
    if (!user?.id || !accountId) return;

    const statementsQuery = query(
      collection(db, "statements"),
      where("userId", "==", user.id),
      where("accountId", "==", accountId),
      orderBy("periodEnd", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      statementsQuery,
      (snapshot) => {
        const statementsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Statement[];
        setStatements(statementsData);
      },
      (error) => {
        console.error("Error loading statements:", error);
      }
    );

    return () => unsubscribe();
  }, [user?.id, accountId]);

  // Load recent transactions
  useEffect(() => {
    if (!user?.id || !accountId) return;

    const transactionsQuery = query(
      collection(db, "transactions"),
      where("userId", "==", user.id),
      where("accountId", "==", accountId),
      orderBy("date", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      transactionsQuery,
      (snapshot) => {
        const transactionsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Transaction[];
        setTransactions(transactionsData);
      },
      (error) => {
        console.error("Error loading transactions:", error);
      }
    );

    return () => unsubscribe();
  }, [user?.id, accountId]);

  // Handle edit dialog
  const handleOpenEdit = () => {
    if (!account) return;
    setEditNickname(account.accountNickname || "");
    setEditBankName(account.bankName || "");
    setEditAccountNumber(account.accountNumber || "");
    setEditAccountType(account.accountType || "checking");
    setEditCurrency(account.currency || "USD");
    setEditBalance(account.balance?.toString() || "0");
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!account || !editNickname.trim() || !editBankName.trim()) return;
    
    setEditSaving(true);
    try {
      const balanceValue = parseFloat(editBalance) || 0;
      
      await updateDoc(doc(db, "accounts", account.id), {
        accountNickname: editNickname.trim(),
        bankName: editBankName.trim(),
        accountNumber: editAccountNumber.trim(),
        accountType: editAccountType,
        currency: editCurrency.toUpperCase(),
        balance: balanceValue,
        updatedAt: Timestamp.now(),
      });
      
      // Update local state
      setAccount({
        ...account,
        accountNickname: editNickname.trim(),
        bankName: editBankName.trim(),
        accountNumber: editAccountNumber.trim(),
        accountType: editAccountType as any,
        currency: editCurrency.toUpperCase(),
        balance: balanceValue,
      });
      
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating account:", error);
      alert("Failed to update account. Please try again.");
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Account Details" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <Header title="Account Details" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">Account not found</p>
            <Button onClick={() => router.push("/accounts")} className="mt-4">
              Back to Accounts
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Calculate summary stats
  const totalCredits = transactions
    .filter((t) => t.type === "credit")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebits = transactions
    .filter((t) => t.type === "debit")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <Header title="Account Details" />

      <div className="flex-1 p-4 overflow-auto">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/accounts")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Accounts
        </Button>

        <div className="space-y-4">
          {/* Account Header */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{account.accountNickname}</h2>
                    <p className="text-sm text-slate-600">
                      {account.bankName} • {account.accountNumber && account.accountNumber !== "unknown" 
                        ? `****${account.accountNumber.slice(-4)}` 
                        : "No account number"}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenEdit}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>

              <Separator className="my-4" />

              {/* Account Details Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Current Balance</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(account.balance || 0, account.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Account Type</p>
                  <Badge variant="secondary" className="mt-1">
                    {account.accountType}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Currency</p>
                  <p className="text-lg font-semibold text-slate-900">{account.currency}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Opened</p>
                  <p className="text-sm text-slate-900">{formatDate(account.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Credits</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(totalCredits, account.currency)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Debits</p>
                    <p className="text-lg font-bold text-red-600">
                      {formatCurrency(totalDebits, account.currency)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Statements</p>
                    <p className="text-lg font-bold text-slate-900">{statements.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Statements */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Statements</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/statements")}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {statements.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No statements uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {statements.map((statement) => (
                    <div
                      key={statement.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-blue-100 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {formatDate(statement.periodStart)} - {formatDate(statement.periodEnd)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {statement.transactionCount} transactions
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(statement.closingBalance || 0, account.currency)}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(statement.fileUrl, "_blank")}
                          className="h-6 text-xs mt-1"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Transactions</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/transactions")}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.slice(0, 10).map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-8 w-8 rounded flex items-center justify-center ${
                            transaction.type === "credit"
                              ? "bg-green-100"
                              : "bg-red-100"
                          }`}
                        >
                          {transaction.type === "credit" ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 truncate max-w-xs">
                            {transaction.description}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDate(transaction.date)}
                            {transaction.category && ` • ${transaction.category}`}
                          </p>
                        </div>
                      </div>
                      <p
                        className={`text-sm font-bold ${
                          transaction.type === "credit"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {transaction.type === "credit" ? "+" : "-"}
                        {formatCurrency(Math.abs(transaction.amount), account.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit Account Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Account</DialogTitle>
              <DialogDescription>
                Update your account details. All fields can be edited.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nickname">Account Nickname</Label>
                <Input
                  id="nickname"
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  placeholder="e.g., Business Checking"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  placeholder="e.g., Chase Bank"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number (Last 4)</Label>
                  <Input
                    id="accountNumber"
                    value={editAccountNumber}
                    onChange={(e) => setEditAccountNumber(e.target.value)}
                    placeholder="e.g., 1234"
                    maxLength={10}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="accountType">Account Type</Label>
                  <Select value={editAccountType} onValueChange={setEditAccountType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="credit">Credit Card</SelectItem>
                      <SelectItem value="investment">Investment</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value.toUpperCase())}
                    placeholder="e.g., USD"
                    maxLength={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="balance">Current Balance</Label>
                  <Input
                    id="balance"
                    type="number"
                    step="0.01"
                    value={editBalance}
                    onChange={(e) => setEditBalance(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={editSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={editSaving || !editNickname.trim() || !editBankName.trim()}
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

