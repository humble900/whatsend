"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google");
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setError("Check your email for a confirmation link.");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafbf7] text-[#14251d] py-10 flex items-center justify-center px-4 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-[420px]"
      >
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <Link href="/" className="text-3xl font-extrabold text-[#14251d] tracking-tight hover:opacity-90 transition-opacity">
            Whatsend
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#dde4da] rounded-xl p-6 sm:p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-[#14251d] mb-1">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-[#58645a] text-sm mb-6">
            {isLogin ? "Sign in to your dashboard." : "Start sending at scale today."}
          </p>

          {/* Google Auth Button */}
          <button
            onClick={handleGoogleAuth}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-[#f0f3eb] border border-[#dde4da] hover:border-[#146c43] text-[#14251d] font-medium py-3 px-4 rounded-xl transition-all duration-200 mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative flex items-center mb-6">
            <div className="flex-1 border-t border-[#dde4da]" />
            <span className="px-4 text-xs text-[#687367] uppercase tracking-wider font-medium">or continue with email</span>
            <div className="flex-1 border-t border-[#dde4da]" />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#14251d] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#fafbf7] border border-[#dde4da] rounded-xl px-4 py-3 text-[#14251d] placeholder:text-[#687367] focus:outline-none focus:border-[#146c43] focus:ring-1 focus:ring-[#146c43]/40 transition-all"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#14251d] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-[#fafbf7] border border-[#dde4da] rounded-xl px-4 py-3 pr-12 text-[#14251d] placeholder:text-[#687367] focus:outline-none focus:border-[#146c43] focus:ring-1 focus:ring-[#146c43]/40 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#687367] hover:text-[#14251d] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p className={`text-sm ${error.includes("Check your email") ? "text-green-700" : "text-red-700"}`}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#146c43] hover:bg-[#0a5130] text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLogin ? "Sign in" : "Sign up"}
            </button>
          </form>

          {/* Toggle Login/Signup */}
          <p className="text-center text-sm text-[#58645a] mt-5">
            {isLogin ? "Need an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => { setIsLogin(!isLogin); setError(""); }}
              className="text-[#146c43] hover:text-[#0a5130] font-medium transition-colors"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>

          {isLogin && (
            <p className="text-center text-sm mt-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (!email) {
                    setError("Please enter your email address first.");
                    return;
                  }
                  setLoading(true);
                  supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/auth/reset-password`,
                  }).then(({ error }) => {
                    setLoading(false);
                    if (error) setError(error.message);
                    else setError("Password reset link sent to your email.");
                  });
                }}
                className="text-[#687367] hover:text-[#14251d] transition-colors"
              >
                Forgot password?
              </button>
            </p>
          )}
        </div>

        {/* Legal Links */}
        <div className="mt-6 text-center">
          <div className="h-px bg-[#dde4da] mb-4" />
          <p className="text-xs text-[#687367] leading-relaxed">
            By continuing, you agree to WhatsEnd&apos;s{" "}
            <Link href="/terms" className="text-[#58645a] hover:text-[#14251d] underline underline-offset-2 transition-colors">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-[#58645a] hover:text-[#14251d] underline underline-offset-2 transition-colors">
              Privacy Policy
            </Link>.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
