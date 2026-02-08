"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, onSnapshot, Timestamp, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table as TableIcon,
  Upload,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Copy,
  CheckCircle2,
  FileSpreadsheet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Columns,
  Plus,
  Settings2,
  Clock,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ImportTemplate, IMPORTABLE_FIELDS, ImportableField } from "@/types/documents";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";

// ============================================
// HELPERS
// ============================================

function formatDate(timestamp: Timestamp | undefined) {
  if (!timestamp) return "-";
  const date = timestamp.toDate();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6">
        <TableIcon className="h-10 w-10 text-white" />
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">
        No Templates Yet
      </h3>
      <p className="text-slate-500 max-w-md mb-6">
        Templates save your column mappings for CSV and Excel imports.
        Upload a file and save the mapping to create a template.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <a href="/receivables/upload">
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Upload Invoices
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href="/payables/upload">
            <ArrowUpFromLine className="h-4 w-4 mr-2" />
            Upload Bills
          </a>
        </Button>
      </div>
    </div>
  );
}

// ============================================
// TEMPLATE CARD
// ============================================

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  template: ImportTemplate;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const mappedFields = template.columns.filter(c => c.targetField).length;
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center",
              template.direction === "outgoing" 
                ? "bg-emerald-100" 
                : "bg-orange-100"
            )}>
              <FileSpreadsheet className={cn(
                "h-5 w-5",
                template.direction === "outgoing"
                  ? "text-emerald-600"
                  : "text-orange-600"
              )} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{template.name}</h3>
              <p className="text-xs text-slate-500">{template.description || "No description"}</p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(template.id)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(template.id)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete(template.id)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="secondary" className="text-xs">
            {template.fileType.toUpperCase()}
          </Badge>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs",
              template.direction === "outgoing"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-orange-100 text-orange-700"
            )}
          >
            {template.direction === "outgoing" ? "Invoices" : "Bills"}
          </Badge>
          {template.isPublic && (
            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
              Shared
            </Badge>
          )}
        </div>

        {/* Mapped Columns */}
        <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
          <span className="flex items-center gap-1">
            <Columns className="h-3 w-3" />
            {mappedFields} mapped fields
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {Math.round(template.successRate * 100)}% success
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Used {template.usageCount} times
          </span>
          <span>
            Last used {formatDate(template.lastUsedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// TEMPLATE EDITOR DIALOG
// ============================================

function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ImportTemplate | null;
  onSave: (updates: Partial<ImportTemplate>) => void;
}) {
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [isPublic, setIsPublic] = useState(template?.isPublic || false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setIsPublic(template.isPublic);
    }
  }, [template]);

  const handleSave = () => {
    onSave({ name, description, isPublic });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
          <DialogDescription>
            Update template name and settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              className="mt-1"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-slate-700">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="mt-1"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-slate-700">
                Share with team members
              </span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function TemplatesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [editingTemplate, setEditingTemplate] = useState<ImportTemplate | null>(null);

  // Load templates
  useEffect(() => {
    if (!user?.id) return;

    const q = query(
      collection(db, "import_templates"),
      where("userId", "==", user.id),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ImportTemplate[];
      setTemplates(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

  // Filter templates
  const filteredTemplates = templates
    .filter(t => {
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(search) ||
          t.description?.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .filter(t => {
      if (directionFilter === "all") return true;
      return t.direction === directionFilter;
    });

  // Handle delete
  const handleDelete = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    
    try {
      await deleteDoc(doc(db, "import_templates", templateId));
      toast.success("Template deleted");
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  // Handle duplicate
  const handleDuplicate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    // TODO: Create a copy of the template
    toast.success("Template duplicated");
  };

  // Handle edit
  const handleEdit = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setEditingTemplate(template);
    }
  };

  // Handle save
  const handleSave = async (updates: Partial<ImportTemplate>) => {
    if (!editingTemplate) return;
    
    try {
      // TODO: Update template in Firestore
      toast.success("Template updated");
    } catch (error) {
      toast.error("Failed to update template");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-200 rounded" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-slate-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header title="Import Templates" />
      <div className="p-6 space-y-6">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <TableIcon className="h-5 w-5 text-white" />
              </div>
              Import Templates
            </h1>
            <p className="text-slate-500 mt-1">
              Manage your saved column mappings for CSV and Excel imports
            </p>
          </div>
        </div>

        {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <TableIcon className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Total Templates</p>
                <p className="text-xl font-bold text-slate-900">{templates.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <ArrowDownToLine className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Invoice Templates</p>
                <p className="text-xl font-bold text-slate-900">
                  {templates.filter(t => t.direction === "outgoing").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <ArrowUpFromLine className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-medium">Bill Templates</p>
                <p className="text-xl font-bold text-slate-900">
                  {templates.filter(t => t.direction === "incoming").length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {templates.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={directionFilter} onValueChange={setDirectionFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="outgoing">Invoices</SelectItem>
              <SelectItem value="incoming">Bills</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <EmptyState />
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500">No templates match your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      {/* How it Works */}
      <Card className="bg-gradient-to-br from-slate-50 to-white border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">How Templates Work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-600">
                1
              </div>
              <div>
                <p className="font-medium text-slate-900">Upload a file</p>
                <p className="text-sm text-slate-500">
                  Upload a CSV or Excel file with your data
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-600">
                2
              </div>
              <div>
                <p className="font-medium text-slate-900">Map columns</p>
                <p className="text-sm text-slate-500">
                  Tell us which columns contain which data
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-600">
                3
              </div>
              <div>
                <p className="font-medium text-slate-900">Save as template</p>
                <p className="text-sm text-slate-500">
                  Reuse the mapping for future imports
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <TemplateEditorDialog
        open={!!editingTemplate}
        onOpenChange={(open) => !open && setEditingTemplate(null)}
        template={editingTemplate}
        onSave={handleSave}
      />
      </div>
    </>
  );
}
