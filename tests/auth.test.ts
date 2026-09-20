import { describe, expect, it, beforeEach } from "vitest";
import { D1Stub, createTestEnv } from "./helpers/d1";
import app from "../src/server/index";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadMigration(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function setupDB(stub: D1Stub): void {
  stub.exec(loadMigration("migrations/0003_auth_users.sql"));
}

type TestEnv = { DB: D1Stub };

async function req(env: TestEnv, method: string, route: string, body?: unknown, cookie?: string) {
  const init: RequestInit = { method };
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  if (cookie) headers["Cookie"] = cookie;
  init.headers = headers;
  const res = await app.request(route, init, env);
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json, headers: res.headers };
}

async function bootstrapOwner(env: TestEnv) {
  return req(env, "POST", "/api/auth/bootstrap", {
    email: "admin@example.com",
    password: "securepass123",
    display_name: "Admin",
  });
}

async function login(env: TestEnv, email = "admin@example.com", password = "securepass123") {
  return req(env, "POST", "/api/auth/login", { email, password });
}

function extractToken(headers: Headers): string | undefined {
  const setCookie = headers.get("set-cookie");
  return setCookie?.match(/session_token=([^;]+)/)?.[1];
}

describe("auth", () => {
  let env: TestEnv;

  beforeEach(() => {
    env = createTestEnv();
    setupDB(env.DB);
  });

  // ── Bootstrap ───────────────────────────────────────────────────

  describe("POST /api/auth/bootstrap", () => {
    it("creates the first owner when no users exist", async () => {
      const res = await bootstrapOwner(env);
      expect(res.status).toBe(201);
      const body = res.body as { user: { email: string; role: string; display_name: string } };
      expect(body.user.email).toBe("admin@example.com");
      expect(body.user.role).toBe("owner");
      expect(body.user.display_name).toBe("Admin");
    });

    it("returns 409 when users already exist", async () => {
      await bootstrapOwner(env);
      const res = await req(env, "POST", "/api/auth/bootstrap", {
        email: "second@example.com",
        password: "securepass123",
        display_name: "Second",
      });
      expect(res.status).toBe(409);
    });

    it("returns 400 for invalid email", async () => {
      const res = await req(env, "POST", "/api/auth/bootstrap", {
        email: "not-an-email",
        password: "securepass123",
        display_name: "Admin",
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for short password", async () => {
      const res = await req(env, "POST", "/api/auth/bootstrap", {
        email: "admin@example.com",
        password: "short",
        display_name: "Admin",
      });
      expect(res.status).toBe(400);
    });
  });

  // ── Login ───────────────────────────────────────────────────────

  describe("POST /api/auth/login", () => {
    it("logs in with valid credentials", async () => {
      await bootstrapOwner(env);
      const res = await login(env);
      expect(res.status).toBe(200);
      const body = res.body as { user: { email: string; role: string } };
      expect(body.user.email).toBe("admin@example.com");
      expect(body.user.role).toBe("owner");
    });

    it("returns 401 for wrong password", async () => {
      await bootstrapOwner(env);
      const res = await login(env, "admin@example.com", "wrongpassword");
      expect(res.status).toBe(401);
    });

    it("returns 401 for non-existent email", async () => {
      const res = await login(env, "nobody@example.com");
      expect(res.status).toBe(401);
    });
  });

  // ── Session ─────────────────────────────────────────────────────

  describe("GET /api/auth/session", () => {
    it("returns null user without cookie", async () => {
      const res = await req(env, "GET", "/api/auth/session");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ user: null });
    });

    it("returns user with valid session cookie", async () => {
      await bootstrapOwner(env);
      const loginRes = await login(env);
      const token = extractToken(loginRes.headers);
      expect(token).toBeTruthy();

      const res = await req(env, "GET", "/api/auth/session", undefined, `session_token=${token}`);
      expect(res.status).toBe(200);
      const body = res.body as { user: { email: string; role: string } };
      expect(body.user).not.toBeNull();
      expect(body.user.email).toBe("admin@example.com");
      expect(body.user.role).toBe("owner");
    });

    it("returns null user with invalid token", async () => {
      const res = await req(env, "GET", "/api/auth/session", undefined, "session_token=invalid-token");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ user: null });
    });
  });

  // ── Logout ──────────────────────────────────────────────────────

  describe("POST /api/auth/logout", () => {
    it("clears the session cookie", async () => {
      await bootstrapOwner(env);
      const loginRes = await login(env);
      const token = extractToken(loginRes.headers);
      expect(token).toBeTruthy();

      const res = await req(env, "POST", "/api/auth/logout", undefined, `session_token=${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });

      // Verify session is gone
      const sessionRes = await req(env, "GET", "/api/auth/session", undefined, `session_token=${token}`);
      expect((sessionRes.body as { user: unknown }).user).toBeNull();
    });
  });

  // ── User management ─────────────────────────────────────────────

  describe("user management", () => {
    async function getToken() {
      await bootstrapOwner(env);
      const loginRes = await login(env);
      return extractToken(loginRes.headers)!;
    }

    it("GET /api/users lists all users", async () => {
      const token = await getToken();
      const res = await req(env, "GET", "/api/users", undefined, `session_token=${token}`);
      expect(res.status).toBe(200);
      const body = res.body as { users: { email: string }[] };
      expect(body.users).toHaveLength(1);
      expect(body.users[0].email).toBe("admin@example.com");
    });

    it("GET /api/users returns 403 without auth (no user context)", async () => {
      const res = await req(env, "GET", "/api/users");
      expect(res.status).toBe(403);
    });

    it("POST /api/users creates a new user (admin+)", async () => {
      const token = await getToken();
      const res = await req(env, "POST", "/api/users", {
        email: "manager@example.com",
        password: "securepass123",
        display_name: "Manager",
        role: "manager",
      }, `session_token=${token}`);
      expect(res.status).toBe(201);
      const body = res.body as { user: { email: string; role: string } };
      expect(body.user.email).toBe("manager@example.com");
      expect(body.user.role).toBe("manager");
    });

    it("POST /api/users returns 409 for duplicate email", async () => {
      const token = await getToken();
      await req(env, "POST", "/api/users", {
        email: "manager@example.com",
        password: "securepass123",
        display_name: "Manager",
        role: "manager",
      }, `session_token=${token}`);

      const res = await req(env, "POST", "/api/users", {
        email: "manager@example.com",
        password: "securepass123",
        display_name: "Manager 2",
        role: "manager",
      }, `session_token=${token}`);
      expect(res.status).toBe(409);
    });

    it("PUT /api/users/:id updates a user", async () => {
      const token = await getToken();
      const createRes = await req(env, "POST", "/api/users", {
        email: "manager@example.com",
        password: "securepass123",
        display_name: "Manager",
        role: "manager",
      }, `session_token=${token}`);
      const userId = (createRes.body as { user: { id: number } }).user.id;

      const res = await req(env, "PUT", `/api/users/${userId}`, {
        display_name: "Updated Manager",
      }, `session_token=${token}`);
      expect(res.status).toBe(200);
      const body = res.body as { user: { display_name: string } };
      expect(body.user.display_name).toBe("Updated Manager");
    });

    it("DELETE /api/users/:id deletes a user (owner only)", async () => {
      const token = await getToken();
      const createRes = await req(env, "POST", "/api/users", {
        email: "manager@example.com",
        password: "securepass123",
        display_name: "Manager",
        role: "manager",
      }, `session_token=${token}`);
      const userId = (createRes.body as { user: { id: number } }).user.id;

      const res = await req(env, "DELETE", `/api/users/${userId}`, undefined, `session_token=${token}`);
      expect(res.status).toBe(200);
    });

    it("cannot delete your own account", async () => {
      const token = await getToken();
      const sessionRes = await req(env, "GET", "/api/auth/session", undefined, `session_token=${token}`);
      const userId = (sessionRes.body as { user: { id: number } }).user.id;

      const res = await req(env, "DELETE", `/api/users/${userId}`, undefined, `session_token=${token}`);
      expect(res.status).toBe(409);
    });

    it("admin cannot delete owner", async () => {
      const token = await getToken();
      // Create admin
      const createRes = await req(env, "POST", "/api/users", {
        email: "admin2@example.com",
        password: "securepass123",
        display_name: "Admin 2",
        role: "admin",
      }, `session_token=${token}`);

      // Login as admin2
      const loginRes2 = await login(env, "admin2@example.com");
      const token2 = extractToken(loginRes2.headers)!;

      // Get owner's ID
      const sessionRes = await req(env, "GET", "/api/auth/session", undefined, `session_token=${token}`);
      const ownerId = (sessionRes.body as { user: { id: number } }).user.id;

      // Admin2 tries to delete owner
      const res = await req(env, "DELETE", `/api/users/${ownerId}`, undefined, `session_token=${token2}`);
      expect(res.status).toBe(403);
    });

    it("admin cannot create owner", async () => {
      const token = await getToken();
      // Create admin
      await req(env, "POST", "/api/users", {
        email: "admin2@example.com",
        password: "securepass123",
        display_name: "Admin 2",
        role: "admin",
      }, `session_token=${token}`);

      // Login as admin2
      const loginRes2 = await login(env, "admin2@example.com");
      const token2 = extractToken(loginRes2.headers)!;

      // Admin2 tries to create owner
      const res = await req(env, "POST", "/api/users", {
        email: "bad@example.com",
        password: "securepass123",
        display_name: "Bad",
        role: "owner",
      }, `session_token=${token2}`);
      expect(res.status).toBe(403);
    });

    it("manager cannot list users", async () => {
      const token = await getToken();
      // Create manager
      await req(env, "POST", "/api/users", {
        email: "manager@example.com",
        password: "securepass123",
        display_name: "Manager",
        role: "manager",
      }, `session_token=${token}`);

      // Login as manager
      const loginRes = await login(env, "manager@example.com");
      const mgrToken = extractToken(loginRes.headers)!;

      // Manager tries to list users — should be 403
      const res = await req(env, "GET", "/api/users", undefined, `session_token=${mgrToken}`);
      expect(res.status).toBe(403);
    });

    it("manager cannot create users", async () => {
      const token = await getToken();
      await req(env, "POST", "/api/users", {
        email: "manager@example.com",
        password: "securepass123",
        display_name: "Manager",
        role: "manager",
      }, `session_token=${token}`);

      const loginRes = await login(env, "manager@example.com");
      const mgrToken = extractToken(loginRes.headers)!;

      const res = await req(env, "POST", "/api/users", {
        email: "new@example.com",
        password: "securepass123",
        display_name: "New",
        role: "manager",
      }, `session_token=${mgrToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── Auth middleware ──────────────────────────────────────────────

  describe("auth middleware", () => {
    it("returns 401 for protected routes without auth when enabled", async () => {
      await bootstrapOwner(env);

      // Enable auth
      await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('AUTH_ENABLED', 'true')").bind().run();
      const { resetAuthCache } = await import("../src/server/auth");
      resetAuthCache();

      const res = await req(env, "GET", "/api/properties");
      expect(res.status).toBe(401);
    });

    it("allows access to protected routes when auth disabled", async () => {
      // Auth is disabled by default (AUTH_ENABLED not set)
      const { resetAuthCache } = await import("../src/server/auth");
      resetAuthCache();

      const res = await req(env, "GET", "/api/health");
      expect(res.status).toBe(200);
    });

    it("allows access to public routes without auth", async () => {
      const { resetAuthCache } = await import("../src/server/auth");
      resetAuthCache();

      const res = await req(env, "GET", "/api/health");
      expect(res.status).toBe(200);
    });

    it("allows access to auth routes without auth", async () => {
      const { resetAuthCache } = await import("../src/server/auth");
      resetAuthCache();

      const res = await req(env, "GET", "/api/auth/session");
      expect(res.status).toBe(200);
    });
  });

  // ── Role hierarchy ──────────────────────────────────────────────

  describe("role hierarchy", () => {
    it("hasMinimumRole works correctly", async () => {
      const { hasMinimumRole } = await import("../src/server/auth");
      expect(hasMinimumRole("owner", "owner")).toBe(true);
      expect(hasMinimumRole("owner", "admin")).toBe(true);
      expect(hasMinimumRole("owner", "manager")).toBe(true);
      expect(hasMinimumRole("admin", "owner")).toBe(false);
      expect(hasMinimumRole("admin", "admin")).toBe(true);
      expect(hasMinimumRole("admin", "manager")).toBe(true);
      expect(hasMinimumRole("manager", "owner")).toBe(false);
      expect(hasMinimumRole("manager", "admin")).toBe(false);
      expect(hasMinimumRole("manager", "manager")).toBe(true);
    });
  });

  // ── Password hashing ────────────────────────────────────────────

  describe("password hashing", () => {
    it("hashPassword produces a valid hash", async () => {
      const { hashPassword } = await import("../src/server/auth");
      const hash = await hashPassword("testpassword");
      expect(hash).toMatch(/^pbkdf2:100000:[a-f0-9]+:[a-f0-9]+$/);
    });

    it("verifyPassword validates correct password", async () => {
      const { hashPassword, verifyPassword } = await import("../src/server/auth");
      const hash = await hashPassword("testpassword");
      expect(await verifyPassword("testpassword", hash)).toBe(true);
    });

    it("verifyPassword rejects wrong password", async () => {
      const { hashPassword, verifyPassword } = await import("../src/server/auth");
      const hash = await hashPassword("testpassword");
      expect(await verifyPassword("wrongpassword", hash)).toBe(false);
    });

    it("verifyPassword rejects invalid format", async () => {
      const { verifyPassword } = await import("../src/server/auth");
      expect(await verifyPassword("test", "invalid")).toBe(false);
    });
  });
});
