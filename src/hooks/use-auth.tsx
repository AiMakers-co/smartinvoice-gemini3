"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { trackSignUp, setAnalyticsUserId, setAnalyticsUserProperties } from "@/lib/analytics";
import type { 
  User, 
  Organization, 
  Team, 
  UserRole, 
  UserSettings,
  OrganizationSettings,
  UsageRecord,
  AuthProvider,
  AuthProviderInfo,
  canUserAccess as canAccess,
} from "@/types";
import { canUserAccess } from "@/types";

// ============================================
// AUTH CONTEXT TYPES
// ============================================

interface AuthContextType {
  // Auth state
  firebaseUser: FirebaseUser | null;
  user: User | null;
  organization: Organization | null;
  teams: Team[];
  loading: boolean;
  error: string | null;

  // Auth actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;

  // User actions
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
  updateUserProfile: (data: { name?: string; avatarUrl?: string }) => Promise<void>;

  // Organization actions (admin only)
  updateOrgSettings: (settings: Partial<OrganizationSettings>) => Promise<void>;
  createOrganization: (name: string) => Promise<string>;
  
  // Team actions
  getTeamMembers: (teamId: string) => Promise<User[]>;
  
  // Permission helpers
  canAccess: (permission: string) => boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isDeveloper: boolean;
  isMember: boolean;

  // Computed values
  effectiveAiModel: string;
  effectiveAiProvider: "google" | "anthropic";
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// DEFAULT VALUES
// ============================================

const defaultUserSettings: UserSettings = {
  defaultExportFormat: "csv",
  theme: "system",
  emailNotifications: true,
  processingAlerts: true,
};

const defaultOrgSettings: OrganizationSettings = {
  aiProvider: "google",
  aiModel: "gemini-3-pro",
  allowUserModelOverride: false,
  maxUsersPerTeam: 10,
  maxTeams: 5,
  maxStatementsPerMonth: 1000,
  maxPagesPerStatement: 50,
  enableTemplateSharing: true,
  enableExport: true,
  enableApi: true,
  confidenceThreshold: 0.85,
  autoApproveThreshold: 0.95,
};

// ============================================
// AUTH PROVIDER
// ============================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen to Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      
      if (fbUser) {
        await loadUserData(fbUser.uid);
      } else {
        setUser(null);
        setOrganization(null);
        setTeams([]);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Load user data and organization
  const loadUserData = async (userId: string) => {
    try {
      // Check if demo mode is active (localStorage set before sign-in)
      const isDemoMode = localStorage.getItem("smartinvoice_demo_mode") === "true";
      const effectiveUserId = isDemoMode ? "demo_coastal_creative_agency" : userId;

      // Get user document
      const userDocRef = doc(db, "users", effectiveUserId);
      const userDoc = await getDoc(userDocRef);
      
      let userData: User;
      
      if (userDoc.exists()) {
        userData = { id: userDoc.id, ...userDoc.data() } as User;
        
        // Update last login (skip for demo user — don't want to modify demo data)
        if (!isDemoMode) {
          await updateDoc(userDocRef, {
            lastLoginAt: serverTimestamp(),
          });
        }
      } else if (isDemoMode) {
        // Demo user doc doesn't exist — create a minimal one
        const demoUser: Record<string, unknown> = {
          email: "demo@smartinvoice.finance",
          name: "Demo User",
          orgId: "demo_org_coastal_creative",
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          orgRole: "owner",
          teamIds: [],
          settings: defaultUserSettings,
          usage: {
            currentMonth: { statements: 0, pages: 0, transactions: 0, apiCalls: 0 },
            lastActivity: serverTimestamp(),
          },
        };
        await setDoc(userDocRef, demoUser);
        userData = { id: effectiveUserId, ...demoUser } as unknown as User;
      } else {
        // User document doesn't exist - create it from Firebase Auth data
        const fbUser = auth.currentUser;
        if (!fbUser) {
          console.error("No Firebase user found");
          return;
        }
        
        const newUser: Record<string, unknown> = {
          email: fbUser.email || "",
          name: fbUser.displayName || fbUser.email?.split("@")[0] || "User",
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          orgRole: "member",
          teamIds: [],
          settings: defaultUserSettings,
          usage: {
            currentMonth: { statements: 0, pages: 0, transactions: 0, apiCalls: 0 },
            lastActivity: serverTimestamp(),
          },
        };
        
        // Only add avatarUrl if it exists (Firestore doesn't accept undefined)
        if (fbUser.photoURL) {
          newUser.avatarUrl = fbUser.photoURL;
        }
        
        await setDoc(userDocRef, newUser);
        userData = { id: userId, ...newUser } as unknown as User;
        console.log("Created new user document for:", fbUser.email);
      }
      
        setUser(userData);

        // Load organization if user belongs to one
        if (userData.orgId) {
          const orgDoc = await getDoc(doc(db, "organizations", userData.orgId));
          if (orgDoc.exists()) {
            setOrganization({ id: orgDoc.id, ...orgDoc.data() } as Organization);
          }

          // Load teams
          if (userData.teamIds?.length > 0) {
            const teamsQuery = query(
              collection(db, "teams"),
              where("orgId", "==", userData.orgId)
            );
            const teamsSnapshot = await getDocs(teamsQuery);
            const teamsData = teamsSnapshot.docs
              .filter(d => userData.teamIds.includes(d.id))
              .map(d => ({ id: d.id, ...d.data() } as Team));
            setTeams(teamsData);
          }
      }
    } catch (err) {
      console.error("Error loading user data:", err);
      setError("Failed to load user data");
    }
  };

  // Subscribe to real-time updates for user and org
  useEffect(() => {
    if (!firebaseUser?.uid) return;

    // In demo mode, subscribe to the demo user doc, not the anonymous UID
    const isDemoMode = localStorage.getItem("smartinvoice_demo_mode") === "true";
    const effectiveUserId = isDemoMode ? "demo_coastal_creative_agency" : firebaseUser.uid;

    const unsubUser = onSnapshot(doc(db, "users", effectiveUserId), (doc) => {
      if (doc.exists()) {
        setUser({ id: doc.id, ...doc.data() } as User);
      }
    });

    return () => unsubUser();
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!user?.orgId) return;

    const unsubOrg = onSnapshot(doc(db, "organizations", user.orgId), (doc) => {
      if (doc.exists()) {
        setOrganization({ id: doc.id, ...doc.data() } as Organization);
      }
    });

    return () => unsubOrg();
  }, [user?.orgId]);

