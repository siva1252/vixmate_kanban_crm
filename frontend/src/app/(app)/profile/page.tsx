"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { changePasswordDirect, getSession, refreshSession } from "@/mock-services/auth";
import { useToast } from "@/components/toast";
import { ApiError } from "@/lib/api";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ProfilePage() {
  const [session, setSession] = useState(getSession());
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    let cancelled = false;
    void refreshSession().then((s) => {
      if (!cancelled && s) setSession(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!session) {
    return <p className="p-6 text-stone-500">No signed-in profile found.</p>;
  }

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl">Profile</h1>
        <p className="text-sm text-stone-500">Your signed-in team profile and password settings.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-stone-200 bg-white/80 p-4 dark:border-stone-800 dark:bg-stone-950/50 sm:p-5">
          <div className="flex flex-wrap items-center gap-4 border-b border-stone-200 pb-4 dark:border-stone-800">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-teal-900 text-lg font-semibold text-white">
              {initials(session.fullName)}
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-2xl tracking-tight">{session.fullName}</h2>
              <p className="text-sm text-stone-500">{session.email}</p>
            </div>
          </div>

          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-500">Full name</dt>
              <dd className="mt-1 text-sm font-medium">{session.fullName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-500">Work email</dt>
              <dd className="mt-1 break-all text-sm font-medium">{session.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-500">Role</dt>
              <dd className="mt-1 text-sm font-medium">Admin</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-500">Account status</dt>
              <dd className="mt-1 text-sm font-medium text-teal-800 dark:text-teal-300">Active</dd>
            </div>
          </dl>
        </section>

        <section className="h-fit space-y-4 rounded-2xl border border-stone-200 bg-white/80 p-4 dark:border-stone-800 dark:bg-stone-950/50 sm:p-5">
          <div>
            <h2 className="font-medium">Change password</h2>
            <p className="mt-1 text-xs text-stone-500">
              Enter your current password and a new password, then update.
            </p>
          </div>
          <div>
            <Label htmlFor="current-password">Current password</Label>
            <PasswordInput
              id="current-password"
              placeholder="Current password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              id="new-password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <PasswordInput
              id="confirm-password"
              placeholder="Re-enter new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button
            disabled={busy || !currentPassword || !password || !confirmPassword}
            onClick={() => {
              void (async () => {
                if (password.length < 8) {
                  push("New password must be at least 8 characters.", "error");
                  return;
                }
                if (password !== confirmPassword) {
                  push("New password and confirm password do not match.", "error");
                  return;
                }
                setBusy(true);
                try {
                  push(await changePasswordDirect(currentPassword, password));
                  setCurrentPassword("");
                  setPassword("");
                  setConfirmPassword("");
                } catch (err) {
                  push(err instanceof ApiError ? err.message : "Update failed", "error");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            {busy ? "Updating…" : "Update password"}
          </Button>
        </section>
      </div>
    </div>
  );
}
