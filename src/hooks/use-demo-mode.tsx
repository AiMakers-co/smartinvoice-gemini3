"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// Master demo account identifiers - must match seed script
export const DEMO_USER_ID = "demo_coastal_creative_agency";
export const DEMO_ORG_ID = "demo_org_coastal_creative";

const DEMO_MODE_KEY = "smartinvoice_demo_mode";
const DEMO_SESSION_KEY = "smartinvoice_demo_session_id";

interface DemoModeContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  setDemoMode: (value: boolean) => void;
  demoUserId: string;
  demoOrgId: string;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Load demo mode state from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(DEMO_MODE_KEY);
    if (stored === "true") {
      setIsDemoMode(true);
    }
    const storedSession = localStorage.getItem(DEMO_SESSION_KEY);
    if (storedSession) {
      setSessionId(storedSession);
    }
  }, []);

  // Persist demo mode state to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(DEMO_MODE_KEY, isDemoMode.toString());
    }
  }, [isDemoMode, mounted]);

  const toggleDemoMode = () => {
    setIsDemoMode(prev => !prev);
  };

  const setDemoMode = (value: boolean) => {
    setIsDemoMode(value);
  };

  // Session-aware demo userId
  const demoUserId = sessionId ? `demo_${sessionId}` : DEMO_USER_ID;
  const demoOrgId = sessionId ? `demo_org_${sessionId}` : DEMO_ORG_ID;

  return (
    <DemoModeContext.Provider value={{
      isDemoMode,
      toggleDemoMode,
      setDemoMode,
      demoUserId,
      demoOrgId,
    }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (context === undefined) {
    throw new Error("useDemoMode must be used within a DemoModeProvider");
  }
  return context;
}
