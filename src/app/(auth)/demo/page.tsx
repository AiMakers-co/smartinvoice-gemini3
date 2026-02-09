"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cloneDemoData } from "@/lib/demo-clone";

const SESSION_KEY = "smartinvoice_demo_session_id";

function generateSessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export default function DemoPage() {
  const router = useRouter();
  const { signInAsGuest, user, loading } = useAuth();
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState("Preparing demo...");

  useEffect(() => {
    if (loading || started) return;

    // If already logged in with a demo session, redirect
    if (user && localStorage.getItem(SESSION_KEY)) {
      router.replace("/dashboard");
      return;
    }

    setStarted(true);

    (async () => {
      try {
        // Sign in first so we have Firestore permissions
        setStatus("Signing in...");
        await signInAsGuest();

        // Check for existing session (returning user)
        let sessionId = localStorage.getItem(SESSION_KEY);

        if (!sessionId) {
          // New demo session — clone data after auth
          sessionId = generateSessionId();
          localStorage.setItem(SESSION_KEY, sessionId);

          setStatus("Creating your demo environment...");
          await cloneDemoData(sessionId);
        }

        router.replace("/dashboard");
      } catch (err: any) {
        console.error("Demo setup error:", err);
        // Clear session on failure so retry creates a fresh one
        localStorage.removeItem(SESSION_KEY);
        setError(err.message || "Failed to start demo. Please try again.");
      }
    })();
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
              <p className="text-sm font-medium text-slate-900">{status}</p>
              <p className="text-xs text-slate-500 mt-1">Setting up sample data for you</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
