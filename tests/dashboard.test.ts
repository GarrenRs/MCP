import { beforeEach, describe, expect, it } from "vitest";
import type { TestEnv } from "./helpers/d1";
import { createTestEnv } from "./helpers/d1";
import { call } from "./helpers/api";
import { resetSeedForTests } from "../src/server/index";

let env: TestEnv;

beforeEach(() => {
  env = createTestEnv();
  resetSeedForTests();
});

interface Summary {
  period: string;
  properties: number;
  units: number;
  occupied: number;
  vacant: number;
  occupancy_rate: number;
  active_leases: number;
  month_outstanding: number;
  month_collected: number;
  overdue_total: number;
  overdue_count: number;
}

async function summary(): Promise<Summary> {
  const res = await call<Summary>(env, "GET", "/api/dashboard/summary");
  expect(res.status).toBe(200);
  return res.body;
}

async function createLease(overrides: Record<string, unknown> = {}) {
  const tenant = await call<{ tenant: { id: number } }>(env, "POST", "/api/tenants", {
    first_name: "Ada",
    last_name: "Lovelace",
  });
  const unit = await call<{ units: Array<{ id: number }> }>(env, "GET", "/api/units");
  const lease = await call<{ lease: { id: number } }>(env, "POST", "/api/leases", {
    unit_id: unit.body.units[0].id,
    primary_tenant_id: tenant.body.tenant.id,
    start_date: "2026-01-01",
    end_date: "2027-12-31",
    monthly_rent: 1200,
    rent_due_day: 15,
    status: "active",
    ...overrides,
  });
  return lease.body.lease;
}

describe("dashboard summary (integration)", () => {
  it("reflects the seeded demo fixture", async () => {
    const s = await summary();
    expect(s.properties).toBe(3);
    expect(s.units).toBe(5);
    expect(s.occupied).toBe(4);
    expect(s.vacant).toBe(1);
    expect(s.occupancy_rate).toBe(80);
  });

  it("reflects an active lease in the current month's totals", async () => {
    await createLease();
    const current = new Date().toISOString().slice(0, 7);
    await call(env, "POST", "/api/rent-charges/generate", { period: current });

    const before = await summary();
    expect(before.active_leases).toBe(1);
    expect(Number(before.month_outstanding)).toBeGreaterThanOrEqual(1200);
    expect(Number(before.month_collected)).toBe(0);
  });

  it("counts collected and outstanding after a payment", async () => {
    const current = new Date().toISOString().slice(0, 7);
    await createLease();
    await call(env, "POST", "/api/rent-charges/generate", { period: current });

    const charges = await call<{ charges: Array<{ id: number }> }>(
      env,
      "GET",
      `/api/rent-charges?period=${current}`,
    );
    const charge = charges.body.charges[0];
    await call(env, "POST", "/api/payments", { charge_id: charge.id, amount: 1200 });

    const s = await summary();
    expect(Number(s.month_collected)).toBe(1200);
    expect(Number(s.month_outstanding)).toBe(0);
  });

  it("excludes waived charges from overdue totals", async () => {
    // A past period charge that is definitely past due.
    await createLease({ start_date: "2024-01-01" });
    await call(env, "POST", "/api/rent-charges/generate", { period: "2024-01" });

    const withOverdue = await summary();
    expect(withOverdue.overdue_count).toBe(1);
    expect(Number(withOverdue.overdue_total)).toBe(1200);

    // Waive it; it must leave the overdue totals.
    const charges = await call<{ charges: Array<{ id: number }> }>(
      env,
      "GET",
      "/api/rent-charges?period=2024-01",
    );
    await call(env, "PUT", `/api/rent-charges/${charges.body.charges[0].id}`, { status: "waived" });

    const after = await summary();
    expect(after.overdue_count).toBe(0);
    expect(Number(after.overdue_total)).toBe(0);
  });

  it("reports a clean sheet on an empty period", async () => {
    const s = await summary();
    expect(Number(s.month_outstanding)).toBe(0);
    expect(Number(s.month_collected)).toBe(0);
    expect(Number(s.overdue_total)).toBe(0);
  });
});