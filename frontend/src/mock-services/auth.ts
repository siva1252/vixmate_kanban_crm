import { apiRequest, clearTokens, getStoredSessionRaw, setStoredSessionRaw, setTokens } from "@/lib/api";
import type { SessionUser } from "@/types";

type LoginResponse = {
  access: string;
  refresh: string;
  token_type?: string;
  expires_in?: number;
  user: {
    id: string;
    email: string;
    full_name: string;
    display_name?: string;
    team_member_id?: string | null;
    job_title?: string;
    phone_number?: string;
    is_active?: boolean;
    is_staff?: boolean;
  };
};

type MeResponse = LoginResponse["user"];

function toSession(user: MeResponse): SessionUser {
  return {
    id: String(user.id),
    email: user.email,
    fullName: user.display_name || user.full_name,
    teamMemberId: user.team_member_id ? String(user.team_member_id) : String(user.id),
  };
}

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = getStoredSessionRaw();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const data = await apiRequest<LoginResponse>("/api/auth/login/", {
    method: "POST",
    auth: false,
    body: { email: email.trim().toLowerCase(), password },
  });
  setTokens(data.access, data.refresh);
  const session = toSession(data.user);
  setStoredSessionRaw(JSON.stringify(session));
  return session;
}

export async function refreshSession(): Promise<SessionUser | null> {
  try {
    const user = await apiRequest<MeResponse>("/api/auth/me/");
    const session = toSession(user);
    setStoredSessionRaw(JSON.stringify(session));
    return session;
  } catch {
    clearTokens();
    return null;
  }
}

export async function logout() {
  const refresh = typeof window !== "undefined" ? localStorage.getItem("viximate.crm.refresh") : null;
  try {
    if (refresh) {
      await apiRequest("/api/auth/logout/", {
        method: "POST",
        body: { refresh },
      });
    }
  } catch {
    // Always clear local session
  } finally {
    clearTokens();
    try {
      const { cacheInvalidate } = await import("@/lib/api-cache");
      cacheInvalidate();
    } catch {
      // ignore
    }
  }
}

export async function requestPasswordReset(email: string) {
  const data = await apiRequest<{ message?: string } | null>("/api/auth/forgot-password/", {
    method: "POST",
    auth: false,
    body: { email: email.trim().toLowerCase() },
  });
  void data;
  return "If an approved account exists for this email, an OTP has been sent.";
}

export async function verifyOtp(email: string, otp: string, purpose = "password_reset") {
  return apiRequest<{ verification_id: string }>("/api/auth/otp/verify/", {
    method: "POST",
    auth: false,
    body: { email: email.trim().toLowerCase(), otp, purpose },
  });
}

export async function resendOtp(email: string, purpose = "password_reset") {
  await apiRequest("/api/auth/otp/resend/", {
    method: "POST",
    auth: false,
    body: { email: email.trim().toLowerCase(), purpose },
  });
  return "If an approved account exists for this email, an OTP has been sent.";
}

export async function resetPassword(email: string, verificationId: string, newPassword: string) {
  await apiRequest("/api/auth/password/reset/", {
    method: "POST",
    auth: false,
    body: {
      email: email.trim().toLowerCase(),
      verification_id: verificationId,
      new_password: newPassword,
    },
  });
  return "Password has been reset.";
}

export async function requestPasswordChange() {
  await apiRequest("/api/auth/password/change/request/", { method: "POST" });
  return "If permitted, an OTP has been sent to your email.";
}

export async function confirmPasswordChange(otp: string, currentPassword: string, newPassword: string) {
  await apiRequest("/api/auth/password/change/confirm/", {
    method: "POST",
    body: {
      otp,
      current_password: currentPassword,
      new_password: newPassword,
    },
  });
  return "Password updated.";
}

/** Signed-in password change — current + new only (no OTP). */
export async function changePasswordDirect(currentPassword: string, newPassword: string) {
  await apiRequest("/api/auth/password/change/", {
    method: "POST",
    body: {
      current_password: currentPassword,
      new_password: newPassword,
    },
  });
  return "Password updated.";
}
