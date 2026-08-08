import { api } from "./client";

export type User = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_verified: boolean;
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
