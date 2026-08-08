import { api } from "./client";

export type Tag = { id: string; name: string; slug: string };

export type User = {
  id: string;
  email: string;
  full_name: string | null;
  username: string;
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

export function login(email: string, password: string): Promise<TokenPair> {
  return api.public("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe(): Promise<User> {
  return api.authed("/users/me");
}
