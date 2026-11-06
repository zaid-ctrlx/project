import React, { createContext, useContext, useEffect, useState } from "react";

import * as authApi from "../api/auth";
import { clearTokens, getAccessToken, saveTokens } from "../api/storage";

type AuthState = {
  user: authApi.User | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: authApi.User) => void;
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

  async function handleLogin(identifier: string, password: string) {
    const tokens = await authApi.login(identifier, password);
    await saveTokens(tokens.access_token, tokens.refresh_token);
    setUser(await authApi.fetchMe());
  }

  async function handleRegister(email: string, password: string, fullName?: string) {
    // Only sends the code; the caller moves on to the verify screen.
    await authApi.register(email, password, fullName);
  }

  async function handleVerifyEmail(email: string, code: string) {
    const tokens = await authApi.verifyEmail(email, code);
    await saveTokens(tokens.access_token, tokens.refresh_token);
    setUser(await authApi.fetchMe());
  }

  async function handleLogout() {
    await clearTokens();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login: handleLogin, register: handleRegister, verifyEmail: handleVerifyEmail, logout: handleLogout, setUser }}
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
