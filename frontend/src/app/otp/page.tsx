"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyOtp } from "@/mock-services/auth";
import { useToast } from "@/components/toast";

function OtpForm() {
  const [otp, setOtp] = useState("123456");
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const router = useRouter();
  const { push } = useToast();

  return (
    <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow dark:border-stone-800 dark:bg-stone-950">
      <h1 className="font-display text-2xl">OTP verification</h1>
      <p className="mt-1 text-sm text-stone-500">Mock OTP for {email || "your account"} is 123456.</p>
      <div className="mt-6">
        <Label htmlFor="otp">OTP</Label>
        <Input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} />
      </div>
      <Button
        className="mt-6 w-full"
        onClick={() => {
          try {
            const result = verifyOtp(otp);
            push("OTP verified");
            router.push(
              `/reset-password?email=${encodeURIComponent(email)}&vid=${result.verificationId}`
            );
          } catch (err) {
            push(err instanceof Error ? err.message : "OTP failed", "error");
          }
        }}
      >
        Verify
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
