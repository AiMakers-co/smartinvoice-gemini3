"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// Demo account identifiers - must match seed script
export const DEMO_USER_ID = "demo_coastal_creative_agency";
export const DEMO_ORG_ID = "demo_org_coastal_creative";

interface DemoModeContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  setDemoMode: (value: boolean) => void;
  demoUserId: string;
  demoOrgId: string;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

const DEMO_MODE_KEY = "smartinvoice_demo_mode";

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load demo mode state from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(DEMO_MODE_KEY);
    if (stored === "true") {
      setIsDemoMode(true);
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

  return (
    <DemoModeContext.Provider value={{ 
      isDemoMode, 
      toggleDemoMode, 
      setDemoMode,
      demoUserId: DEMO_USER_ID,
      demoOrgId: DEMO_ORG_ID,
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
