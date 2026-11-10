"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSession, verifyOtp } from "@/mock-services/auth";
import { useToast } from "@/components/toast";

export default function ProfilePage() {
  const session = getSession();
  const [otp, setOtp] = useState("123456");
  const [password, setPassword] = useState("");
  const { push } = useToast();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="font-display text-3xl">Profile</h1>
      <div className="rounded-xl border bg-white/80 p-5 dark:border-stone-800 dark:bg-stone-950/60">
        <p className="font-medium">{session?.fullName}</p>
        <p className="text-sm text-stone-500">{session?.email}</p>
      </div>
      <div className="space-y-3 rounded-xl border bg-white/80 p-5 dark:border-stone-800 dark:bg-stone-950/60">
        <h2 className="font-medium">Change password (mock OTP)</h2>
        <div>
          <Label>OTP</Label>
          <Input value={otp} onChange={(e) => setOtp(e.target.value)} />
        </div>
        <div>
          <Label>New password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button
          onClick={() => {
            try {
              verifyOtp(otp);
              if (password.length < 8) throw new Error("Password must be at least 8 characters.");
              push("Password changed (mock)");
              setPassword("");
            } catch (err) {
              push(err instanceof Error ? err.message : "Failed", "error");
            }
          }}
        >
          Update password
        </Button>
      </div>
    </div>
  );
}
