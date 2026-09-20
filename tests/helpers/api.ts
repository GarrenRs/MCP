import app from "../../src/server/index";
import type { TestEnv } from "./d1";

type Json = Record<string, unknown>;

export interface ApiResult<T = Json | Json[] | null> {
  status: number;
  body: T;
}

export async function call<T = Json | Json[] | null>(
  env: TestEnv,
  method: string,
  route: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await app.request(route, init, env);
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json as T };
}