"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/mock-services/auth";
import { useToast } from "@/components/toast";
import { ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { push } = useToast();

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow dark:border-stone-800 dark:bg-stone-950">
        <h1 className="font-display text-2xl">Forgot password</h1>
        <p className="mt-1 text-sm text-stone-500">
          We will email an OTP if this address is an approved CRM account.
        </p>
        <div className="mt-6">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@viximate.com"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button
          className="mt-6 w-full"
          disabled={busy || !email.trim()}
          onClick={() => {
            void (async () => {
              setBusy(true);
              try {
                const message = await requestPasswordReset(email);
                push(message);
                router.push(`/otp?email=${encodeURIComponent(email.trim().toLowerCase())}`);
              } catch (err) {
                push(err instanceof ApiError ? err.message : "Request failed", "error");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          {busy ? "Sending…" : "Send OTP"}
        </Button>
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
