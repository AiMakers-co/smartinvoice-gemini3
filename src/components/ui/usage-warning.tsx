"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, X, Zap, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface UsageWarningProps {
  className?: string;
  variant?: "banner" | "inline" | "compact";
  showWhenAbove?: number; // Show when usage is above this percentage (default 75)
  onDismiss?: () => void;
}

export function UsageWarning({ 
  className, 
  variant = "banner",
  showWhenAbove = 75,
  onDismiss,
}: UsageWarningProps) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  
  // Get subscription data
  const pagesUsed = user?.subscription?.pagesUsedThisMonth || 0;
  const pagesLimit = user?.subscription?.pagesLimit || 50;
  const status = user?.subscription?.status || "free";
  const planId = user?.subscription?.planId || "free";
  
  // Calculate usage percentage
  const usagePercent = pagesLimit > 0 ? Math.round((pagesUsed / pagesLimit) * 100) : 0;
  const pagesRemaining = Math.max(0, pagesLimit - pagesUsed);
  const isAtLimit = pagesRemaining === 0;
  const isNearLimit = usagePercent >= showWhenAbove;
  
  // Don't show if not near limit, or if dismissed
  if (!isNearLimit || dismissed) {
    return null;
  }
  
  // Determine severity
  const severity = isAtLimit ? "critical" : usagePercent >= 90 ? "warning" : "info";
  
  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };
  
  // Compact variant - just a small inline warning
  if (variant === "compact") {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
        severity === "critical" 
          ? "bg-red-100 text-red-700" 
          : severity === "warning" 
            ? "bg-amber-100 text-amber-700"
            : "bg-blue-100 text-blue-700",
        className
      )}>
        {severity === "critical" ? (
          <AlertTriangle className="w-3 h-3" />
        ) : (
          <TrendingUp className="w-3 h-3" />
        )}
        {isAtLimit 
          ? "Limit reached" 
          : `${pagesRemaining} pages left`
        }
      </div>
    );
  }
  
  // Inline variant - smaller, no dismiss
  if (variant === "inline") {
    return (
      <div className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
        severity === "critical" 
          ? "bg-red-50 border border-red-200 text-red-800" 
          : severity === "warning" 
            ? "bg-amber-50 border border-amber-200 text-amber-800"
            : "bg-blue-50 border border-blue-200 text-blue-800",
        className
      )}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">
          {isAtLimit ? (
            <>You&apos;ve reached your {pagesLimit} page limit for this month.</>
          ) : (
            <>You&apos;ve used {pagesUsed} of {pagesLimit} pages ({usagePercent}%).</>
          )}
        </span>
        <Link href="/settings?tab=billing">
          <Button size="sm" variant="outline" className="text-xs h-7">
            <Zap className="w-3 h-3 mr-1" />
            Upgrade
          </Button>
        </Link>
      </div>
    );
  }
  
  // Full banner variant
  return (
    <div className={cn(
      "relative rounded-lg p-4",
      severity === "critical" 
        ? "bg-red-50 border border-red-200" 
        : severity === "warning" 
          ? "bg-amber-50 border border-amber-200"
          : "bg-blue-50 border border-blue-200",
      className
    )}>
      <button 
        onClick={handleDismiss}
        className={cn(
          "absolute top-3 right-3 hover:opacity-80",
          severity === "critical" ? "text-red-600" : severity === "warning" ? "text-amber-600" : "text-blue-600"
        )}
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3 pr-8">
        <div className={cn(
          "p-2 rounded-lg",
          severity === "critical" ? "bg-red-100" : severity === "warning" ? "bg-amber-100" : "bg-blue-100"
        )}>
          <AlertTriangle className={cn(
            "w-5 h-5",
            severity === "critical" ? "text-red-600" : severity === "warning" ? "text-amber-600" : "text-blue-600"
          )} />
        </div>
        
        <div className="flex-1">
          <h3 className={cn(
            "font-semibold text-sm",
            severity === "critical" ? "text-red-900" : severity === "warning" ? "text-amber-900" : "text-blue-900"
          )}>
            {isAtLimit 
              ? "You've reached your page limit" 
              : usagePercent >= 90 
                ? "Almost at your limit"
                : "Usage update"
            }
          </h3>
          <p className={cn(
            "text-sm mt-0.5",
            severity === "critical" ? "text-red-700" : severity === "warning" ? "text-amber-700" : "text-blue-700"
          )}>
            {isAtLimit ? (
              <>You&apos;ve used all {pagesLimit} pages this month. Upgrade to continue processing.</>
            ) : (
              <>You&apos;ve used <strong>{pagesUsed}</strong> of <strong>{pagesLimit}</strong> pages this month ({usagePercent}%). {pagesRemaining} pages remaining.</>
            )}
          </p>
          
          {/* Usage bar */}
          <div className="mt-3 mb-3">
            <div className="h-2 bg-white rounded-full overflow-hidden border">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  severity === "critical" ? "bg-red-500" : severity === "warning" ? "bg-amber-500" : "bg-blue-500"
                )}
                style={{ width: `${Math.min(100, usagePercent)}%` }}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/settings?tab=billing">
              <Button 
                size="sm" 
                className={cn(
                  "text-xs",
                  severity === "critical" 
                    ? "bg-red-600 hover:bg-red-700 text-white" 
                    : severity === "warning" 
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                )}
              >
                <Zap className="w-3 h-3 mr-1" />
                Upgrade Now
              </Button>
            </Link>
            {planId === "free" && (
              <span className="text-xs text-slate-500">
                From $0.05/page
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to get current usage status
 */
export function useUsageStatus() {
  const { user } = useAuth();
  
  const pagesUsed = user?.subscription?.pagesUsedThisMonth || 0;
  const pagesLimit = user?.subscription?.pagesLimit || 50;
  const usagePercent = pagesLimit > 0 ? Math.round((pagesUsed / pagesLimit) * 100) : 0;
  const pagesRemaining = Math.max(0, pagesLimit - pagesUsed);
  
  return {
    pagesUsed,
    pagesLimit,
    pagesRemaining,
    usagePercent,
    isAtLimit: pagesRemaining === 0,
    isNearLimit: usagePercent >= 80,
    status: user?.subscription?.status || "free",
    planId: user?.subscription?.planId || "free",
  };
}
