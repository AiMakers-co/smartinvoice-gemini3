"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function DemoPage() {
  const router = useRouter();
  const { signInAsGuest, user, loading } = useAuth();
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    // If already logged in with demo mode, redirect
    if (!loading && user) {
      router.replace("/dashboard");
      return;
    }

    if (!loading && !user && !started) {
      setStarted(true);
      signInAsGuest()
        .then(() => {
          router.replace("/dashboard");
        })
        .catch((err: any) => {
          console.error("Demo sign-in error:", err);
          setError(err.message || "Failed to start demo. Please try again.");
        });
    }
  }, [loading, user, started, signInAsGuest, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <div className="space-y-4">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <span className="text-red-600 text-xl">!</span>
            </div>
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => { setError(""); setStarted(false); }}
              className="text-sm text-purple-600 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto">
              {started ? (
                <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
              ) : (
                <Sparkles className="h-6 w-6 text-purple-600" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Loading demo environment...</p>
              <p className="text-xs text-slate-500 mt-1">Setting up sample data for you</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
