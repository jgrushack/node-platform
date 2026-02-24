"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center">
        <CheckCircle className="mb-4 h-12 w-12 text-pink-400" />
        <h1 className="text-2xl font-bold text-sand-100">Check your email</h1>
        <p className="mt-2 text-sm text-sand-300">
          We sent a magic link to{" "}
          <span className="text-pink-400">{email}</span>
        </p>
        <Button
          variant="ghost"
          className="mt-6 text-pink-400 hover:text-pink-300"
          onClick={() => setSent(false)}
        >
          Try a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-sand-100">Welcome back</h1>
        <p className="mt-1 text-sm text-sand-300">
          Sign in with your email
        </p>
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

      <Button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-pink-500 font-semibold text-white hover:bg-pink-600 glow-pink"
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="mr-2 h-4 w-4" />
        )}
        {loading ? "Sending..." : "Send Magic Link"}
      </Button>

      <p className="text-center text-sm text-sand-400">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-pink-400 hover:text-pink-300">
          Sign up
        </Link>
      </p>
    </form>
  );
}
