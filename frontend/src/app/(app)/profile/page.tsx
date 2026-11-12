"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  confirmPasswordChange,
  getSession,
  refreshSession,
  requestPasswordChange,
} from "@/mock-services/auth";
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
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    void refreshSession().then((s) => {
      if (s) setSession(s);
    });
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
              <dt className="text-xs uppercase tracking-wide text-stone-500">Email</dt>
              <dd className="mt-1 break-all text-sm font-medium">{session.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-500">User ID</dt>
              <dd className="mt-1 break-all text-sm font-medium">{session.id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-500">Team member ID</dt>
              <dd className="mt-1 break-all text-sm font-medium">{session.teamMemberId}</dd>
            </div>
          </dl>
        </section>

        <section className="h-fit space-y-4 rounded-2xl border border-stone-200 bg-white/80 p-4 dark:border-stone-800 dark:bg-stone-950/50 sm:p-5">
          <div>
            <h2 className="font-medium">Change password</h2>
            <p className="mt-1 text-xs text-stone-500">
              Request an OTP, then confirm with your current password and a new password.
            </p>
          </div>
          {!otpSent ? (
            <Button
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    push(await requestPasswordChange());
                    setOtpSent(true);
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
          ) : (
            <>
              <div>
                <Label htmlFor="otp">OTP</Label>
                <Input
                  id="otp"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
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
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    if (password !== confirmPassword) {
                      push("New password and confirm password do not match.", "error");
                      return;
                    }
                    setBusy(true);
                    try {
                      push(await confirmPasswordChange(otp, currentPassword, password));
                      setOtpSent(false);
                      setOtp("");
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
            </>
          )}
        </section>
      </div>
    </div>
  );
}
