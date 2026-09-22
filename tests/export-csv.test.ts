import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { TestEnv } from "./helpers/d1";
import { createTestEnv } from "./helpers/d1";
import { call } from "./helpers/api";
import app from "../src/server/index";
import { resetSeedForTests } from "../src/server/index";

let env: TestEnv;

beforeEach(() => {
  env = createTestEnv();
  resetSeedForTests();
});

function setupAuthDB(stub: TestEnv["DB"]): void {
  stub.exec(readFileSync(resolve(process.cwd(), "migrations/0003_auth_users.sql"), "utf8"));
}

async function callText(env: TestEnv, method: string, route: string, cookie?: string) {
  const init: RequestInit = { method };
  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;
  init.headers = headers;
  const res = await app.request(route, init, env);
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

async function getSessionCookie(env: TestEnv): Promise<string> {
  const bootstrap = await call(env, "POST", "/api/auth/bootstrap", {
    email: "owner@example.com",
    password: "securepass123",
    display_name: "Owner",
  });
  if (bootstrap.status !== 201) throw new Error("Bootstrap failed in test helper");
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@example.com", password: "securepass123" }),
  };
  const res = await app.request("/api/auth/login", init, env);
  const setCookie = res.headers.get("set-cookie") || "";
  const token = setCookie.match(/session_token=([^;]+)/)?.[1];
  if (!token) throw new Error("Login failed in test helper");
  return `session_token=${token}`;
}

