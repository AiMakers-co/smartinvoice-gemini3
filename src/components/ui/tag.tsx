"use client";

import { cn } from "@/lib/utils";

// ============================================
// CENTRAL TAG SYSTEM
// Use these everywhere in the app for consistency
// ============================================

export type TagVariant = 
  | "default" 
  | "primary" 
  | "success" 
  | "warning" 
  | "danger" 
  | "info"
  | "cyan"
  | "emerald"
  | "orange"
  | "purple"
  | "slate";

export type TagSize = "xs" | "sm" | "md";

interface TagProps {
  children: React.ReactNode;
  variant?: TagVariant;
  size?: TagSize;
  className?: string;
  dot?: boolean; // Show colored dot before text
  removable?: boolean;
  onRemove?: () => void;
}

const variantStyles: Record<TagVariant, string> = {
  default: "bg-slate-100 text-slate-700 border-slate-200",
  primary: "bg-blue-50 text-blue-700 border-blue-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

const dotStyles: Record<TagVariant, string> = {
  default: "bg-slate-400",
  primary: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
  cyan: "bg-cyan-500",
  emerald: "bg-emerald-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  slate: "bg-slate-400",
};

const sizeStyles: Record<TagSize, string> = {
  xs: "text-[10px] px-1.5 py-0.5 gap-1",
  sm: "text-xs px-2 py-0.5 gap-1.5",
  md: "text-sm px-2.5 py-1 gap-2",
};

export function Tag({ 
  children, 
  variant = "default", 
  size = "sm",
  className,
  dot = false,
  removable = false,
  onRemove,
}: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-md border",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotStyles[variant])} />
      )}
      {children}
      {removable && onRemove && (
        <button 
          onClick={onRemove}
          className="ml-0.5 hover:opacity-70 transition-opacity"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}

// ============================================
// PRESET TAGS - Common tags used across the app
// ============================================

// Document types
export const DocumentTypeTags = {
  invoice: <Tag variant="emerald">Invoice</Tag>,
  bill: <Tag variant="orange">Bill</Tag>,
  statement: <Tag variant="cyan">Statement</Tag>,
};

// Status tags
export const StatusTags = {
  paid: <Tag variant="success" dot>Paid</Tag>,
  unpaid: <Tag variant="slate" dot>Unpaid</Tag>,
  partial: <Tag variant="warning" dot>Partial</Tag>,
  overdue: <Tag variant="danger" dot>Overdue</Tag>,
  pending: <Tag variant="slate" dot>Pending</Tag>,
  matched: <Tag variant="success" dot>Matched</Tag>,
  unmatched: <Tag variant="warning" dot>Unmatched</Tag>,
};

// File type tags
export const FileTypeTags = {
  pdf: <Tag variant="danger" size="xs">PDF</Tag>,
  csv: <Tag variant="success" size="xs">CSV</Tag>,
  xlsx: <Tag variant="emerald" size="xs">Excel</Tag>,
  png: <Tag variant="purple" size="xs">PNG</Tag>,
  jpg: <Tag variant="purple" size="xs">JPG</Tag>,
};

// Field tags - for showing what fields will be extracted
export function FieldTag({ children, variant = "slate" }: { children: React.ReactNode; variant?: TagVariant }) {
  return <Tag variant={variant} size="sm">{children}</Tag>;
}

// AI/Tech tags
export const TechTags = {
  gemini: <Tag variant="purple" size="xs">Gemini AI</Tag>,
  ai: <Tag variant="info" size="xs">AI</Tag>,
  auto: <Tag variant="cyan" size="xs">Auto</Tag>,
};
