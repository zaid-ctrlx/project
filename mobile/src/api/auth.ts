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
  onboarding_completed: boolean;
  location_lat: number | null;
  location_lng: number | null;
  location_label: string | null;
  tags: Tag[];
  created_at: string;
};

type TokenPair = { access_token: string; refresh_token: string; token_type: string };

export function register(email: string, password: string, fullName?: string): Promise<User> {
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
