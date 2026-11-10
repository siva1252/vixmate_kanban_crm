"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/mock-services/auth";
import { useToast } from "@/components/toast";

function ResetForm() {
  const [password, setPassword] = useState("NewMemberPass123!");
  const params = useSearchParams();
  const vid = params.get("vid") ?? "";
  const router = useRouter();
  const { push } = useToast();

  return (
    <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow dark:border-stone-800 dark:bg-stone-950">
      <h1 className="font-display text-2xl">Reset password</h1>
      <div className="mt-6">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button
        className="mt-6 w-full"
        onClick={() => {
          try {
            push(resetPassword(vid, password));
            router.push("/login");
          } catch (err) {
            push(err instanceof Error ? err.message : "Reset failed", "error");
          }
        }}
      >
        Update password
      </Button>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
