import React, { createContext, useContext, useEffect, useState } from "react";

import * as authApi from "../api/auth";
import { clearTokens, getAccessToken, saveTokens } from "../api/storage";

type AuthState = {
  user: authApi.User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<authApi.User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On app launch: if we already have an access token, try to resolve it to
  // a user (client.ts will silently refresh if it's expired).
  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (token) {
        try {
          setUser(await authApi.fetchMe());
        } catch {
          await clearTokens();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  async function handleLogin(email: string, password: string) {
    const tokens = await authApi.login(email, password);
    await saveTokens(tokens.access_token, tokens.refresh_token);
    setUser(await authApi.fetchMe());
  }

  async function handleRegister(email: string, password: string, fullName?: string) {
    await authApi.register(email, password, fullName);
    await handleLogin(email, password);
  }

  async function handleLogout() {
    await clearTokens();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login: handleLogin, register: handleRegister, logout: handleLogout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
