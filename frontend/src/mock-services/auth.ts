import { MOCK_PASSWORD, TEAM } from "@/mock-data/store";
import type { SessionUser } from "@/types";

const SESSION_KEY = "viximate.crm.mock.session";

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function login(email: string, password: string): SessionUser {
  const member = TEAM.find((m) => m.email.toLowerCase() === email.toLowerCase() && m.isActive);
  if (!member || password !== MOCK_PASSWORD) {
    throw new Error("Invalid email or password.");
  }
  const session: SessionUser = {
    id: member.id,
    email: member.email,
    fullName: member.displayName,
    teamMemberId: member.id,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export function requestPasswordReset(email: string) {
  // Enumeration-safe mock response
  void email;
  return "If an approved account exists for this email, an OTP has been sent.";
}

export function verifyOtp(otp: string) {
  if (otp !== "123456") {
    throw new Error("Invalid or expired OTP.");
  }
  return { verificationId: "mock-verification" };
}

export function resetPassword(_verificationId: string, newPassword: string) {
  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  return "Password has been reset.";
}
