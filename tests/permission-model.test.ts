import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { TestEnv } from "./helpers/d1";
import { createTestEnv } from "./helpers/d1";
import app, { resetSeedForTests } from "../src/server/index";

/**
 * V1 Permission Model — server-side enforcement tests.
 *
 * Proves the approved gate matrix (Docs/execution/governance/permission-model-gate-2026-09-26.md)
 * for the surfaces that vary by role: sensitive charge edits/waives (rows
 * 21–22), payment deletion (26), financial export (49 vs operational 50–51),
 * settings write (41), reconcile (42), user management (43–47), audit read
 * (48), the read-only capability view (§17), and the AUTH_ENABLED=false
 * rollback posture (known gap 6 — unchanged).
 */

let env: TestEnv;

beforeEach(() => {
  env = createTestEnv();
  resetSeedForTests();
});

const PERIOD = "2099-06";

function setupAuthDB(stub: TestEnv["DB"]): void {
  stub.exec(readFileSync(resolve(process.cwd(), "migrations/0003_auth_users.sql"), "utf8"));
  stub.exec(readFileSync(resolve(process.cwd(), "migrations/0005_audit_logs.sql"), "utf8"));
}

async function enableAuth(): Promise<void> {
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('AUTH_ENABLED', 'true')").bind().run();
  const { resetAuthCache } = await import("../src/server/auth");
  resetAuthCache();
}

interface Res {
  status: number;
  body: any;
  headers: Headers;
}

