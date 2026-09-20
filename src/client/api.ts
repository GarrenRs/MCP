import { resolveErrorMessage } from "./i18n";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  let data: unknown = null;
  try {
    data = await r.json();
  } catch {
    /* empty body */
  }
  if (!r.ok) {
    const { error, code } = (data as { error?: string; code?: string } | null) ?? {};
    const fallback = error || `${r.status} ${r.statusText}`;
    throw new ApiError(r.status, resolveErrorMessage(code, fallback), code);
  }
  return data as T;
}
