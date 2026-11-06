import Constants from "expo-constants";
import { Platform } from "react-native";

import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./storage";

const BACKEND_PORT = 8000;
const API_PREFIX = "/api/v1";

// Works out where the backend is, so nobody has to edit .env every time the
// PC's Wi-Fi address changes. The backend runs on the same PC as the Expo
// dev server, so whatever address the phone used to load the app from
// Expo is also the address of the backend — just on port 8000.
//   - Web: the page's own hostname (localhost on the PC itself).
//   - Expo Go / dev build: the host part of Expo's hostUri, e.g.
//     "10.141.240.161:8081" -> 10.141.240.161.
// Falls back to EXPO_PUBLIC_API_URL when there's no dev server to read from
// (a production build) or when Expo runs in tunnel mode, where the host is an
// *.exp.direct proxy that only forwards the Metro port, not the backend's.
function detectDevHost(): string | null {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" ? window.location.hostname || null : null;
  }
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  if (!hostUri) return null;
  const host = hostUri.split(":")[0];
  if (!host || host.endsWith(".exp.direct")) return null;
  return host;
}

function resolveApiUrl(): string | undefined {
  // Set EXPO_PUBLIC_API_URL_FORCE=1 to always use the .env value (e.g. to
  // point a phone at a backend on a different machine).
  const forced = process.env.EXPO_PUBLIC_API_URL_FORCE === "1";
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (!forced) {
    const host = detectDevHost();
    if (host) return `http://${host}:${BACKEND_PORT}${API_PREFIX}`;
  }
  return fromEnv;
}

const resolved = resolveApiUrl();

if (!resolved) {
  // Fail loud in dev rather than silently hitting "undefined/auth/login".
  throw new Error(
    "Couldn't work out the backend address — set EXPO_PUBLIC_API_URL in mobile/.env (see .env.example)."
  );
}

export const API_URL: string = resolved;

// API_URL includes the "/api/v1" prefix; strip it to get the origin that
// relative paths returned by the API (e.g. avatar_url) are served from.
const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

export class ApiError extends Error {
  status: number;
  /** Machine-readable reason when the backend sends detail as an object
   * (e.g. "email_not_verified"); undefined for plain string details. */
  code?: string;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
    this.code = typeof extra?.code === "string" ? extra.code : undefined;
  }
}

const REQUEST_TIMEOUT_MS = 15000;

// FastAPI 422s arrive as a list of { loc, msg, ... }. Turn the first one into
// a sentence a person can act on instead of showing raw JSON.
function describeValidationErrors(errors: { loc?: unknown[]; msg?: string; type?: string; ctx?: { min_length?: number } }[]): string {
  const first = errors[0];
  if (!first) return "Please check what you entered.";
  const field = String(first.loc?.[first.loc.length - 1] ?? "");
  if (field === "email" || field === "identifier") {
    return field === "email" ? "Enter a valid email address." : "Enter your email or username.";
  }
  if (field === "password" || field === "new_password") {
    return first.ctx?.min_length
      ? `Password must be at least ${first.ctx.min_length} characters.`
      : "That password isn't valid.";
  }
  if (field === "code") return "Enter the 6-digit code.";
  return (first.msg ?? "Please check what you entered.").replace(/^Value error, /, "");
}

async function rawRequest(path: string, options: RequestInit = {}, accessToken?: string | null) {
  // FormData bodies (e.g. avatar upload) must NOT get a manual Content-Type —
  // fetch sets one itself with the multipart boundary included.
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  // Without a timeout an unreachable server (wrong LAN IP, backend down, other
  // Wi-Fi) leaves every screen spinning for a minute or more before failing.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch {
    throw new ApiError(
      0,
      `Can't reach the server (${API_ORIGIN}). Check you're on the same Wi-Fi as the PC and that the backend is running.`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = res.statusText;
    let extra: Record<string, unknown> | undefined;
    try {
      const body = await res.json();
      const d = body.detail;
      if (Array.isArray(d)) {
        detail = describeValidationErrors(d);
      } else if (d && typeof d === "object") {
        // Structured error, e.g. { code: "email_not_verified", message, email }.
        extra = d;
        detail = typeof d.message === "string" ? d.message : detail;
      } else if (typeof d === "string") {
        detail = d;
      }
    } catch {
      // response wasn't JSON — keep statusText
    }
    throw new ApiError(res.status, detail, extra);
  }

  if (res.status === 204) return null;
  return res.json();
}

// Attaches the current access token, and on a 401 tries exactly one silent
// refresh-and-retry before giving up. Public endpoints (register/login)
// should call rawRequest directly instead.
async function authedRequest(path: string, options: RequestInit = {}) {
  const accessToken = await getAccessToken();
  try {
    return await rawRequest(path, options, accessToken);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw err;

      const tokens = await rawRequest("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      await saveTokens(tokens.access_token, tokens.refresh_token);

      return rawRequest(path, options, tokens.access_token);
    }
    throw err;
  }
}

export const api = {
  public: rawRequest,
  authed: authedRequest,
};

export { clearTokens };
