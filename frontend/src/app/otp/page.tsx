"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resendOtp, verifyOtp } from "@/mock-services/auth";
import { useToast } from "@/components/toast";
import { ApiError } from "@/lib/api";

function OtpForm() {
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const router = useRouter();
  const { push } = useToast();

  return (
    <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow dark:border-stone-800 dark:bg-stone-950">
      <h1 className="font-display text-2xl">OTP verification</h1>
      <p className="mt-1 text-sm text-stone-500">
        Enter the code sent to {email || "your email"}.
      </p>
      <div className="mt-6">
        <Label htmlFor="otp">OTP</Label>
        <Input
          id="otp"
          inputMode="numeric"
          placeholder="6-digit code"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
      </div>
      <Button
        className="mt-6 w-full"
        disabled={busy || otp.length < 4 || !email}
        onClick={() => {
          void (async () => {
            setBusy(true);
            try {
              const result = await verifyOtp(email, otp, "password_reset");
              push("OTP verified");
              router.push(
                `/reset-password?email=${encodeURIComponent(email)}&vid=${result.verification_id}`
              );
            } catch (err) {
              push(err instanceof ApiError ? err.message : "OTP failed", "error");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {busy ? "Verifying…" : "Verify"}
      </Button>
      <Button
        variant="outline"
        className="mt-3 w-full"
        disabled={busy || !email}
        onClick={() => {
          void (async () => {
            setBusy(true);
            try {
              push(await resendOtp(email, "password_reset"));
            } catch (err) {
              push(err instanceof ApiError ? err.message : "Resend failed", "error");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        Resend OTP
      </Button>
    </div>
  );
}

export default function OtpPage() {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <Suspense>
        <OtpForm />
      </Suspense>
    </div>
  );
}
