import { beforeEach, describe, expect, it } from "vitest";
import type { TestEnv } from "./helpers/d1";
import { createTestEnv } from "./helpers/d1";
import { call } from "./helpers/api";
import { resetSeedForTests } from "../src/server/index";
import { applyDemoFixture } from "./helpers/demo-fixture";

let env: TestEnv;

beforeEach(async () => {
  env = createTestEnv();
  resetSeedForTests();
  await applyDemoFixture(env);
});

interface Lease { id: number }
interface Charge {
  id: number;
  period: string;
  due_date: string;
  amount: number;
  amount_paid: number;
  status: string;
}
interface Summary {
  overdue_total: number;
  overdue_count: number;
}

async function createLease(): Promise<Lease> {
  const tenant = await call<{ tenant: { id: number } }>(env, "POST", "/api/tenants", {
    first_name: "Ada", last_name: "Lovelace",
  });
  const unit = await call<{ units: Array<{ id: number }> }>(env, "GET", "/api/units");
  const lease = await call<{ lease: Lease }>(env, "POST", "/api/leases", {
    unit_id: unit.body.units[0].id,
    primary_tenant_id: tenant.body.tenant.id,
    start_date: "2026-01-01",
    end_date: "2027-12-31",
    monthly_rent: 1200,
    rent_due_day: 1,
    status: "active",
  });
  return lease.body.lease;
}

// Creates a charge that is already past due but whose stored status is still
// 'open' — i.e. stale — by inserting it directly (generation would have marked
// it overdue in the same call).
async function createStaleCharge(leaseId: number, overrides: Record<string, unknown> = {}): Promise<Charge> {
  const res = await call<{ charge: Charge }>(env, "POST", "/api/rent-charges", {
    lease_id: leaseId,
    period: "2025-05",
    due_date: "2025-05-15",
    amount: 1200,
    ...overrides,
  });
  return res.body.charge;
}

async function listCharges(query = ""): Promise<Charge[]> {
  const res = await call<{ charges: Charge[] }>(env, "GET", `/api/rent-charges${query}`);
  return res.body.charges;
}

async function summary(): Promise<Summary> {
  const res = await call<Summary>(env, "GET", "/api/dashboard/summary");
  expect(res.status).toBe(200);
  return res.body;
}

describe("overdue freshness (read-path refresh)", () => {
  it("marks a past-due open charge as overdue on GET /rent-charges", async () => {
    const lease = await createLease();
    const seeded = await createStaleCharge(lease.id);
    expect(seeded.status).toBe("open");

    const charges = await listCharges("?period=2025-05");
    expect(charges).toHaveLength(1);
    expect(charges[0].id).toBe(seeded.id);
    expect(charges[0].status).toBe("overdue");
    expect(charges[0].due_date).toBe("2025-05-15");
    expect(charges[0].amount_paid).toBe(0);
  });

  it("refreshes overdue state before computing the dashboard summary", async () => {
    const lease = await createLease();
    const charged = await createStaleCharge(lease.id);

    const s = await summary();
    expect(s.overdue_count).toBe(1);
    expect(Number(s.overdue_total)).toBe(1200);

    const charges = await listCharges();
    const stale = charges.find((c) => c.id === charged.id);
    expect(stale).toBeDefined();
    expect(stale!.status).toBe("overdue");
  });

  it("leaves paid charges paid", async () => {
    const lease = await createLease();
    const charged = await createStaleCharge(lease.id);

    await call(env, "POST", "/api/payments", { charge_id: charged.id, amount: 1200 });
    const afterPay = await listCharges("?period=2025-05");
    expect(afterPay[0].status).toBe("paid");

    const s = await summary();
    expect(s.overdue_count).toBe(0);
    expect(Number(s.overdue_total)).toBe(0);
  });

  it("leaves waived charges waived", async () => {
    const lease = await createLease();
    const charged = await createStaleCharge(lease.id);

    await call(env, "PUT", `/api/rent-charges/${charged.id}`, { status: "waived" });

    const charges = await listCharges("?period=2025-05");
    expect(charges[0].status).toBe("waived");

    const s = await summary();
    expect(s.overdue_count).toBe(0);
  });

  it("is idempotent across repeated reads", async () => {
    const lease = await createLease();
    const charged = await createStaleCharge(lease.id);

    const first = await listCharges();
    const second = await listCharges();
    const third = await listCharges();

    const rows = [first, second, third].map((list) => list.find((c) => c.id === charged.id)?.status);
    expect(rows).toEqual(["overdue", "overdue", "overdue"]);

    const s = await summary();
    expect(s.overdue_count).toBe(1);
  });

  it("keeps dashboard overdue counts consistent with the rent list", async () => {
    const lease = await createLease();
    await createStaleCharge(lease.id);

    const charges = await listCharges();
    const rentOverdue = charges.filter((c) => c.status === "overdue").length;
    const s = await summary();

    expect(s.overdue_count).toBe(rentOverdue);
    expect(s.overdue_count).toBe(1);
  });

  it("regression: preserves overdue through a partial payment and an amount edit", async () => {
    const lease = await createLease();
    const charged = await createStaleCharge(lease.id);

    await listCharges();
    expect((await listCharges("?period=2025-05"))[0].status).toBe("overdue");

    // A partial payment momentarily derives 'partial' from the payment sum; the
    // next read must re-assert 'overdue'.
    await call(env, "POST", "/api/payments", { charge_id: charged.id, amount: 500 });
    const afterPay = await listCharges("?period=2025-05");
    expect(afterPay[0].status).toBe("overdue");
    expect(afterPay[0].amount_paid).toBe(500);

    // Editing the amount also recomputes status; overdue must be preserved.
    const edited = await call<{ charge: Charge }>(env, "PUT", `/api/rent-charges/${charged.id}`, { amount: 1000 });
    expect(edited.body.charge.status).toBe("overdue");

    const afterEdit = await listCharges("?period=2025-05");
    expect(afterEdit[0].status).toBe("overdue");
    expect(afterEdit[0].amount).toBe(1000);
    expect(afterEdit[0].amount_paid).toBe(500);
  });
});