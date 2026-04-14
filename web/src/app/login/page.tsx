"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auth not configured yet -- show placeholder
  if (!supabase) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="text-on-surface-muted font-display">Authentication coming soon.</p>
      </div>
    );
  }

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
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-primary">
            PokeComp
          </h2>
          <p className="mt-1 font-body text-sm text-on-surface-muted">
            Your competitive Pokemon Champions companion
          </p>
        </div>

        <div className="card p-8 shadow-2xl rounded-xl relative overflow-hidden">
          <h1 className="text-2xl font-display font-bold tracking-tight text-on-surface mb-2 text-center">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-sm font-body text-on-surface-muted text-center mb-8">
            {isSignUp
              ? "Sign up to save teams, track matches, and get AI draft help"
              : "Sign in to continue"}
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
                className="input-field w-full h-12 rounded-xl px-4 text-on-surface focus:outline-none transition-colors"
                placeholder="you@example.com"
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
                className="input-field w-full h-12 rounded-xl px-4 text-on-surface focus:outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 rounded-xl text-red-400 text-sm text-center font-medium">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-teal-500/10 rounded-xl text-teal-400 text-sm text-center font-medium">
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-2 h-12 w-full font-display text-sm font-medium uppercase tracking-wider hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100"
            >
              {loading ? (
                <span className="animate-pulse">Processing...</span>
              ) : isSignUp ? (
                "Sign Up"
              ) : (
                "Sign In"
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
              className="text-sm font-display text-on-surface-muted hover:text-primary transition-colors tracking-wide underline-offset-4 hover:underline"
            >
              {isSignUp
                ? "Already have an account? Sign in instead."
                : "Need an account? Create one."}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
