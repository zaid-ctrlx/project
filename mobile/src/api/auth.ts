import { api } from "./client";

export type Tag = { id: string; name: string; slug: string };

export const GENDER_OPTIONS = ["Male", "Female", "Prefer not to say"] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

export type User = {
  id: string;
  email: string;
  full_name: string | null;
  username: string;
  bio: string | null;
  gender: Gender | null;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_admin?: boolean;
  onboarding_completed: boolean;
  location_lat: number | null;
  location_lng: number | null;
  location_label: string | null;
  tags: Tag[];
  created_at: string;
};

type TokenPair = { access_token: string; refresh_token: string; token_type: string };

export function register(email: string, password: string, fullName?: string): Promise<{ message: string }> {
  return api.public("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name: fullName ?? null }),
  });
}

// identifier is either the account's email or its @username — see
// UserLogin in the backend's schemas/user.py.
export function login(identifier: string, password: string): Promise<TokenPair> {
  return api.public("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
}

export function fetchMe(): Promise<User> {
  return api.authed("/users/me");
}

// Registration only emails a code; the account can't log in until the code
// is confirmed here, which also returns the first token pair.
export function verifyEmail(email: string, code: string): Promise<TokenPair> {
  return api.public("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export function resendVerification(email: string): Promise<{ message: string }> {
  return api.public("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return api.public("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(email: string, code: string, newPassword: string): Promise<{ message: string }> {
  return api.public("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, code, new_password: newPassword }),
  });
}
