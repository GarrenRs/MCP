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

interface LeaseRecord {
  id: number;
  unit_id: number;
  monthly_rent: number;
  rent_due_day: number;
  start_date: string;
  end_date: string;
}

async function createLease(overrides: Record<string, unknown> = {}): Promise<LeaseRecord> {
  const tenant = await call<{ tenant: { id: number } }>(env, "POST", "/api/tenants", {
    first_name: "Ada",
    last_name: "Lovelace",
  });
  const unit = await call<{ units: Array<{ id: number }> }>(env, "GET", "/api/units");
  const lease = await call<{ lease: LeaseRecord }>(env, "POST", "/api/leases", {
    unit_id: unit.body.units[0].id,
    primary_tenant_id: tenant.body.tenant.id,
    start_date: "2026-01-01",
    end_date: "2027-12-31",
    monthly_rent: 1200,
    rent_due_day: 1,
    status: "active",
    ...overrides,
  });
  return lease.body.lease;
}

async function generate(period: string) {
  return call<{ created: number; period: string }>(env, "POST", "/api/rent-charges/generate", { period });
}

async function chargesFor(period: string) {
  const res = await call<{ charges: Array<Record<string, unknown>> }>(env, "GET", `/api/rent-charges?period=${period}`);
  return res.body.charges;
}

describe("rent charge generation (integration)", () => {
  it("is idempotent per (lease, period)", async () => {
    const lease = await createLease();
    const first = await generate("2026-06");
    expect(first.body.created).toBe(1);

    const second = await generate("2026-06");
    expect(second.body.created).toBe(0);

    const charges = await chargesFor("2026-06");
    expect(charges).toHaveLength(1);
    expect(charges[0].lease_id).toBe(lease.id);
    expect(Number(charges[0].amount)).toBe(1200);
  });

  it("clamps the due day to 28 when a lease asks for day 31", async () => {
    const lease = await createLease({ rent_due_day: 31 });
    await generate("2026-06");

    const charges = await chargesFor("2026-06");
    expect(charges).toHaveLength(1);
    expect(charges[0].lease_id).toBe(lease.id);
    expect(charges[0].due_date).toBe("2026-06-28");
  });

  it("keeps the due day as-is when it fits within the month", async () => {
    await createLease({ rent_due_day: 15 });
    await generate("2026-06");

    const charges = await chargesFor("2026-06");
    expect(charges[0].due_date).toBe("2026-06-15");
  });

  it("skips leases that end before the period starts", async () => {
    await createLease({ end_date: "2026-05-01" });
    const result = await generate("2026-06");
    expect(result.body.created).toBe(0);
  });

  it("marks past-due open charges as overdue", async () => {
    // Start the lease well before "now"; charge period 2025-05 is already past due.
    await createLease({ start_date: "2025-01-01" });
    await generate("2025-05");

    const charges = await chargesFor("2025-05");
    expect(charges[0].status).toBe("overdue");
    expect(charges[0].due_date).toBe("2025-05-01");
  });
});

describe("settings defaults (integration)", () => {
  it("serves defaults even on a cold database", async () => {
    const res = await call<{ settings: Record<string, string> }>(env, "GET", "/api/settings");
    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({
      default_rent_due_day: "1",
      late_fee_amount: "50",
      late_fee_grace_days: "5",
      currency: "DZD",
    });
  });

  it("persists a setting override", async () => {
    const put = await call<{ settings: Record<string, string> }>(env, "PUT", "/api/settings", { currency: "EUR" });
    expect(put.body.settings.currency).toBe("EUR");
    const get = await call<{ settings: Record<string, string> }>(env, "GET", "/api/settings");
    expect(get.body.settings.currency).toBe("EUR");
  });
});