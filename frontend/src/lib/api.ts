/** Authenticated API client for Viximate CRM backend (existing /api/* only). */

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

const ACCESS_KEY = "viximate.crm.access";
const REFRESH_KEY = "viximate.crm.refresh";
const SESSION_KEY = "viximate.crm.session";

export function apiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:6019").replace(/\/$/, "");
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function getStoredSessionRaw() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setStoredSessionRaw(json: string) {
  localStorage.setItem(SESSION_KEY, json);
}

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function messageFromPayload(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const p = payload as Record<string, unknown>;
  if (typeof p.message === "string" && p.message) return p.message;
  if (typeof p.detail === "string" && p.detail) return p.detail;
  const errors = p.errors ?? p;
  if (errors && typeof errors === "object") {
    for (const value of Object.values(errors as Record<string, unknown>)) {
      if (typeof value === "string") return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (value && typeof value === "object") {
        for (const nested of Object.values(value as Record<string, unknown>)) {
          if (typeof nested === "string") return nested;
          if (Array.isArray(nested) && typeof nested[0] === "string") return nested[0];
        }
      }
    }
  }
  return fallback;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch(`${apiBaseUrl()}/api/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh }),
    });
    const json = (await res.json().catch(() => null)) as ApiEnvelope<{
      access: string;
      refresh?: string;
    }> | null;
    if (!res.ok || !json?.data?.access) {
      clearTokens();
      return false;
    }
    setTokens(json.data.access, json.data.refresh || refresh);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

export type ApiRequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined | null>;
};

function buildUrl(path: string, query?: ApiRequestOptions["query"]) {
  const url = new URL(path.startsWith("http") ? path : `${apiBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, signal, query } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const access = getAccessToken();
    if (access) headers.Authorization = `Bearer ${access}`;
  }

  const doFetch = () =>
    fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });

  let res = await doFetch();
  if (res.status === 401 && auth) {
    if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const ok = await refreshPromise;
    if (ok) {
      const access = getAccessToken();
      if (access) headers.Authorization = `Bearer ${access}`;
      res = await doFetch();
    }
  }

  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | Record<string, unknown> | null;
  if (!res.ok) {
    throw new ApiError(messageFromPayload(json, `Request failed (${res.status})`), res.status, json);
  }
  if (json && typeof json === "object" && "data" in json) {
    return (json as ApiEnvelope<T>).data;
  }
  return json as T;
}