  // ============================================
  // AUTH ACTIONS
  // ============================================

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      const { user: fbUser } = await signInWithEmailAndPassword(auth, email, password);
      
      // Update last auth provider and last used timestamp
      await updateAuthProviderUsage(fbUser.uid, "email");
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // Helper to update auth provider usage tracking
  const updateAuthProviderUsage = async (userId: string, provider: AuthProvider) => {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const existingProviders: AuthProviderInfo[] = userData.authProviders || [];
      
      // Find if this provider already exists
      const providerIndex = existingProviders.findIndex(p => p.provider === provider);
      // Use Timestamp.now() for arrays (serverTimestamp() not allowed in arrays)
      const nowTimestamp = Timestamp.now();
      
      if (providerIndex >= 0) {
        // Update last used timestamp
        existingProviders[providerIndex].lastUsedAt = nowTimestamp;
      } else {
        // Add new provider
        existingProviders.push({
          provider,
          linkedAt: nowTimestamp,
          lastUsedAt: nowTimestamp,
        });
      }
      
      await updateDoc(userRef, {
        authProviders: existingProviders,
        lastAuthProvider: provider,
        lastLoginAt: serverTimestamp(),
      });
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    setError(null);
    try {
      const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password);
      // Use Timestamp.now() for array values, serverTimestamp() for top-level fields
      const nowTimestamp = Timestamp.now();
      
      // Create user document with auth provider tracking
      const newUser: Omit<User, "id"> = {
        email,
        name,
        createdAt: serverTimestamp() as Timestamp,
        orgRole: "member",
        teamIds: [],
        settings: defaultUserSettings,
        authProviders: [{
          provider: "email",
          linkedAt: nowTimestamp,
          lastUsedAt: nowTimestamp,
        }],
        lastAuthProvider: "email",
        usage: {
          currentMonth: { statements: 0, pages: 0, transactions: 0, apiCalls: 0 },
          lastActivity: serverTimestamp() as Timestamp,
        },
      };

      await setDoc(doc(db, "users", fbUser.uid), newUser);
      
      // Track signup conversion
      trackSignUp("email");
      setAnalyticsUserId(fbUser.uid);
      setAnalyticsUserProperties({ plan: "free", account_type: "member" });
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const { user: fbUser } = await signInWithPopup(auth, provider);
      // Use Timestamp.now() for array values, serverTimestamp() for top-level fields
      const nowTimestamp = Timestamp.now();

      // Check if user exists
      const userDoc = await getDoc(doc(db, "users", fbUser.uid));
      
      if (!userDoc.exists()) {
        // Create new user with Google auth provider tracking
        const newUser: Omit<User, "id"> = {
          email: fbUser.email || "",
          name: fbUser.displayName || "",
          avatarUrl: fbUser.photoURL || undefined,
          createdAt: serverTimestamp() as Timestamp,
          orgRole: "member",
          teamIds: [],
          settings: defaultUserSettings,
          authProviders: [{
            provider: "google",
            linkedAt: nowTimestamp,
            lastUsedAt: nowTimestamp,
          }],
          lastAuthProvider: "google",
          usage: {
            currentMonth: { statements: 0, pages: 0, transactions: 0, apiCalls: 0 },
            lastActivity: serverTimestamp() as Timestamp,
          },
        };

        await setDoc(doc(db, "users", fbUser.uid), newUser);
        
        // Track signup conversion (new Google user)
        trackSignUp("google");
        setAnalyticsUserId(fbUser.uid);
        setAnalyticsUserProperties({ plan: "free", account_type: "member" });
      } else {
        // Existing user - update auth provider usage
        await updateAuthProviderUsage(fbUser.uid, "google");
        
        // Track returning user
        setAnalyticsUserId(fbUser.uid);
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const signInAsGuest = async () => {
    setError(null);
    try {
      // Set demo mode BEFORE signing in so loadUserData knows
      localStorage.setItem("smartinvoice_demo_mode", "true");
      await signInAnonymously(auth);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      // Clear demo mode on sign out
      localStorage.removeItem("smartinvoice_demo_mode");
      await firebaseSignOut(auth);
      setUser(null);
      setOrganization(null);
      setTeams([]);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  // ============================================
  // USER ACTIONS
  // ============================================

  const updateUserSettings = async (settings: Partial<UserSettings>) => {
    if (!firebaseUser?.uid) throw new Error("Not authenticated");
    
    await updateDoc(doc(db, "users", firebaseUser.uid), {
      settings: { ...user?.settings, ...settings },
    });
  };

  const updateUserProfile = async (data: { name?: string; avatarUrl?: string }) => {
    if (!firebaseUser?.uid) throw new Error("Not authenticated");
    
    await updateDoc(doc(db, "users", firebaseUser.uid), data);
  };

  // ============================================
  // ORGANIZATION ACTIONS
  // ============================================

  const updateOrgSettings = async (settings: Partial<OrganizationSettings>) => {
    if (!organization?.id) throw new Error("No organization");
    if (!canAccess("settings.manage")) throw new Error("Permission denied");

    await updateDoc(doc(db, "organizations", organization.id), {
      settings: { ...organization.settings, ...settings },
    });
  };

  const createOrganization = async (name: string): Promise<string> => {
    if (!firebaseUser?.uid) throw new Error("Not authenticated");

    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    const orgRef = doc(collection(db, "organizations"));

    const newOrg: Omit<Organization, "id"> = {
      name,
      slug,
      createdAt: serverTimestamp() as Timestamp,
      createdBy: firebaseUser.uid,
      settings: defaultOrgSettings,
      billing: {
        plan: "free",
        billingEmail: firebaseUser.email || "",
        billingCycle: "monthly",
      },
      usage: {
        currentMonth: {
          statements: 0,
          pages: 0,
          transactions: 0,
          apiCalls: 0,
          tokensUsed: 0,
          cost: 0,
        },
        allTime: {
          statements: 0,
          pages: 0,
          transactions: 0,
          apiCalls: 0,
          tokensUsed: 0,
        },
        lastUpdated: serverTimestamp() as Timestamp,
      },
    };

    await setDoc(orgRef, newOrg);

    // Update user to be owner of org
    await updateDoc(doc(db, "users", firebaseUser.uid), {
      orgId: orgRef.id,
      orgRole: "owner",
    });

    return orgRef.id;
  };

  // ============================================
  // TEAM ACTIONS
  // ============================================

  const getTeamMembers = async (teamId: string): Promise<User[]> => {
    if (!user?.orgId) return [];

    const membersQuery = query(
      collection(db, "users"),
      where("orgId", "==", user.orgId),
      where("teamIds", "array-contains", teamId)
    );

    const snapshot = await getDocs(membersQuery);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
  };

  // ============================================
  // PERMISSION HELPERS
  // ============================================

  const canAccess = useCallback((permission: string): boolean => {
    if (!user) return false;
    return canUserAccess(user.orgRole, permission);
  }, [user]);

  const isOwner = user?.orgRole === "owner";
  const isAdmin = user?.orgRole === "admin" || isOwner;
  const isDeveloper = user?.orgRole === "developer" || isAdmin;
  const isMember = !!user;

  // ============================================
  // COMPUTED VALUES
  // ============================================

  // Determine effective AI model based on org settings and user preferences
  const effectiveAiProvider = organization?.settings?.aiProvider || "google";
  
  const effectiveAiModel = (() => {
    // If org allows user override and user has a preference
    if (organization?.settings?.allowUserModelOverride && user?.settings?.preferredAiModel) {
      return user.settings.preferredAiModel;
    }
    // Otherwise use org setting
    return organization?.settings?.aiModel || "gemini-3-pro";
  })();

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value: AuthContextType = {
    firebaseUser,
    user,
    organization,
    teams,
    loading,
    error,

    signIn,
    signUp,
    signInWithGoogle,
    signInAsGuest,
    signOut,
    resetPassword,

    updateUserSettings,
    updateUserProfile,
    updateOrgSettings,
    createOrganization,
    getTeamMembers,

    canAccess,
    isOwner,
    isAdmin,
    isDeveloper,
    isMember,

    effectiveAiModel,
    effectiveAiProvider,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================
// HOOK
// ============================================

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// ============================================
// PROTECTED ROUTE COMPONENT
// ============================================

export function RequireAuth({ 
  children, 
  requiredRole,
  fallback = <div className="flex items-center justify-center h-full"><div className="animate-spin h-6 w-6 border-2 border-slate-300 border-t-slate-600 rounded-full" /></div>,
  accessDenied = <div className="flex items-center justify-center h-full text-sm text-slate-500">Access denied</div>
}: { 
  children: ReactNode;
  requiredRole?: UserRole;
  fallback?: ReactNode;
  accessDenied?: ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) return <>{fallback}</>;
  if (!user) return null;

  if (requiredRole) {
    const roleHierarchy: UserRole[] = ["member", "developer", "admin", "owner"];
    const userRoleIndex = roleHierarchy.indexOf(user.orgRole);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);

    if (userRoleIndex < requiredRoleIndex) {
      return <>{accessDenied}</>;
    }
  }

  return <>{children}</>;
}
