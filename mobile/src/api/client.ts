import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./storage";

export const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  // Fail loud in dev rather than silently hitting "undefined/auth/login".
  throw new Error(
    "EXPO_PUBLIC_API_URL is not set — copy mobile/.env.example to mobile/.env and set your LAN IP."
  );
}

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
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // response wasn't JSON — keep statusText
    }
    throw new ApiError(res.status, detail);
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
