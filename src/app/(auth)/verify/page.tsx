"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type VerifyState = "loading" | "success" | "error";

export default function VerifyPage() {
  const [state, setState] = useState<VerifyState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function verify() {
      const supabase = createClient();

      // Check if user is already authenticated (redirected from callback)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setState("success");
        setTimeout(() => router.push("/dashboard"), 1500);
        return;
      }

      // Check for error in URL params
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");
      if (error) {
        setState("error");
        setErrorMsg(errorDescription || "Verification failed");
        return;
      }

      // If no user and no error, something went wrong
      setState("error");
      setErrorMsg("No session found. Please try logging in again.");
    }

    verify();
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center text-center">
      {state === "loading" && (
        <>
          <Loader2 className="mb-4 h-12 w-12 animate-spin text-pink-400" />
          <h1 className="text-2xl font-bold text-sand-100">Verifying...</h1>
          <p className="mt-2 text-sm text-sand-300">
            Hang tight, we&apos;re confirming your identity.
          </p>
        </>
      )}
      {state === "success" && (
        <>
          <CheckCircle className="mb-4 h-12 w-12 text-pink-400" />
          <h1 className="text-2xl font-bold text-sand-100">You&apos;re in!</h1>
          <p className="mt-2 text-sm text-sand-300">
            Welcome to NODE. Let&apos;s get you set up.
          </p>
          <Button
            onClick={() => router.push("/dashboard")}
            className="mt-6 rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink"
          >
            Go to Dashboard
          </Button>
        </>
      )}
      {state === "error" && (
        <>
          <XCircle className="mb-4 h-12 w-12 text-destructive" />
          <h1 className="text-2xl font-bold text-sand-100">
            Verification Failed
          </h1>
          <p className="mt-2 text-sm text-sand-300">
            {errorMsg || "The link may have expired. Please try again."}
          </p>
          <Link href="/login">
            <Button
              variant="ghost"
              className="mt-6 text-pink-400 hover:text-pink-300"
            >
              Back to Login
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}
