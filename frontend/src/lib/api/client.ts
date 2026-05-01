import type { ArgsOf, EndpointDef, ResultOf } from "./types";

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8787";

const TOKEN_KEY = "playlog.authToken";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* localStorage unavailable — ignore */ }
}

// Listeners get notified when a 401 response comes back, so the auth provider
// can clear stored credentials and bounce the user to the login screen.
const unauthorizedListeners = new Set<() => void>();

export function onUnauthorized(fn: () => void): () => void {
  unauthorizedListeners.add(fn);
  return () => { unauthorizedListeners.delete(fn); };
}

export async function callEndpoint<E extends EndpointDef<unknown, unknown>>(
  endpoint: E,
  args: ArgsOf<E>
): Promise<ResultOf<E>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api/${endpoint.module}/${endpoint.name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args ?? {}),
  });

  if (!res.ok) {
    let message = `${endpoint.module}.${endpoint.name} failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* response wasn't JSON — keep default */ }

    if (res.status === 401) {
      // Don't fire for the login/signup path itself — those are how the user
      // authenticates in the first place, and a 401 there means "wrong email",
      // not "session expired".
      const isLoginAttempt =
        endpoint.module === "auth" &&
        (endpoint.name === "login" || endpoint.name === "signup");
      if (!isLoginAttempt) {
        for (const fn of unauthorizedListeners) fn();
      }
    }

    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<ResultOf<E>>;
}
