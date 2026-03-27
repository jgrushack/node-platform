"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("magic");
  const [magicSent, setMagicSent] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("error") === "link_expired") {
      setError("Your magic link has expired. Please request a new one.");
    }
  }, [searchParams]);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      window.location.href = "/dashboard";
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setMagicSent(true);
    }
  }

  if (magicSent) {
    return (
      <div className="space-y-6 text-center">
        <div>
          <Mail className="mx-auto h-12 w-12 text-pink-400" />
          <h1 className="mt-4 text-2xl font-bold text-sand-100">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-sand-300">
            We sent a magic link to{" "}
            <span className="font-medium text-sand-100">{email}</span>.
            <br />
            Click the link to sign in.
          </p>
        </div>
        <Button
          variant="ghost"
          className="text-sand-400 hover:text-sand-200"
          onClick={() => {
            setMagicSent(false);
            setEmail("");
          }}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink}
      className="space-y-6"
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold text-sand-100">Welcome back</h1>
        <p className="mt-1 text-sm text-sand-300">Sign in to your account</p>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email" className="text-sand-200">
          Email
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400" />
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10"
            required
          />
        </div>
      </div>

      {mode === "password" && (
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sand-200">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400" />
            <Input
              id="password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-pink-500 font-semibold text-white hover:bg-pink-600 glow-pink"
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : mode === "magic" ? (
          <Sparkles className="mr-2 h-4 w-4" />
        ) : (
          <ArrowRight className="mr-2 h-4 w-4" />
        )}
        {loading
          ? mode === "magic"
            ? "Sending link..."
            : "Signing in..."
          : mode === "magic"
            ? "Send Magic Link"
            : "Sign In"}
      </Button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "password" ? "magic" : "password");
          setError("");
        }}
        className="w-full text-center text-sm text-sand-400 hover:text-sand-200 transition-colors"
      >
        {mode === "password"
          ? "Sign in with a magic link instead"
          : "Sign in with password instead"}
      </button>

      <p className="text-center text-sm text-sand-400">
        Don&apos;t have an account?{" "}
        <Link href="/apply" className="text-pink-400 hover:text-pink-300">
          Apply for 2026
        </Link>
      </p>
    </form>
  );
}
