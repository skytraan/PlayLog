import type { ArgsOf, EndpointDef, ResultOf } from "./types";

const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8787";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function callEndpoint<E extends EndpointDef<unknown, unknown>>(
  endpoint: E,
  args: ArgsOf<E>
): Promise<ResultOf<E>> {
  const res = await fetch(`${BASE_URL}/api/${endpoint.module}/${endpoint.name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args ?? {}),
  });

  if (!res.ok) {
    let message = `${endpoint.module}.${endpoint.name} failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* response wasn't JSON — keep default */ }
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<ResultOf<E>>;
}
