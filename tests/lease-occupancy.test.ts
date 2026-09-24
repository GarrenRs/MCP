import { beforeEach, describe, expect, it } from "vitest";
import type { TestEnv } from "./helpers/d1";
import { createTestEnv } from "./helpers/d1";
import { call } from "./helpers/api";
import { resetSeedForTests } from "../src/server/index";
import { applyDemoFixture } from "./helpers/demo-fixture";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

let env: TestEnv;

beforeEach(async () => {
  env = createTestEnv();
  const migration = readFileSync(resolve(process.cwd(), "migrations/0004_lease_unit_occupancy.sql"), "utf8");
  env.DB.exec(migration);
  resetSeedForTests();
  await applyDemoFixture(env);
});

interface LeaseRow {
  id: number;
  unit_id: number;
  start_date: string;
  end_date: string;
  status: string;
}

async function firstUnitId(): Promise<number> {
  const units = await call<{ units: Array<{ id: number }> }>(env, "GET", "/api/units");
  return units.body.units[0].id;
}

async function createLease(overrides: Record<string, unknown> = {}) {
  const unit_id = await firstUnitId();
  return call<{ lease: LeaseRow }>(env, "POST", "/api/leases", {
    unit_id,
    primary_tenant_id: null,
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    monthly_rent: 900,
    status: "active",
    ...overrides,
  });
}

async function unitStatus(unitId: number): Promise<string> {
  const res = await call<{ units: Array<{ id: number; status: string }> }>(env, "GET", "/api/units");
  return res.body.units.find((u) => u.id === unitId)?.status ?? "unknown";
}

describe("lease occupancy integrity (P9)", () => {
  it("rejects a lease whose period overlaps an active lease on the same unit", async () => {
    await createLease();
    const res = await createLease({ start_date: "2026-06-01", end_date: "2026-07-31" });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "lease_conflict" });
  });

  it("allows a lease that starts after the current one ends", async () => {
    await createLease();
    const res = await createLease({ start_date: "2027-01-01", end_date: "2027-12-31" });
    expect(res.status).toBe(201);
  });

  it("allows overlapping leases on different units", async () => {
    const units = await call<{ units: Array<{ id: number }> }>(env, "GET", "/api/units");
    const a = units.body.units[0].id;
    const b = units.body.units[1].id;

    const r1 = await call<{ lease: LeaseRow }>(env, "POST", "/api/leases", {
      unit_id: a, primary_tenant_id: null, start_date: "2026-01-01", end_date: "2026-12-31", monthly_rent: 900, status: "active",
    });
    const r2 = await call<{ lease: LeaseRow }>(env, "POST", "/api/leases", {
      unit_id: b, primary_tenant_id: null, start_date: "2026-06-01", end_date: "2026-12-31", monthly_rent: 1100, status: "active",
    });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
  });

  it("does not reject an update that only touches notes", async () => {
    const created = await createLease();
    const res = await call(
      env, "PUT", `/api/leases/${created.body.lease.id}`, { notes: "updated notes" },
    );
    expect(res.status).toBe(200);
  });

  it("marks the unit occupied for an active lease and vacant after delete", async () => {
    const created = await createLease();
    expect(await unitStatus(created.body.lease.unit_id)).toBe("occupied");

    const del = await call(env, "DELETE", `/api/leases/${created.body.lease.id}`);
    expect(del.status).toBe(200);
    expect(await unitStatus(created.body.lease.unit_id)).toBe("vacant");
  });

  it("keeps the unit status when a manual 'turnover' override exists", async () => {
    const created = await createLease();
    const unit = created.body.lease.unit_id;

    const api = await import("../src/server/finance");

    const res = await call(env, "PUT", `/api/units/${unit}`, { status: "turnover" });
    expect(res.status).toBe(200);

    // Reconciling (dashboard summary) must not clobber the manual status.
    await call(env, "GET", "/api/dashboard/summary");
    expect(await unitStatus(unit)).toBe("turnover");
  });
});
