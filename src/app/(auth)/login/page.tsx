"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useBrand } from "@/hooks/use-brand";
// BrandStyles is now in the layout

// Google icon SVG component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// Mosaic background component - now uses brand colors
function MosaicBackground() {
  const brand = useBrand();
  
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient - uses brand colors */}
      <div 
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${brand.colors.loginGradientStart || '#b8c9d4'}, ${brand.colors.loginGradientEnd || '#ffffff'})`
        }}
      />
      
      {/* Mosaic squares */}
      <svg className="absolute inset-0 w-full h-full opacity-80" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="mosaic" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="15" height="15" fill="#a8bcc8" opacity="0.6"/>
            <rect x="15" y="0" width="12" height="18" fill="#c2d1da" opacity="0.5"/>
            <rect x="30" y="5" width="18" height="12" fill="#9ab0be" opacity="0.4"/>
            <rect x="50" y="0" width="10" height="15" fill="#b5c7d2" opacity="0.5"/>
            <rect x="0" y="18" width="20" height="14" fill="#cdd9e1" opacity="0.4"/>
            <rect x="22" y="20" width="14" height="16" fill="#a3b8c5" opacity="0.5"/>
            <rect x="40" y="15" width="16" height="20" fill="#bccad5" opacity="0.6"/>
            <rect x="5" y="35" width="18" height="12" fill="#b0c3cf" opacity="0.5"/>
            <rect x="25" y="38" width="12" height="18" fill="#c8d6de" opacity="0.4"/>
            <rect x="42" y="40" width="15" height="15" fill="#9daebb" opacity="0.5"/>
            <rect x="0" y="50" width="14" height="10" fill="#c0ced8" opacity="0.3"/>
            <rect x="18" y="52" width="16" height="8" fill="#afc2ce" opacity="0.4"/>
            <rect x="38" y="55" width="20" height="5" fill="#d5dfe5" opacity="0.3"/>
          </pattern>
          
          <pattern id="mosaic2" x="30" y="30" width="80" height="80" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="20" height="20" fill="#95aab9" opacity="0.4"/>
            <rect x="25" y="10" width="25" height="15" fill="#b8c9d4" opacity="0.3"/>
            <rect x="55" y="0" width="18" height="22" fill="#a5b9c6" opacity="0.5"/>
            <rect x="10" y="25" width="22" height="18" fill="#c5d3dc" opacity="0.4"/>
            <rect x="38" y="30" width="15" height="25" fill="#9fb3c1" opacity="0.5"/>
            <rect x="60" y="28" width="20" height="20" fill="#aec1cd" opacity="0.4"/>
            <rect x="0" y="48" width="28" height="16" fill="#bfced8" opacity="0.3"/>
            <rect x="32" y="58" width="20" height="18" fill="#a8bcc8" opacity="0.4"/>
            <rect x="58" y="55" width="22" height="25" fill="#d0dbe2" opacity="0.3"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mosaic)" />
        <rect width="100%" height="100%" fill="url(#mosaic2)" />
      </svg>
      
      {/* Additional scattered squares for depth */}
      <div className="absolute inset-0">
        {[
          { w: 25, h: 30, l: 5, t: 10, o: 0.3 },
          { w: 35, h: 25, l: 15, t: 25, o: 0.4 },
          { w: 20, h: 35, l: 8, t: 45, o: 0.25 },
          { w: 40, h: 20, l: 25, t: 8, o: 0.35 },
          { w: 28, h: 28, l: 35, t: 35, o: 0.3 },
          { w: 22, h: 40, l: 45, t: 15, o: 0.4 },
          { w: 38, h: 22, l: 55, t: 5, o: 0.25 },
          { w: 30, h: 32, l: 65, t: 28, o: 0.35 },
          { w: 24, h: 24, l: 75, t: 12, o: 0.3 },
          { w: 42, h: 18, l: 85, t: 38, o: 0.4 },
          { w: 18, h: 38, l: 92, t: 8, o: 0.25 },
          { w: 32, h: 26, l: 12, t: 58, o: 0.35 },
          { w: 26, h: 34, l: 28, t: 52, o: 0.3 },
          { w: 36, h: 24, l: 42, t: 48, o: 0.4 },
          { w: 20, h: 30, l: 58, t: 55, o: 0.25 },
          { w: 34, h: 28, l: 72, t: 45, o: 0.35 },
          { w: 28, h: 36, l: 88, t: 52, o: 0.3 },
          { w: 22, h: 22, l: 3, t: 32, o: 0.4 },
          { w: 38, h: 20, l: 18, t: 68, o: 0.25 },
          { w: 24, h: 32, l: 38, t: 62, o: 0.35 },
        ].map((sq, i) => (
          <div
            key={i}
            className="absolute bg-white/30"
            style={{
              width: `${sq.w}px`,
              height: `${sq.h}px`,
              left: `${sq.l}%`,
              top: `${sq.t}%`,
              opacity: sq.o,
            }}
          />
        ))}
      </div>
      
      {/* Fade to white at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-white via-white/80 to-transparent" />
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const { signIn, signUp, signInWithGoogle, signInAsGuest, resetPassword } = useAuth();
  const brand = useBrand();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Google auth error:", err);
      setError(err.message || "Failed to sign in with Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setDemoLoading(true);
    setError("");
    try {
      await signInAsGuest();
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Demo sign-in error:", err);
      setError(err.message || "Failed to start demo");
    } finally {
      setDemoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Debug log
    console.log("Form submitted with:", { email, password: password ? "***" : "empty" });
    
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }
    
    setLoading(true);
    setError("");
    try {
      if (isSignUp) {
        await signUp(email, password, name || email.split("@")[0]);
      } else {
      await signIn(email, password);
      }
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await resetPassword(email);
      setSuccess("Password reset email sent");
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col relative">
      {/* Mosaic Background */}
      <MosaicBackground />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-[80vh]">
        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            {/* Demo Access — prominent for judges */}
            <button
              onClick={handleDemoSignIn}
              disabled={demoLoading || loading || googleLoading}
              className="w-full mb-4 flex items-center justify-center gap-3 h-12 px-6 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-purple-200 hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50"
            >
              {demoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {demoLoading ? "Loading demo..." : "Try Live Demo — No sign-up needed"}
            </button>

            <div className="bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden">
              {/* Card Header */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                <h1 className="text-base font-semibold text-slate-900">{isSignUp ? "Create Account" : "Sign In"}</h1>
                <p className="text-xs text-slate-500 mt-0.5">{isSignUp ? `Get started with ${brand.content.name}` : "Enter your credentials to continue"}</p>
              </div>

              {/* Card Content */}
              <div className="p-6">
                {error && (
                  <div className="mb-4 p-2.5 rounded bg-red-50 border border-red-100 text-red-700 text-xs">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mb-4 p-2.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs">
                    {success}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {isSignUp && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-medium text-slate-700">
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-9 text-sm"
                        placeholder="John Smith"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium text-slate-700">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-9 text-sm"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs font-medium text-slate-700">
                        Password
                      </Label>
                      {!isSignUp && (
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-xs hover:underline"
                        style={{ color: brand.colors.primary }}
                      >
                        Forgot?
                      </button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-9 text-sm pr-9"
                        required
                        minLength={isSignUp ? 6 : undefined}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-9 text-sm" disabled={loading || googleLoading}>
                    {loading ? (isSignUp ? "Creating account..." : "Signing in...") : (isSignUp ? "Create Account" : "Sign In")}
                  </Button>
                </form>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-slate-400">or continue with</span>
                  </div>
                </div>

                {/* Google Sign In Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading || googleLoading}
                  className="w-full flex items-center justify-center gap-3 h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {googleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (
                    <GoogleIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  )}
                  <span>{googleLoading ? "Connecting..." : "Continue with Google"}</span>
                </button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
                  </button>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
              <Lock className="h-3 w-3" />
              <span>256-bit SSL encryption</span>
            </div>

            {/* Footer Links */}
            <p className="mt-4 text-center text-[10px] text-slate-500">
              By signing in, you agree to our{" "}
              <Link href="#" className="text-slate-600 hover:underline">Terms</Link>
              {" "}&{" "}
              <Link href="#" className="text-slate-600 hover:underline">Privacy Policy</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}
