import { beforeEach, describe, expect, it } from "vitest";
import { createTestEnv, type TestEnv } from "./helpers/d1";
import { call } from "./helpers/api";
import app from "../src/server/index";
import { resetSeedForTests } from "../src/server/index";

let env: TestEnv;

beforeEach(() => {
  env = createTestEnv();
  resetSeedForTests();
});

async function createOrder(status = "open") {
  const res = await call<{ work_order: { id: number; status: string; completed_at: string | null } }>(
    env, "POST", "/api/work-orders", { title: "Fix leaking faucet", status },
  );
  return res.body.work_order;
}

async function getOrder(id: number) {
  const res = await call<{ work_orders: Array<{ id: number; status: string; completed_at: string | null; title: string }> }>(
    env, "GET", "/api/work-orders",
  );
  const order = res.body.work_orders.find((w) => w.id === id);
  if (!order) throw new Error(`work order ${id} not found`);
  return order;
}

describe("work-order completion stamp (P7)", () => {
  it("stamps completed_at when an order is completed", async () => {
    const order = await createOrder("open");
    expect(order.completed_at).toBeNull();

    const res = await call<{ work_order: { id: number; status: string; completed_at: string | null } }>(
      env, "PUT", `/api/work-orders/${order.id}`, { status: "completed" },
    );
    expect(res.status).toBe(200);
    expect(res.body.work_order.status).toBe("completed");
    expect(res.body.work_order.completed_at).toBeTruthy();
    expect(res.body.work_order.completed_at).not.toBeNull();

    const persisted = await getOrder(order.id);
    expect(persisted.status).toBe("completed");
    expect(persisted.completed_at).toBe(res.body.work_order.completed_at);
  });

  it("stamps completed_at when an order is created directly as completed", async () => {
    const order = await createOrder("completed");
    expect(order.status).toBe("completed");
    expect(order.completed_at).toBeTruthy();
  });

  it("preserves the original completed_at on re-edit of a completed order", async () => {
    const order = await createOrder("open");
    const completed = await call<{ work_order: { completed_at: string } }>(
      env, "PUT", `/api/work-orders/${order.id}`, { status: "completed" },
    );
    const stamp = completed.body.work_order.completed_at;
    expect(stamp).toBeTruthy();

    const re = await call<{ work_order: { completed_at: string; notes: string | null } }>(
      env, "PUT", `/api/work-orders/${order.id}`, { status: "completed", notes: "follow-up visit" },
    );
    expect(re.status).toBe(200);
    expect(re.body.work_order.completed_at).toBe(stamp);
  });

  it("leaves completed_at null when a never-completed order is cancelled", async () => {
    const order = await createOrder("open");

    const res = await call<{ work_order: { status: string; completed_at: string | null } }>(
      env, "PUT", `/api/work-orders/${order.id}`, { status: "cancelled" },
    );
    expect(res.status).toBe(200);
    expect(res.body.work_order.status).toBe("cancelled");
    expect(res.body.work_order.completed_at).toBeNull();
  });

  it("respects an explicit completed_at supplied by the client", async () => {
    const order = await createOrder("open");

    const res = await call<{ work_order: { status: string; completed_at: string | null } }>(
      env, "PUT", `/api/work-orders/${order.id}`, { status: "completed", completed_at: "2026-06-10T10:00:00.000Z" },
    );
    expect(res.status).toBe(200);
    expect(res.body.work_order.completed_at).toBe("2026-06-10T10:00:00.000Z");
  });

  it("stamps a completed order even when completed_at is explicitly set to null", async () => {
    const order = await createOrder("open");

    const res = await call<{ work_order: { status: string; completed_at: string | null } }>(
      env, "PUT", `/api/work-orders/${order.id}`, { status: "completed", completed_at: null },
    );
    expect(res.status).toBe(200);
    expect(res.body.work_order.status).toBe("completed");
    expect(res.body.work_order.completed_at).toBeTruthy();
    expect(res.body.work_order.completed_at).not.toBeNull();
  });

  it("does not stamp non-completed status edits", async () => {
    const order = await createOrder("open");

    const res = await call<{ work_order: { status: string; completed_at: string | null } }>(
      env, "PUT", `/api/work-orders/${order.id}`, { status: "in_progress" },
    );
    expect(res.status).toBe(200);
    expect(res.body.work_order.status).toBe("in_progress");
    expect(res.body.work_order.completed_at).toBeNull();
  });
});

