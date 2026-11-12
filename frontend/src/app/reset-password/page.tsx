"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPassword } from "@/mock-services/auth";
import { useToast } from "@/components/toast";
import { ApiError } from "@/lib/api";

function ResetForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const params = useSearchParams();
  const vid = params.get("vid") ?? "";
  const email = params.get("email") ?? "";
  const router = useRouter();
  const { push } = useToast();

  return (
    <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow dark:border-stone-800 dark:bg-stone-950">
      <h1 className="font-display text-2xl">Reset password</h1>
      <p className="mt-1 text-sm text-stone-500">Choose a new password for {email || "your account"}.</p>
      <div className="mt-6 space-y-4">
        <div>
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput
            id="confirm"
            placeholder="Re-enter new password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </div>
      <Button
        className="mt-6 w-full"
        disabled={busy || !vid || !email}
        onClick={() => {
          void (async () => {
            if (password.length < 8) {
              push("Password must be at least 8 characters.", "error");
              return;
            }
            if (password !== confirm) {
              push("Passwords do not match.", "error");
              return;
            }
            setBusy(true);
            try {
              push(await resetPassword(email, vid, password));
              router.push("/login");
            } catch (err) {
              push(err instanceof ApiError ? err.message : "Reset failed", "error");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {busy ? "Updating…" : "Update password"}
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
