"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isSignUp, setIsSignUp] = useState(false);

  // Auth not configured yet — show placeholder
  if (!supabase) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="text-on-surface-muted font-display">Authentication coming soon.</p>
      </div>
    );
  }
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccessMsg("Check your email to confirm your account!");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        router.push("/roster");
        router.refresh();
      }
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[url('/bg-orbits.svg')] bg-cover bg-center">
      <div className="w-full max-w-md">
        <div className="glass-panel p-8 backdrop-blur-xl bg-surface-high/60 border border-surface-border shadow-2xl rounded-chunky relative overflow-hidden group">
          {/* Decorative Top Glow */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-teal-400 to-transparent opacity-50" />
          
          <h1 className="text-3xl font-display font-bold tracking-tight text-on-surface mb-2 text-center">
            {isSignUp ? "Orbital Access" : "Welcome Back"}
          </h1>
          <p className="text-sm font-display uppercase tracking-[0.05rem] text-on-surface-muted text-center mb-8">
            {isSignUp ? "Create your commander account" : "Log in to your commander account"}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label 
                htmlFor="email" 
                className="block text-xs font-display font-medium uppercase tracking-wider text-on-surface-muted mb-2 ml-1"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-12 rounded-pill bg-surface border border-surface-border px-4 text-on-surface focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors"
                placeholder="commander@orbital.net"
              />
            </div>

            <div>
              <label 
                htmlFor="password" 
                className="block text-xs font-display font-medium uppercase tracking-wider text-on-surface-muted mb-2 ml-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-12 rounded-pill bg-surface border border-surface-border px-4 text-on-surface focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-pill text-red-400 text-sm text-center font-medium">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-pill text-teal-400 text-sm text-center font-medium">
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full rounded-pill gradient-primary font-display text-sm font-medium uppercase tracking-wider text-surface gloss-top transition-all glow-teal hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100"
            >
              {loading ? (
                <span className="animate-pulse">Processing...</span>
              ) : isSignUp ? (
                "Initialize Account"
              ) : (
                "Authorize Access"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-sm font-display text-on-surface-muted hover:text-teal-400 transition-colors tracking-wide underline-offset-4 hover:underline"
            >
              {isSignUp
                ? "Already established? Sign in instead."
                : "Need clearance? Create an account."}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