describe("work-order CRUD regression (P7)", () => {
  it("creates, lists, updates, and deletes a work order", async () => {
    const created = await call<{ work_order: { id: number; title: string; status: string } }>(
      env, "POST", "/api/work-orders", { title: "Replace filter", priority: "high" },
    );
    expect(created.status).toBe(201);
    expect(created.body.work_order.title).toBe("Replace filter");
    expect(created.body.work_order.status).toBe("open");

    const list = await call<{ work_orders: Array<{ id: number }> }>(env, "GET", "/api/work-orders");
    expect(list.status).toBe(200);
    expect(list.body.work_orders.some((w) => w.id === created.body.work_order.id)).toBe(true);

    const updated = await call<{ work_order: { title: string; priority: string } }>(
      env, "PUT", `/api/work-orders/${created.body.work_order.id}`, { priority: "urgent", title: "Replace filter now" },
    );
    expect(updated.status).toBe(200);
    expect(updated.body.work_order.title).toBe("Replace filter now");
    expect(updated.body.work_order.priority).toBe("urgent");

    const del = await call(env, "DELETE", `/api/work-orders/${created.body.work_order.id}`);
    expect(del.status).toBe(200);
  });

  it("returns 404 for a nonexistent work order", async () => {
    const res = await call(env, "PUT", "/api/work-orders/99999", { status: "completed" });
    expect(res.status).toBe(404);
  });

  it("returns 400 for an empty patch", async () => {
    const order = await createOrder("open");
    const res = await call(env, "PUT", `/api/work-orders/${order.id}`, {});
    expect(res.status).toBe(400);
  });
});

describe("work-order auth regression (P7)", () => {
  async function setupOwner() {
    const fs = await import("node:fs");
    const { resolve } = await import("node:path");
    env.DB.exec(fs.readFileSync(resolve(process.cwd(), "migrations/0003_auth_users.sql"), "utf8"));
    const boot = await request("POST", "/api/auth/bootstrap", {
      email: "owner@example.com",
      password: "securepass123",
      display_name: "Owner",
    });
    expect(boot.status).toBe(201);
  }

  async function enableAuth() {
    await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('AUTH_ENABLED', 'true')").bind().run();
    const { resetAuthCache } = await import("../src/server/auth");
    resetAuthCache();
  }

  async function request(method: string, route: string, body?: unknown) {
    const init: RequestInit = { method };
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    init.headers = headers;
    const res = await app.request(route, init, env);
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json, headers: res.headers };
  }

  async function login(): Promise<string> {
    const loginRes = await request("POST", "/api/auth/login", { email: "owner@example.com", password: "securepass123" });
    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    const token = setCookie.match(/session_token=([^;]+)/)?.[1];
    if (!token) throw new Error("no session token");
    return token;
  }

  it("returns 401 for work-order routes without auth when enabled", async () => {
    await setupOwner();
    await enableAuth();
    const res = await request("GET", "/api/work-orders");
    expect(res.status).toBe(401);
  });

  it("allows work-order mutation with a valid session and role", async () => {
    await setupOwner();
    await enableAuth();
    const token = await login();
    const res = await app.request(
      "/api/work-orders",
      { method: "POST", headers: { "Content-Type": "application/json", Cookie: `session_token=${token}` }, body: JSON.stringify({ title: "Auth-check order" }) },
      env,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { work_order: { id: number; title: string } };
    expect(body.work_order.title).toBe("Auth-check order");
  });
});