async function request(route: string, method: string, body?: unknown, cookie?: string): Promise<Res> {
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

function tokenOf(headers: Headers): string {
  const setCookie = headers.get("set-cookie") || "";
  const token = setCookie.match(/session_token=([^;]+)/)?.[1];
  if (!token) throw new Error("no session token in set-cookie");
  return `session_token=${token}`;
}

async function loginCookie(email: string, password = "securepass123"): Promise<string> {
  const res = await request("/api/auth/login", "POST", { email, password });
  expect(res.status).toBe(200);
  return tokenOf(res.headers);
}

interface Actor {
  cookie: string;
  id: number;
}

/** Bootstrap owner, enable auth, and create one admin + one manager. */
async function setupActors(): Promise<{ owner: Actor; admin: Actor; manager: Actor }> {
  setupAuthDB(env.DB);
  await enableAuth();

  const boot = await request("/api/auth/bootstrap", "POST", {
    email: "owner@example.com",
    password: "securepass123",
    display_name: "Owner",
  });
  expect(boot.status).toBe(201);
  const owner: Actor = {
    cookie: tokenOf(boot.headers),
    id: boot.body.user.id,
  };

  const adminCreate = await request("/api/users", "POST", {
    email: "admin@example.com",
    password: "securepass123",
    display_name: "Admin",
    role: "admin",
  }, owner.cookie);
  expect(adminCreate.status).toBe(201);

  const mgrCreate = await request("/api/users", "POST", {
    email: "manager@example.com",
    password: "securepass123",
    display_name: "Manager",
    role: "manager",
  }, owner.cookie);
  expect(mgrCreate.status).toBe(201);

  const admin: Actor = { cookie: await loginCookie("admin@example.com"), id: adminCreate.body.user.id };
  const manager: Actor = { cookie: await loginCookie("manager@example.com"), id: mgrCreate.body.user.id };
  return { owner, admin, manager };
}

/** Build an active lease + generated charge + one recorded payment. */
async function seedChargeFixture(cookie: string): Promise<{ chargeId: number; paymentId: number }> {
  const prop = await request("/api/properties", "POST", { name: "Fixture", type: "single_family" }, cookie);
  expect(prop.status).toBe(201);
  const unit = await request("/api/units", "POST", { property_id: prop.body.property.id, name: "A1", market_rent: 900 }, cookie);
  expect(unit.status).toBe(201);
  const tenant = await request("/api/tenants", "POST", { first_name: "Ada", last_name: "Lovelace" }, cookie);
  expect(tenant.status).toBe(201);
  const lease = await request("/api/leases", "POST", {
    unit_id: unit.body.unit.id,
    primary_tenant_id: tenant.body.tenant.id,
    start_date: "2026-01-01",
    end_date: "2099-12-31",
    monthly_rent: 900,
    rent_due_day: 1,
    status: "active",
  }, cookie);
  expect(lease.status).toBe(201);
  const gen = await request("/api/rent-charges/generate", "POST", { period: PERIOD }, cookie);
  expect(gen.status).toBe(200);
  expect(gen.body.created).toBe(1);
  const list = await request(`/api/rent-charges?period=${PERIOD}`, "GET", undefined, cookie);
  const chargeId = list.body.charges[0].id as number;
  const pay = await request("/api/payments", "POST", { charge_id: chargeId, amount: 300 }, cookie);
  expect(pay.status).toBe(201);
  const payList = await request(`/api/rent-charges/${chargeId}/payments`, "GET", undefined, cookie);
  const paymentId = payList.body.payments[0].id as number;
  return { chargeId, paymentId };
}

describe("V1 permission model — server-side enforcement", () => {
  describe("rent charges: routine vs sensitive edits and waives (rows 20–22, D1)", () => {
    it("manager may perform routine notes-only edits", async () => {
      const { manager } = await setupActors();
      const { chargeId } = await seedChargeFixture(manager.cookie);
      const res = await request(`/api/rent-charges/${chargeId}`, "PUT", { notes: "routine note" }, manager.cookie);
      expect(res.status).toBe(200);
      expect(res.body.charge.notes).toBe("routine note");
      expect(res.body.charge.amount).toBe(900);
    });

    it("manager is denied sensitive edits touching amount", async () => {
      const { manager } = await setupActors();
      const { chargeId } = await seedChargeFixture(manager.cookie);
      const res = await request(`/api/rent-charges/${chargeId}`, "PUT", { amount: 500 }, manager.cookie);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("forbidden");
    });

    it("manager is denied sensitive edits touching due_date", async () => {
      const { manager } = await setupActors();
      const { chargeId } = await seedChargeFixture(manager.cookie);
      const res = await request(`/api/rent-charges/${chargeId}`, "PUT", { due_date: "2099-07-01" }, manager.cookie);
      expect(res.status).toBe(403);
    });

    it("manager is denied waiving a charge (status transition)", async () => {
      const { manager } = await setupActors();
      const { chargeId } = await seedChargeFixture(manager.cookie);
      const res = await request(`/api/rent-charges/${chargeId}`, "PUT", { status: "waived" }, manager.cookie);
      expect(res.status).toBe(403);
    });

    it("admin may perform sensitive edits and waives", async () => {
      const { admin } = await setupActors();
      const { chargeId } = await seedChargeFixture(admin.cookie);
      const edit = await request(`/api/rent-charges/${chargeId}`, "PUT", { amount: 800 }, admin.cookie);
      expect(edit.status).toBe(200);
      expect(edit.body.charge.amount).toBe(800);
      const waive = await request(`/api/rent-charges/${chargeId}`, "PUT", { status: "waived" }, admin.cookie);
      expect(waive.status).toBe(200);
      expect(waive.body.charge.status).toBe("waived");
    });

    it("owner may perform sensitive edits and waives", async () => {
      const { owner } = await setupActors();
      const { chargeId } = await seedChargeFixture(owner.cookie);
      const edit = await request(`/api/rent-charges/${chargeId}`, "PUT", { amount: 750 }, owner.cookie);
      expect(edit.status).toBe(200);
      const waive = await request(`/api/rent-charges/${chargeId}`, "PUT", { status: "waived" }, owner.cookie);
      expect(waive.status).toBe(200);
    });

    it("manager may create and generate charges (D1)", async () => {
      const { manager } = await setupActors();
      const { chargeId } = await seedChargeFixture(manager.cookie);
      // Direct create uses a fresh period — the generate route already owns PERIOD
      // (and POST / rent-charges is idempotent per lease+period).
      const create = await request("/api/rent-charges", "POST", {
        lease_id: chargeId, period: "2099-07", due_date: "2099-07-01", amount: 100,
      }, manager.cookie);
      expect(create.status).toBe(201);
    });

    it("sensitive charge edits are audited", async () => {
      const { admin } = await setupActors();
      const { chargeId } = await seedChargeFixture(admin.cookie);
      await request(`/api/rent-charges/${chargeId}`, "PUT", { amount: 700 }, admin.cookie);
      const audit = await request("/api/audit", "GET", undefined, admin.cookie);
      expect(audit.status).toBe(200);
      expect(audit.body.some((r: any) => r.entity === "rent_charge" && r.action === "update")).toBe(true);
    });
  });

  describe("payments: record vs delete (rows 25–26, D1)", () => {
    it("manager may record a payment", async () => {
      const { manager } = await setupActors();
      const { chargeId } = await seedChargeFixture(manager.cookie);
      const res = await request("/api/payments", "POST", { charge_id: chargeId, amount: 200 }, manager.cookie);
      expect(res.status).toBe(201);
    });

    it("manager is denied deleting a payment and the payment remains", async () => {
      const { manager } = await setupActors();
      const { chargeId, paymentId } = await seedChargeFixture(manager.cookie);
      const res = await request(`/api/payments/${paymentId}`, "DELETE", undefined, manager.cookie);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("forbidden");
      const payList = await request(`/api/rent-charges/${chargeId}/payments`, "GET", undefined, manager.cookie);
      expect(payList.body.payments).toHaveLength(1);
    });

    it("admin may delete a payment", async () => {
      const { admin } = await setupActors();
      const { chargeId, paymentId } = await seedChargeFixture(admin.cookie);
      const res = await request(`/api/payments/${paymentId}`, "DELETE", undefined, admin.cookie);
      expect(res.status).toBe(200);
      const payList = await request(`/api/rent-charges/${chargeId}/payments`, "GET", undefined, admin.cookie);
      expect(payList.body.payments).toHaveLength(0);
    });

    it("owner may delete a payment", async () => {
      const { owner } = await setupActors();
      const { paymentId } = await seedChargeFixture(owner.cookie);
      const res = await request(`/api/payments/${paymentId}`, "DELETE", undefined, owner.cookie);
      expect(res.status).toBe(200);
    });
  });

  describe("exports: financial vs operational (rows 49–51, D2)", () => {
    it("manager is denied the rent-ledger export", async () => {
      const { manager } = await setupActors();
      await seedChargeFixture(manager.cookie);
      const res = await request(`/api/export/rent-ledger?period=${PERIOD}`, "GET", undefined, manager.cookie);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("forbidden");
    });

    it("admin may export the rent ledger", async () => {
      const { admin } = await setupActors();
      await seedChargeFixture(admin.cookie);
      const res = await request(`/api/export/rent-ledger?period=${PERIOD}`, "GET", undefined, admin.cookie);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/csv");
    });

    it("owner may export the rent ledger", async () => {
      const { owner } = await setupActors();
      await seedChargeFixture(owner.cookie);
      const res = await request(`/api/export/rent-ledger?period=${PERIOD}`, "GET", undefined, owner.cookie);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/csv");
    });

    it("manager may export operational CSVs (tenants, properties)", async () => {
      const { manager } = await setupActors();
      const tenants = await request("/api/export/tenants", "GET", undefined, manager.cookie);
      expect(tenants.status).toBe(200);
      const props = await request("/api/export/properties", "GET", undefined, manager.cookie);
      expect(props.status).toBe(200);
      expect(props.headers.get("content-type")).toContain("text/csv");
    });

    it("rent-ledger exports are audited (row 49 REQUIRED)", async () => {
      const { admin } = await setupActors();
      await seedChargeFixture(admin.cookie);
      await request(`/api/export/rent-ledger?period=${PERIOD}`, "GET", undefined, admin.cookie);
      const audit = await request("/api/audit", "GET", undefined, admin.cookie);
      const exportRow = audit.body.find((r: any) => r.entity === "rent_ledger" && r.action === "export");
      expect(exportRow).toBeTruthy();
      expect(JSON.parse(exportRow.new_value).period).toBe(PERIOD);
    });
  });

  describe("users (rows 43–47)", () => {
    it("manager is denied every user-management action", async () => {
      const { owner, admin, manager } = await setupActors();
      expect((await request("/api/users", "GET", undefined, manager.cookie)).status).toBe(403);
      expect((await request("/api/users", "POST", {
        email: "x@example.com", password: "securepass123", display_name: "X", role: "manager",
      }, manager.cookie)).status).toBe(403);
      expect((await request(`/api/users/${admin.id}`, "PUT", { display_name: "X" }, manager.cookie)).status).toBe(403);
      expect((await request(`/api/users/${owner.id}`, "DELETE", undefined, manager.cookie)).status).toBe(403);
    });

    it("admin may list, create manager/admin, update manager accounts, and assign roles within the gate", async () => {
      const { admin } = await setupActors();
      const list = await request("/api/users", "GET", undefined, admin.cookie);
      expect(list.status).toBe(200);
      expect(list.body.users.length).toBeGreaterThanOrEqual(3);

      const createMgr = await request("/api/users", "POST", {
        email: "m2@example.com", password: "securepass123", display_name: "M2", role: "manager",
      }, admin.cookie);
      expect(createMgr.status).toBe(201);

      const update = await request(`/api/users/${createMgr.body.user.id}`, "PUT", { display_name: "M2b" }, admin.cookie);
      expect(update.status).toBe(200);

      // Admin may assign the manager role (row 46 CONDITIONAL — non-owner roles only)
      const assign = await request(`/api/users/${createMgr.body.user.id}`, "PUT", { role: "manager" }, admin.cookie);
      expect(assign.status).toBe(200);
    });

    it("admin may not create an owner account", async () => {
      const { admin } = await setupActors();
      const res = await request("/api/users", "POST", {
        email: "bad@example.com", password: "securepass123", display_name: "Bad", role: "owner",
      }, admin.cookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owners can create owner accounts");
    });

    it("admin may not modify an owner account", async () => {
      const { owner, admin } = await setupActors();
      const res = await request(`/api/users/${owner.id}`, "PUT", { display_name: "Hacked" }, admin.cookie);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("cannot_modify_owner");
    });

    it("admin may not assign the owner role", async () => {
      const { manager, admin } = await setupActors();
      const res = await request(`/api/users/${manager.id}`, "PUT", { role: "owner" }, admin.cookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Only owners can assign owner role");
    });

    it("owner may create users and assign the owner role", async () => {
      const { owner, manager } = await setupActors();
      const create = await request("/api/users", "POST", {
        email: "o2@example.com", password: "securepass123", display_name: "O2", role: "admin",
      }, owner.cookie);
      expect(create.status).toBe(201);
      const promote = await request(`/api/users/${manager.id}`, "PUT", { role: "admin" }, owner.cookie);
      expect(promote.status).toBe(200);
      const promoteOwner = await request(`/api/users/${create.body.user.id}`, "PUT", { role: "owner" }, owner.cookie);
      expect(promoteOwner.status).toBe(200);
    });

    it("user create and update are audited without logging passwords", async () => {
      const { owner } = await setupActors();
      const create = await request("/api/users", "POST", {
        email: "audited@example.com", password: "securepass123", display_name: "Audited", role: "manager",
      }, owner.cookie);
      expect(create.status).toBe(201);
      const id = create.body.user.id;
      await request(`/api/users/${id}`, "PUT", { display_name: "Audited 2", password: "newpass123" }, owner.cookie);

      const audit = await request("/api/audit", "GET", undefined, owner.cookie);
      const created = audit.body.filter((r: any) => r.entity === "user" && r.action === "create");
      const updated = audit.body.filter((r: any) => r.entity === "user" && r.action === "update");
      expect(created.length).toBeGreaterThanOrEqual(1);
      expect(updated.length).toBeGreaterThanOrEqual(1);
      // The password VALUE is never logged, and no password / password_hash
      // keys exist in audit payloads (only the password_changed flag, which is
      // metadata about the action, not credentials).
      const payloads = [...created, ...updated].map((r: any) => JSON.parse(r.new_value));
      const serialized = JSON.stringify(payloads);
      expect(serialized).not.toContain("securepass123");
      expect(serialized).not.toContain("newpass123");
      for (const p of payloads) {
        expect(Object.keys(p)).not.toContain("password");
        expect(Object.keys(p)).not.toContain("password_hash");
      }
    });
  });

  describe("self-deletion invariant (row 47 + register §13)", () => {
    it("owner cannot delete their own account — 409 cannot_delete_self", async () => {
      const { owner } = await setupActors();
      const res = await request(`/api/users/${owner.id}`, "DELETE", undefined, owner.cookie);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("cannot_delete_self");
    });

    it("admin cannot delete any user, including themselves", async () => {
      const { owner, admin } = await setupActors();
      expect((await request(`/api/users/${admin.id}`, "DELETE", undefined, admin.cookie)).status).toBe(403);
      expect((await request(`/api/users/${owner.id}`, "DELETE", undefined, admin.cookie)).status).toBe(403);
    });

    it("manager cannot delete any user, including themselves", async () => {
      const { manager } = await setupActors();
      expect((await request(`/api/users/${manager.id}`, "DELETE", undefined, manager.cookie)).status).toBe(403);
    });

    it("owner may delete other users (authority applies to other accounts only)", async () => {
      const { owner, manager } = await setupActors();
      const res = await request(`/api/users/${manager.id}`, "DELETE", undefined, owner.cookie);
      expect(res.status).toBe(200);
    });
  });

  describe("settings / reconcile / audit (rows 41–42, 48)", () => {
    it("manager is denied settings writes; admin may write settings", async () => {
      const { admin, manager } = await setupActors();
      const denied = await request("/api/settings", "PUT", { late_fee_amount: "10" }, manager.cookie);
      expect(denied.status).toBe(403);
      const allowed = await request("/api/settings", "PUT", { late_fee_amount: "10" }, admin.cookie);
      expect(allowed.status).toBe(200);
      expect(allowed.body.settings.late_fee_amount).toBe("10");
    });

    it("manager cannot change the system language via the settings API; owner/admin can and it persists", async () => {
      const { owner, admin, manager } = await setupActors();
      const denied = await request("/api/settings", "PUT", { locale: "ar" }, manager.cookie);
      expect(denied.status).toBe(403);
      const byOwner = await request("/api/settings", "PUT", { locale: "ar" }, owner.cookie);
      expect(byOwner.status).toBe(200);
      expect(byOwner.body.settings.locale).toBe("ar");
      const reloaded = await request("/api/settings", "GET", undefined, admin.cookie);
      expect(reloaded.body.settings.locale).toBe("ar");
      const byAdmin = await request("/api/settings", "PUT", { locale: "fr-DZ" }, admin.cookie);
      expect(byAdmin.status).toBe(200);
      expect(byAdmin.body.settings.locale).toBe("fr-DZ");
    });

    it("manager is denied reconcile; admin may reconcile", async () => {
      const { admin, manager } = await setupActors();
      const denied = await request("/api/admin/reconcile-occupancy", "POST", undefined, manager.cookie);
      expect(denied.status).toBe(403);
      const allowed = await request("/api/admin/reconcile-occupancy", "POST", undefined, admin.cookie);
      expect(allowed.status).toBe(200);
    });

    it("manager is denied audit read; admin may read the audit log", async () => {
      const { admin, manager } = await setupActors();
      const denied = await request("/api/audit", "GET", undefined, manager.cookie);
      expect(denied.status).toBe(403);
      const allowed = await request("/api/audit", "GET", undefined, admin.cookie);
      expect(allowed.status).toBe(200);
      expect(Array.isArray(allowed.body)).toBe(true);
    });
  });

  describe("read-only capability view (gate §17)", () => {
    it("session exposes the owner capability list", async () => {
      const { owner } = await setupActors();
      const res = await request("/api/auth/session", "GET", undefined, owner.cookie);
      const caps = res.body.user.capabilities as string[];
      expect(caps).toContain("users:delete");
      expect(caps).toContain("users:assign-owner");
      expect(caps).toContain("users:create");
      expect(caps).toContain("export:rent-ledger");
      expect(caps).toContain("rent-charges:update-sensitive");
      expect(caps).toContain("payments:delete");
      expect(caps).toContain("settings:update");
      expect(caps).toContain("audit:read");
    });

    it("session exposes admin capabilities without owner-only grants", async () => {
      const { admin } = await setupActors();
      const res = await request("/api/auth/session", "GET", undefined, admin.cookie);
      const caps = res.body.user.capabilities as string[];
      expect(caps).toContain("users:create");
      expect(caps).toContain("export:rent-ledger");
      expect(caps).toContain("rent-charges:update-sensitive");
      expect(caps).toContain("payments:delete");
      expect(caps).not.toContain("users:delete");
      expect(caps).not.toContain("users:assign-owner");
    });

    it("manager session has an empty capability list", async () => {
      const { manager } = await setupActors();
      const res = await request("/api/auth/session", "GET", undefined, manager.cookie);
      expect(res.body.user.capabilities).toEqual([]);
    });
  });

  describe("AUTH_ENABLED=false rollback posture (known gap 6 — unchanged)", () => {
    it("sensitive edits and financial exports stay open when auth is disabled", async () => {
      // No users, no AUTH_ENABLED: the flat runtime posture is preserved.
      const { chargeId } = await seedChargeFixture("");
      const edit = await request(`/api/rent-charges/${chargeId}`, "PUT", { amount: 1200 });
      expect(edit.status).toBe(200);
      const exp = await request(`/api/export/rent-ledger?period=${PERIOD}`, "GET");
      expect(exp.status).toBe(200);
      expect(exp.headers.get("content-type")).toContain("text/csv");
      const del = await request(`/api/payments/${(await request(`/api/rent-charges/${chargeId}/payments`, "GET")).body.payments[0].id}`, "DELETE");
      expect(del.status).toBe(200);
    });
  });
});