async function enableAuth(env: TestEnv): Promise<void> {
  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('AUTH_ENABLED', 'true')").bind().run();
  const { resetAuthCache } = await import("../src/server/auth");
  resetAuthCache();
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  cells.push(current);
  return cells;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trimEnd().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

async function seedRentScenario(period: string): Promise<void> {
  const prop = await call<{ property: { id: number } }>(env, "POST", "/api/properties", {
    name: "Test Property",
    type: "single_family",
  });
  const unit = await call<{ unit: { id: number } }>(env, "POST", "/api/units", {
    property_id: prop.body.property.id,
    name: "A1",
    market_rent: 1200,
  });
  const tenant = await call<{ tenant: { id: number } }>(env, "POST", "/api/tenants", {
    first_name: "Ada",
    last_name: "Lovelace",
  });
  await call(env, "POST", "/api/leases", {
    unit_id: unit.body.unit.id,
    primary_tenant_id: tenant.body.tenant.id,
    start_date: "2026-01-01",
    end_date: "2027-12-31",
    monthly_rent: 1200,
    status: "active",
  });
  await call(env, "POST", "/api/rent-charges/generate", { period });
}

describe("CSV export", () => {
  describe("presence and methods", () => {
    it("GET /api/export/properties returns CSV", async () => {
      const res = await callText(env, "GET", "/api/export/properties");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/csv");
    });

    it("GET /api/export/tenants returns CSV", async () => {
      const res = await callText(env, "GET", "/api/export/tenants");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/csv");
    });

    it("GET /api/export/rent-ledger returns CSV", async () => {
      const res = await callText(env, "GET", "/api/export/rent-ledger?period=2026-05");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/csv");
    });

    it("does not expose mutating methods on export routes", async () => {
      const res = await callText(env, "POST", "/api/export/properties");
      expect(res.status).toBe(404);
    });
  });

  describe("rent ledger period validation", () => {
    it("requires a period", async () => {
      const res = await callText(env, "GET", "/api/export/rent-ledger");
      expect(res.status).toBe(400);
    });

    it("rejects an invalid period format", async () => {
      const res = await callText(env, "GET", "/api/export/rent-ledger?period=not-a-period");
      expect(res.status).toBe(400);
    });
  });

  describe("CSV structure", () => {
    it("rent ledger has stable column order", async () => {
      const res = await callText(env, "GET", "/api/export/rent-ledger?period=2026-05");
      const { headers } = parseCsv(res.text);
      expect(headers).toEqual([
        "period", "due_date", "property_id", "property_name", "unit_id", "unit_name",
        "tenant_id", "tenant_first_name", "tenant_last_name", "amount", "amount_paid",
        "balance", "status",
      ]);
    });

    it("tenants has stable column order", async () => {
      const res = await callText(env, "GET", "/api/export/tenants");
      const { headers } = parseCsv(res.text);
      expect(headers).toEqual([
        "id", "first_name", "last_name", "email", "phone", "active_property_name", "active_unit_name",
      ]);
    });

    it("properties has stable column order", async () => {
      const res = await callText(env, "GET", "/api/export/properties");
      const { headers } = parseCsv(res.text);
      expect(headers).toEqual([
        "id", "name", "type", "address", "commune", "wilaya", "country", "city", "state",
        "zip", "unit_count", "occupied_count",
      ]);
    });
  });

  describe("RFC-4180 quoting", () => {
    it("quotes values containing commas", async () => {
      await call(env, "POST", "/api/tenants", { first_name: "Ada, Jr.", last_name: "Lovelace" });
      const res = await callText(env, "GET", "/api/export/tenants");
      const { rows } = parseCsv(res.text);
      const row = rows.find((r) => r[1].includes("Ada"));
      expect(row?.[1]).toBe("Ada, Jr.");
    });

    it("quotes values containing double quotes", async () => {
      await call(env, "POST", "/api/properties", { name: 'The "Grand" Villa', type: "single_family" });
      const res = await callText(env, "GET", "/api/export/properties");
      const { rows } = parseCsv(res.text);
      const row = rows.find((r) => r[1].includes("Grand"));
      expect(row?.[1]).toBe('The "Grand" Villa');
    });

    it("returns a valid header-only CSV for an empty dataset", async () => {
      const res = await callText(env, "GET", "/api/export/rent-ledger?period=2020-01");
      const { headers, rows } = parseCsv(res.text);
      expect(headers).toHaveLength(13);
      expect(rows).toHaveLength(0);
      expect(res.text.trimEnd().split(/\r?\n/)).toHaveLength(1);
    });
  });

  describe("amount formatting", () => {
    it("renders DZD amounts as plain numbers without thousands separators", async () => {
      await seedRentScenario("2026-05");
      const res = await callText(env, "GET", "/api/export/rent-ledger?period=2026-05");
      const { rows } = parseCsv(res.text);
      expect(rows).toHaveLength(1);
      const amount = rows[0][9];
      expect(amount).toBe("1200");
      expect(amount).not.toContain(",");
    });
  });

  describe("rent period parity", () => {
    it("matches GET /api/rent-charges for the same period", async () => {
      await seedRentScenario("2026-05");
      const csvRes = await callText(env, "GET", "/api/export/rent-ledger?period=2026-05");
      const apiRes = await call<{ charges: Array<{ period: string; amount: number; amount_paid: number; status: string; due_date: string }> }>(
        env, "GET", "/api/rent-charges?period=2026-05",
      );
      const { rows } = parseCsv(csvRes.text);
      expect(rows.length).toBe(apiRes.body.charges.length);
      const api = apiRes.body.charges[0];
      const csv = rows[0];
      expect(csv[0]).toBe(api.period);
      expect(csv[3]).toBe("Test Property");
      expect(csv[9]).toBe(String(api.amount));
      expect(csv[10]).toBe(String(api.amount_paid));
      expect(csv[12]).toBe(api.status);
    });

    it("reflects overdue state after markOverdue refresh", async () => {
      await seedRentScenario("2025-05");
      // Move the charge's due date into the past so it becomes overdue on read.
      await env.DB.prepare("UPDATE rent_charges SET due_date = ? WHERE period = ?").bind("2025-05-01", "2025-05").run();
      const res = await callText(env, "GET", "/api/export/rent-ledger?period=2025-05");
      const { rows } = parseCsv(res.text);
      expect(rows[0][12]).toBe("overdue");
    });
  });

  describe("authorization", () => {
    it("rejects unauthenticated requests when auth is enabled", async () => {
      setupAuthDB(env.DB);
      await enableAuth(env);
      for (const route of [
        "/api/export/properties",
        "/api/export/tenants",
        "/api/export/rent-ledger?period=2026-05",
      ]) {
        const res = await callText(env, "GET", route);
        expect(res.status).toBe(401);
      }
    });

    it("allows authenticated requests when auth is enabled", async () => {
      setupAuthDB(env.DB);
      await enableAuth(env);
      const cookie = await getSessionCookie(env);
      const res = await callText(env, "GET", "/api/export/properties", cookie);
      expect(res.status).toBe(200);
    });
  });

  describe("response headers", () => {
    it("sets Content-Disposition with the requested filename", async () => {
      const res = await callText(env, "GET", "/api/export/properties?filename=my-properties.csv");
      const cd = res.headers.get("content-disposition");
      expect(cd).toContain("attachment");
      expect(cd).toContain("my-properties.csv");
    });
  });

  describe("content-disposition filename hardening", () => {
    it("preserves a normal localized filename", async () => {
      const res = await callText(env, "GET", "/api/export/rent-ledger?period=2026-05&filename=loyers-2026-05.csv");
      const cd = res.headers.get("content-disposition") || "";
      expect(cd).toContain('filename="loyers-2026-05.csv"');
      expect(cd).toContain("UTF-8''loyers-2026-05.csv");
    });

    it("escapes double quotes in the ASCII filename fallback", async () => {
      const res = await callText(env, "GET", "/api/export/properties?filename=a%22b.csv");
      const cd = res.headers.get("content-disposition") || "";
      expect(cd).toContain('filename="a\\"b.csv"');
      expect(cd).toContain("UTF-8''a%22b.csv");
    });

    it("escapes backslashes in the ASCII filename fallback", async () => {
      const res = await callText(env, "GET", "/api/export/properties?filename=a%5Cb.csv");
      const cd = res.headers.get("content-disposition") || "";
      expect(cd).toContain('filename="a\\\\b.csv"');
    });

    it("neutralizes CR/LF and other header-breaking control characters", async () => {
      const res = await callText(env, "GET", "/api/export/properties?filename=bad%0D%0A%01.csv");
      const cd = res.headers.get("content-disposition") || "";
      expect(cd).not.toContain("\r");
      expect(cd).not.toContain("\n");
      expect(cd).toContain("attachment;");
      expect(cd).toContain("bad___.csv");
    });

    it("keeps the RFC 5987 filename* encoding valid for Unicode localized names", async () => {
      const name = "إيجارات-2026-05.csv";
      const res = await callText(env, "GET", "/api/export/rent-ledger?period=2026-05&filename=" + encodeURIComponent(name));
      const cd = res.headers.get("content-disposition") || "";
      expect(cd).toMatch(/filename\*=UTF-8''[A-Za-z0-9\-._~%]+$/);
      // The whole header stays printable ASCII — no raw non-ASCII or control bytes.
      expect(cd).toMatch(/^[\x20-\x7e]+$/);
      // Non-ASCII characters in the ASCII fallback are neutralized to underscores.
      expect(cd).toContain('filename="_');
    });
  });
});
