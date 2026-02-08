"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageLoadingProps {
  title?: string;
  message?: string;
  className?: string;
  variant?: "spinner" | "skeleton" | "minimal";
}

export function PageLoading({ 
  title, 
  message = "Loading...",
  className,
  variant = "spinner"
}: PageLoadingProps) {
  if (variant === "minimal") {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div className={cn("p-4 space-y-4", className)}>
        {/* Summary bar skeleton */}
        <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
        
        {/* Filters skeleton */}
        <div className="flex gap-2">
          <div className="h-8 w-48 bg-slate-100 rounded animate-pulse" />
          <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
          <div className="h-8 w-24 bg-slate-100 rounded animate-pulse" />
        </div>
        
        {/* Table skeleton */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="h-10 bg-slate-50 border-b" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 border-b last:border-0 flex items-center px-4 gap-4">
              <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
              <div className="h-3 w-16 bg-slate-100 rounded animate-pulse ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default spinner variant
  return (
    <div className={cn("flex flex-col items-center justify-center p-12", className)}>
      <div className="relative">
        <div className="h-10 w-10 rounded-full border-2 border-slate-200" />
        <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
      </div>
      {title && <p className="mt-4 text-sm font-medium text-slate-700">{title}</p>}
      {message && !title && <p className="mt-3 text-xs text-slate-400">{message}</p>}
    </div>
  );
}
